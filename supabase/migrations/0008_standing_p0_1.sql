-- 0008_standing_p0_1.sql
--
-- P0-1 IS NOT DECIDED BY THIS MIGRATION.
--
-- The approved database specification defines pipeline_status + standing as
-- the implementation model, and both the specification and the decision
-- brief recommend the split. This migration puts the structure in place
-- while leaving the business decision genuinely open, and it is isolated in
-- its own file for exactly that reason.
--
-- Why nothing is locked in:
--
--   1. Every one of the nine current retailers is genuinely Active. No row
--      carries a value that encodes a judgement, so no business behaviour
--      changes and no existing meaning is overwritten.
--   2. pipeline_status is untouched. It holds the sixteen ladder values, in
--      order, exactly as the workbook words them.
--   3. If CLD adopts the split, nothing further is needed.
--   4. If CLD rejects it, down/0008 drops the column and the lookup table
--      cleanly, and the three non-ladder values fold into pipeline_status as
--      additional rows -- an INSERT, because statuses are lookup rows rather
--      than a native enum type.
--
-- Both outcomes remain a small additive change from here. That is the point
-- of keeping this separate from 0002.

create table lookup_standing (
  value         text primary key,
  display_label text    not null,
  sort_order    integer not null unique,
  is_terminal   boolean not null default false,
  counts_as_attention boolean not null default false
);

insert into lookup_standing (value, display_label, sort_order, is_terminal, counts_as_attention) values
  ('Active',             'Active',             10, false, false),
  ('Follow-up required', 'Follow-up required', 20, false, true),
  ('On hold',            'On hold',            30, false, false),
  ('Not proceeding',     'Not proceeding',     40, true,  false);

alter table retailers
  add column standing text not null default 'Active'
    references lookup_standing (value);

create index retailers_standing_idx on retailers (standing);
