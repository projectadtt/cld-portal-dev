-- 0009_planning_fields.sql
--
-- Phase 4 found that three field pairs dropped in 0002 and 0003 as
-- "calculated" are read by the UI and are NOT derivable from child records.
-- Restoring them is a correction to the specification, made on evidence
-- rather than convenience. Each is justified separately below.
--
-- What is NOT restored, because it genuinely is a roll-up:
--   retailers.sample_status  -- the furthest sample status among the account's
--                               items. It is the field that had already
--                               drifted (S&R read "Received" while one of its
--                               items read "Reviewed - positive"), and the
--                               derived value corrects it.

/* -- 1. Forward-looking meeting state --------------------------------- */
--
-- Evidence: two accounts hold a meeting state that no meetings row can carry.
--   the-marketplace  Scheduled, 2026-09-17  -- a meeting that has not happened
--   metro            Requested, no date     -- a meeting asked for, not booked
--
-- metro also has a completed meeting (mtg-07, 2026-08-14). One field could
-- not hold both facts, which is why the retailer record contradicted the
-- meetings table. Splitting historical from forward-looking resolves it: the
-- meetings table owns what happened, this pair owns what is next.
--
-- This is the same shape as pipeline_status + standing, for the same reason.

create table lookup_meeting_outlook (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_meeting_outlook values
  ('Requested', 'Meeting requested', 10),
  ('Scheduled', 'Meeting scheduled', 20);

alter table retailers
  add column next_meeting_status text references lookup_meeting_outlook (value),
  add column next_meeting_at date;

create index retailers_next_meeting_idx on retailers (next_meeting_at)
  where next_meeting_status is not null;

comment on column retailers.next_meeting_status is
  'Forward-looking only. A meeting that has happened is a meetings row.';

/* -- 2. Planning text, account level ---------------------------------- */
--
-- Evidence that this is content rather than a roll-up of actions:
--
--   a. The wording differs from the action it sits nearest. SM Markets reads
--      "Follow up on the protein claim rework before the shelf set", while
--      act-02 reads "Follow up with the SM Markets buyer on the protein claim
--      rework". Same subject, different sentence, written for a different
--      reader.
--   b. Two accounts carry planning text with no tracked action at all --
--      rustans and watsons. A roll-up would render them blank.
--
-- The date is stored alongside because the two are written together. Where a
-- tracked action exists the UI already prefers the action's own due date;
-- this is the fallback, which is exactly how the components use it today.

alter table retailers
  add column next_action text,
  add column next_action_date date;

/* -- 3. Planning text, item level ------------------------------------- */
--
-- Same argument, stronger evidence: five of fourteen workstream items carry
-- planning text with no tracked action -- ws-03, ws-05, ws-10, ws-12, ws-13.
-- Those five are precisely the early-stage pairings where CLD has an
-- intention but has not yet committed anyone to a dated action, which is the
-- case the field exists to cover.

alter table workstream_items
  add column next_action text,
  add column next_action_date date;
