-- down/0007_history_rules.sql
drop trigger if exists buyer_feedback_no_update on buyer_feedback;
drop trigger if exists buyer_feedback_no_delete on buyer_feedback;
drop trigger if exists activities_no_update on activities;
drop trigger if exists activities_no_delete on activities;
create trigger buyer_feedback_touch before update on buyer_feedback
  for each row execute function cld_touch_updated_at();
create trigger activities_touch before update on activities
  for each row execute function cld_touch_updated_at();
drop function if exists cld_append_only();
