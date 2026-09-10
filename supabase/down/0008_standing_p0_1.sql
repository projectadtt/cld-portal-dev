-- down/0008_standing_p0_1.sql
-- Reverses the P0-1 structure if CLD rejects the split.
drop index if exists retailers_standing_idx;
alter table retailers drop column if exists standing;
drop table if exists lookup_standing;
