import "server-only";

import { withTransaction } from "./pool";
import { DEFAULT_CLIENT_ID, resetWorkspace, storedPipelineStatus } from "./workspace";
import { DEMO_TODAY } from "@/lib/demo";
import { PIPELINE_STATUSES, type PipelineStatus } from "@/lib/status";
import {
  putAsset,
  removeAsset,
  type AcceptedUpload,
  type AssetKind,
} from "@/lib/storage/assets";

import type { PoolClient } from "pg";

/**
 * The portal's write layer.
 *
 * Deliberately not part of `selectors.ts`. Reads are a synchronous view over
 * one loaded snapshot; writes are transactional, validated and invalidating.
 * Keeping them in separate modules means no component can reach a write by
 * autocompleting its way through the read API, and the whole surface that can
 * change the database is one file long.
 *
 *   Page / component  ->  server action  ->  this module  ->  Postgres
 *
 * Nothing here is imported by a client component. `server-only` makes that a
 * build error rather than a review comment.
 *
 * Scope: the workspace, products, the workstream item, the action, and the
 * image any of products/brokers/retailers carries. Retailer, broker, contact,
 * meeting and opportunity writes do not otherwise exist yet, by design -- they
 * are the phases after this one.
 */

/* ── The edit ──────────────────────────────────────────────────────────── */

export interface WorkstreamItemEdit {
  /** lookup_item_status. */
  itemStatus: string;
  /** lookup_sample_status. Applied to the samples table, never to the item. */
  sampleStatus: string;
  /** The item's own planning text — not the tracked action's wording. */
  nextAction: string;
  nextActionDate: string;
  /** Present only when the item already has a tracked action to update. */
  action?: { status: string; due: string };
  /** Present only when it has none and the user asked for one to be created. */
  trackAsAction?: boolean;
  /** A new record every time. Existing feedback is never touched. */
  feedback?: {
    quote: string;
    theme: string;
    /** lookup_feedback_source. Required at entry — see 0004. */
    source: string;
    /** Required at entry, for the same reason. */
    occurredAt: string;
  };
}

export type FieldErrors = Record<string, string>;

export type WriteResult =
  | { ok: true; changed: string[] }
  | { ok: false; errors: FieldErrors };

/* ── Validation helpers ────────────────────────────────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string is not a real calendar date. Catches 2026-02-31. */
function notADate(value: string): boolean {
  if (!ISO_DATE.test(value)) return true;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  );
}

/**
 * Checks a value against a lookup table in the database, not against the
 * TypeScript constant.
 *
 * The two are meant to agree, and `must()` in the read layer fails loudly
 * when they do not. Validating the write against the database means a status
 * CLD adds by INSERT — which is the whole point of lookups rather than native
 * enums — is accepted without a redeploy, and a value the database has never
 * heard of is refused here rather than by a foreign key three statements later.
 *
 * `table` is only ever one of the literals below; no caller supplies it.
 */
async function inLookup(
  client: PoolClient,
  table:
    | "lookup_item_status"
    | "lookup_sample_status"
    | "lookup_action_status"
    | "lookup_feedback_source"
    | "lookup_readiness"
    | "lookup_broker_status"
    | "lookup_current_target"
    | "lookup_pipeline_status"
    | "lookup_tier"
    | "lookup_priority"
    | "lookup_fit"
    | "lookup_standing",
  value: string,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `select 1 from ${table} where value = $1`,
    [value],
  );
  return rowCount === 1;
}

/* ── Row shapes read inside the transaction ────────────────────────────── */

interface ItemRow {
  id: string;
  retailer_id: string;
  product_id: string;
  owner_id: string | null;
  broker_id: string | null;
  item_status: string;
  next_action: string | null;
  next_action_date: string | null;
}

interface SampleRow {
  id: string;
  status: string;
}

interface ActionRow {
  id: string;
  label: string;
  status: string;
  due: string | null;
  owner_id: string;
}

/** The status that means a second physical round, never an overwrite (0007). */
const SECOND_ROUND = "Additional samples requested";

/**
 * The rule 0005 deliberately left to the write path: Done means a completion
 * time, and moving off Done clears it rather than leaving a stale one.
 *
 * A constraint could not express this in the schema, because act-01 is already
 * Done and nothing records when it was finished -- a NOT NULL there would have
 * forced a fabricated date onto a historical row. Here the moment is real: it
 * is the moment someone marked it done.
 *
 * Written once and used by both write paths, so the two can never disagree
 * about what Done means.
 */
const completedAtRule = (statusParam: string) =>
  `completed_at = case when ${statusParam} = 'Done' then coalesce(completed_at, now())
                        else null end`;

/** A broker who can own work on this client's book, today. */
async function isOwner(client: PoolClient, brokerId: string, clientId: string) {
  const { rowCount } = await client.query(
    `select 1 from brokers where id = $1 and client_id = $2 and archived_at is null`,
    [brokerId, clientId],
  );
  return rowCount === 1;
}

/* ── The write ─────────────────────────────────────────────────────────── */

/**
 * Saves one workstream item, and whatever the edit implies about its sample,
 * its tracked action and the buyer's words.
 *
 * Everything happens in one transaction: an edit that changes a status and
 * records feedback either lands whole or does not land.
 *
 * Nothing is invented. No lifecycle date is stamped, no feedback date is
 * inferred, no action is created where one already exists, and no existing
 * feedback record is modified — the append-only trigger would refuse it, and
 * this path never asks.
 */
export async function saveWorkstreamItem(
  itemId: string,
  edit: WorkstreamItemEdit,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const errors: FieldErrors = {};
  const changed: string[] = [];

  const result = await withTransaction(async (client) => {
    /* -- 1. The item, and that it is this client's ---------------------- */
    /* The client scope is part of the WHERE clause, not a check after the
       fact: an id from another tenant simply does not resolve. FOR UPDATE
       holds the row for the transaction so two saves cannot interleave. */
    const { rows: itemRows } = await client.query<ItemRow>(
      `select w.id, w.retailer_id, w.product_id, w.owner_id, w.broker_id, w.item_status,
              w.next_action, w.next_action_date::text as next_action_date
         from workstream_items w
         join retailers r on r.id = w.retailer_id
        where w.id = $1 and r.client_id = $2 and w.archived_at is null
        for update of w`,
      [itemId, clientId],
    );

    const item = itemRows[0];
    if (!item) {
      errors.form =
        "That workstream item is not in this client's workspace. Nothing was saved.";
      return { ok: false as const, errors };
    }

    /* -- 2. Field validation, all of it, before anything is written ----- */

    if (!(await inLookup(client, "lookup_item_status", edit.itemStatus))) {
      errors.itemStatus = "Not a status the workbook defines.";
    }
    if (!(await inLookup(client, "lookup_sample_status", edit.sampleStatus))) {
      errors.sampleStatus = "Not a sample status the workbook defines.";
    }

    const nextAction = edit.nextAction.trim();
    if (!nextAction) {
      errors.nextAction = "Say what happens next on this item.";
    } else if (nextAction.length > 300) {
      errors.nextAction = "Keep the next step to a sentence.";
    }
    if (notADate(edit.nextActionDate)) {
      errors.nextActionDate = "Needs a real date.";
    }

    /* The tracked action, if the item has one. Same pointer rule the read
       layer uses: the soonest open action, else the soonest of any. */
    const { rows: actionRows } = await client.query<ActionRow>(
      `select id, label, status, due::text as due, owner_id
         from actions where workstream_item_id = $1`,
      [itemId],
    );
    const byDue = (a: ActionRow, b: ActionRow) =>
      (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31") ||
      a.id.localeCompare(b.id);
    const open = actionRows.filter((a) => a.status !== "Done");
    const tracked = [...(open.length ? open : actionRows)].sort(byDue)[0];

    if (edit.action) {
      if (!tracked) {
        /* The form was rendered against an item that had an action and the
           action has since gone. Refuse rather than create a replacement. */
        errors.form =
          "This item no longer has a tracked action. Reload the page and try again.";
      }
      if (!(await inLookup(client, "lookup_action_status", edit.action.status))) {
        errors.actionStatus = "Not an action status the portal uses.";
      }
      if (notADate(edit.action.due)) {
        errors.actionDue = "Needs a real date.";
      }
    }

    if (edit.trackAsAction && tracked) {
      /* Belt and braces: the form only offers this when no action exists.
         Creating one here would be the duplicate the phase forbids. */
      errors.form =
        "This item already has a tracked action, so a second one was not created.";
    }

    let owner: string | null = null;
    if (edit.trackAsAction && !tracked) {
      owner = item.owner_id ?? item.broker_id;
      if (!owner) {
        errors.trackAsAction =
          "This item has no owner, so there is nobody to give the action to.";
      } else if (!(await isOwner(client, owner, clientId))) {
        errors.trackAsAction =
          "The item's owner is not an active broker on this client.";
      }
    }

    if (edit.feedback) {
      const quote = edit.feedback.quote.trim();
      if (!quote) {
        errors.feedbackQuote = "Feedback needs the buyer's actual words.";
      }
      if (!(await inLookup(client, "lookup_feedback_source", edit.feedback.source))) {
        errors.feedbackSource = "Say where this feedback came from.";
      }
      /* occurred_at and source are nullable in the schema only because seven
         historical records have no recorded date and inventing one would have
         been worse. At the point of entry both are required — the promise
         0004 makes, kept here. */
      if (notADate(edit.feedback.occurredAt)) {
        errors.feedbackDate = "Needs a real date.";
      } else if (edit.feedback.occurredAt > DEMO_TODAY) {
        errors.feedbackDate = "Feedback is something that has already been said.";
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false as const, errors };
    }

    /* -- 3. The item itself --------------------------------------------- */

    if (item.item_status !== edit.itemStatus) {
      changed.push(`item status → ${edit.itemStatus}`);
    }
    if (
      item.next_action !== nextAction ||
      item.next_action_date !== edit.nextActionDate
    ) {
      changed.push("next step");
    }

    await client.query(
      `update workstream_items
          set item_status = $1, next_action = $2, next_action_date = $3
        where id = $4`,
      [edit.itemStatus, nextAction, edit.nextActionDate, itemId],
    );

    /* -- 4. The sample -------------------------------------------------- */
    /*
     * Sample state lives in the samples table and is never derived from the
     * item's status. The row the portal displays is the furthest-along one,
     * so that is the row an edit corrects.
     *
     * No lifecycle date is written here. A status can be corrected months
     * after the fact, so stamping today's date onto sent_at or reviewed_at
     * would be recording a guess as a fact. Dates stay null until a screen
     * exists that asks for the real one.
     */
    const { rows: sampleRows } = await client.query<SampleRow>(
      `select s.id, s.status
         from samples s join lookup_sample_status l on l.value = s.status
        where s.workstream_item_id = $1
        order by l.sort_order desc, s.created_at desc, s.id desc`,
      [itemId],
    );
    const furthest = sampleRows[0];

    if (edit.sampleStatus !== (furthest?.status ?? "Not discussed")) {
      if (edit.sampleStatus === SECOND_ROUND) {
        /* A second round is a second physical send, so it is a second row.
           Reusing the first would erase what the first round achieved. */
        if (!sampleRows.some((s) => s.status === SECOND_ROUND)) {
          await client.query(
            `insert into samples (workstream_item_id, status) values ($1, $2)`,
            [itemId, edit.sampleStatus],
          );
          changed.push("a further sample round requested");
        }
      } else if (furthest) {
        await client.query(`update samples set status = $1 where id = $2`, [
          edit.sampleStatus,
          furthest.id,
        ]);
        changed.push(`sample → ${edit.sampleStatus}`);
      } else if (edit.sampleStatus !== "Not discussed") {
        /* First sample on this item. Status only: nothing knows when it was
           requested, prepared or sent. */
        await client.query(
          `insert into samples (workstream_item_id, status) values ($1, $2)`,
          [itemId, edit.sampleStatus],
        );
        changed.push(`sample → ${edit.sampleStatus}`);
      }
    }

    /* -- 5. The tracked action ------------------------------------------ */
    /*
     * The item's planning text and the action's label are different fields
     * written for different readers, and 0009 restored the first on exactly
     * that evidence. So an edit to the next step does not rewrite an action's
     * wording. What it can change is the operational state of the work:
     * status and due date, on the action that already exists.
     */
    if (edit.action && tracked) {
      if (tracked.status !== edit.action.status || tracked.due !== edit.action.due) {
        changed.push(
          tracked.status !== edit.action.status
            ? `${tracked.id} → ${edit.action.status}`
            : `${tracked.id} due ${edit.action.due}`,
        );
      }
      await client.query(
        `update actions set status = $1, due = $2, ${completedAtRule("$1")}
          where id = $3`,
        [edit.action.status, edit.action.due, tracked.id],
      );
    }

    if (edit.trackAsAction && !tracked && owner) {
      /* Ids stay in the readable act-NN series the rest of the data uses.
         Two simultaneous creations would collide on the primary key and the
         second transaction would fail loudly, which is the correct outcome
         for a prototype: nothing is silently renumbered. */
      const { rows: nextIdRows } = await client.query<{ next: string }>(
        `select 'act-' || lpad((coalesce(max(substring(id from 5)::integer), 0) + 1)::text, 2, '0') as next
           from actions where id ~ '^act-[0-9]+$'`,
      );
      await client.query(
        `insert into actions
           (id, retailer_id, owner_id, label, status, due, product_id, workstream_item_id,
            display_order)
         values ($1, $2, $3, $4, 'Open', $5, $6, $7,
                 (select coalesce(max(display_order), 0) + 1 from actions))`,
        [
          nextIdRows[0].next,
          item.retailer_id,
          owner,
          nextAction,
          edit.nextActionDate,
          item.product_id,
          itemId,
        ],
      );
      changed.push(`tracked as ${nextIdRows[0].next}`);
    }

    /* -- 6. Buyer feedback ---------------------------------------------- */
    /*
     * Always an insert. The append-only trigger on buyer_feedback would
     * refuse an update, and this path has no reason to attempt one: a buyer
     * saying something new does not unsay what they said before.
     *
     * recorded_by stays null. There is no authentication yet, so the portal
     * does not know who is typing, and attributing the record to the item's
     * owner would be a guess written into the history. Phase 7 supplies the
     * real answer.
     */
    if (edit.feedback) {
      await client.query(
        `insert into buyer_feedback
           (workstream_item_id, quote, theme, source, occurred_at)
         values ($1, $2, $3, $4, $5)`,
        [
          itemId,
          edit.feedback.quote.trim(),
          edit.feedback.theme.trim() || null,
          edit.feedback.source,
          edit.feedback.occurredAt,
        ],
      );
      changed.push("buyer feedback recorded");
    }

    return { ok: true as const, changed };
  });

  /* -- 7. The snapshot the read layer holds --------------------------- */
  /*
   * The workspace is cached per process for the life of the process, which
   * was correct while the portal was read-only and is exactly what a write
   * has to undo. Dropping it here — after the commit, never before — means
   * the next `loadWorkspace()` reads the database again.
   *
   * The route cache is Next's, not this layer's, so the server action
   * revalidates paths. Both are needed: one governs what the selectors see,
   * the other what a visitor is served.
   */
  if (result.ok) resetWorkspace(clientId);

  return result;
}

/* ── The action ────────────────────────────────────────────────────────── */

/**
 * What can be changed about a piece of work: where it stands, when it is due,
 * and whose it is.
 *
 * Nothing else. The retailer, the product and the workstream item are not in
 * this shape at all, so no relationship id ever arrives from the browser --
 * they cannot be reassigned by a crafted request because the write path has
 * nowhere to put them. The label is not here either: an action's wording is
 * what the shared list is read by, and rewriting it silently under someone
 * else's eyes is a different operation from working it.
 */
export interface ActionEdit {
  /** lookup_action_status. */
  status: string;
  due: string;
  /** A broker on this client's book. Verified, never trusted. */
  ownerId: string;
}

/**
 * Saves one action.
 *
 * The relationships that define it -- retailer, product, workstream item,
 * meeting -- are read to confirm they still resolve inside this client, and
 * then left exactly as they are. `ws-01 -> act-01, act-02` survives every
 * edit here, because the key that expresses it is never written.
 */
export async function saveAction(
  actionId: string,
  edit: ActionEdit,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const errors: FieldErrors = {};
  const changed: string[] = [];

  const result = await withTransaction(async (client) => {
    /* -- 1. The action, and that it is this client's -------------------- */
    const { rows } = await client.query<{
      id: string; label: string; status: string; due: string | null;
      owner_id: string; retailer_id: string; product_id: string | null;
      workstream_item_id: string | null; meeting_id: string | null;
      completed_at: Date | null;
    }>(
      `select a.id, a.label, a.status, a.due::text as due, a.owner_id, a.retailer_id,
              a.product_id, a.workstream_item_id, a.meeting_id, a.completed_at
         from actions a
         join retailers r on r.id = a.retailer_id
        where a.id = $1 and r.client_id = $2
        for update of a`,
      [actionId, clientId],
    );

    const action = rows[0];
    if (!action) {
      /* Either it does not exist or it belongs to someone else. The message
         is the same on purpose: a difference here would confirm the id. */
      errors.form = "That action is not in this client's workspace. Nothing was saved.";
      return { ok: false as const, errors };
    }

    /* -- 2. Validation, all of it, before anything is written ----------- */

    if (!(await inLookup(client, "lookup_action_status", edit.status))) {
      errors.status = "Not an action status the portal uses.";
    }
    if (notADate(edit.due)) {
      errors.due = "Needs a real date.";
    }
    if (!(await isOwner(client, edit.ownerId, clientId))) {
      /* The one relationship this form can change, so the one it has to
         prove. An id belonging to another client's broker fails here. */
      errors.ownerId = "Not an active broker on this client's book.";
    }

    /* -- 3. The relationships that are preserved rather than written ---- */
    /*
     * Read back, not rewritten. If any of them no longer resolves inside this
     * client the action is not safe to operate on, and saying so is better
     * than writing a status onto a record whose context has moved.
     */
    if (action.product_id) {
      const { rowCount } = await client.query(
        `select 1 from products where id = $1 and client_id = $2`,
        [action.product_id, clientId],
      );
      if (rowCount !== 1) errors.form = "This action's product is no longer on this client's book.";
    }
    if (action.workstream_item_id) {
      const { rowCount } = await client.query(
        `select 1 from workstream_items w join retailers r on r.id = w.retailer_id
          where w.id = $1 and r.client_id = $2`,
        [action.workstream_item_id, clientId],
      );
      if (rowCount !== 1) errors.form = "This action's workstream item is no longer on this client's book.";
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false as const, errors };
    }

    /* -- 4. The write --------------------------------------------------- */

    if (action.status !== edit.status) changed.push(`status → ${edit.status}`);
    if (action.due !== edit.due) changed.push(`due ${edit.due}`);
    if (action.owner_id !== edit.ownerId) changed.push(`owner → ${edit.ownerId}`);

    await client.query(
      `update actions
          set status = $1, due = $2, owner_id = $3, ${completedAtRule("$1")}
        where id = $4`,
      [edit.status, edit.due, edit.ownerId, actionId],
    );

    /* Deliberately not written: retailer_id, product_id, workstream_item_id,
       meeting_id, label. No activity row either -- an edit is a change to
       operational state, not a thing that happened to the account, and
       inventing the history entry was the alternative. */

    return { ok: true as const, changed };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/* ── The workspace ─────────────────────────────────────────────────────── */

/**
 * Creating the workspace is the first write a fresh database ever takes.
 *
 * Everything in the portal hangs off a client row: products, brokers,
 * retailers and every record beneath them carry its id. So the portal cannot
 * show anything at all until one exists, and this is deliberately the only
 * thing the first-run screen can do — it is not client management, it is the
 * one row that makes the rest possible.
 *
 * The id comes from configuration rather than from the form. It is the tenant
 * key the whole read layer is scoped by, and a name typed into a box is the
 * wrong thing to key a database on.
 */
export interface WorkspaceDraft {
  name: string;
  workspace: string;
  category: string;
  tagline: string;
  /** Whether the records entered here are illustrative rather than real. */
  isDemo: boolean;
}

export async function createWorkspace(
  draft: WorkspaceDraft,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const errors: FieldErrors = {};

  const name = draft.name.trim();
  const workspace = draft.workspace.trim();

  if (!name) errors.name = "The client needs a name.";
  else if (name.length > 120) errors.name = "Keep the name short enough to sit in the sidebar.";
  if (!workspace) errors.workspace = "Name the workspace, e.g. “Retail Growth”.";
  else if (workspace.length > 80) errors.workspace = "Keep this to a couple of words.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const result = await withTransaction(async (client) => {
    const { rowCount } = await client.query(`select 1 from clients where id = $1`, [clientId]);
    if (rowCount) {
      /* Not an error worth a stack trace: two people opened the first-run
         screen and both pressed the button. */
      errors.form = "This workspace already exists. Reload to see it.";
      return { ok: false as const, errors };
    }

    await client.query(
      `insert into clients (id, name, workspace, tagline, category, is_demo)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        clientId,
        name,
        workspace,
        draft.tagline.trim() || null,
        draft.category.trim() || null,
        draft.isDemo,
      ],
    );
    return { ok: true as const, changed: [`workspace created for ${name}`] };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/* ── Products ──────────────────────────────────────────────────────────── */

/**
 * A product as the form describes it.
 *
 * Five fields are required because the database requires them. Everything
 * else is optional and arrives as a string from the form: an empty box means
 * "not known yet" and is stored as null, never as zero. CLD routinely opens a
 * conversation about an item long before a landed cost exists.
 */
export interface ProductDraft {
  name: string;
  itemId: string;
  category: string;
  readiness: string;
  packSize: string;
  positioning: string;
  upc: string;
  sourceNotes: string;
  fobCost: string;
  landedCost: string;
  suggestedRetail: string;
  moq: string;
  casePack: string;
  leadTimeDays: string;
}

/** A url-safe id derived from the name, matching the ids already in use. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** An empty box is an unknown value, not a zero. */
function optionalNumber(
  raw: string,
  field: string,
  errors: FieldErrors,
  { integer = false, max = 1_000_000 } = {},
): number | null {
  const value = raw.trim();
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors[field] = "Needs to be a number, or left blank.";
    return null;
  }
  if (parsed < 0) {
    errors[field] = "Cannot be negative.";
    return null;
  }
  if (parsed > max) {
    errors[field] = "That looks too large to be right.";
    return null;
  }
  if (integer && !Number.isInteger(parsed)) {
    errors[field] = "Needs to be a whole number.";
    return null;
  }
  return parsed;
}

const trimmed = (value: string) => (value.trim() ? value.trim() : null);

/** Shared by create and edit, so the two can never drift apart. */
async function validateProduct(
  client: PoolClient,
  draft: ProductDraft,
  clientId: string,
  /** The product being edited, so its own item number does not collide with itself. */
  existingId: string | null,
) {
  const errors: FieldErrors = {};

  const name = draft.name.trim();
  const itemId = draft.itemId.trim();
  const category = draft.category.trim();

  if (!name) errors.name = "A product needs a name.";
  else if (name.length > 120) errors.name = "Keep the name under 120 characters.";

  if (!itemId) errors.itemId = "The workbook item number identifies this item.";
  else if (itemId.length > 40) errors.itemId = "Keep the item number under 40 characters.";

  if (!category) errors.category = "Say which set this sits in.";
  else if (category.length > 80) errors.category = "Keep the category short.";

  if (!(await inLookup(client, "lookup_readiness", draft.readiness))) {
    errors.readiness = "Not a readiness state the workbook defines.";
  }

  const upc = draft.upc.trim();
  if (upc && !/^\d{8,14}$/.test(upc)) {
    errors.upc = "A UPC is 8 to 14 digits, or leave it blank.";
  }

  const values = {
    fobCost: optionalNumber(draft.fobCost, "fobCost", errors, { max: 100_000 }),
    landedCost: optionalNumber(draft.landedCost, "landedCost", errors, { max: 100_000 }),
    suggestedRetail: optionalNumber(draft.suggestedRetail, "suggestedRetail", errors, { max: 100_000 }),
    moq: optionalNumber(draft.moq, "moq", errors, { integer: true, max: 10_000_000 }),
    casePack: optionalNumber(draft.casePack, "casePack", errors, { integer: true, max: 10_000 }),
    leadTimeDays: optionalNumber(draft.leadTimeDays, "leadTimeDays", errors, { integer: true, max: 3650 }),
  };

  /* The database enforces this too. Catching it here names the field. */
  if (itemId) {
    const { rowCount } = await client.query(
      `select 1 from products
        where client_id = $1 and lower(item_id) = lower($2)
          and ($3::text is null or id <> $3)`,
      [clientId, itemId, existingId],
    );
    if (rowCount) errors.itemId = "Another product already carries this item number.";
  }

  return { errors, name, itemId, category, upc, values };
}

export interface CreateResult {
  ok: boolean;
  errors: FieldErrors;
  changed: string[];
  /** The new product's id, so the caller can navigate to it. */
  id?: string;
}

export async function createProduct(
  draft: ProductDraft,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<CreateResult> {
  const result = await withTransaction<CreateResult>(async (client) => {
    const { rowCount: hasClient } = await client.query(
      `select 1 from clients where id = $1`,
      [clientId],
    );
    if (!hasClient) {
      return {
        ok: false,
        changed: [],
        errors: { form: "This workspace has not been set up yet." },
      };
    }

    const { errors, name, itemId, category, upc, values } = await validateProduct(
      client,
      draft,
      clientId,
      null,
    );
    if (Object.keys(errors).length > 0) return { ok: false, changed: [], errors };

    /* The slug is the route segment, so it has to be unique. A second item
       with the same name becomes -2 rather than being refused: the name is
       not the identity here, the item number is. */
    const base = slugify(name) || "product";
    let id = base;
    for (let suffix = 2; suffix < 100; suffix++) {
      const { rowCount } = await client.query(`select 1 from products where id = $1`, [id]);
      if (!rowCount) break;
      id = `${base}-${suffix}`;
    }

    await client.query(
      `insert into products
         (id, client_id, item_id, name, category, pack_size, positioning,
          fob_cost, landed_cost, suggested_retail, moq, case_pack, lead_time_days,
          readiness, upc, source_notes, display_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               (select coalesce(max(display_order), 0) + 1
                  from products where client_id = $2))`,
      [
        id, clientId, itemId, name, category,
        trimmed(draft.packSize), trimmed(draft.positioning),
        values.fobCost, values.landedCost, values.suggestedRetail,
        values.moq, values.casePack, values.leadTimeDays,
        draft.readiness, upc || null, trimmed(draft.sourceNotes),
      ],
    );

    return { ok: true, errors: {}, changed: [`${name} added`], id };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

export async function updateProduct(
  productId: string,
  draft: ProductDraft,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const result = await withTransaction<WriteResult>(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select id from products
        where id = $1 and client_id = $2 and archived_at is null
        for update`,
      [productId, clientId],
    );
    if (!rows[0]) {
      return {
        ok: false,
        errors: { form: "That product is not on this client's range. Nothing was saved." },
      };
    }

    const { errors, name, itemId, category, upc, values } = await validateProduct(
      client,
      draft,
      clientId,
      productId,
    );
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    await client.query(
      `update products
          set item_id = $1, name = $2, category = $3, pack_size = $4, positioning = $5,
              fob_cost = $6, landed_cost = $7, suggested_retail = $8,
              moq = $9, case_pack = $10, lead_time_days = $11,
              readiness = $12, upc = $13, source_notes = $14
        where id = $15`,
      [
        itemId, name, category, trimmed(draft.packSize), trimmed(draft.positioning),
        values.fobCost, values.landedCost, values.suggestedRetail,
        values.moq, values.casePack, values.leadTimeDays,
        draft.readiness, upc || null, trimmed(draft.sourceNotes),
        productId,
      ],
    );

    /* The id is deliberately not regenerated when the name changes. It is the
       route segment and the key every workstream row points at; rewriting it
       would break links and orphan relationships to tidy a cosmetic detail. */
    return { ok: true, changed: [`${name} saved`] };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/**
 * Archive, never delete.
 *
 * A product accumulates relationships — workstream rows, samples, buyer
 * feedback, actions, opportunities — and a delete would either take them with
 * it or be refused by a foreign key. Archiving withdraws the item from the
 * working range and leaves every record that mentions it intact and true.
 */
export async function archiveProduct(
  productId: string,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const result = await withTransaction<WriteResult>(async (client) => {
    const { rows } = await client.query<{ name: string; archived_at: Date | null }>(
      `select name, archived_at from products
        where id = $1 and client_id = $2 for update`,
      [productId, clientId],
    );
    if (!rows[0]) {
      return {
        ok: false,
        errors: { form: "That product is not on this client's range." },
      };
    }
    if (rows[0].archived_at) return { ok: true, changed: [] };

    const [{ n }] = (
      await client.query<{ n: string }>(
        `select count(*)::text as n from workstream_items where product_id = $1`,
        [productId],
      )
    ).rows;

    await client.query(`update products set archived_at = now() where id = $1`, [productId]);

    return {
      ok: true,
      changed: [
        `${rows[0].name} archived` +
          (Number(n) > 0 ? ` — ${n} workstream record(s) keep their history` : ""),
      ],
    };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/* ── Brokers ───────────────────────────────────────────────────────────── */

export interface BrokerDraft {
  name: string;
  shortName: string;
  role: string;
  coverage: string;
  initials: string;
  email: string;
  phone: string;
}

/**
 * A new broker on this client's books.
 *
 * The people side of the workstream, and the reason it exists before
 * retailers: an account carries `assigned_broker_id`, so there has to be
 * somebody to assign it to. Nothing here can be reached from a retailer form.
 *
 * `status` is not in the draft. Every broker starts Active, and pausing one is
 * an edit — a decision taken later, about someone already on the books, not
 * something to answer while adding them.
 */
export async function createBroker(
  draft: BrokerDraft,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<CreateResult> {
  const result = await withTransaction<CreateResult>(async (client) => {
    const { rowCount: hasClient } = await client.query(
      `select 1 from clients where id = $1`,
      [clientId],
    );
    if (!hasClient) {
      return {
        ok: false,
        changed: [],
        errors: { form: "This workspace has not been set up yet." },
      };
    }

    const errors: FieldErrors = {};
    const name = draft.name.trim();
    const shortName = draft.shortName.trim();

    if (!name) errors.name = "A broker needs a name.";
    else if (name.length > 120) errors.name = "Keep the name under 120 characters.";

    if (!shortName) errors.shortName = "A short name is what tables and chips show.";
    else if (shortName.length > 40) errors.shortName = "Keep this to a word or two.";

    const email = draft.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "That does not look like an email address, or leave it blank.";
    }

    const initials = draft.initials.trim();
    if (initials && initials.length > 4) {
      errors.initials = "Two or three letters.";
    }

    /* The database enforces this too — unique (client_id, name). Catching it
       here names the field instead of surfacing a constraint violation. */
    if (name) {
      const { rowCount } = await client.query(
        `select 1 from brokers where client_id = $1 and lower(name) = lower($2)`,
        [clientId, name],
      );
      if (rowCount) errors.name = "A broker with this name is already on the books.";
    }

    if (Object.keys(errors).length > 0) return { ok: false, changed: [], errors };

    /* Same rule as products: the slug is the route segment, so a second
       broker with a clashing name becomes -2 rather than being refused. */
    const base = slugify(name) || "broker";
    let id = base;
    for (let suffix = 2; suffix < 100; suffix++) {
      const { rowCount } = await client.query(`select 1 from brokers where id = $1`, [id]);
      if (!rowCount) break;
      id = `${base}-${suffix}`;
    }

    await client.query(
      `insert into brokers
         (id, client_id, name, short_name, role, coverage, initials, email, phone,
          status, display_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active',
               (select coalesce(max(display_order), 0) + 1
                  from brokers where client_id = $2))`,
      [
        id, clientId, name, shortName,
        trimmed(draft.role), trimmed(draft.coverage), trimmed(initials),
        trimmed(email), trimmed(draft.phone),
      ],
    );

    return { ok: true, errors: {}, changed: [`${name} added`], id };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/* ── Retailers ─────────────────────────────────────────────────────────── */

export interface RetailerDraft {
  name: string;
  shortName: string;
  channel: string;
  currentTarget: string;
  pipelineStatus: string;
  standing: string;
  assignedBrokerId: string;
  tier: string;
  priority: string;
  fit: string;
}

/**
 * A new retail account.
 *
 * Every status value is checked against its own lookup table rather than
 * against a TypeScript constant, so the database stays the authority on what a
 * status may be.
 *
 * `pipelineStatus` carries one extra rule. The lookup holds sixteen values and
 * the application's vocabulary covers eleven of them; a row holding one of the
 * other five would make `loadWorkspace()` throw and take every screen down
 * with it — see `must()` in workspace.ts. So the value is checked against the
 * displayed vocabulary as well as the table, and stored in the workbook's
 * wording via `storedPipelineStatus`.
 */
export async function createRetailer(
  draft: RetailerDraft,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<CreateResult> {
  const result = await withTransaction<CreateResult>(async (client) => {
    const { rowCount: hasClient } = await client.query(
      `select 1 from clients where id = $1`,
      [clientId],
    );
    if (!hasClient) {
      return {
        ok: false,
        changed: [],
        errors: { form: "This workspace has not been set up yet." },
      };
    }

    const errors: FieldErrors = {};
    const name = draft.name.trim();
    const shortName = draft.shortName.trim();
    const channel = draft.channel.trim();

    if (!name) errors.name = "An account needs a name.";
    else if (name.length > 120) errors.name = "Keep the name under 120 characters.";

    if (!shortName) errors.shortName = "A short name is what tables and chips show.";
    else if (shortName.length > 40) errors.shortName = "Keep this to a word or two.";

    if (!channel) errors.channel = "Say what kind of retailer this is.";
    else if (channel.length > 60) errors.channel = "Keep the channel short.";

    /* Stored as the workbook words it, checked as the portal shows it. */
    const pipelineStatus = storedPipelineStatus(draft.pipelineStatus);
    if (!PIPELINE_STATUSES.includes(draft.pipelineStatus as PipelineStatus)) {
      errors.pipelineStatus = "Not a pipeline status this portal can display.";
    } else if (!(await inLookup(client, "lookup_pipeline_status", pipelineStatus))) {
      errors.pipelineStatus = "Not a pipeline status the workbook defines.";
    }

    if (!(await inLookup(client, "lookup_current_target", draft.currentTarget))) {
      errors.currentTarget = "Not a value the workbook defines.";
    }
    if (!(await inLookup(client, "lookup_standing", draft.standing))) {
      errors.standing = "Not a standing the workbook defines.";
    }

    /* Optional throughout: an account can be entered before any of this is
       known, and an empty select is a blank column rather than a guess. */
    const tier = trimmed(draft.tier);
    if (tier && !(await inLookup(client, "lookup_tier", tier))) {
      errors.tier = "Not a tier the workbook defines.";
    }
    const priority = trimmed(draft.priority);
    if (priority && !(await inLookup(client, "lookup_priority", priority))) {
      errors.priority = "Not a priority the workbook defines.";
    }
    const fit = trimmed(draft.fit);
    if (fit && !(await inLookup(client, "lookup_fit", fit))) {
      errors.fit = "Not a fit the workbook defines.";
    }

    /* Nullable, and checked against this client's own brokers — an account
       cannot be handed to somebody on another client's books. */
    const assignedBrokerId = trimmed(draft.assignedBrokerId);
    if (assignedBrokerId) {
      const { rowCount } = await client.query(
        `select 1 from brokers where id = $1 and client_id = $2 and archived_at is null`,
        [assignedBrokerId, clientId],
      );
      if (!rowCount) errors.assignedBrokerId = "That broker is not on this client's books.";
    }

    if (name) {
      const { rowCount } = await client.query(
        `select 1 from retailers where client_id = $1 and lower(name) = lower($2)`,
        [clientId, name],
      );
      if (rowCount) errors.name = "This account is already on the books.";
    }

    if (Object.keys(errors).length > 0) return { ok: false, changed: [], errors };

    const base = slugify(name) || "retailer";
    let id = base;
    for (let suffix = 2; suffix < 100; suffix++) {
      const { rowCount } = await client.query(`select 1 from retailers where id = $1`, [id]);
      if (!rowCount) break;
      id = `${base}-${suffix}`;
    }

    await client.query(
      `insert into retailers
         (id, client_id, name, short_name, channel, current_target, pipeline_status,
          standing, assigned_broker_id, tier, priority, fit, display_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               (select coalesce(max(display_order), 0) + 1
                  from retailers where client_id = $2))`,
      [
        id, clientId, name, shortName, channel,
        draft.currentTarget, pipelineStatus, draft.standing,
        assignedBrokerId, tier, priority, fit,
      ],
    );

    return { ok: true, errors: {}, changed: [`${name} added`], id };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/** The three fields that say where an account stands today. */
export interface RetailerStatusEdit {
  /** lookup_current_target. */
  currentTarget: string;
  /** lookup_pipeline_status, in the wording the portal displays. */
  pipelineStatus: string;
  /** lookup_standing. */
  standing: string;
}

/**
 * Moving an account along the pipeline.
 *
 * Deliberately three fields and no more. They are the ones that change as a
 * conversation progresses, they are all lookup-backed, and none of them
 * touches the account's identity — so this write cannot rename a record,
 * orphan a slug, break a unique constraint or disturb an uploaded logo.
 * Editing the rest of the account is a later, larger piece of work.
 *
 * The pipeline status is checked twice, against two different vocabularies,
 * because they genuinely differ. The lookup table holds sixteen values; the
 * portal knows how to render eleven. A row set to one of the other five would
 * be refused by `must()` in the read layer on the very next render and take
 * every screen down with it -- so a status this application cannot draw is
 * refused here, at the point where a person can still be told why.
 */
export async function updateRetailerStatus(
  retailerId: string,
  edit: RetailerStatusEdit,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<WriteResult> {
  const result = await withTransaction<WriteResult>(async (client) => {
    /* Scoped to the workspace and to a live record, and locked for the
       duration: the same shape updateProduct uses. An id belonging to another
       client, or to an archived account, finds nothing and is refused. */
    const { rows } = await client.query<{
      name: string;
      current_target: string;
      pipeline_status: string;
      standing: string;
    }>(
      `select name, current_target, pipeline_status, standing
         from retailers
        where id = $1 and client_id = $2 and archived_at is null
        for update`,
      [retailerId, clientId],
    );
    const existing = rows[0];
    if (!existing) {
      return {
        ok: false,
        errors: { form: "That account is not on this client's book. Nothing was saved." },
      };
    }

    const errors: FieldErrors = {};

    /* Stored as the workbook words it, checked as the portal shows it --
       the same two-step createRetailer uses, so the two paths cannot drift. */
    const pipelineStatus = storedPipelineStatus(edit.pipelineStatus);
    if (!PIPELINE_STATUSES.includes(edit.pipelineStatus as PipelineStatus)) {
      errors.pipelineStatus = "Not a pipeline status this portal can display.";
    } else if (!(await inLookup(client, "lookup_pipeline_status", pipelineStatus))) {
      errors.pipelineStatus = "Not a pipeline status the workbook defines.";
    }

    if (!(await inLookup(client, "lookup_current_target", edit.currentTarget))) {
      errors.currentTarget = "Not a value the workbook defines.";
    }
    if (!(await inLookup(client, "lookup_standing", edit.standing))) {
      errors.standing = "Not a standing the workbook defines.";
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    await client.query(
      `update retailers
          set current_target = $1, pipeline_status = $2, standing = $3
        where id = $4`,
      [edit.currentTarget, pipelineStatus, edit.standing, retailerId],
    );

    /* Reported field by field, and only what actually moved. Saving a form
       nobody changed says so rather than claiming a save that did nothing.
       The pipeline line is read back in the portal's own wording, because
       that is what the person on the page just chose. */
    const changed: string[] = [];
    if (existing.current_target !== edit.currentTarget) {
      changed.push(`Current / Target -> ${edit.currentTarget}`);
    }
    if (existing.pipeline_status !== pipelineStatus) {
      changed.push(`Pipeline status -> ${edit.pipelineStatus}`);
    }
    if (existing.standing !== edit.standing) {
      changed.push(`Standing -> ${edit.standing}`);
    }

    return {
      ok: true,
      changed: changed.length > 0 ? changed : ["Nothing changed"],
    };
  });

  if (result.ok) resetWorkspace(clientId);
  return result;
}

/* ── Images ────────────────────────────────────────────────────────────── */

/**
 * What a form said to do with a record's picture.
 *
 * Three states rather than a nullable path, because "no file in the request"
 * and "take the picture away" look identical in a FormData and mean opposite
 * things. An edit form that is submitted without touching the file input must
 * leave the existing image exactly where it is.
 */
export type ImageIntent =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; upload: AcceptedUpload };

/** The tables that can carry an image, fixed here so a table name is never
    assembled from anything a request could influence. */
const IMAGE_TABLE: Record<AssetKind, string> = {
  product: "products",
  broker: "brokers",
  retailer: "retailers",
};

export interface ImageResult {
  /** The change, in the words the form reports back. Empty if nothing moved. */
  changed: string[];
  /** Set when the record saved but its picture did not. */
  error?: string;
}

/**
 * Attaches, replaces or removes one record's image.
 *
 * Ordering is the whole of the design here, and it is chosen so that the two
 * stores can never disagree in the direction that hurts:
 *
 *   1. the bytes go to Storage first, under a brand-new random name
 *   2. the row is updated to point at them, in a transaction
 *   3. only then is the object the row used to point at deleted
 *
 * A failure at (1) leaves the record untouched. A failure at (2) leaves an
 * object nothing references, which `npm run db:storage` lists and which costs
 * nothing but space. A failure at (3) leaves the same kind of orphan. What
 * cannot happen at any step is a row pointing at a file that is not there —
 * which is the only one of these a person would ever see.
 *
 * Never called inside the caller's transaction: it holds no database
 * connection while it waits on the network.
 */
export async function setEntityImage(
  kind: AssetKind,
  ownerId: string,
  intent: ImageIntent,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<ImageResult> {
  if (intent.kind === "keep") return { changed: [] };

  const table = IMAGE_TABLE[kind];

  let uploaded: string | null = null;
  if (intent.kind === "replace") {
    try {
      uploaded = await putAsset(kind, ownerId, intent.upload);
    } catch (error) {
      /* The record itself is already saved and correct. Say what failed
         rather than pretending the whole save did. */
      return { changed: [], error: message(error) };
    }
  }

  let previous: string | null = null;
  try {
    previous = await withTransaction(async (client) => {
      const { rows } = await client.query<{ image_path: string | null }>(
        `select image_path from ${table} where id = $1 and client_id = $2 for update`,
        [ownerId, clientId],
      );
      if (!rows[0]) throw new Error("That record is not on this client's books.");

      await client.query(`update ${table} set image_path = $2 where id = $1`, [
        ownerId,
        uploaded,
      ]);
      return rows[0].image_path;
    });
  } catch (error) {
    /* The row did not change, so the object just uploaded is referenced by
       nothing. Take it back out rather than leaving it to be found later. */
    if (uploaded) await removeAsset(uploaded).catch(() => {});
    return { changed: [], error: message(error) };
  }

  /* The snapshot every page reads is now out of date by one image. */
  resetWorkspace(clientId);

  if (previous && previous !== uploaded) {
    /* Best effort, and deliberately after the commit. An object that outlives
       its reference is untidy; a reference that outlives its object is broken. */
    await removeAsset(previous).catch(() => {});
  }

  if (intent.kind === "remove") {
    return { changed: previous ? ["image removed"] : [] };
  }
  return { changed: [previous ? "image replaced" : "image added"] };
}

/** An error's sentence, without a stack and without anything secret. */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
