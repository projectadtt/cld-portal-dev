-- down/0009_planning_fields.sql
drop index if exists retailers_next_meeting_idx;
alter table retailers
  drop column if exists next_meeting_status,
  drop column if exists next_meeting_at,
  drop column if exists next_action,
  drop column if exists next_action_date;
alter table workstream_items
  drop column if exists next_action,
  drop column if exists next_action_date;
drop table if exists lookup_meeting_outlook;
