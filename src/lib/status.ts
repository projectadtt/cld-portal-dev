/**
 * CLD status vocabulary — the single source of truth for every status value
 * in the portal.
 *
 * Transcribed from the retail development workbook. Screens must not invent
 * additional values, and components must not hardcode status colours — they
 * read `tone` instead.
 */

/* ── Pipeline status (Retailer Pipeline > Overall Status) ──────────────── */

export const PIPELINE_STATUSES = [
  "Not reached out yet",
  "Intro planned",
  "Reached out - waiting for response",
  "Asked for meeting",
  "Meeting scheduled",
  "Meeting completed",
  "Samples requested",
  "Samples sent",
  "Samples reviewed",
  "Pricing requested",
  "Pricing submitted",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/** The ladder is linear: every status is further along than the one before. */
export const PIPELINE_PROGRESSION = PIPELINE_STATUSES;

export function pipelineIndex(status: PipelineStatus): number {
  return PIPELINE_STATUSES.indexOf(status);
}

/** True when a retailer has reached at least the given rung. */
export function pipelineAtLeast(
  status: PipelineStatus,
  threshold: PipelineStatus,
): boolean {
  return pipelineIndex(status) >= pipelineIndex(threshold);
}

/* ── Pipeline phases — presentation only ───────────────────────────────── */

/**
 * A client-readable grouping of the eleven canonical pipeline statuses.
 *
 * These are NOT new statuses and never enter PIPELINE_STATUSES. A retailer's
 * status is always one of the eleven; a phase is only how the portal groups
 * the ladder when a client needs to read the shape of the book at a glance.
 *
 * The grouping is contiguous and in ladder order, so phase order and pipeline
 * order can never disagree.
 */
export const PIPELINE_PHASES = [
  {
    id: "not-started",
    label: "Not started",
    statuses: ["Not reached out yet"],
  },
  {
    id: "outreach",
    label: "Outreach",
    statuses: [
      "Intro planned",
      "Reached out - waiting for response",
      "Asked for meeting",
    ],
  },
  {
    id: "meeting",
    label: "Meeting",
    statuses: ["Meeting scheduled", "Meeting completed"],
  },
  {
    id: "samples",
    label: "Samples",
    statuses: ["Samples requested", "Samples sent"],
  },
  {
    id: "buyer-review",
    label: "Buyer review",
    statuses: ["Samples reviewed"],
  },
  {
    id: "pricing",
    label: "Pricing",
    statuses: ["Pricing requested", "Pricing submitted"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  statuses: readonly PipelineStatus[];
}[];

export type PipelinePhase = (typeof PIPELINE_PHASES)[number];
export type PipelinePhaseId = PipelinePhase["id"];

export function pipelinePhase(status: PipelineStatus): PipelinePhase {
  const phase = PIPELINE_PHASES.find((p) =>
    (p.statuses as readonly PipelineStatus[]).includes(status),
  );
  /* Every canonical status belongs to exactly one phase; the fallback exists
     only so the return type stays non-optional. */
  return phase ?? PIPELINE_PHASES[0];
}

/* ── Sample status (shared by pipeline and item tracker) ───────────────── */

export const SAMPLE_STATUSES = [
  "Not discussed",
  "Requested",
  "Preparing",
  "Sent",
  "Received",
  "Reviewed - positive",
  "Reviewed - neutral",
  "Reviewed - concerns",
  "Additional samples requested",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

/** Sample statuses that mean a physical sample is with the retailer. */
const SAMPLE_IN_MARKET: readonly SampleStatus[] = [
  "Sent",
  "Received",
  "Reviewed - positive",
  "Reviewed - neutral",
  "Reviewed - concerns",
  "Additional samples requested",
];

export function isSampleWithRetailer(status: SampleStatus): boolean {
  return SAMPLE_IN_MARKET.includes(status);
}

/* ── Item status (Item-Retailer Tracker > Item Status) ─────────────────── */

export const ITEM_STATUSES = [
  "Not pitched",
  "Pitch planned",
  "Pitched",
  "Samples requested",
  "Samples sent",
  "Samples reviewed",
  "Pricing requested",
  "Pricing submitted",
  "Buyer evaluating",
  "Accepted",
  "Rejected",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export function isPitched(status: ItemStatus): boolean {
  return status !== "Not pitched" && status !== "Pitch planned";
}

/**
 * Item statuses where the buyer holds the item and is forming a decision.
 *
 * A derived grouping of the canonical list, not a new status — the same way
 * pipeline phases group the retailer ladder.
 */
const UNDER_REVIEW: readonly ItemStatus[] = [
  "Samples reviewed",
  "Pricing requested",
  "Pricing submitted",
  "Buyer evaluating",
];

export function isUnderReview(status: ItemStatus): boolean {
  return UNDER_REVIEW.includes(status);
}

/** The one status that means a buyer has actually said yes. */
export function isApproved(status: ItemStatus): boolean {
  return status === "Accepted";
}

/* ── Retail readiness (Product Master) ─────────────────────────────────── */

/**
 * Whether an item can actually be taken to a retailer today. Market-neutral
 * on purpose — readiness is an operational state, not a country.
 */
export const RETAIL_READINESS = [
  "Retail ready",
  "In preparation",
  "Needs work",
] as const;

export type RetailReadiness = (typeof RETAIL_READINESS)[number];

/* ── Fit ───────────────────────────────────────────────────────────────── */

export const FIT_LEVELS = ["High", "Medium", "Low", "Unknown"] as const;
export type Fit = (typeof FIT_LEVELS)[number];

/* ── Current / Target ──────────────────────────────────────────────────── */

export const CURRENT_TARGET_VALUES = [
  "Current",
  "Target",
  "Current + Expansion",
  "Do Not Pursue",
  "Benchmark",
] as const;

export type CurrentTarget = (typeof CURRENT_TARGET_VALUES)[number];

export function isPursued(value: CurrentTarget): boolean {
  return value !== "Do Not Pursue" && value !== "Benchmark";
}

/* ── Priority ──────────────────────────────────────────────────────────── */

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/* ── Retailer tier and standing ────────────────────────────────────────── */

/**
 * How big a prize the account is, in the workbook's own three bands.
 *
 * Offered when an account is entered, because that is when someone knows it,
 * and read on the account's own page beside Priority — the two are the same
 * kind of judgement and belong together. Optional in the database and
 * optional here: an account nobody has banded yet reads as unrecorded rather
 * than being sorted into a default band.
 *
 * Narrowed with `maybe()` rather than `must()` in workspace.ts, so a NULL is
 * an absent view while a value outside these three is still an error.
 */
export const TIERS = ["Tier 1", "Tier 2", "Tier 3"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Whether the account is being worked right now.
 *
 * Recorded by the create form and not yet read by any screen. Deliberately
 * not narrowed on the way in, so a value here cannot make a row the portal is
 * unable to render; it is still checked against its lookup table on write,
 * like every other one.
 */
export const STANDINGS = [
  "Active",
  "Follow-up required",
  "On hold",
  "Not proceeding",
] as const;
export type Standing = (typeof STANDINGS)[number];

/* ── Meeting status ────────────────────────────────────────────────────── */

export const MEETING_STATUSES = [
  "Not scheduled",
  "Requested",
  "Scheduled",
  "Completed",
  "Follow-up needed",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/* ── Action status ─────────────────────────────────────────────────────── */

export const ACTION_STATUSES = ["Open", "In Progress", "Blocked", "Done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export function isOpenAction(status: ActionStatus): boolean {
  return status !== "Done";
}

/* ── Buyer feedback source ─────────────────────────────────────────────── */

/**
 * Where a piece of buyer feedback came from. Mirrors lookup_feedback_source.
 *
 * The database is the authority: the write path validates against the lookup
 * table, so a source CLD adds by INSERT is accepted before this list catches
 * up. This exists so a form can offer the choices without querying.
 */
export const FEEDBACK_SOURCES = [
  "Meeting",
  "Email",
  "Call",
  "Broker relay",
  "Sample review",
] as const;

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

/* ── Activity type ─────────────────────────────────────────────────────── */

export const ACTIVITY_TYPES = [
  "Sample sent",
  "Buyer feedback",
  "Broker update",
  "Meeting completed",
  "Pricing requested",
  "Action created",
  "Status change",
  "Email",
  "Call",
  "Internal note",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Activity types that represent an actual exchange with the retailer. */
const CONVERSATION_TYPES: readonly ActivityType[] = [
  "Meeting completed",
  "Call",
  "Email",
  "Buyer feedback",
];

export function isConversation(type: ActivityType): boolean {
  return CONVERSATION_TYPES.includes(type);
}

/* ── Tone ──────────────────────────────────────────────────────────────── */

/**
 * The only visual vocabulary a status is allowed to carry.
 *
 * neutral   — in progress, unremarkable (ink)
 * active    — a confirmed win / furthest along (forest)
 * attention — needs a decision, blocked, or rejected (red, used sparingly)
 * dormant   — paused, closed, or not yet begun (faint)
 *
 * Deliberately four tones, not a colour per status.
 */
export type Tone = "neutral" | "active" | "attention" | "dormant";

export const pipelineTone: Record<PipelineStatus, Tone> = {
  "Not reached out yet": "dormant",
  "Intro planned": "dormant",
  "Reached out - waiting for response": "neutral",
  "Asked for meeting": "neutral",
  "Meeting scheduled": "neutral",
  "Meeting completed": "neutral",
  "Samples requested": "neutral",
  "Samples sent": "neutral",
  "Samples reviewed": "neutral",
  "Pricing requested": "neutral",
  "Pricing submitted": "active",
};

export const itemStatusTone: Record<ItemStatus, Tone> = {
  "Not pitched": "dormant",
  "Pitch planned": "dormant",
  Pitched: "neutral",
  "Samples requested": "neutral",
  "Samples sent": "neutral",
  "Samples reviewed": "neutral",
  "Pricing requested": "neutral",
  "Pricing submitted": "neutral",
  "Buyer evaluating": "neutral",
  Accepted: "active",
  Rejected: "attention",
};

export const sampleStatusTone: Record<SampleStatus, Tone> = {
  "Not discussed": "dormant",
  Requested: "neutral",
  Preparing: "neutral",
  Sent: "neutral",
  Received: "neutral",
  "Reviewed - positive": "active",
  "Reviewed - neutral": "neutral",
  "Reviewed - concerns": "attention",
  "Additional samples requested": "attention",
};

export const fitTone: Record<Fit, Tone> = {
  High: "active",
  Medium: "neutral",
  Low: "dormant",
  Unknown: "dormant",
};

export const retailReadinessTone: Record<RetailReadiness, Tone> = {
  "Retail ready": "active",
  /* Work in hand, not a blocker — this must not read as an alarm. */
  "In preparation": "neutral",
  "Needs work": "attention",
};

export const currentTargetTone: Record<CurrentTarget, Tone> = {
  Current: "active",
  "Current + Expansion": "active",
  Target: "neutral",
  "Do Not Pursue": "dormant",
  Benchmark: "dormant",
};

export const actionStatusTone: Record<ActionStatus, Tone> = {
  Open: "neutral",
  "In Progress": "neutral",
  Blocked: "attention",
  Done: "dormant",
};
