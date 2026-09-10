/**
 * The shapes the selector layer works with, now sourced from the database.
 *
 * Almost all of them are the shapes the portal has always used, re-exported
 * from `@/data/types` so nothing downstream changes. Two differences, both
 * consequences of the canonical model:
 *
 *   Meeting     loses `actions`. The free-text array was retired in favour of
 *               actions.meeting_id, so a meeting's follow-through is now real
 *               action rows with owners, due dates and completion state.
 *
 *   Sample, BuyerFeedbackRecord, Contact are new. They were fields on a
 *               workstream row and are now records with their own history.
 */

import type {
  Action as StaticAction,
  Meeting as StaticMeeting,
} from "@/data/types";
import type { SampleStatus } from "@/lib/status";

export type {
  Activity,
  Broker,
  BrokerId,
  Client,
  ClientId,
  NotYetItem,
  Opportunity,
  OwnerId,
  Product,
  ProductId,
  Retailer,
  RetailerId,
  WorkstreamRecord,
} from "@/data/types";

export type Meeting = Omit<StaticMeeting, "actions">;

/**
 * An action, carrying the item it belongs to.
 *
 * `actions.workstream_item_id` is the reversal of the old single `actionId`
 * field, and it is why ws-01 can hold both act-01 and act-02 rather than
 * losing one to a slot. The static data had no way to express the link, so
 * this is the one shape in which the database is richer than the file it
 * replaced. Optional, because an action may belong to an account rather than
 * to any one item.
 */
export type Action = StaticAction & { workstreamItemId?: string };

/** One physical send. A second round is a second record, never an overwrite. */
export interface Sample {
  id: string;
  workstreamItemId: string;
  status: SampleStatus;
  /** All five are null wherever the source recorded no date. Never inferred. */
  requestedAt: string | null;
  preparedAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  reviewedAt: string | null;
  quantity: number | null;
}

/** One thing a buyer said. Append-only: a correction is a new record. */
export interface BuyerFeedbackRecord {
  id: string;
  workstreamItemId: string;
  quote: string;
  theme: string | null;
  sentiment: string | null;
  source: string | null;
  /** Null where no date is recorded anywhere in the source. */
  occurredAt: string | null;
  recordedBy: string | null;
  meetingId: string | null;
}

/**
 * A person at a retailer. P0-3 is unresolved, so `email` and `phone` exist in
 * the schema and are null on every row; nothing in the portal reads them.
 */
export interface Contact {
  id: string;
  retailerId: string;
  name: string;
  title: string | null;
  isPrimary: boolean;
}

/**
 * Everything one client's portal needs, loaded together.
 *
 * Fifteen queries build this — one per table, none per row — and the
 * derivation that follows is the same pure logic the portal has always used.
 * That is the whole N+1 story: there is no query inside any selector.
 */
export interface Workspace {
  clientId: string;
  /**
   * Null until a workspace exists. A database-first portal starts with an
   * empty database, and the very first screen has to render before there is
   * anything to render — so this is absent rather than invented.
   */
  client: import("@/data/types").Client | null;
  brokers: import("@/data/types").Broker[];
  retailers: import("@/data/types").Retailer[];
  products: import("@/data/types").Product[];
  workstream: import("@/data/types").WorkstreamRecord[];
  actions: Action[];
  meetings: Meeting[];
  activities: import("@/data/types").Activity[];
  opportunities: import("@/data/types").Opportunity[];
  notYet: import("@/data/types").NotYetItem[];
  samples: Sample[];
  feedback: BuyerFeedbackRecord[];
  contacts: Contact[];
}
