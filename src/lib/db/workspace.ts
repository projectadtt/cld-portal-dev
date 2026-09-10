import "server-only";

import { cache } from "react";

import { query } from "./pool";
import type {
  Action,
  BuyerFeedbackRecord,
  Contact,
  Meeting,
  Sample,
  Workspace,
} from "./types";
import type {
  Activity,
  Broker,
  BrokerId,
  Client,
  NotYetItem,
  Opportunity,
  OwnerId,
  Product,
  ProductId,
  Retailer,
  RetailerId,
  WorkstreamRecord,
} from "@/data/types";
import {
  ACTION_STATUSES,
  ACTIVITY_TYPES,
  CURRENT_TARGET_VALUES,
  FIT_LEVELS,
  isHeldMeeting,
  ITEM_STATUSES,
  MEETING_RECORD_STATUSES,
  MEETING_STATUSES,
  PIPELINE_STATUSES,
  PRIORITIES,
  RETAIL_READINESS,
  SAMPLE_STATUSES,
  STANDINGS,
  TIERS,
  type MeetingStatus,
  type SampleStatus,
} from "@/lib/status";

/**
 * Loads one client's entire workspace from the database.
 *
 * The portal is a read surface over a small dataset, so the whole workspace is
 * fetched in fifteen queries -- one per table -- and every selector then works
 * against that snapshot in memory. This is what keeps the selector layer free
 * of queries entirely, and why no page can produce an N+1: the query count for
 * a request is fifteen regardless of how many rows any screen renders.
 *
 * There is no static fallback anywhere in this file. If the database is
 * unreachable the load rejects and the page fails, which is the only way a
 * validation run can tell the two data sources apart.
 */

export const DEFAULT_CLIENT_ID = process.env.CLD_CLIENT_ID ?? "client";

/** Absent rather than invented: no contact has been recorded for the account. */
const NO_CONTACT = "To be identified";

/**
 * The single word the portal and the workbook disagree on.
 *
 * The workbook — and therefore the lookup table — says "waiting ON response".
 * The portal has displayed "waiting FOR response" since it was built. The
 * value is translated here, at the boundary, rather than either side being
 * changed quietly: which wording is canonical is a terminology decision for
 * CLD, and it shows on screen.
 *
 * Whichever way CLD decides, it is a one-line change. Adopt the workbook's
 * wording: delete this map and update PIPELINE_STATUSES in status.ts. Keep the
 * portal's: delete this map and update the lookup row instead. Until then the
 * map is the only place the two vocabularies meet, and nothing else in the
 * application needs to know.
 */
const PIPELINE_WORDING: Record<string, string> = {
  "Reached out - waiting on response": "Reached out - waiting for response",
};

/**
 * The same map, read the other way, for the write path.
 *
 * A form offers the wording the portal displays; the column stores the
 * workbook's. Inverting the one map here rather than writing a second one
 * keeps the promise made above: this is still the only place the two
 * vocabularies meet, in either direction.
 */
export function storedPipelineStatus(displayed: string): string {
  const pair = Object.entries(PIPELINE_WORDING).find(([, shown]) => shown === displayed);
  return pair ? pair[0] : displayed;
}

/* -- narrowing ---------------------------------------------------------- */

/**
 * A status the application does not know is an error, never a default.
 * Silently coercing it would let a database value the UI cannot render
 * disappear into a fallback, which is exactly what must not happen.
 */
function must<T extends string>(allowed: readonly T[], value: string, field: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(
    `${field}: the database holds "${value}", which the application's status ` +
      `vocabulary does not contain. Expected one of: ${allowed.join(" | ")}`,
  );
}

const maybe = <T extends string>(allowed: readonly T[], value: string | null, field: string) =>
  value === null ? undefined : must(allowed, value, field);

/* -- row shapes --------------------------------------------------------- */

type ClientRow = {
  id: string; name: string; workspace: string;
  tagline: string | null; category: string | null; is_demo: boolean;
};
type BrokerRow = {
  id: string; name: string; short_name: string;
  role: string | null; coverage: string | null;
  status: string; initials: string | null; image_path: string | null;
};
/* Every column the retailers table declares nullable is nullable here. The
   shape used to overstate what the table guarantees, and the mapping below
   cast straight through it, so a sparse account reached the renderer holding
   nulls in fields typed as present. Only what the table marks NOT NULL --
   id, name, short_name, channel, current_target, pipeline_status,
   categories -- is non-null. */
type RetailerRow = {
  id: string; name: string; short_name: string; channel: string;
  geography: string | null;
  assigned_broker_id: string | null; current_target: string; pipeline_status: string;
  tier: string | null; standing: string;
  priority: string | null; fit: string | null; categories: string[];
  approximate_doors: number | null;
  assumed_skus: number | null; units_per_store_week: string | null;
  last_contact: string | null;
  attention_reason: string | null; notes: string | null;
  next_meeting_status: string | null; next_meeting_at: string | null;
  next_action: string | null; next_action_date: string | null; image_path: string | null;
};
type ProductRow = {
  id: string; item_id: string; category: string; name: string;
  pack_size: string | null; positioning: string | null;
  fob_cost: string | null; landed_cost: string | null; suggested_retail: string | null;
  moq: number | null; case_pack: number | null; lead_time_days: number | null;
  readiness: string; upc: string | null; source_notes: string | null;
  image_path: string | null;
};
/* Same reading as RetailerRow above: only what workstream_items marks NOT NULL
   -- id, retailer_id, product_id, current_target, item_status -- is non-null.
   estimated_annual_units is a generated column over two nullable inputs, so
   Postgres yields NULL for it whenever either is missing. */
type WorkstreamRow = {
  id: string; retailer_id: string; broker_id: string | null; product_id: string;
  current_target: string; item_status: string; fit: string | null;
  requested_retail: string | null; quoted_cost: string | null; moq: number | null;
  estimated_doors: number | null; units_per_store_week: string | null;
  estimated_annual_units: number | null;
  next_action: string | null; next_action_date: string | null;
  owner_id: string | null; notes: string | null;
};
type ActionRow = {
  id: string; label: string; retailer_id: string; product_id: string | null;
  owner_id: string; due: string; status: string; workstream_item_id: string | null;
  meeting_id: string | null;
};
/* broker_id and summary are both nullable: the key is ON DELETE SET NULL, so
   removing a broker empties it on every meeting they ran, and a meeting can be
   on the book before anybody has written up what was said. */
type MeetingRow = {
  id: string; scheduled_on: string; title: string; retailer_id: string;
  broker_id: string | null; summary: string | null; decisions: string[];
  status: string;
};
type ActivityRow = {
  id: string; occurred_on: string; type: string; retailer_id: string;
  product_id: string | null; person_id: string; description: string;
};
type OpportunityRow = {
  id: string; title: string; type: string | null; signal: string | null;
  recommendation: string | null; confidence: string | null; recommended_action: string | null;
  status: string; deferral_reason: string | null;
};

/**
 * Runs the table reads one after another rather than concurrently.
 *
 * The whole workspace is loaded once per request, and serialising the reads
 * means the layer needs only a single connection to do it. That keeps it
 * honest on a small Supabase pool and lets it run against a local
 * single-connection server unchanged.
 */
async function series<T extends readonly unknown[]>(
  work: { [K in keyof T]: () => Promise<T[K]> },
): Promise<T> {
  const out: unknown[] = [];
  for (const run of work as readonly (() => Promise<unknown>)[]) out.push(await run());
  return out as unknown as T;
}

/* -- the load ----------------------------------------------------------- */

async function load(clientId: string): Promise<Workspace> {
  /* Dates are cast to text in SQL rather than parsed by the driver, so a
     stored 2026-09-07 can never shift a day through a timezone. */
  const [
    clientRows, brokerRows, retailerRows, productRows, workstreamRows,
    sampleRows, feedbackRows, contactRows, meetingRows, attendeeRows,
    actionRows, activityRows, opportunityRows, oppProductRows, oppRetailerRows,
  ] = await series([
    () => query<ClientRow>(
      `select id, name, workspace, tagline, category, is_demo from clients where id = $1`, [clientId]),
    () => query<BrokerRow>(
      `select id, name, short_name, role, coverage, status, initials, image_path
         from brokers where client_id = $1 and archived_at is null order by display_order, id`, [clientId]),
    () => query<RetailerRow>(
      `select id, name, short_name, channel, geography, assigned_broker_id, current_target,
              pipeline_status, tier, standing, priority, fit, categories, approximate_doors, assumed_skus,
              units_per_store_week, last_contact::text as last_contact, attention_reason, notes,
              next_meeting_status, next_meeting_at::text as next_meeting_at,
              next_action, next_action_date::text as next_action_date, image_path
         from retailers where client_id = $1 and archived_at is null order by display_order, id`, [clientId]),
    () => query<ProductRow>(
      `select id, item_id, category, name, pack_size, positioning, fob_cost, landed_cost,
              suggested_retail, moq, case_pack, lead_time_days, readiness, upc,
              source_notes, image_path
         from products where client_id = $1 and archived_at is null order by display_order, id`, [clientId]),
    () => query<WorkstreamRow>(
      `select w.id, w.retailer_id, w.broker_id, w.product_id, w.current_target, w.item_status,
              w.fit, w.requested_retail, w.quoted_cost, w.moq, w.estimated_doors,
              w.units_per_store_week, w.estimated_annual_units, w.owner_id, w.notes,
              w.next_action, w.next_action_date::text as next_action_date
         from workstream_items w
         join retailers r on r.id = w.retailer_id
        where r.client_id = $1 and w.archived_at is null order by w.display_order, w.id`, [clientId]),
    () => query<{ id: string; workstream_item_id: string; status: string; requested_at: string | null;
            prepared_at: string | null; sent_at: string | null; received_at: string | null;
            reviewed_at: string | null; quantity: number | null }>(
      `select s.id, s.workstream_item_id, s.status,
              s.requested_at::text as requested_at, s.prepared_at::text as prepared_at,
              s.sent_at::text as sent_at, s.received_at::text as received_at,
              s.reviewed_at::text as reviewed_at, s.quantity
         from samples s
         join workstream_items w on w.id = s.workstream_item_id
         join retailers r on r.id = w.retailer_id
        where r.client_id = $1
        order by s.created_at asc, s.id asc`, [clientId]),
    () => query<{ id: string; workstream_item_id: string; quote: string; theme: string | null;
            sentiment: string | null; source: string | null; occurred_at: string | null;
            recorded_by: string | null; meeting_id: string | null }>(
      `select f.id, f.workstream_item_id, f.quote, f.theme, f.sentiment, f.source,
              f.occurred_at::text as occurred_at, f.recorded_by, f.meeting_id
         from buyer_feedback f
         join workstream_items w on w.id = f.workstream_item_id
         join retailers r on r.id = w.retailer_id
        where r.client_id = $1
        /* created_at before id: two things said on the same day are normal,
           and a random uuid would then decide which one counts as the last
           thing the buyer said. Insertion order is the real answer; id stays
           only so the sort is total. */
        order by f.occurred_at asc nulls first, f.created_at asc, f.id asc`, [clientId]),
    () => query<{ id: string; retailer_id: string; name: string; title: string | null; is_primary: boolean }>(
      `select c.id, c.retailer_id, c.name, c.title, c.is_primary
         from contacts c join retailers r on r.id = c.retailer_id
        where r.client_id = $1 and c.archived_at is null`, [clientId]),
    () => query<MeetingRow>(
      /* Every meeting, whatever became of it. This used to read only the
         completed ones, which meant a scheduled meeting could not be seen at
         all — the status was spent as a predicate and then thrown away.
         It is a field now, and the selectors decide what each screen shows. */
      `select m.id, (m.scheduled_at at time zone 'UTC')::date::text as scheduled_on, m.title,
              m.retailer_id, m.broker_id, m.summary, m.decisions, m.status
         from meetings m join retailers r on r.id = m.retailer_id
        where r.client_id = $1
        order by m.scheduled_at desc`, [clientId]),
    () => query<{ meeting_id: string; display_name: string }>(
      `select a.meeting_id, a.display_name
         from meeting_attendees a
         join meetings m on m.id = a.meeting_id
         join retailers r on r.id = m.retailer_id
        where r.client_id = $1 order by a.meeting_id, a.display_order`, [clientId]),
    () => query<ActionRow>(
      `select a.id, a.label, a.retailer_id, a.product_id, a.owner_id, a.due::text as due,
              a.status, a.workstream_item_id, a.meeting_id
         from actions a join retailers r on r.id = a.retailer_id
        where r.client_id = $1 order by a.display_order, a.id`, [clientId]),
    () => query<ActivityRow>(
      `select v.id, (v.occurred_at at time zone 'UTC')::date::text as occurred_on, v.type,
              v.retailer_id, v.product_id, v.person_id, v.description
         from activities v join retailers r on r.id = v.retailer_id
        where r.client_id = $1 order by v.occurred_at desc, v.id`, [clientId]),
    () => query<OpportunityRow>(
      `select id, title, type, signal, recommendation, confidence, recommended_action,
              status, deferral_reason
         from opportunities where client_id = $1 and archived_at is null order by display_order, id`, [clientId]),
    () => query<{ opportunity_id: string; product_id: string }>(
      `select p.opportunity_id, p.product_id from opportunity_products p
         join opportunities o on o.id = p.opportunity_id where o.client_id = $1`, [clientId]),
    () => query<{ opportunity_id: string; retailer_id: string }>(
      `select x.opportunity_id, x.retailer_id from opportunity_retailers x
         join opportunities o on o.id = x.opportunity_id where o.client_id = $1`, [clientId]),
  ]);

  /* -- master records --------------------------------------------------- */

  /* No client row is a legitimate state, not an error: it is what a fresh
     database looks like before anyone has set the workspace up. Every array
     below is then simply empty, and the portal renders its first-run screen. */
  const client: Client | null = clientRows[0]
    ? ({
        id: clientRows[0].id,
        name: clientRows[0].name,
        workspace: clientRows[0].workspace,
        tagline: clientRows[0].tagline ?? "",
        category: clientRows[0].category ?? "",
        isDemo: clientRows[0].is_demo,
      } as Client)
    : null;

  /* A null column becomes an absent field, never a zero. An item with no
     landed cost recorded has no landed cost — it does not cost nothing.
     Declared before the first mapping that needs them. */
  const num = (value: string | null) => (value === null ? undefined : Number(value));
  const text = (value: string | null) => value ?? undefined;

  const brokers: Broker[] = brokerRows.map((b) => ({
    id: b.id as BrokerId,
    name: b.name,
    shortName: b.short_name,
    role: text(b.role),
    coverage: text(b.coverage),
    status: b.status as Broker["status"],
    initials: text(b.initials),
    imagePath: b.image_path,
  }));

  const products: Product[] = productRows.map((p) => {
    const landed = num(p.landed_cost);
    const retail = num(p.suggested_retail);

    return {
      id: p.id as ProductId,
      itemId: p.item_id,
      category: p.category,
      name: p.name,
      packSize: text(p.pack_size),
      positioning: text(p.positioning),
      fobCost: num(p.fob_cost),
      landedCost: landed,
      suggestedRetail: retail,
      /* Derived, never stored: a copy is free to disagree with its own
         inputs. Absent unless both inputs are there to derive it from. */
      retailerMargin:
        landed !== undefined && retail !== undefined && retail > 0
          ? Math.round(((retail - landed) / retail) * 100) / 100
          : undefined,
      moq: p.moq ?? undefined,
      casePack: p.case_pack ?? undefined,
      leadTimeDays: p.lead_time_days ?? undefined,
      readiness: must(RETAIL_READINESS, p.readiness, `products.${p.id}.readiness`),
      upc: text(p.upc),
      sourceNotes: text(p.source_notes),
      imagePath: p.image_path,
    };
  });

  /* -- promoted records ------------------------------------------------- */

  const samples: Sample[] = sampleRows.map((s) => ({
    id: s.id,
    workstreamItemId: s.workstream_item_id,
    status: must(SAMPLE_STATUSES, s.status, `samples.${s.id}.status`),
    requestedAt: s.requested_at,
    preparedAt: s.prepared_at,
    sentAt: s.sent_at,
    receivedAt: s.received_at,
    reviewedAt: s.reviewed_at,
    quantity: s.quantity,
  }));

  const feedback: BuyerFeedbackRecord[] = feedbackRows.map((f) => ({
    id: f.id,
    workstreamItemId: f.workstream_item_id,
    quote: f.quote,
    theme: f.theme,
    sentiment: f.sentiment,
    source: f.source,
    occurredAt: f.occurred_at,
    recordedBy: f.recorded_by,
    meetingId: f.meeting_id,
  }));

  const contacts: Contact[] = contactRows.map((c) => ({
    id: c.id,
    retailerId: c.retailer_id,
    name: c.name,
    title: c.title,
    isPrimary: c.is_primary,
  }));

  /* -- actions, needed before the roll-ups that read them --------------- */

  const actions: Action[] = actionRows.map((a) => ({
    id: a.id,
    label: a.label,
    retailerId: a.retailer_id as RetailerId,
    productId: (a.product_id ?? undefined) as ProductId | undefined,
    ownerId: a.owner_id as OwnerId,
    due: a.due,
    status: must(ACTION_STATUSES, a.status, `actions.${a.id}.status`),
    workstreamItemId: a.workstream_item_id ?? undefined,
  }));

  const actionsByItem = new Map<string, ActionRow[]>();
  for (const a of actionRows) {
    if (!a.workstream_item_id) continue;
    const list = actionsByItem.get(a.workstream_item_id) ?? [];
    list.push(a);
    actionsByItem.set(a.workstream_item_id, list);
  }

  /* -- workstream items, with their children rolled up ------------------ */

  const samplesByItem = new Map<string, Sample[]>();
  for (const s of samples) {
    const list = samplesByItem.get(s.workstreamItemId) ?? [];
    list.push(s);
    samplesByItem.set(s.workstreamItemId, list);
  }

  const feedbackByItem = new Map<string, BuyerFeedbackRecord[]>();
  for (const f of feedback) {
    const list = feedbackByItem.get(f.workstreamItemId) ?? [];
    list.push(f);
    feedbackByItem.set(f.workstreamItemId, list);
  }

  /** Furthest along, by the workbook's own ordering of the nine values. */
  const furthestSample = (list: Sample[] | undefined): SampleStatus =>
    (list ?? []).reduce<SampleStatus>(
      (best, s) =>
        SAMPLE_STATUSES.indexOf(s.status) > SAMPLE_STATUSES.indexOf(best) ? s.status : best,
      "Not discussed",
    );

  const workstream: WorkstreamRecord[] = workstreamRows.map((w) => {
    /* The last thing the buyer said. The rest stay available as history --
       the single field this replaces could only ever hold one. */
    const latestFeedback = feedbackByItem.get(w.id)?.at(-1);

    /* Replaces WorkstreamRecord.actionId, which could hold one action and so
       already lost act-01 on ws-01. The pointer is now the soonest piece of
       open work; every action on the item stays reachable through actions. */
    const itemActions = actionsByItem.get(w.id) ?? [];
    const open = itemActions.filter((a) => a.status !== "Done");
    const pointer = [...(open.length ? open : itemActions)].sort((a, b) =>
      a.due.localeCompare(b.due) || a.id.localeCompare(b.id),
    )[0];

    return {
      id: w.id,
      retailerId: w.retailer_id as RetailerId,
      brokerId: (w.broker_id ?? undefined) as BrokerId | undefined,
      productId: w.product_id as ProductId,
      currentTarget: must(CURRENT_TARGET_VALUES, w.current_target, `workstream.${w.id}.currentTarget`),
      itemStatus: must(ITEM_STATUSES, w.item_status, `workstream.${w.id}.itemStatus`),
      sampleStatus: furthestSample(samplesByItem.get(w.id)),
      /* maybe, not must: the column is nullable, so NULL is "no view formed
         yet" rather than a value outside the vocabulary. A value the
         vocabulary does not contain is still an error. */
      fit: maybe(FIT_LEVELS, w.fit, `workstream.${w.id}.fit`),
      buyerFeedback: latestFeedback?.quote,
      feedbackTheme: latestFeedback?.theme ?? undefined,
      requestedRetail: w.requested_retail === null ? undefined : Number(w.requested_retail),
      quotedCost: w.quoted_cost === null ? undefined : Number(w.quoted_cost),
      moq: w.moq ?? undefined,
      estimatedDoors: w.estimated_doors ?? undefined,
      /* num(), not Number(): Number(null) is 0, which would turn an unrecorded
         velocity into a claim that the item sells nothing. */
      unitsPerStoreWeek: num(w.units_per_store_week),
      estimatedAnnualUnits: w.estimated_annual_units ?? undefined,
      nextAction: text(w.next_action),
      nextActionDate: text(w.next_action_date),
      ownerId: (w.owner_id ?? undefined) as OwnerId | undefined,
      actionId: pointer?.id,
      notes: text(w.notes),
    };
  });

  /* -- meetings --------------------------------------------------------- */

  const attendeesByMeeting = new Map<string, string[]>();
  for (const a of attendeeRows) {
    const list = attendeesByMeeting.get(a.meeting_id) ?? [];
    list.push(a.display_name);
    attendeesByMeeting.set(a.meeting_id, list);
  }

  const meetings: Meeting[] = meetingRows.map((m) => ({
    id: m.id,
    date: m.scheduled_on,
    title: m.title,
    retailerId: m.retailer_id as RetailerId,
    /* Absent, not a stand-in: the same treatment retailers.assigned_broker_id
       gets. A meeting whose broker has been removed names nobody rather than
       linking to a broker that is not there. */
    brokerId: (m.broker_id ?? undefined) as BrokerId | undefined,
    attendees: attendeesByMeeting.get(m.id) ?? [],
    summary: m.summary ?? undefined,
    decisions: m.decisions,
    /* must, not maybe: the column is NOT NULL with a default of Scheduled, and
       a value outside lookup_meeting_status is a fault worth hearing about. */
    status: must(MEETING_RECORD_STATUSES, m.status, `meetings.${m.id}.status`),
  }));

  /* -- retailers, last, because they roll up everything above ----------- */

  const itemsByRetailer = new Map<string, WorkstreamRecord[]>();
  for (const w of workstream) {
    const list = itemsByRetailer.get(w.retailerId) ?? [];
    list.push(w);
    itemsByRetailer.set(w.retailerId, list);
  }

  /* Held meetings only. The derivation below asks "has this account actually
     been met", and a meeting merely on the book is not an answer to that —
     now that the read no longer filters by status, the filter belongs here. */
  const meetingsByRetailer = new Map<string, Meeting[]>();
  for (const m of meetings) {
    if (!isHeldMeeting(m.status)) continue;
    const list = meetingsByRetailer.get(m.retailerId) ?? [];
    list.push(m);
    meetingsByRetailer.set(m.retailerId, list);
  }

  const primaryContact = new Map<string, Contact>();
  for (const c of contacts) if (c.isPrimary) primaryContact.set(c.retailerId, c);

  const retailers: Retailer[] = retailerRows.map((r) => {
    /* Historical meeting state comes from the meetings table; anything still
       ahead comes from the account. Holding both is what resolves the record
       that used to read "Requested" while a completed meeting existed. */
    const held = meetingsByRetailer.get(r.id) ?? [];
    const outlook = maybe(MEETING_STATUSES, r.next_meeting_status, `retailers.${r.id}.nextMeetingStatus`);
    const meetingStatus: MeetingStatus = outlook ?? (held.length ? "Completed" : "Not scheduled");
    const meetingDate = outlook ? (r.next_meeting_at ?? undefined) : held[0]?.date;

    return {
      id: r.id as RetailerId,
      name: r.name,
      shortName: r.short_name,
      channel: r.channel,
      geography: text(r.geography),
      currentTarget: must(CURRENT_TARGET_VALUES, r.current_target, `retailers.${r.id}.currentTarget`),
      /* maybe, not must: these columns are nullable, so NULL is a legitimate
         "no view recorded" rather than a value outside the vocabulary. A
         value the vocabulary does not contain is still an error. */
      tier: maybe(TIERS, r.tier, `retailers.${r.id}.tier`),
      /* must, not maybe: the column is NOT NULL with a default of Active. */
      standing: must(STANDINGS, r.standing, `retailers.${r.id}.standing`),
      priority: maybe(PRIORITIES, r.priority, `retailers.${r.id}.priority`),
      assignedBrokerId: (r.assigned_broker_id ?? undefined) as BrokerId | undefined,
      overallStatus: must(
        PIPELINE_STATUSES,
        PIPELINE_WORDING[r.pipeline_status] ?? r.pipeline_status,
        `retailers.${r.id}.pipelineStatus`,
      ),
      /* The one retailer field that genuinely is a roll-up. */
      sampleStatus: (itemsByRetailer.get(r.id) ?? []).reduce<SampleStatus>(
        (best, i) =>
          SAMPLE_STATUSES.indexOf(i.sampleStatus) > SAMPLE_STATUSES.indexOf(best) ? i.sampleStatus : best,
        "Not discussed",
      ),
      fit: maybe(FIT_LEVELS, r.fit, `retailers.${r.id}.fit`),
      categories: r.categories,
      approximateDoors: r.approximate_doors ?? undefined,
      assumedSkus: r.assumed_skus ?? undefined,
      unitsPerStoreWeek: num(r.units_per_store_week),
      buyerContact: primaryContact.get(r.id)?.name ?? NO_CONTACT,
      lastContact: r.last_contact ?? undefined,
      nextAction: text(r.next_action),
      nextActionDate: text(r.next_action_date),
      meetingStatus,
      meetingDate,
      notes: text(r.notes),
      attention: r.attention_reason ? { reason: r.attention_reason } : undefined,
      imagePath: r.image_path,
    };
  });

  /* -- activity and opportunities --------------------------------------- */

  const activities: Activity[] = activityRows.map((a) => ({
    id: a.id,
    date: a.occurred_on,
    type: must(ACTIVITY_TYPES, a.type, `activities.${a.id}.type`),
    retailerId: a.retailer_id as RetailerId,
    productId: (a.product_id ?? undefined) as ProductId | undefined,
    personId: a.person_id as OwnerId,
    description: a.description,
  }));

  const oppProducts = new Map<string, ProductId[]>();
  for (const row of oppProductRows) {
    const list = oppProducts.get(row.opportunity_id) ?? [];
    list.push(row.product_id as ProductId);
    oppProducts.set(row.opportunity_id, list);
  }
  const oppRetailers = new Map<string, RetailerId[]>();
  for (const row of oppRetailerRows) {
    const list = oppRetailers.get(row.opportunity_id) ?? [];
    list.push(row.retailer_id as RetailerId);
    oppRetailers.set(row.opportunity_id, list);
  }

  /* Deferred opportunities are the old notYet list. Same table, because a
     decision not to act belongs in the same register as a decision to act. */
  const active = opportunityRows.filter((o) => o.status === "Active");
  const deferred = opportunityRows.filter((o) => o.status === "Deferred");

  const opportunities: Opportunity[] = active.map((o) => ({
    id: o.id,
    title: o.title,
    type: o.type ?? "",
    productIds: oppProducts.get(o.id) ?? [],
    retailerIds: oppRetailers.get(o.id) ?? [],
    signal: o.signal ?? "",
    recommendation: o.recommendation ?? "",
    confidence: (o.confidence ?? "Medium") as Opportunity["confidence"],
    recommendedAction: o.recommended_action ?? "",
  }));

  const notYet: NotYetItem[] = deferred.map((o) => ({
    id: o.id,
    label: o.title,
    reason: o.deferral_reason ?? "",
  }));

  return {
    clientId,
    client,
    brokers,
    retailers,
    products,
    workstream,
    actions,
    meetings,
    activities,
    opportunities,
    notYet,
    samples,
    feedback,
    contacts,
  };
}

/* -- request access ----------------------------------------------------- */

interface Snapshots {
  loaded: Map<string, Workspace>;
  loading: Map<string, Promise<Workspace>>;
}

/**
 * The snapshot store, scoped to one request.
 *
 * This used to be two module-level Maps held for the life of the process, and
 * that was the bug behind "the save worked but the page still shows the old
 * data". The write path did call revalidatePath, and Next did discard the
 * rendered output and render again — but the fresh render read the same
 * process-wide Map, which still held the workspace as it was before the write.
 * Restarting the server was the only thing that cleared it. Three symptoms,
 * one cause: the Overview stuck on its first-run screen after a workspace was
 * created, a new product missing from the list, and that product's own page
 * returning 404 because the detail selector could not find it either.
 *
 * A module-level cache also cannot be invalidated across processes. Next runs
 * server actions and renders in more than one worker, so even a reset that
 * fired correctly only ever cleared the copy belonging to whichever worker
 * happened to handle the action.
 *
 * React's `cache()` fixes both. It memoises per request: the layout, the page
 * and generateMetadata all share one load — which is what makes the selector
 * layer's synchronous `workspace()` possible — and nothing survives into the
 * next request. So a write is visible on the very next render, with no reset
 * to remember and nothing for two workers to disagree about.
 *
 * The cost is one load per dynamic request rather than one per process. If
 * that ever matters, the answer is Next's own data cache with a tag the write
 * path invalidates — not a global that shadows it.
 */
const requestSnapshots = cache((): Snapshots => ({
  loaded: new Map(),
  loading: new Map(),
}));

/**
 * Outside a request there is no React cache to scope to.
 *
 * The scripts under scripts/db call loadWorkspace() directly, outside any
 * request. In that case `cache()` does not memoise at all and would hand back
 * a new store on every call, so `workspace()` would never find what
 * `loadWorkspace()` had just put away. This module-level store is used only
 * then.
 */
const processSnapshots: Snapshots = { loaded: new Map(), loading: new Map() };

/**
 * Two calls, compared: inside a request React returns the identical object
 * both times; outside one it builds a new store each call. That difference is
 * the only reliable signal available, and it is checked rather than assumed.
 */
function snapshots(): Snapshots {
  try {
    const first = requestSnapshots();
    return requestSnapshots() === first ? first : processSnapshots;
  } catch {
    return processSnapshots;
  }
}

/**
 * Loads a client's workspace, once per request. Awaited by the root layout, so
 * every component below it can reach the snapshot synchronously.
 *
 * Keyed by client id, so two clients never share a snapshot.
 */
export function loadWorkspace(clientId: string = DEFAULT_CLIENT_ID): Promise<Workspace> {
  const { loaded, loading } = snapshots();

  const already = loading.get(clientId);
  if (already) return already;

  const pending = load(clientId).then((snapshot) => {
    loaded.set(clientId, snapshot);
    return snapshot;
  });
  /* A failed load must not be cached, or one blip would look exactly like a
     database with no rows for the rest of the request. */
  pending.catch(() => loading.delete(clientId));
  loading.set(clientId, pending);
  return pending;
}

/**
 * The loaded snapshot, synchronously.
 *
 * This is what lets the selector layer stay synchronous and unchanged in
 * shape. It throws rather than falling back to anything: if this ever fires,
 * a route reached a selector without the layout having loaded the workspace,
 * and the correct fix is an await, not a default.
 */
export function workspace(clientId: string = DEFAULT_CLIENT_ID): Workspace {
  const snapshot = snapshots().loaded.get(clientId);
  if (!snapshot) {
    throw new Error(
      `Workspace "${clientId}" has not been loaded. A route must await ` +
        `loadWorkspace() before any selector runs. There is no static fallback.`,
    );
  }
  return snapshot;
}

/**
 * Forget the snapshot loaded for this request.
 *
 * Since the store is request-scoped, this no longer has to reach across
 * requests or across workers — nothing survives a request to be stale later.
 * It still matters within one: a server action that writes and then reads,
 * directly or through a selector, must not be answered from the snapshot it
 * loaded before the write. The write path calls it for that reason, and the
 * scripts call it because theirs is the process-level store.
 */
export function resetWorkspace(clientId: string = DEFAULT_CLIENT_ID): void {
  const { loaded, loading } = snapshots();
  loaded.delete(clientId);
  loading.delete(clientId);
  /* A script may have loaded before a render ever ran; clear both. */
  processSnapshots.loaded.delete(clientId);
  processSnapshots.loading.delete(clientId);
}
