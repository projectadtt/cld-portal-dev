/**
 * Every derivation the screens need, in one place.
 *
 * Pages and components stay composition-only: they ask for a shaped result
 * and render it. Nothing here fetches, mutates, or reads the wall clock —
 * all relative dates are measured against DEMO_TODAY.
 *
 * If a number appears anywhere in the portal it is counted here from the
 * underlying data. No screen carries a figure of its own.
 */

import { DEMO_TODAY } from "@/lib/demo";
import { workspace } from "@/lib/db/workspace";
import type {
  Action,
  Activity,
  Broker,
  BuyerFeedbackRecord,
  BrokerId,
  Client,
  Meeting,
  NotYetItem,
  Opportunity,
  OwnerId,
  Product,
  ProductId,
  Retailer,
  RetailerId,
  Sample,
  Workspace,
  WorkstreamRecord,
} from "@/lib/db/types";
import {
  FIT_LEVELS,
  ITEM_STATUSES,
  PIPELINE_PHASES,
  isConversation,
  isHeldMeeting,
  isOpenAction,
  isApproved,
  isPitched,
  isPursued,
  isSampleWithRetailer,
  isUnderReview,
  pipelineAtLeast,
  pipelineIndex,
  pipelinePhase,
  type ActionStatus,
  type ActivityType,
  type ItemStatus,
  type MeetingStatus,
  type PipelinePhase,
  type PipelinePhaseId,
  type Fit,
  type PipelineStatus,
  type Priority,
} from "@/lib/status";

/**
 * What the portal calls an account nobody is carrying.
 *
 * One word, defined once, so the Overview, the pipeline table and the account
 * page cannot drift into saying it three different ways. It is a statement
 * about the record, not a stand-in broker: nothing links anywhere from it.
 */
export const UNASSIGNED = "Unassigned";

/**
 * What the portal calls a field nobody has filled in.
 *
 * Used where a label is already on screen and its value is missing — a
 * label/value row reads as broken with nothing beside it. Inline metadata
 * uses `meta()` instead and simply omits the absent part, and dense table
 * cells keep their existing em dash: three registers, one meaning, each
 * chosen so a sparse account does not shout about everything it lacks.
 */
export const NOT_RECORDED = "Not recorded";

/* ── Data source ───────────────────────────────────────────────────────── */

/**
 * Every record below comes from the database, through the workspace snapshot
 * the root layout loads once per client.
 *
 * There is no static import left in this file and no fallback of any kind. If
 * the snapshot is missing, `workspace()` throws — a page that renders is a
 * page that reached Postgres.
 *
 * The client is resolved by the workspace layer rather than named here, so
 * nothing in the selector layer knows or cares which client it is serving.
 */
const d = {
  get client() { return workspace().client; },
  get brokers() { return workspace().brokers; },
  get retailers() { return workspace().retailers; },
  get products() { return workspace().products; },
  get workstream() { return workspace().workstream; },
  get actions() { return workspace().actions; },
  get meetings() { return workspace().meetings; },
  get activities() { return workspace().activities; },
  get opportunities() { return workspace().opportunities; },
  get notYet() { return workspace().notYet; },
  get samples() { return workspace().samples; },
  get feedback() { return workspace().feedback; },
  get contacts() { return workspace().contacts; },
  get retailersById() { return index(workspace(), "retailers"); },
  get brokersById() { return index(workspace(), "brokers"); },
  get productsById() { return index(workspace(), "products"); },
};

/**
 * Id lookups, built once per snapshot rather than per call. Cheap, but these
 * are read inside render paths often enough that rebuilding them would be the
 * closest thing this layer has to an N+1.
 */
const indexes = new WeakMap<Workspace, Record<string, unknown>>();

function index<K extends "retailers" | "brokers" | "products">(
  ws: Workspace,
  key: K,
): Record<string, Workspace[K][number]> {
  let forSnapshot = indexes.get(ws);
  if (!forSnapshot) {
    forSnapshot = {};
    indexes.set(ws, forSnapshot);
  }
  forSnapshot[key] ??= Object.fromEntries(
    (ws[key] as { id: string }[]).map((row) => [row.id, row]),
  );
  return forSnapshot[key] as Record<string, Workspace[K][number]>;
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Whole days since the epoch, parsed as UTC.
 *
 * Deliberately not local-time Date parsing: this keeps every relative label
 * identical on the server and in the browser regardless of timezone, and
 * avoids the off-by-one that local parsing of YYYY-MM-DD can produce.
 */
function toDayNumber(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

const TODAY = toDayNumber(DEMO_TODAY);

/** Signed days from DEMO_TODAY: negative is past, positive is future. */
export function daysFromToday(iso: string): number {
  return toDayNumber(iso) - TODAY;
}

/** "Sep 10" */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return MONTHS[month - 1] + " " + day;
}

/** "Sep 10, 2026" */
export function formatLongDate(iso: string): string {
  const [year] = iso.split("-").map(Number);
  return formatShortDate(iso) + ", " + year;
}

/** Past-leaning label: "Today", "Yesterday", "4 days ago", "Aug 26". */
export function formatRelativeDate(iso: string): string {
  const delta = daysFromToday(iso);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta < 0 && delta >= -6) return -delta + " days ago";
  if (delta === 1) return "Tomorrow";
  if (delta > 0 && delta <= 6) return "In " + delta + " days";
  return formatShortDate(iso);
}

/**
 * The relative label, or nothing when it would only repeat the date beside
 * it. Far-off dates fall back to the short date in formatRelativeDate, and a
 * row that prints "Sep 1, 2026" above "Sep 1" says nothing twice.
 */
export function relativeDateLabel(iso: string): string | undefined {
  const relative = formatRelativeDate(iso);
  return relative === formatShortDate(iso) ? undefined : relative;
}

/** Future-leaning label: "Today", "Tomorrow", "Sep 10". */
export function formatDueDate(iso: string): string {
  const delta = daysFromToday(iso);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  return formatShortDate(iso);
}

/** An action is overdue only while it is still outstanding. */
export function isActionOverdue(action: Action): boolean {
  return isOpenAction(action.status) && daysFromToday(action.due) < 0;
}

/* ── Sorting ───────────────────────────────────────────────────────────── */

/* ISO dates sort correctly as plain strings; id breaks ties deterministically. */
const byDateDesc = (
  a: { date: string; id: string },
  b: { date: string; id: string },
) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id);

const byDueAsc = (a: Action, b: Action) =>
  a.due.localeCompare(b.due) || a.id.localeCompare(b.id);

/* ── Lookups ───────────────────────────────────────────────────────────── */

export function getBroker(id: BrokerId): Broker {
  return d.brokersById[id];
}

export function getAllBrokers(): Broker[] {
  return d.brokers;
}

export function getProduct(id: ProductId): Product {
  return d.productsById[id];
}

export function getAllProducts(): Product[] {
  return d.products;
}

export function getAllRetailers(): Retailer[] {
  return d.retailers;
}

export function getRetailer(id: string): Retailer | null {
  return Object.prototype.hasOwnProperty.call(d.retailersById, id)
    ? d.retailersById[id as RetailerId]
    : null;
}

/** Retailer ids are compile-time checked, so this always resolves. */
/* An id with no row behind it is a stale link, not a crash. Both of these
   are used inside labels, where a thrown error would take a whole page down
   over one missing name. */
export function getRetailerName(id: RetailerId): string {
  return d.retailersById[id]?.name ?? "Unknown retailer";
}

/** Compact retailer label, for dense views such as the fit matrix. */
export function getRetailerShortName(id: RetailerId): string {
  return d.retailersById[id]?.shortName ?? "Unknown";
}

/**
 * The workspace's client. Named by the database, never by this layer.
 * Null until the workspace has been created.
 */
export function getClient(): Client | null {
  return d.client;
}

/**
 * What to call this workspace in a browser tab.
 *
 * Derived, not written into seven page files. Before a workspace exists the
 * portal still has a name of its own, which is what a first-run screen is
 * titled with.
 */
export function getWorkspaceLabel(): string {
  const client = d.client;
  return client ? client.workspace + " Workspace" : "Coffee, Lunch, Dinner";
}

/** "Products — Retail Growth Workspace", once there is a workspace to name. */
export function pageTitle(section: string): string {
  return section + " — " + getWorkspaceLabel();
}

/** Owners are brokers or the client themself. */
export function getOwnerName(ownerId: OwnerId | undefined): string {
  if (ownerId === undefined) return UNASSIGNED;
  if (ownerId === "client") return d.client?.name ?? "The client";
  return d.brokersById[ownerId]?.shortName ?? UNASSIGNED;
}

/**
 * Resolves the broker carrying an account, which may be nobody.
 *
 * assigned_broker_id is nullable and ON DELETE SET NULL, so an account can
 * legitimately have no broker — newly entered, or left behind when a broker
 * was removed. Every caller takes `Broker | undefined` and names the gap
 * rather than being handed a stand-in.
 */
function brokerFor(retailer: Retailer): Broker | undefined {
  return retailer.assignedBrokerId === undefined
    ? undefined
    : d.brokersById[retailer.assignedBrokerId];
}

/**
 * The same question asked of a meeting: who ran it, which may be nobody.
 *
 * meetings.broker_id is nullable for the same reason — ON DELETE SET NULL —
 * so a held meeting outlives the broker who held it.
 */
function brokerOf(meeting: Meeting): Broker | undefined {
  return meeting.brokerId === undefined
    ? undefined
    : d.brokersById[meeting.brokerId];
}

/**
 * Every retailer id. Not used by a route: the portal is cookie-gated, so no
 * detail page can be prerendered. Kept for scripts and future export work.
 */
export function getAllRetailerIds(): RetailerId[] {
  return d.retailers.map((r) => r.id);
}

/* ── Per-retailer derivation ───────────────────────────────────────────── */

/** A workstream record with its product resolved, for rendering. */
export interface ResolvedItem {
  record: WorkstreamRecord;
  product: Product;
}

export function getRetailerItems(retailerId: RetailerId): ResolvedItem[] {
  return d.workstream
    .filter((row) => row.retailerId === retailerId)
    .map((row) => ({ record: row, product: d.productsById[row.productId] }));
}

export function getRetailerActivities(retailerId: RetailerId): Activity[] {
  return d.activities.filter((a) => a.retailerId === retailerId).sort(byDateDesc);
}

export function getRetailerActions(retailerId: RetailerId): Action[] {
  return d.actions.filter((a) => a.retailerId === retailerId).sort(byDueAsc);
}

/**
 * Meetings actually held on this account, most recent first.
 *
 * Held, not every meeting: the notes panel, the account timeline and
 * `getLastMeeting` all ask what was said, and a meeting still on the book has
 * said nothing. The read layer now carries scheduled meetings too, so the
 * distinction is made here rather than in the query.
 */
export function getRetailerMeetings(retailerId: RetailerId): Meeting[] {
  return d.meetings
    .filter((m) => m.retailerId === retailerId && isHeldMeeting(m.status))
    .sort(byDateDesc);
}

/** A meeting flattened for the notes panel on the retailer page. */
export interface RetailerNote {
  id: string;
  date: string;
  title: string;
  /** Absent where the meeting records no broker. */
  authorId?: OwnerId;
  /** Absent where nothing was written up. */
  body?: string;
}

export function getRetailerNotes(retailerId: RetailerId): RetailerNote[] {
  return getRetailerMeetings(retailerId).map((m) => ({
    id: m.id,
    date: m.date,
    title: m.title,
    authorId: m.brokerId,
    body: m.summary,
  }));
}

/** The soonest action still outstanding — what happens next for this retailer. */
export function getNextAction(retailerId: RetailerId): Action | undefined {
  return getRetailerActions(retailerId).filter((a) =>
    isOpenAction(a.status),
  )[0];
}

export function getLastActivity(retailerId: RetailerId): Activity | undefined {
  return getRetailerActivities(retailerId)[0];
}

/** Most recent activity that was an actual exchange with the retailer. */
export function getLastConversation(
  retailerId: RetailerId,
): Activity | undefined {
  return getRetailerActivities(retailerId).find((a) => isConversation(a.type));
}

/* ── Overview metrics ──────────────────────────────────────────────────── */

export interface OverviewMetrics {
  activeBrokers: number;
  retailersInProgress: number;
  samplesSent: number;
  retailersInReview: number;
  buyerDiscussions: number;
}

/**
 * The five figures at the top of the Overview. Every one is counted from the
 * data — none is written down anywhere.
 */
export function getOverviewMetrics(): OverviewMetrics {
  const pursued = d.retailers.filter((r) => isPursued(r.currentTarget));

  return {
    activeBrokers: d.brokers.filter(
      (b) =>
        b.status === "Active" &&
        pursued.some((r) => r.assignedBrokerId === b.id),
    ).length,

    retailersInProgress: pursued.filter(
      (r) => r.overallStatus !== "Not reached out yet",
    ).length,

    /* Counted at SKU level: one retailer can have some items out and some not. */
    samplesSent: d.workstream.filter((row) =>
      isSampleWithRetailer(row.sampleStatus),
    ).length,

    retailersInReview: d.retailers.filter((r) =>
      pipelineAtLeast(r.overallStatus, "Samples sent"),
    ).length,

    buyerDiscussions: d.retailers.filter((r) =>
      pipelineAtLeast(r.overallStatus, "Meeting completed"),
    ).length,
  };
}

export interface FunnelStep {
  label: string;
  count: number;
}

/**
 * How far the book of accounts has travelled. Each step is a superset of the
 * one below it, so the shape always reads as a funnel.
 */
export function getProgressFunnel(): FunnelStep[] {
  const atLeast = (threshold: PipelineStatus) =>
    d.retailers.filter((r) => pipelineAtLeast(r.overallStatus, threshold)).length;

  return [
    {
      label: "Contacted",
      count: atLeast("Reached out - waiting for response"),
    },
    { label: "Buyer meeting", count: atLeast("Meeting completed") },
    { label: "Samples sent", count: atLeast("Samples sent") },
    { label: "Samples reviewed", count: atLeast("Samples reviewed") },
    { label: "Pricing", count: atLeast("Pricing requested") },
  ];
}

/* ── Attention ─────────────────────────────────────────────────────────── */

export interface AttentionSignal {
  retailer: Retailer;
  /** Absent while the account is unassigned. */
  broker?: Broker;
  /** What is actually wrong, in one line. */
  headline: string;
  nextAction?: Action;
  overdue: boolean;
  lastActivity?: Activity;
}

/**
 * An overdue account with no broker-written reason still needs a line that
 * says what is wrong. Describe the condition — how late, how quiet — rather
 * than restating the action, which is already shown under Next 3 moves.
 */
function describeOverdue(action: Action, lastActivity?: Activity): string {
  const daysLate = -daysFromToday(action.due);
  const late = daysLate === 1 ? "1 day overdue" : daysLate + " days overdue";
  return lastActivity
    ? "Follow-up is " +
        late +
        ". No contact since " +
        formatShortDate(lastActivity.date) +
        "."
    : "Follow-up is " + late + ".";
}

/**
 * What needs attention: retailers explicitly flagged, plus any retailer whose
 * next action has slipped past its due date.
 *
 * Overdue is derived, never stored — the action's own status stays Open.
 */
export function getAttentionSignals(): AttentionSignal[] {
  const signals: AttentionSignal[] = [];

  for (const retailer of d.retailers) {
    const nextAction = getNextAction(retailer.id);
    const overdue = nextAction ? isActionOverdue(nextAction) : false;
    const flagged = retailer.attention !== undefined;
    if (!flagged && !overdue) continue;

    signals.push({
      retailer,
      broker: brokerFor(retailer),
      headline:
        retailer.attention?.reason ??
        (overdue && nextAction
          ? describeOverdue(nextAction, getLastActivity(retailer.id))
          : (nextAction?.label ?? "")),
      nextAction,
      overdue,
      lastActivity: getLastActivity(retailer.id),
    });
  }

  /* Flagged accounts lead; an overdue date alone is a smaller signal than a
     broker saying the account is stuck. Within each, soonest due first. */
  return signals.sort((a, b) => {
    const flagA = a.retailer.attention ? 0 : 1;
    const flagB = b.retailer.attention ? 0 : 1;
    if (flagA !== flagB) return flagA - flagB;
    const dueA = a.nextAction?.due ?? "9999-12-31";
    const dueB = b.nextAction?.due ?? "9999-12-31";
    return (
      dueA.localeCompare(dueB) || a.retailer.name.localeCompare(b.retailer.name)
    );
  });
}

/* ── Workstream ────────────────────────────────────────────────────────── */

export interface WorkstreamRow {
  retailer: Retailer;
  /** Absent while the account is unassigned. */
  broker?: Broker;
  items: ResolvedItem[];
  itemCount: number;
  pitchedCount: number;
  feedback?: string;
  lastActivity?: Activity;
  nextAction?: Action;
}

/**
 * Broker to Retailer to Status to Sample to Items to Feedback to Next Action.
 * Furthest-along accounts lead; benchmark accounts fall last.
 */
export function getWorkstreamRows(brokerId?: BrokerId): WorkstreamRow[] {
  return d.retailers
    .filter((r) => brokerId === undefined || r.assignedBrokerId === brokerId)
    .map((retailer) => {
      const items = getRetailerItems(retailer.id);
      return {
        retailer,
        broker: brokerFor(retailer),
        items,
        itemCount: items.length,
        pitchedCount: items.filter((i) => isPitched(i.record.itemStatus))
          .length,
        feedback: items.find((i) => i.record.buyerFeedback)?.record
          .buyerFeedback,
        lastActivity: getLastActivity(retailer.id),
        nextAction: getNextAction(retailer.id),
      };
    })
    .sort(
      (a, b) =>
        pipelineIndex(b.retailer.overallStatus) -
          pipelineIndex(a.retailer.overallStatus) ||
        a.retailer.name.localeCompare(b.retailer.name),
    );
}

export interface WorkstreamGroup {
  /** Absent on the trailing group of accounts nobody is carrying. */
  broker?: Broker;
  rows: WorkstreamRow[];
}

/**
 * The same rows, grouped under their broker for the workstream screen.
 *
 * Accounts with no broker are collected into a final group rather than
 * dropped. Silently omitting them would hide exactly the thing the screen
 * exists to surface — work with nobody on it — and would let the workstream
 * and the pipeline table disagree about how many accounts there are.
 */
export function getWorkstreamGroups(brokerId?: BrokerId): WorkstreamGroup[] {
  const rows = getWorkstreamRows(brokerId);

  const groups: WorkstreamGroup[] = d.brokers
    .filter((broker) => brokerId === undefined || broker.id === brokerId)
    .map((broker) => ({
      broker,
      rows: rows.filter((row) => row.retailer.assignedBrokerId === broker.id),
    }));

  /* Only when the screen is not already filtered to one broker: an unassigned
     account is not part of any broker's book. */
  if (brokerId === undefined) {
    const unassigned = rows.filter(
      (row) => row.retailer.assignedBrokerId === undefined,
    );
    if (unassigned.length > 0) groups.push({ rows: unassigned });
  }

  return groups.filter((group) => group.rows.length > 0);
}

/** Broker coverage: who carries how much of the book. */
export interface BrokerCoverage {
  broker: Broker;
  retailers: number;
  items: number;
  openActions: number;
}

/* Reads off the broker portfolio so coverage and the Brokers screen can
   never report different numbers. Deliberately not sorted — the Overview
   lists d.brokers in their canonical order. */
export function getBrokerCoverage(): BrokerCoverage[] {
  return d.brokers.map(buildPortfolio).map((p) => ({
    broker: p.broker,
    retailers: p.accounts,
    items: p.items,
    openActions: p.openActions,
  }));
}

/* ── Retailer timeline ─────────────────────────────────────────────────── */

/**
 * One dated event on an account.
 *
 * The only sources are meetings, activities, and a meeting the retailer
 * record says is still on the books. Nothing is synthesised to make an
 * account's history look longer than the work behind it.
 */
export interface RetailerEvent {
  id: string;
  date: string;
  /** "Meeting", "Meeting scheduled", or the activity's own type. */
  label: string;
  headline: string;
  /** A meeting's summary. An activity carries its whole story in the headline. */
  detail?: string;
  decisions?: string[];
  personId?: OwnerId;
  /** Still ahead of DEMO_TODAY — the one forward-looking entry. */
  upcoming: boolean;
}

/**
 * The account's history, newest first, with anything still scheduled on top.
 *
 * A completed meeting already exists as a meeting record, so only a
 * "Scheduled" one is read off the retailer — that way nothing appears twice.
 */
export function getRetailerTimeline(retailerId: RetailerId): RetailerEvent[] {
  const retailer = d.retailersById[retailerId];
  if (!retailer) return [];

  const events: RetailerEvent[] = [];

  if (retailer.meetingStatus === "Scheduled" && retailer.meetingDate) {
    events.push({
      id: retailer.id + "-scheduled",
      date: retailer.meetingDate,
      label: "Meeting scheduled",
      headline: "Buyer meeting with " + retailer.buyerContact,
      personId: retailer.assignedBrokerId,
      upcoming: true,
    });
  }

  for (const meeting of getRetailerMeetings(retailerId)) {
    events.push({
      id: meeting.id,
      date: meeting.date,
      label: "Meeting",
      headline: meeting.title,
      detail: meeting.summary,
      decisions: meeting.decisions,
      personId: meeting.brokerId,
      upcoming: false,
    });
  }

  /* The same encounter is logged twice — once as an activity, once as the
     meeting itself. The meeting record carries the buyer's substance, so it
     supersedes an activity logged on the same day for the same account. */
  const heldOn = new Set(getRetailerMeetings(retailerId).map((m) => m.date));

  for (const activity of getRetailerActivities(retailerId)) {
    if (
      SUPERSEDED_BY_MEETING.includes(activity.type) &&
      heldOn.has(activity.date)
    ) {
      continue;
    }

    events.push({
      id: activity.id,
      date: activity.date,
      label: activity.type,
      headline: activity.description,
      personId: activity.personId,
      upcoming: false,
    });
  }

  return events.sort(byDateDesc);
}

/** Items the buyer has actually said something about. */
export function getRetailerFeedback(retailerId: RetailerId): ResolvedItem[] {
  return getRetailerItems(retailerId).filter(
    (item) => item.record.buyerFeedback,
  );
}

/** An item with the tracked action behind its next step resolved. */
export interface RetailerItemRow extends ResolvedItem {
  action?: Action;
  overdue: boolean;
}

/**
 * The account's Item x Retailer records, furthest along first, each carrying
 * the tracked action its next step is linked to where one exists.
 */
export function getRetailerItemRows(retailerId: RetailerId): RetailerItemRow[] {
  return getRetailerItems(retailerId)
    .map((item) => {
      const action = item.record.actionId
        ? d.actions.find((a) => a.id === item.record.actionId)
        : undefined;
      return {
        ...item,
        action,
        overdue: action ? isActionOverdue(action) : false,
      };
    })
    .sort(
      (a, b) =>
        ITEM_STATUSES.indexOf(b.record.itemStatus) -
          ITEM_STATUSES.indexOf(a.record.itemStatus) ||
        a.product.name.localeCompare(b.product.name),
    );
}

/* ── One workstream item ───────────────────────────────────────────────── */

/**
 * A single Item x Retailer record with everything attached to it.
 *
 * The shape the item workspace reads, and the first selector written for a
 * screen that writes as well as reads. Note what it returns: `actions` is a
 * list, and `feedback` is a list. Both were single fields on the static
 * record, and both lost information — ws-01 has two actions and can acquire
 * more feedback than one sentence can hold.
 */
export interface WorkstreamItemDetail {
  record: WorkstreamRecord;
  product: Product;
  retailer: Retailer;
  owner: string;
  /** Every action on this item, whatever its state. */
  actions: Action[];
  /** The one an edit acts on: soonest open, else soonest of any. */
  tracked?: Action;
  /** Every recorded thing the buyer said, oldest first. */
  feedback: BuyerFeedbackRecord[];
  /** One row per physical send. A second round is a second row. */
  samples: Sample[];
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getWorkstreamItem(itemId: string): WorkstreamItemDetail | null {
  const record = d.workstream.find((item) => item.id === itemId);
  if (!record) return null;

  const actions = d.actions.filter((action) => action.workstreamItemId === itemId);

  return {
    record,
    product: d.productsById[record.productId],
    retailer: d.retailersById[record.retailerId],
    owner: getOwnerName(record.ownerId),
    actions,
    tracked: actions.find((action) => action.id === record.actionId),
    feedback: d.feedback.filter((entry) => entry.workstreamItemId === itemId),
    samples: d.samples.filter((sample) => sample.workstreamItemId === itemId),
  };
}

/* ── Retailer detail ───────────────────────────────────────────────────── */

export interface RetailerDetail {
  retailer: Retailer;
  /** Absent while the account is unassigned. */
  broker?: Broker;
  items: ResolvedItem[];
  /** Items with their tracked action resolved, for the workstream section. */
  itemRows: RetailerItemRow[];
  /** Items the buyer has commented on, for the feedback section. */
  feedback: ResolvedItem[];
  activities: Activity[];
  meetings: Meeting[];
  /** Meetings and activities merged into one dated account history. */
  timeline: RetailerEvent[];
  actions: Action[];
  openActions: Action[];
  notes: RetailerNote[];
  nextAction?: Action;
  lastActivity?: Activity;
  lastConversation?: Activity;
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getRetailerDetail(id: string): RetailerDetail | null {
  const retailer = getRetailer(id);
  if (!retailer) return null;

  const retailerActions = getRetailerActions(retailer.id);
  return {
    retailer,
    broker: brokerFor(retailer),
    items: getRetailerItems(retailer.id),
    itemRows: getRetailerItemRows(retailer.id),
    feedback: getRetailerFeedback(retailer.id),
    activities: getRetailerActivities(retailer.id),
    meetings: getRetailerMeetings(retailer.id),
    timeline: getRetailerTimeline(retailer.id),
    actions: retailerActions,
    openActions: retailerActions.filter((a) => isOpenAction(a.status)),
    notes: getRetailerNotes(retailer.id),
    nextAction: getNextAction(retailer.id),
    lastActivity: getLastActivity(retailer.id),
    lastConversation: getLastConversation(retailer.id),
  };
}

/* ── Actions ───────────────────────────────────────────────────────────── */

/** How near a due date has to be before the work counts as due next. */
const DUE_NEXT_WINDOW = 7;

/** The account's most recent meeting. */
export function getLastMeeting(retailerId: RetailerId): Meeting | undefined {
  return getRetailerMeetings(retailerId)[0];
}

/**
 * One action with everything it points at resolved.
 *
 * Every relationship here is a real key on the record — retailer, product and
 * owner sit on the action, and the tracker row is found by the actionId the
 * tracker itself carries. The meeting is the one exception and is labelled as
 * such: the data records no link from a meeting to an action, so the account's
 * last conversation is offered as context, never as the action's cause.
 */
export interface ResolvedAction {
  action: Action;
  /** Absent when the client owns the action rather than a broker. */
  broker?: Broker;
  ownerName: string;
  retailer: Retailer;
  /** Every action currently names a product, but the key is optional. */
  product?: Product;
  /** The tracker row whose next step this action is. */
  record?: WorkstreamRecord;
  /** The account's most recent meeting — context, not causation. */
  lastMeeting?: Meeting;
  overdue: boolean;
  /** Signed days from DEMO_TODAY: negative is past, positive is future. */
  daysOut: number;
}

export function resolveAction(action: Action): ResolvedAction {
  return {
    action,
    broker: action.ownerId === "client" ? undefined : d.brokersById[action.ownerId],
    ownerName: getOwnerName(action.ownerId),
    retailer: d.retailersById[action.retailerId],
    product: action.productId ? d.productsById[action.productId] : undefined,
    /* The item this action belongs to, by its own foreign key. It used to be
       found by asking which item pointed back at this action, which meant a
       completed action resolved to nothing — act-01 lost its item to act-02
       for no reason other than that one slot could hold one id. */
    record: action.workstreamItemId
      ? d.workstream.find((w) => w.id === action.workstreamItemId)
      : undefined,
    lastMeeting: getLastMeeting(action.retailerId),
    overdue: isActionOverdue(action),
    daysOut: daysFromToday(action.due),
  };
}

/** Every action id — for the action workspace route. */
export function getAllActionIds(): string[] {
  return d.actions.map((a) => a.id);
}

/**
 * One action with everything around it, plus its siblings.
 *
 * `siblings` is the point: an item's actions are a list, and this returns the
 * others so the workspace can show that act-01 and act-02 are both still
 * there, independently, while one of them is being edited.
 */
export interface ActionDetail extends ResolvedAction {
  siblings: Action[];
  /** Who this work can be given to — this client's brokers, and only those. */
  owners: Broker[];
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getActionDetail(actionId: string): ActionDetail | null {
  const action = d.actions.find((a) => a.id === actionId);
  if (!action) return null;

  return {
    ...resolveAction(action),
    siblings: action.workstreamItemId
      ? d.actions.filter(
          (a) => a.workstreamItemId === action.workstreamItemId && a.id !== action.id,
        )
      : [],
    owners: d.brokers,
  };
}

export interface ActionFilter {
  ownerId?: OwnerId;
  retailerId?: RetailerId;
  status?: ActionStatus;
}

/**
 * The book of work in four figures, counted from the same ten records every
 * other screen reads. Nothing here is a rate, a trend, or a comparison —
 * there is no history in the data to compare against.
 */
export interface ActionMetrics {
  open: number;
  overdue: number;
  dueNext: number;
  blocked: number;
}

export function getActionMetrics(): ActionMetrics {
  const open = d.actions.filter((a) => isOpenAction(a.status));

  return {
    open: open.length,
    overdue: open.filter(isActionOverdue).length,
    dueNext: open.filter((a) => {
      const days = daysFromToday(a.due);
      return days >= 0 && days <= DUE_NEXT_WINDOW;
    }).length,
    blocked: d.actions.filter((a) => a.status === "Blocked").length,
  };
}

export type ActionGroupId =
  | "overdue"
  | "due-next"
  | "upcoming"
  | "no-date"
  | "completed";

export interface ActionGroup {
  id: ActionGroupId;
  label: string;
  description: string;
  actions: ResolvedAction[];
}

const GROUP_COPY: Record<ActionGroupId, { label: string; description: string }> =
  {
    overdue: {
      label: "Overdue",
      description: "Past its date and still outstanding.",
    },
    "due-next": {
      label: "Due next",
      description: "Landing within the week.",
    },
    upcoming: {
      label: "Upcoming",
      description: "Further out, but already owned and dated.",
    },
    "no-date": {
      label: "No date",
      description: "Owned, but nothing agreed about when.",
    },
    completed: {
      label: "Completed",
      description: "Done, and kept here so the account's record stays whole.",
    },
  };

const GROUP_ORDER: ActionGroupId[] = [
  "overdue",
  "due-next",
  "upcoming",
  "no-date",
  "completed",
];

/**
 * Which group an action belongs to.
 *
 * Overdue reuses isActionOverdue rather than comparing dates a second time,
 * so this screen and every other one agree about what is late. The no-date
 * group cannot populate while a due date is required on the record; it is
 * here because the eventual database will allow work to be owned before it is
 * dated, and that work must not silently vanish.
 */
function groupFor(row: ResolvedAction): ActionGroupId {
  if (!isOpenAction(row.action.status)) return "completed";
  if (row.overdue) return "overdue";
  if (!row.action.due) return "no-date";
  return row.daysOut <= DUE_NEXT_WINDOW ? "due-next" : "upcoming";
}

/**
 * Open work grouped by when it lands, soonest first inside each group.
 *
 * Empty groups are dropped rather than rendered as empty headings.
 */
export function getActionGroups(filter: ActionFilter = {}): ActionGroup[] {
  const matches = d.actions
    .filter(
      (a) =>
        (filter.ownerId === undefined || a.ownerId === filter.ownerId) &&
        (filter.retailerId === undefined || a.retailerId === filter.retailerId) &&
        (filter.status === undefined || a.status === filter.status),
    )
    .sort(byDueAsc)
    .map(resolveAction);

  return GROUP_ORDER.map((id) => ({
    id,
    ...GROUP_COPY[id],
    actions: matches.filter((row) => groupFor(row) === id),
  })).filter((group) => group.actions.length > 0);
}

/** Total actions a filter selection resolves to, for the count line. */
export function countActions(filter: ActionFilter = {}): number {
  return getActionGroups(filter).reduce(
    (total, group) => total + group.actions.length,
    0,
  );
}

/** Brokers who actually own work, for the owner filter. */
export function getActionOwners(): Broker[] {
  const owned = new Set(d.actions.map((a) => a.ownerId));
  return d.brokers.filter((b) => owned.has(b.id));
}

/** Accounts that actually carry work, for the retailer filter. */
export function getActionRetailers(): Retailer[] {
  const carried = new Set(d.actions.map((a) => a.retailerId));
  return d.retailers.filter((r) => carried.has(r.id));
}

/* ── Meetings ──────────────────────────────────────────────────────────── */

/**
 * Activity types that log the same encounter a meeting record already holds.
 *
 * The meeting carries the buyer's substance, so it supersedes an activity
 * filed on the same day for the same account. Shared by the retailer timeline
 * and the meeting page so both dedupe identically.
 */
const SUPERSEDED_BY_MEETING: readonly ActivityType[] = [
  "Meeting completed",
  "Call",
];

/**
 * Every meeting id. Not used by a route: the portal is cookie-gated, so no
 * detail page can be prerendered. Kept for scripts and future export work.
 */
export function getAllMeetingIds(): string[] {
  return d.meetings.map((m) => m.id);
}

/**
 * Every meeting held, most recent first — what the Past tab is.
 *
 * Completed only. A cancelled meeting was never held, so it is not a record of
 * anything that was said, and "Past meetings" is where the portal keeps what
 * was said. Nothing can reach that state through the portal yet; see the
 * cancellation workflow, which is deliberately not built.
 */
export function getMeetings(): Meeting[] {
  return d.meetings.filter((m) => isHeldMeeting(m.status)).sort(byDateDesc);
}

/**
 * Meetings on the book and not yet held — what the Upcoming tab is built from.
 *
 * Soonest first, and deliberately not filtered by date. A scheduled meeting
 * whose day has passed is still outstanding: nobody has written it up, and no
 * other list would show it, so excluding it would make the record vanish from
 * the portal entirely. It stays here until someone records what happened.
 */
export function getScheduledMeetings(): Meeting[] {
  return d.meetings
    .filter((m) => m.status === "Scheduled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getMeeting(id: string): Meeting | null {
  return d.meetings.find((m) => m.id === id) ?? null;
}

/**
 * What still has to happen after a meeting, counted off the tracked action
 * list for that account. A meeting with nothing outstanding is finished work.
 */
export interface MeetingFollowThrough {
  openActions: Action[];
  overdue: number;
}

function followThrough(retailerId: RetailerId): MeetingFollowThrough {
  const open = getRetailerActions(retailerId).filter((a) =>
    isOpenAction(a.status),
  );
  return { openActions: open, overdue: open.filter(isActionOverdue).length };
}

/** One meeting on the list, with the people and the account resolved. */
export interface MeetingSummary {
  meeting: Meeting;
  retailer: Retailer;
  /** Absent where the meeting records no broker. */
  broker?: Broker;
  followThrough: MeetingFollowThrough;
}

export function getMeetingSummaries(): MeetingSummary[] {
  return getMeetings().map((meeting) => ({
    meeting,
    retailer: d.retailersById[meeting.retailerId],
    broker: brokerOf(meeting),
    followThrough: followThrough(meeting.retailerId),
  }));
}

/**
 * A meeting that has not happened yet.
 *
 * Two sources, and the difference between them is real. A row carrying
 * `meeting` is an actual record on the book, scheduled through the portal and
 * openable. A row without one is the account's own planning field — an
 * intention recorded against the retailer, with no meeting behind it — which
 * is what this list was built from before meetings could be created at all.
 *
 * No date is inferred either way: an account that asked for a meeting without
 * fixing a day says exactly that.
 */
export interface UpcomingMeeting {
  retailer: Retailer;
  /** Absent while the account is unassigned. */
  broker?: Broker;
  status: MeetingStatus;
  /** Absent when a meeting has been requested but not yet dated. */
  date?: string;
  /** The last time this account was actually met — what to pick up from. */
  lastMeeting?: Meeting;
  /** Tracked work still outstanding going into it. */
  openActions: Action[];
  /** The record itself, where one exists. Absent for a planning-only row. */
  meeting?: Meeting;
}

const UPCOMING_STATUSES: readonly MeetingStatus[] = ["Scheduled", "Requested"];

/**
 * What is still to come: real scheduled meetings, then accounts whose only
 * plan is the retailer's own field.
 *
 * The planning fallback is kept rather than removed — `next_meeting_status`
 * and `next_meeting_at` are still in the schema and still read, so dropping
 * them here would be a silent behaviour change on a field this step is not
 * meant to touch. It is suppressed per account once a real meeting exists, so
 * the same conversation is never listed twice.
 *
 * Dated rows first, soonest first; undated requests after them.
 */
export function getUpcomingMeetings(): UpcomingMeeting[] {
  const scheduled = getScheduledMeetings();
  const booked = new Set(scheduled.map((m) => m.retailerId));

  const fromMeetings: UpcomingMeeting[] = scheduled.map((meeting) => ({
    retailer: d.retailersById[meeting.retailerId],
    broker: brokerOf(meeting),
    status: "Scheduled",
    date: meeting.date,
    lastMeeting: getRetailerMeetings(meeting.retailerId)[0],
    openActions: followThrough(meeting.retailerId).openActions,
    meeting,
  }));

  const fromPlanning: UpcomingMeeting[] = d.retailers
    .filter(
      (r) => UPCOMING_STATUSES.includes(r.meetingStatus) && !booked.has(r.id),
    )
    .map((retailer) => ({
      retailer,
      broker: brokerFor(retailer),
      status: retailer.meetingStatus,
      date: retailer.meetingDate,
      lastMeeting: getRetailerMeetings(retailer.id)[0],
      openActions: followThrough(retailer.id).openActions,
    }));

  return [...fromMeetings, ...fromPlanning]
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.retailer.name.localeCompare(b.retailer.name);
    });
}

export interface MeetingDetail {
  meeting: Meeting;
  retailer: Retailer;
  /** Absent where the meeting records no broker. */
  broker?: Broker;
  /** Tracked work outstanding on the account this meeting was about. */
  openActions: Action[];
  /** The account's Item x Retailer records, so the meeting lands in the work. */
  items: RetailerItemRow[];
  /** Account activity, minus whatever logs this meeting a second time. */
  activities: Activity[];
}

/**
 * One meeting, with everything it connects to.
 *
 * Actions and workstream records belong to the account rather than to the
 * meeting — the data records no link from a meeting to an item — so they are
 * presented as what is true of the account, never as something this meeting
 * created.
 */
export function getMeetingDetail(id: string): MeetingDetail | null {
  const meeting = getMeeting(id);
  if (!meeting) return null;

  return {
    meeting,
    retailer: d.retailersById[meeting.retailerId],
    broker: brokerOf(meeting),
    openActions: followThrough(meeting.retailerId).openActions,
    items: getRetailerItemRows(meeting.retailerId),
    activities: getRetailerActivities(meeting.retailerId).filter(
      (a) =>
        !(SUPERSEDED_BY_MEETING.includes(a.type) && a.date === meeting.date),
    ),
  };
}

/* ── Cross-workstream lists ────────────────────────────────────────────── */

/** Outstanding actions, soonest first. Overdue items surface at the top. */
export function getUpcomingActions(limit?: number): Action[] {
  const open = d.actions.filter((a) => isOpenAction(a.status)).sort(byDueAsc);
  return limit === undefined ? open : open.slice(0, limit);
}

export function getRecentActivity(limit?: number): Activity[] {
  const sorted = [...d.activities].sort(byDateDesc);
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function getAllMeetings(): Meeting[] {
  return [...d.meetings].sort(byDateDesc);
}

/* ── Buyer feedback ────────────────────────────────────────────────────── */

export interface BuyerQuote {
  retailer: Retailer;
  product: Product;
  quote: string;
  theme?: string;
}

/**
 * What buyers are telling us, read straight off the Item-Retailer tracker so
 * there is no parallel quote list to drift out of sync.
 *
 * One quote per retailer, most recently heard from first.
 */
export function getBuyerFeedback(limit?: number): BuyerQuote[] {
  const seen = new Set<RetailerId>();
  const quotes: BuyerQuote[] = [];

  for (const row of d.workstream) {
    if (!row.buyerFeedback || seen.has(row.retailerId)) continue;
    seen.add(row.retailerId);
    quotes.push({
      retailer: d.retailersById[row.retailerId],
      product: d.productsById[row.productId],
      quote: row.buyerFeedback,
      theme: row.feedbackTheme,
    });
  }

  quotes.sort((a, b) => {
    const aDate = getLastActivity(a.retailer.id)?.date ?? "";
    const bDate = getLastActivity(b.retailer.id)?.date ?? "";
    return bDate.localeCompare(aDate);
  });

  return limit === undefined ? quotes : quotes.slice(0, limit);
}

export interface FeedbackTheme {
  theme: string;
  count: number;
  retailers: string[];
}

/**
 * Recurring signals: the same concern raised at more than one account is the
 * thing worth acting on, and it is what the opportunities layer reads from.
 */
export function getFeedbackThemes(): FeedbackTheme[] {
  const byTheme = new Map<string, RetailerId[]>();

  for (const row of d.workstream) {
    if (!row.feedbackTheme || !row.buyerFeedback) continue;
    const list = byTheme.get(row.feedbackTheme) ?? [];
    if (!list.includes(row.retailerId)) list.push(row.retailerId);
    byTheme.set(row.feedbackTheme, list);
  }

  return [...byTheme.entries()]
    .map(([theme, ids]) => ({
      theme,
      count: ids.length,
      retailers: ids.map((id) => d.retailersById[id].name),
    }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

/* ── Opportunities ─────────────────────────────────────────────────────── */

export function getOpportunitySignals(): Opportunity[] {
  const rank = { High: 0, Medium: 1, Low: 2 };
  return [...d.opportunities].sort(
    (a, b) => rank[a.confidence] - rank[b.confidence],
  );
}

export interface OpportunityMapPoint {
  id: RetailerId;
  name: string;
  /** 0–100. How ready this account is to convert today. */
  brandReadiness: number;
  /** 0–100. Unit prize, log-scaled so one giant does not flatten the rest. */
  marketOpportunity: number;
  inWorkstream: boolean;
  /** Absent when no note has been written on the account. */
  note?: string;
}

const FIT_SCORE: Record<Fit, number> = {
  High: 85,
  Medium: 55,
  Low: 25,
  Unknown: 40,
};

/**
 * doors x SKUs x units per store per week x 52.
 *
 * Undefined when any of the three is unrecorded. Treating an absent door
 * count as nought would plot the account at the origin as though CLD had
 * sized it and found nothing there, which is a different and untrue claim.
 */
function annualUnitOpportunity(retailer: Retailer): number | undefined {
  const { approximateDoors, assumedSkus, unitsPerStoreWeek } = retailer;
  if (
    approximateDoors === undefined ||
    assumedSkus === undefined ||
    unitsPerStoreWeek === undefined
  ) {
    return undefined;
  }
  return approximateDoors * assumedSkus * unitsPerStoreWeek * 52;
}

/**
 * The opportunity map, derived from the pipeline rather than authored.
 *
 * Readiness blends how far the account has travelled with how well the range
 * fits it. Opportunity is the unit prize on a log scale, because the largest
 * account is two orders of magnitude bigger than the smallest and a linear
 * axis would push everything else into one corner.
 */
export function getOpportunityMap(): OpportunityMapPoint[] {
  /* Only accounts that can actually be placed. Both axes are derived — an
     account with no volume inputs has no position on one, and no recorded fit
     has none on the other. Plotting it anyway would put a mark on the chart
     that no data supports; getUnsizedRetailers names them instead. */
  const sizable = d.retailers.filter(
    (r) => annualUnitOpportunity(r) !== undefined && r.fit !== undefined,
  );

  const volumes = sizable.map((r) => Math.log10(annualUnitOpportunity(r)!));
  const min = Math.min(...volumes);
  const max = Math.max(...volumes);
  const span = max - min || 1;

  return sizable.map((retailer) => {
    const progress = (pipelineIndex(retailer.overallStatus) / 10) * 100;
    return {
      id: retailer.id,
      name: retailer.shortName,
      brandReadiness: Math.round(
        0.6 * progress + 0.4 * FIT_SCORE[retailer.fit!],
      ),
      marketOpportunity: Math.round(
        ((Math.log10(annualUnitOpportunity(retailer)!) - min) / span) * 100,
      ),
      inWorkstream: d.workstream.some((w) => w.retailerId === retailer.id),
      note: retailer.notes,
    };
  });
}

/**
 * Accounts the map cannot place, and why — so they are visibly set aside
 * rather than quietly missing from a chart that claims to show the book.
 */
export function getUnsizedRetailers(): Retailer[] {
  return d.retailers.filter(
    (r) => annualUnitOpportunity(r) === undefined || r.fit === undefined,
  );
}

export function getNotYet(): NotYetItem[] {
  return d.notYet;
}

/* ── Grouping ──────────────────────────────────────────────────────────── */

export interface ActivityDay {
  date: string;
  /** "Today", "Yesterday", "Sep 6" */
  label: string;
  activities: Activity[];
}

export function groupActivityByDay(list: Activity[]): ActivityDay[] {
  const byDay = new Map<string, Activity[]>();
  for (const activity of [...list].sort(byDateDesc)) {
    const bucket = byDay.get(activity.date);
    if (bucket) bucket.push(activity);
    else byDay.set(activity.date, [activity]);
  }
  return [...byDay.entries()].map(([date, entries]) => ({
    date,
    label: formatRelativeDate(date),
    activities: entries,
  }));
}

/* ── Products ──────────────────────────────────────────────────────────── */

/**
 * Every product id. Not used by a route: the portal is cookie-gated, so no
 * detail page can be prerendered. Kept for scripts and future export work.
 */
export function getAllProductIds(): ProductId[] {
  return d.products.map((p) => p.id);
}

export interface PortfolioMetrics {
  inPortfolio: number;
  inWorkstream: number;
  withBuyerFeedback: number;
  withSignals: number;
}

/**
 * The four figures at the top of the Products screen. Each one counts
 * products, so they share a unit and can be read against each other.
 */
export function getPortfolioMetrics(): PortfolioMetrics {
  const distinct = (rows: { productId: ProductId }[]) =>
    new Set(rows.map((r) => r.productId)).size;

  return {
    inPortfolio: d.products.length,
    inWorkstream: distinct(d.workstream),
    withBuyerFeedback: distinct(d.workstream.filter((w) => w.buyerFeedback)),
    withSignals: new Set(d.opportunities.flatMap((o) => o.productIds)).size,
  };
}

/**
 * How far along the item ladder a status sits.
 *
 * ITEM_STATUSES ends "Accepted", "Rejected" because that is the workbook
 * order. A rejection is an outcome rather than a rung, so it ranks below the
 * start of the ladder instead of above its end.
 */
function itemRank(status: ItemStatus): number {
  return status === "Rejected" ? -1 : ITEM_STATUSES.indexOf(status);
}

/**
 * How far an item has travelled at its furthest retailer.
 *
 * The canonical ITEM_STATUSES list ends "Accepted", "Rejected" because that
 * is the workbook order. For "furthest reached" a rejection is an outcome
 * rather than a rung, so it is set aside unless it is all there is.
 */
function furthestItemStatus(
  records: WorkstreamRecord[],
): ItemStatus | undefined {
  if (records.length === 0) return undefined;
  const live = records.filter((r) => r.itemStatus !== "Rejected");
  const pool = live.length > 0 ? live : records;
  return pool.reduce((best, row) =>
    itemRank(row.itemStatus) > itemRank(best.itemStatus)
      ? row
      : best,
  ).itemStatus;
}

/**
 * FIT_LEVELS runs strongest first, so the lowest index is the best read.
 *
 * Records with no fit recorded are not part of the comparison at all: an
 * unformed view is not a weak one, and letting it stand in as the worst would
 * quietly drag a product's summary down. If nothing has a fit, there is no
 * best fit to report.
 */
function strongestFit(records: WorkstreamRecord[]): Fit | undefined {
  const rated = records.filter(
    (row): row is WorkstreamRecord & { fit: Fit } => row.fit !== undefined,
  );
  if (rated.length === 0) return undefined;
  return rated.reduce((best, row) =>
    FIT_LEVELS.indexOf(row.fit) < FIT_LEVELS.indexOf(best.fit) ? row : best,
  ).fit;
}

/** One product, read through the retail workstream rather than the catalog. */
export interface ProductSummary {
  product: Product;
  records: WorkstreamRecord[];
  retailerCount: number;
  /** Records where the item has actually been put in front of a buyer. */
  activeCount: number;
  samplesOut: number;
  feedbackCount: number;
  bestFit?: Fit;
  furthestStatus?: ItemStatus;
  openActions: Action[];
  signals: Opportunity[];
}

function summarize(product: Product): ProductSummary {
  const records = d.workstream.filter((w) => w.productId === product.id);

  return {
    product,
    records,
    retailerCount: new Set(records.map((r) => r.retailerId)).size,
    activeCount: records.filter((r) => isPitched(r.itemStatus)).length,
    samplesOut: records.filter((r) => isSampleWithRetailer(r.sampleStatus))
      .length,
    feedbackCount: records.filter((r) => r.buyerFeedback).length,
    bestFit: strongestFit(records),
    furthestStatus: furthestItemStatus(records),
    openActions: d.actions
      .filter((a) => a.productId === product.id && isOpenAction(a.status))
      .sort(byDueAsc),
    signals: d.opportunities.filter((o) => o.productIds.includes(product.id)),
  };
}

/**
 * The portfolio, ordered by how much retail conversation each product is
 * carrying. Products nobody is working fall to the end rather than being
 * hidden — a SKU with no conversation is itself a finding.
 */
export function getProductSummaries(): ProductSummary[] {
  return d.products
    .map(summarize)
    .sort(
      (a, b) =>
        b.retailerCount - a.retailerCount ||
        b.activeCount - a.activeCount ||
        a.product.name.localeCompare(b.product.name),
    );
}

/** Only the products actually in play, in the same order. */
export function getWorkedProducts(): ProductSummary[] {
  return getProductSummaries().filter((s) => s.records.length > 0);
}

/* ── Product detail ────────────────────────────────────────────────────── */

/** One retailer conversation about one product, fully resolved. */
export interface ProductConversation {
  record: WorkstreamRecord;
  retailer: Retailer;
  /** Absent while nobody carries this pairing. */
  broker?: Broker;
  action?: Action;
}

export interface ProductDetail {
  product: Product;
  summary: ProductSummary;
  conversations: ProductConversation[];
  actions: Action[];
  openActions: Action[];
  signals: Opportunity[];
  activities: Activity[];
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getProductDetail(id: string): ProductDetail | null {
  if (!Object.prototype.hasOwnProperty.call(d.productsById, id)) return null;
  const product = d.productsById[id as ProductId];
  const summary = summarize(product);

  const productActions = d.actions
    .filter((a) => a.productId === product.id)
    .sort(byDueAsc);

  return {
    product,
    summary,
    /* Furthest-along accounts first — the same ordering the workstream screen
       uses, so the two screens agree about what leads. */
    conversations: summary.records
      .map((record) => ({
        record,
        retailer: d.retailersById[record.retailerId],
        broker:
          record.brokerId === undefined
            ? undefined
            : d.brokersById[record.brokerId],
        action: record.actionId
          ? d.actions.find((a) => a.id === record.actionId)
          : undefined,
      }))
      .sort(
        (a, b) =>
          pipelineIndex(b.retailer.overallStatus) -
            pipelineIndex(a.retailer.overallStatus) ||
          a.retailer.name.localeCompare(b.retailer.name),
      ),
    actions: productActions,
    openActions: productActions.filter((a) => isOpenAction(a.status)),
    signals: summary.signals,
    activities: d.activities
      .filter((a) => a.productId === product.id)
      .sort(byDateDesc),
  };
}

/* ── Buyer signals ─────────────────────────────────────────────────────── */

/** One thing a buyer said, with the item and account it was said about. */
export interface BuyerSignal {
  record: WorkstreamRecord;
  product: Product;
  retailer: Retailer;
  quote: string;
  theme?: string;
}

/**
 * Every buyer response on the tracker, furthest-along item first.
 *
 * The only competitive evidence this workspace holds. Nothing is modelled or
 * benchmarked — these are the buyers own words, in the order of how much
 * decision weight sits behind them.
 */
export function getBuyerSignals(limit?: number): BuyerSignal[] {
  const signals = d.workstream
    .filter((w) => w.buyerFeedback !== undefined)
    .sort(
      (a, b) =>
        itemRank(b.itemStatus) - itemRank(a.itemStatus) ||
        a.id.localeCompare(b.id),
    )
    .map((record) => ({
      record,
      product: d.productsById[record.productId],
      retailer: d.retailersById[record.retailerId],
      quote: record.buyerFeedback as string,
      theme: record.feedbackTheme,
    }));

  return limit === undefined ? signals : signals.slice(0, limit);
}

/* ── Retail fit ────────────────────────────────────────────────────────── */

export interface FitRow {
  product: Product;
  /** One entry per retailer column; null where no relationship exists. */
  cells: (WorkstreamRecord | null)[];
}

export interface RetailFitMatrix {
  retailers: Retailer[];
  rows: FitRow[];
}

/**
 * Product against retailer, showing only pairs that exist in the tracker.
 *
 * Both axes are filtered to what is actually being worked, so the grid never
 * grows a row or a column of dashes just to fill itself out.
 */
export function getRetailFitMatrix(): RetailFitMatrix {
  const workedRetailers = d.retailers
    .filter((r) => d.workstream.some((w) => w.retailerId === r.id))
    .sort(
      (a, b) =>
        pipelineIndex(b.overallStatus) - pipelineIndex(a.overallStatus) ||
        a.name.localeCompare(b.name),
    );

  return {
    retailers: workedRetailers,
    rows: getWorkedProducts().map(({ product }) => ({
      product,
      cells: workedRetailers.map(
        (retailer) =>
          d.workstream.find(
            (w) => w.productId === product.id && w.retailerId === retailer.id,
          ) ?? null,
      ),
    })),
  };
}

/* ── Positioning ───────────────────────────────────────────────────────── */

export interface PositioningChallenge {
  retailer: Retailer;
  quote: string;
  theme?: string;
}

export interface PositioningRead {
  product: Product;
  /** The same product summary the portfolio screens read. */
  summary: ProductSummary;
  /** How CLD positions the product today. Absent until someone writes it. */
  positioning?: string;
  /** Where a buyer has answered that positioning, in their own words. */
  challenges: PositioningChallenge[];
  signals: Opportunity[];
}

/**
 * The competitive read the portal can honestly support today: how each
 * product is positioned, and every place a buyer has responded to that
 * positioning. No syndicated data, no market share, nothing modelled.
 *
 * Products carrying a buyer response lead, because those are the ones whose
 * positioning is actually being tested in market.
 */
export function getPositioningReads(): PositioningRead[] {
  return getWorkedProducts()
    .map((summary) => ({
      product: summary.product,
      summary,
      positioning: summary.product.positioning,
      challenges: summary.records
        .filter((r) => r.buyerFeedback !== undefined)
        .map((r) => ({
          retailer: d.retailersById[r.retailerId],
          quote: r.buyerFeedback as string,
          theme: r.feedbackTheme,
        })),
      signals: summary.signals,
    }))
    .sort(
      (a, b) =>
        b.challenges.length - a.challenges.length ||
        a.product.name.localeCompare(b.product.name),
    );
}

/* ── Retailer pipeline ─────────────────────────────────────────────────── */

export interface PipelineMetrics {
  targetAccounts: number;
  inConversation: number;
  samplesWithBuyers: number;
  needsAttention: number;
}

/**
 * The book of accounts in four figures.
 *
 * "In conversation" uses the same threshold as the Overview funnel's first
 * step, so the two screens can never report different numbers for the same
 * idea. "Needs attention" is the attention list itself, counted.
 */
export function getPipelineMetrics(): PipelineMetrics {
  return {
    targetAccounts: d.retailers.filter((r) => isPursued(r.currentTarget)).length,

    inConversation: d.retailers.filter((r) =>
      pipelineAtLeast(r.overallStatus, "Reached out - waiting for response"),
    ).length,

    samplesWithBuyers: d.retailers.filter((r) =>
      d.workstream.some(
        (w) => w.retailerId === r.id && isSampleWithRetailer(w.sampleStatus),
      ),
    ).length,

    needsAttention: getAttentionSignals().length,
  };
}

/** One account on the pipeline screen. */
export interface RetailerPipelineRow {
  retailer: Retailer;
  /** Absent while the account is unassigned. */
  broker?: Broker;
  items: ResolvedItem[];
  samplesOut: number;
  feedbackCount: number;
  /**
   * The theme of the furthest-along item the buyer has commented on — the
   * one-line answer to "what did they say?". Absent until they say something.
   */
  feedbackSignal?: string;
  nextAction?: Action;
  overdue: boolean;
  lastActivity?: Activity;
  /**
   * Why this account needs a decision, taken from the shared attention
   * selector so the wording matches the Overview exactly rather than being
   * written a second time here.
   */
  attention?: string;
}

export interface RetailerFilter {
  brokerId?: BrokerId;
  phase?: PipelinePhaseId;
  priority?: Priority;
  channel?: string;
  /** Free text typed into the search field. */
  query?: string;
}

/** Every channel present in the book, in canonical retailer order. */
export function getRetailerChannels(): string[] {
  return [...new Set(d.retailers.map((r) => r.channel))];
}

export interface RetailerPhaseGroup {
  phase: PipelinePhase;
  rows: RetailerPipelineRow[];
}

function toRow(retailer: Retailer, attention?: string): RetailerPipelineRow {
  const items = getRetailerItems(retailer.id);
  const nextAction = getNextAction(retailer.id);

  return {
    retailer,
    broker: brokerFor(retailer),
    items,
    samplesOut: items.filter((i) => isSampleWithRetailer(i.record.sampleStatus))
      .length,
    feedbackCount: items.filter((i) => i.record.buyerFeedback).length,
    feedbackSignal: [...items]
      .sort(
        (a, b) =>
          ITEM_STATUSES.indexOf(b.record.itemStatus) -
          ITEM_STATUSES.indexOf(a.record.itemStatus),
      )
      .find((i) => i.record.buyerFeedback)?.record.feedbackTheme,
    nextAction,
    overdue: nextAction ? isActionOverdue(nextAction) : false,
    lastActivity: getLastActivity(retailer.id),
    attention,
  };
}

/**
 * The pipeline, grouped by phase with the furthest-along phase first.
 *
 * Phases are a presentation grouping of the canonical ladder, so this view
 * and the workstream can never disagree about where an account stands.
 * Empty phases are dropped rather than rendered as empty headings.
 */
export function getRetailerPipeline(
  filter: RetailerFilter = {},
): RetailerPhaseGroup[] {
  const attention = new Map(
    getAttentionSignals().map((signal) => [
      signal.retailer.id,
      signal.headline,
    ]),
  );

  /* Search reads the fields a person would actually type: the account, its
     channel, and the broker carrying it. */
  const query = filter.query?.trim().toLowerCase();

  const matches = d.retailers.filter(
    (r) =>
      (filter.brokerId === undefined ||
        r.assignedBrokerId === filter.brokerId) &&
      (filter.priority === undefined || r.priority === filter.priority) &&
      (filter.channel === undefined || r.channel === filter.channel) &&
      (filter.phase === undefined ||
        pipelinePhase(r.overallStatus).id === filter.phase) &&
      (!query ||
        [r.name, r.shortName, r.channel, brokerFor(r)?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );

  return [...PIPELINE_PHASES]
    .reverse()
    .map((phase) => ({
      phase,
      rows: matches
        .filter((r) => pipelinePhase(r.overallStatus).id === phase.id)
        .sort(
          (a, b) =>
            pipelineIndex(b.overallStatus) - pipelineIndex(a.overallStatus) ||
            a.name.localeCompare(b.name),
        )
        .map((r) => toRow(r, attention.get(r.id))),
    }))
    .filter((group) => group.rows.length > 0);
}

/** Total accounts a filter selection resolves to, for the empty state. */
export function countRetailers(filter: RetailerFilter = {}): number {
  return getRetailerPipeline(filter).reduce(
    (total, group) => total + group.rows.length,
    0,
  );
}

/* ── Brokers ───────────────────────────────────────────────────────────── */

/**
 * Every broker id. Not used by a route: the portal is cookie-gated, so no
 * detail page can be prerendered. Kept for scripts and future export work.
 */
export function getAllBrokerIds(): BrokerId[] {
  return d.brokers.map((b) => b.id);
}

/**
 * A broker's book of business.
 *
 * The portal's coordination layer made visible: who owns which accounts, how
 * much of that book is actually moving, and what is waiting on them.
 */
export interface BrokerPortfolio {
  broker: Broker;
  /** Their accounts, furthest along the pipeline first. */
  retailers: Retailer[];
  accounts: number;
  /** Accounts a buyer conversation has actually opened on. */
  inMotion: number;
  needsAttention: number;
  /** Item x Retailer records they are carrying. */
  items: number;
  samplesOut: number;
  openActions: number;
  /** Soonest outstanding action they own; overdue surfaces first. */
  nextAction?: Action;
  overdue: boolean;
  lastActivity?: Activity;
}

function buildPortfolio(broker: Broker): BrokerPortfolio {
  const flagged = new Set(
    getAttentionSignals().map((signal) => signal.retailer.id),
  );

  const owned = d.retailers
    .filter((r) => r.assignedBrokerId === broker.id)
    .sort(
      (a, b) =>
        pipelineIndex(b.overallStatus) - pipelineIndex(a.overallStatus) ||
        a.name.localeCompare(b.name),
    );

  const records = d.workstream.filter((w) => w.brokerId === broker.id);
  const open = d.actions
    .filter((a) => a.ownerId === broker.id && isOpenAction(a.status))
    .sort(byDueAsc);

  return {
    broker,
    retailers: owned,
    accounts: owned.length,

    /* Same threshold the Retailers screen calls "in conversation", so the
       two pages can never disagree about what counts as started. */
    inMotion: owned.filter((r) =>
      pipelineAtLeast(r.overallStatus, "Reached out - waiting for response"),
    ).length,

    needsAttention: owned.filter((r) => flagged.has(r.id)).length,
    items: records.length,
    samplesOut: records.filter((w) => isSampleWithRetailer(w.sampleStatus))
      .length,
    openActions: open.length,
    nextAction: open[0],
    overdue: open[0] ? isActionOverdue(open[0]) : false,
    lastActivity: d.activities
      .filter((a) => a.personId === broker.id)
      .sort(byDateDesc)[0],
  };
}

/** Every broker, ordered by how much of the book they are carrying. */
export function getBrokerPortfolios(): BrokerPortfolio[] {
  return d.brokers
    .map(buildPortfolio)
    .sort(
      (a, b) =>
        b.accounts - a.accounts ||
        b.items - a.items ||
        d.brokers.indexOf(a.broker) - d.brokers.indexOf(b.broker),
    );
}

/** Returns null for an unknown id so the route can call notFound(). */
export function getBrokerPortfolio(id: string): BrokerPortfolio | null {
  return Object.prototype.hasOwnProperty.call(d.brokersById, id)
    ? buildPortfolio(d.brokersById[id as BrokerId])
    : null;
}

/* ── Broker detail ─────────────────────────────────────────────────────── */

/** One account inside a broker's portfolio, resolved for rendering. */
export interface BrokerAccount {
  retailer: Retailer;
  items: ResolvedItem[];
  samplesOut: number;
  /** The buyer's own words on this account, where any have been recorded. */
  feedback?: { quote: string; theme?: string; product: Product };
  nextAction?: Action;
  overdue: boolean;
  lastActivity?: Activity;
  /** Shared wording with the Overview attention list, not written again. */
  attention?: string;
}

export interface BrokerDetail {
  portfolio: BrokerPortfolio;
  scorecard: BrokerScorecard;
  accounts: BrokerAccount[];
  actions: Action[];
  openActions: Action[];
  activities: Activity[];
  notes: RetailerNote[];
}

export function getBrokerDetail(id: string): BrokerDetail | null {
  const portfolio = getBrokerPortfolio(id);
  if (!portfolio) return null;
  const brokerId = portfolio.broker.id;

  const attention = new Map(
    getAttentionSignals().map((signal) => [
      signal.retailer.id,
      signal.headline,
    ]),
  );

  const owned = d.actions.filter((a) => a.ownerId === brokerId).sort(byDueAsc);

  return {
    portfolio,
    scorecard: scoreBroker(portfolio.broker),

    accounts: portfolio.retailers.map((retailer) => {
      const items = getRetailerItems(retailer.id);
      const withFeedback = items.find((i) => i.record.buyerFeedback);
      const nextAction = getNextAction(retailer.id);

      return {
        retailer,
        items,
        samplesOut: items.filter((i) =>
          isSampleWithRetailer(i.record.sampleStatus),
        ).length,
        feedback: withFeedback
          ? {
              quote: withFeedback.record.buyerFeedback as string,
              theme: withFeedback.record.feedbackTheme,
              product: withFeedback.product,
            }
          : undefined,
        nextAction,
        overdue: nextAction ? isActionOverdue(nextAction) : false,
        lastActivity: getLastActivity(retailer.id),
        attention: attention.get(retailer.id),
      };
    }),

    actions: owned,
    openActions: owned.filter((a) => isOpenAction(a.status)),
    activities: d.activities
      .filter((a) => a.personId === brokerId)
      .sort(byDateDesc),
    notes: getBrokerNotes(brokerId),
  };
}

/** Meetings this broker ran, flattened for the shared notes panel. */
export function getBrokerNotes(brokerId: BrokerId): RetailerNote[] {
  return d.meetings
    .filter((m) => m.brokerId === brokerId)
    .sort(byDateDesc)
    .map((m) => ({
      id: m.id,
      date: m.date,
      title: m.title,
      /* The filter above is the proof: every row here is this broker's. */
      authorId: brokerId,
      body: m.summary,
    }));
}

/* ── Broker accountability ─────────────────────────────────────────────── */

/** The three record cuts a scorecard column can drill into. */
export type BrokerRecordView = "samples" | "under-review" | "approved";

const RECORD_PREDICATE: Record<
  BrokerRecordView,
  (row: WorkstreamRecord) => boolean
> = {
  /* Physically with a buyer — the same test the Overview counts as
     "SKU samples sent", so the two screens agree. */
  samples: (row) => isSampleWithRetailer(row.sampleStatus),
  "under-review": (row) => isUnderReview(row.itemStatus),
  approved: (row) => isApproved(row.itemStatus),
};

/**
 * One row of the broker accountability table.
 *
 * Every figure counts something already recorded on the Item-Retailer
 * tracker or the action list. Nothing here is stored on a broker.
 */
export interface BrokerScorecard {
  broker: Broker;
  accounts: number;
  /** Accounts a buyer conversation has actually opened on. */
  contacted: number;
  items: number;
  samplesOut: number;
  underReview: number;
  approved: number;
  nextSteps: number;
  /** Soonest outstanding action on their desk — what happens next. */
  nextAction?: Action;
  /** True when one of their open actions has slipped past its due date. */
  overdue: boolean;
}

function scoreBroker(broker: Broker): BrokerScorecard {
  const records = d.workstream.filter((w) => w.brokerId === broker.id);
  const open = d.actions
    .filter((a) => a.ownerId === broker.id && isOpenAction(a.status))
    .sort(byDueAsc);
  const owned = d.retailers.filter((r) => r.assignedBrokerId === broker.id);

  return {
    broker,
    accounts: owned.length,

    /* Same threshold the Overview funnel calls "Contacted", so a broker row
       and the funnel can never disagree. */
    contacted: owned.filter((r) =>
      pipelineAtLeast(r.overallStatus, "Reached out - waiting for response"),
    ).length,
    items: records.length,
    samplesOut: records.filter(RECORD_PREDICATE.samples).length,
    underReview: records.filter(RECORD_PREDICATE["under-review"]).length,
    approved: records.filter(RECORD_PREDICATE.approved).length,
    nextSteps: open.length,
    nextAction: open[0],
    overdue: open.some(isActionOverdue),
  };
}

/** Brokers in canonical order, so the table reads the same as the Overview. */
export function getBrokerScorecards(): BrokerScorecard[] {
  return d.brokers.map(scoreBroker);
}

export type BrokerScorecardTotals = Omit<BrokerScorecard, "broker">;

const NO_TOTALS: BrokerScorecardTotals = {
  accounts: 0,
  contacted: 0,
  items: 0,
  samplesOut: 0,
  underReview: 0,
  approved: 0,
  nextSteps: 0,
  overdue: false,
};

/** Column totals, added up from the rows rather than counted again. */
export function getBrokerScorecardTotals(): BrokerScorecardTotals {
  return getBrokerScorecards().reduce<BrokerScorecardTotals>(
    (total, row) => ({
      accounts: total.accounts + row.accounts,
      contacted: total.contacted + row.contacted,
      items: total.items + row.items,
      samplesOut: total.samplesOut + row.samplesOut,
      underReview: total.underReview + row.underReview,
      approved: total.approved + row.approved,
      nextSteps: total.nextSteps + row.nextSteps,
      overdue: total.overdue || row.overdue,
    }),
    NO_TOTALS,
  );
}

/**
 * The broker worth looking at first: whoever has the most accounts waiting on
 * a buyer decision, with the biggest book breaking a tie.
 *
 * Derived rather than chosen by hand, so the panel stays true as data moves.
 */
export function getSpotlightBroker(): BrokerScorecard | null {
  /* Null with no brokers on the book. There is no broker to spotlight, and
     inventing one would be the only alternative. */
  return [...getBrokerScorecards()].sort(
    (a, b) =>
      b.underReview - a.underReview ||
      b.samplesOut - a.samplesOut ||
      b.items - a.items ||
      d.brokers.indexOf(a.broker) - d.brokers.indexOf(b.broker),
  )[0] ?? null;
}

/* ── Broker drill-down ─────────────────────────────────────────────────── */

/** One Item x Retailer record, resolved for a drill-down row. */
export interface BrokerRecord {
  record: WorkstreamRecord;
  product: Product;
  /** The tracked action this step is linked to, where there is one. */
  action?: Action;
  overdue: boolean;
}

export interface BrokerRecordGroup {
  retailer: Retailer;
  records: BrokerRecord[];
}

/**
 * A broker's workstream records for one column of the scorecard, grouped by
 * the account they sit on and ordered the way every other screen orders
 * accounts — furthest along the pipeline first.
 *
 * Returns an empty array when nothing matches. Nothing is invented to fill it.
 */
export function getBrokerRecords(
  brokerId: BrokerId,
  view: BrokerRecordView,
): BrokerRecordGroup[] {
  const matching = d.workstream.filter(
    (row) => row.brokerId === brokerId && RECORD_PREDICATE[view](row),
  );

  return d.retailers
    .filter((retailer) =>
      matching.some((row) => row.retailerId === retailer.id),
    )
    .sort(
      (a, b) =>
        pipelineIndex(b.overallStatus) - pipelineIndex(a.overallStatus) ||
        a.name.localeCompare(b.name),
    )
    .map((retailer) => ({
      retailer,
      records: matching
        .filter((row) => row.retailerId === retailer.id)
        .map((row) => {
          const action = row.actionId
            ? d.actions.find((a) => a.id === row.actionId)
            : undefined;
          return {
            record: row,
            product: d.productsById[row.productId],
            action,
            overdue: action ? isActionOverdue(action) : false,
          };
        }),
    }));
}

/** How many accounts a drill-down spans, for the count line above it. */
export function countBrokerRecords(groups: BrokerRecordGroup[]): number {
  return groups.reduce((total, group) => total + group.records.length, 0);
}

/* ── Market insights ───────────────────────────────────────────────────── */

/**
 * One read of the market, with the evidence it was read from.
 *
 * The signal, the interpretation and the recommended move are CLD's own
 * judgement and live on the opportunity record. Everything counted here is
 * derived: a buyer response only counts as evidence when it sits on both a
 * product and an account the signal names, which is why the counts match what
 * each opportunity says about itself rather than being asserted twice.
 */
export interface MarketTakeaway {
  opportunity: Opportunity;
  /** Buyer responses recorded where this signal was read. */
  evidence: BuyerSignal[];
  products: Product[];
  retailers: Retailer[];
  /** Open work already carrying this signal forward. */
  openActions: Action[];
}

function readTakeaway(opportunity: Opportunity): MarketTakeaway {
  const onSignal = (productId: ProductId, retailerId: RetailerId) =>
    opportunity.productIds.includes(productId) &&
    opportunity.retailerIds.includes(retailerId);

  return {
    opportunity,
    evidence: getBuyerSignals().filter((signal) =>
      onSignal(signal.product.id, signal.retailer.id),
    ),
    products: opportunity.productIds.map((id) => d.productsById[id]),
    retailers: opportunity.retailerIds.map((id) => d.retailersById[id]),
    openActions: d.actions
      .filter(
        (a) =>
          isOpenAction(a.status) &&
          a.productId !== undefined &&
          onSignal(a.productId, a.retailerId),
      )
      .sort(byDueAsc),
  };
}

/** Strongest reads first, using the confidence already on the record. */
export function getMarketTakeaways(): MarketTakeaway[] {
  return getOpportunitySignals().map(readTakeaway);
}

/** One open action, with the reads it is already carrying forward. */
export interface SignalAction {
  action: Action;
  /** 1-based positions in the takeaway ranking, so the bridge is legible. */
  reads: number[];
}

/**
 * Insight to action, flattened.
 *
 * The same open records the reads above already point at, folded into one
 * list so an action shared by two reads is shown — and read — once. Nothing
 * is created here: every row is an action the Actions screen already carries.
 */
export function getSignalActions(): SignalAction[] {
  const byAction = new Map<string, SignalAction>();

  getMarketTakeaways().forEach((takeaway, i) => {
    for (const action of takeaway.openActions) {
      const seen = byAction.get(action.id);
      if (seen) seen.reads.push(i + 1);
      else byAction.set(action.id, { action, reads: [i + 1] });
    }
  });

  return [...byAction.values()].sort((a, b) => byDueAsc(a.action, b.action));
}

/**
 * How much of the book each read is standing on.
 *
 * Counts distinct records rather than adding the takeaways up: a product or
 * an account that carries two signals must not be counted twice.
 */
export interface InsightMetrics {
  buyerResponses: number;
  accountsHeardFrom: number;
  productsWithSignal: number;
  reads: number;
}

export function getInsightMetrics(): InsightMetrics {
  const answered = d.workstream.filter((w) => w.buyerFeedback !== undefined);

  return {
    buyerResponses: answered.length,
    accountsHeardFrom: new Set(answered.map((w) => w.retailerId)).size,
    productsWithSignal: new Set(answered.map((w) => w.productId)).size,
    reads: d.opportunities.length,
  };
}

/**
 * The book cut by channel rather than by account.
 *
 * The channel taxonomy is whatever the retailer records already say — no new
 * grouping is invented on top of them. Every figure is a count of records at
 * the accounts in that channel, so a channel with nothing in it reads as
 * empty rather than as zero-something.
 */
export interface ChannelSignal {
  channel: string;
  retailers: Retailer[];
  /** Item x Retailer records at these accounts. */
  items: number;
  samplesOut: number;
  withFeedback: number;
  /** Items where the conversation has reached commercial terms. */
  inPricing: number;
  /** Accounts the attention layer has flagged. */
  needsAttention: number;
  /** Open actions past their date at these accounts. */
  overdue: number;
}

const PRICING_STATUSES: readonly ItemStatus[] = [
  "Pricing requested",
  "Pricing submitted",
];

export function getChannelSignals(): ChannelSignal[] {
  const flagged = new Set(
    getAttentionSignals().map((signal) => signal.retailer.id),
  );

  return getRetailerChannels()
    .map((channel) => {
      const inChannel = d.retailers.filter((r) => r.channel === channel);
      const ids = new Set(inChannel.map((r) => r.id));
      const records = d.workstream.filter((w) => ids.has(w.retailerId));

      return {
        channel,
        retailers: inChannel,
        items: records.length,
        samplesOut: records.filter((w) => isSampleWithRetailer(w.sampleStatus))
          .length,
        withFeedback: records.filter((w) => w.buyerFeedback !== undefined)
          .length,
        inPricing: records.filter((w) => PRICING_STATUSES.includes(w.itemStatus))
          .length,
        needsAttention: inChannel.filter((r) => flagged.has(r.id)).length,
        overdue: d.actions.filter(
          (a) => ids.has(a.retailerId) && isActionOverdue(a),
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.withFeedback - a.withFeedback ||
        b.items - a.items ||
        a.channel.localeCompare(b.channel),
    );
}

/* ── Reports ───────────────────────────────────────────────────────────── */

/**
 * The reporting layer is a VIEW, not a second data model.
 *
 * Every figure below is composed from a selector another screen already
 * uses, so a report can never quote a number the workspace disagrees with.
 * Nothing here counts anything for the first time.
 */
export interface ReportMetrics {
  retailAccounts: number;
  workstreamItems: number;
  openActions: number;
  buyerResponses: number;
}

export function getReportMetrics(): ReportMetrics {
  return {
    retailAccounts: getPipelineMetrics().targetAccounts,
    workstreamItems: d.workstream.length,
    openActions: getActionMetrics().open,
    buyerResponses: getInsightMetrics().buyerResponses,
  };
}

/** The pipeline as one flat list, furthest-along account first. */
export function getPipelineReport(): RetailerPipelineRow[] {
  return getRetailerPipeline().flatMap((group) => group.rows);
}

/** A broker's desk, with the accounts on it the attention layer has flagged. */
export interface BrokerCoverageRow {
  scorecard: BrokerScorecard;
  needsAttention: number;
}

export function getBrokerCoverageReport(): BrokerCoverageRow[] {
  const flagged = getAttentionSignals();

  return getBrokerScorecards().map((scorecard) => ({
    scorecard,
    needsAttention: flagged.filter((s) => s.broker?.id === scorecard.broker.id)
      .length,
  }));
}

/** One figure in the executive snapshot, with where it can be opened. */
export interface ExecutiveStat {
  value: number;
  label: string;
  href: string;
}

export interface ExecutiveSummary {
  stands: ExecutiveStat[];
  /** The accounts a decision is waiting on, strongest signal first. */
  attention: AttentionSignal[];
  attentionAccounts: number;
  overdueActions: number;
  blockedActions: number;
  /** Accounts furthest along that are not already flagged above. */
  moving: RetailerPipelineRow[];
  next: Action[];
}

/**
 * The executive snapshot: where things stand, what is stuck, what is moving,
 * what happens next.
 *
 * "Moving" deliberately excludes anything already named under attention. An
 * account cannot be both the good news and the bad news in the same summary,
 * and showing it twice would overstate how much of the book each block covers.
 */
export function getExecutiveSummary(): ExecutiveSummary {
  const pipeline = getPipelineMetrics();
  const portfolio = getPortfolioMetrics();
  const insight = getInsightMetrics();
  const action = getActionMetrics();
  const signals = getAttentionSignals();
  const flagged = new Set(signals.map((s) => s.retailer.id));

  return {
    stands: [
      {
        value: pipeline.inConversation,
        label: "accounts in conversation",
        href: "/retailers",
      },
      {
        value: portfolio.inWorkstream,
        label: "products in retail conversations",
        href: "/products",
      },
      {
        value: insight.buyerResponses,
        label: "buyer responses recorded",
        href: "/market-insights",
      },
      { value: action.open, label: "actions open", href: "/actions" },
    ],
    attention: signals.slice(0, 3),
    attentionAccounts: signals.length,
    overdueActions: action.overdue,
    blockedActions: action.blocked,
    moving: getPipelineReport()
      .filter((row) => !flagged.has(row.retailer.id))
      .slice(0, 3),
    next: getUpcomingActions(3),
  };
}

/** One entry in the report index. */
export interface ReportEntry {
  /** Anchor id of the report section further down the page. */
  id: string;
  title: string;
  /** The question the report answers. */
  description: string;
  /** What is inside it, counted from the records. */
  contains: string;
  workspace: { href: string; label: string };
}

/**
 * The report index.
 *
 * The "contains" line is assembled from live counts rather than written
 * down, so the index cannot drift from the reports beneath it as the
 * workbook grows.
 */
export function getReportLibrary(): ReportEntry[] {
  const metrics = getReportMetrics();
  const plural = (n: number, one: string, many: string) =>
    n + " " + (n === 1 ? one : many);

  return [
    {
      id: "executive-summary",
      title: "Executive Summary",
      description: "Where the book stands, and what is waiting on a decision.",
      contains:
        plural(getAttentionSignals().length, "account", "accounts") +
        " needing attention · " +
        plural(metrics.openActions, "open action", "open actions"),
      workspace: { href: "/", label: "The overview" },
    },
    {
      id: "retailer-pipeline",
      title: "Retailer Pipeline",
      description: "Every account, its phase, and the step it is waiting on.",
      contains:
        plural(d.retailers.length, "account", "accounts") +
        " · " +
        plural(getRetailerPipeline().length, "phase", "phases"),
      workspace: { href: "/retailers", label: "The pipeline" },
    },
    {
      id: "broker-coverage",
      title: "Broker & Account Coverage",
      description: "Who is carrying which accounts, and how much work sits there.",
      contains:
        plural(d.brokers.length, "broker", "brokers") +
        " · " +
        plural(metrics.workstreamItems, "tracked item", "tracked items"),
      workspace: { href: "/brokers", label: "The desks" },
    },
    {
      id: "product-read",
      title: "Product & Retail Read",
      description: "How the portfolio is travelling through retail.",
      contains:
        plural(d.products.length, "product", "products") +
        " · " +
        plural(metrics.buyerResponses, "buyer response", "buyer responses"),
      workspace: { href: "/products", label: "The portfolio" },
    },
    {
      id: "opportunities",
      title: "Opportunities & Next Moves",
      description: "The reads drawn from the work, and what carries them forward.",
      contains:
        plural(d.opportunities.length, "read", "reads") +
        " · " +
        plural(getSignalActions().length, "action attached", "actions attached"),
      workspace: { href: "/market-insights", label: "Market insights" },
    },
  ];
}
