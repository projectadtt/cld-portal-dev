/**
 * Entity types for the CLD portal.
 *
 * This file is a type contract and nothing else. It holds no records: every
 * business row lives in Postgres and arrives through the read layer.
 *
 * Ids used to be string-literal unions of the prototype's own rows, which
 * checked the relationship graph at compile time while the data was a fixed
 * file. That is no longer true of them — a record created through the portal
 * has an id TypeScript cannot know — so they are plain strings, and the
 * relationship graph is checked where it now lives: in the foreign keys.
 *
 * Field names mirror the retail development workbook (Retailer Pipeline,
 * Product Master, Item-Retailer Tracker) so the portal and the operating
 * spreadsheet speak the same language.
 */

import type {
  ActionStatus,
  ActivityType,
  CurrentTarget,
  Fit,
  ItemStatus,
  MeetingStatus,
  PipelineStatus,
  RetailReadiness,
  Priority,
  SampleStatus,
  Standing,
  Tier,
} from "@/lib/status";

/* ── Identifiers ───────────────────────────────────────────────────────── */

/*
 * Named aliases rather than bare `string` everywhere: they carry no
 * constraint any more, but they still say what a value is for, and they keep
 * every signature in the application readable.
 */

export type BrokerId = string;

/** The client themself can own an action or author a note. */
export type ClientId = string;

export type OwnerId = string;

export type ProductId = string;

/** Slugs double as the route segment for /retailers/[retailerId]. */
export type RetailerId = string;

/* ── Client ────────────────────────────────────────────────────────────── */

export interface Client {
  id: ClientId;
  name: string;
  workspace: string;
  /** Editorial supporting line for the Overview header. */
  tagline: string;
  category: string;
  /**
   * Whether this workspace holds illustrative records rather than a real
   * client's book. Drives the disclaimer, which must not appear over data
   * someone has actually entered.
   */
  isDemo: boolean;
}

/* ── Broker ────────────────────────────────────────────────────────────── */

/**
 * Someone carrying part of the book.
 *
 * Two fields are required, because the database requires them: a name and the
 * short one every table and owner column shows. How CLD describes the desk is
 * optional and often settled later — the same nullable-column reading the
 * Retailer type below carries, for the same reason.
 */
export interface Broker {
  id: BrokerId;
  name: string;
  /** How the client refers to them in conversation. */
  shortName: string;
  role?: string;
  coverage?: string;
  status: "Active" | "Paused";
  /** Absent falls back to letters taken from the short name, never to blank. */
  initials?: string;
  /** Storage path for a profile photograph, or null for the initials mark. */
  imagePath: string | null;
}

/* ── Product Master ────────────────────────────────────────────────────── */

/**
 * A product on the client's range.
 *
 * Five fields are required, because the database requires them: an item has
 * to have an id, a workbook item number, a name, a category and a readiness
 * state before it can be talked about at all. Everything else is optional and
 * genuinely often unknown — CLD frequently opens a conversation about an item
 * long before a landed cost exists. An optional field renders as absent, not
 * as zero: a missing margin is not a margin of nought.
 */
export interface Product {
  id: ProductId;
  /** Workbook Item ID, e.g. "7G-101". */
  itemId: string;
  category: string;
  name: string;
  packSize?: string;
  positioning?: string;
  fobCost?: number;
  landedCost?: number;
  suggestedRetail?: number;
  /** Fraction, e.g. 0.59. Derived; absent unless both inputs are known. */
  retailerMargin?: number;
  moq?: number;
  casePack?: number;
  leadTimeDays?: number;
  /** Whether the item can be taken to a retailer as it stands today. */
  readiness: RetailReadiness;
  upc?: string;
  sourceNotes?: string;
  /**
   * The object's path inside the Supabase Storage bucket, or null.
   *
   * A path, never a URL: the URL is built from it when a page renders, so
   * nothing stored goes stale when the project or the bucket changes. Null
   * means there is no photograph, which is a normal state — the portal shows
   * its typographic plate rather than a broken image.
   */
  imagePath: string | null;
}

/* ── Retailer Pipeline ─────────────────────────────────────────────────── */

/**
 * A retail account on the pipeline.
 *
 * Five fields are required, because the database requires them: an account has
 * to have an id, a name, a short name, a channel and a place on the pipeline
 * ladder before it can be talked about at all. Everything else is optional and
 * genuinely often unknown — CLD routinely opens an account long before anyone
 * has sized its door count or formed a view on fit.
 *
 * These were once all required, and that was a lie the seeded workbook data
 * happened to cover for: every column below is nullable in Postgres, so the
 * first sparse account entered through the portal put NULLs into fields the
 * renderer had been told could never be absent. An optional field renders as
 * absent, not as zero — an account with no door count recorded does not have
 * no doors, and a step nobody has dated is not a step due today.
 */
export interface Retailer {
  id: RetailerId;
  name: string;
  /** Compact label for dense views such as the opportunity map. */
  shortName: string;
  channel: string;
  geography?: string;
  currentTarget: CurrentTarget;
  /** How big a prize the account is, in the workbook's three bands. */
  tier?: Tier;
  priority?: Priority;
  /** Absent while the account is unassigned; brokers.id is ON DELETE SET NULL. */
  assignedBrokerId?: BrokerId;
  overallStatus: PipelineStatus;
  /**
   * Whether the account is being worked right now.
   *
   * NOT NULL with a default of Active, so always present. Read because the
   * status form edits it: a field that can be written and not read gets reset
   * to its default by the next person who saves that form.
   */
  standing: Standing;
  sampleStatus: SampleStatus;
  fit?: Fit;
  categories: string[];
  approximateDoors?: number;
  assumedSkus?: number;
  unitsPerStoreWeek?: number;
  /** Fictional demo contact — never a real buyer name. */
  buyerContact: string;
  /** Absent when the account has not been contacted yet. */
  lastContact?: string;
  nextAction?: string;
  nextActionDate?: string;
  meetingStatus: MeetingStatus;
  meetingDate?: string;
  notes?: string;
  /**
   * The portal's own layer, not a workbook column: present only when this
   * account genuinely needs a decision. The only thing that puts a retailer
   * in the attention section, and the only place red is earned.
   */
  attention?: { reason: string };
  /**
   * Storage path for the retailer's logo, or null for the initials mark.
   *
   * Only ever a file CLD has been given: the portal will not go and fetch a
   * real company's logo from anywhere, and a missing one is a mark, not a gap.
   */
  imagePath: string | null;
}

/* ── Item-Retailer Tracker — the atomic workflow unit ──────────────────── */

/**
 * One product at one retailer — the atomic unit of the whole workstream.
 *
 * Four fields are required, because the database requires them: the pairing
 * itself, where it sits against the current range, and where the item stands.
 * Everything else is optional and genuinely unknown at the moment a pairing is
 * first made — nobody has a view on fit, a door count or a velocity the
 * instant a product is put in front of an account.
 *
 * The same nullable-column reading the Retailer type carries, for the same
 * reason: every one of these columns is nullable in Postgres, and declaring
 * them present is a lie that holds only while the data happens to be complete.
 * An absent velocity is not a velocity of nought, and a step nobody has dated
 * is not a step due today.
 */
export interface WorkstreamRecord {
  id: string;
  retailerId: RetailerId;
  /** Absent while nobody carries it; brokers.id is ON DELETE SET NULL. */
  brokerId?: BrokerId;
  productId: ProductId;
  currentTarget: CurrentTarget;
  itemStatus: ItemStatus;
  sampleStatus: SampleStatus;
  fit?: Fit;
  /** The buyer's own words. Absent until they have actually said something. */
  buyerFeedback?: string;
  /** Theme the feedback belongs to, for rolling up recurring signals. */
  feedbackTheme?: string;
  requestedRetail?: number;
  quotedCost?: number;
  moq?: number;
  estimatedDoors?: number;
  /**
   * Per-SKU velocity assumption. Held on the record rather than inherited
   * from the retailer, because SKUs in the same account do not move at the
   * same rate — and it makes the annual figure verifiable from its own row.
   */
  unitsPerStoreWeek?: number;
  /**
   * estimatedDoors x unitsPerStoreWeek x 52.
   *
   * A stored generated column, so it is absent exactly when either input is —
   * Postgres yields NULL rather than nought, and so does this.
   */
  estimatedAnnualUnits?: number;
  nextAction?: string;
  nextActionDate?: string;
  /** Absent while nobody owns the next step. */
  ownerId?: OwnerId;
  /** Links to the tracked action list when this step is formally tracked. */
  actionId?: string;
  notes?: string;
}

/* ── Actions ───────────────────────────────────────────────────────────── */

export interface Action {
  id: string;
  label: string;
  retailerId: RetailerId;
  productId?: ProductId;
  ownerId: OwnerId;
  due: string;
  status: ActionStatus;
}

/* ── Meetings ──────────────────────────────────────────────────────────── */

export interface Meeting {
  id: string;
  date: string;
  title: string;
  retailerId: RetailerId;
  brokerId: BrokerId;
  attendees: string[];
  summary: string;
  decisions: string[];
  actions: string[];
}

/* ── Activity ──────────────────────────────────────────────────────────── */

export interface Activity {
  id: string;
  date: string;
  type: ActivityType;
  retailerId: RetailerId;
  productId?: ProductId;
  personId: OwnerId;
  description: string;
}

/* ── Opportunities — CLD's strategic / product intelligence layer ──────── */

export interface Opportunity {
  id: string;
  title: string;
  type: string;
  productIds: ProductId[];
  retailerIds: RetailerId[];
  signal: string;
  recommendation: string;
  confidence: "High" | "Medium" | "Low";
  recommendedAction: string;
}

/** Something worth doing later, deliberately not now. */
export interface NotYetItem {
  id: string;
  label: string;
  reason: string;
}
