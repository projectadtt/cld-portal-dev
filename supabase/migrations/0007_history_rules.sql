-- 0007_history_rules.sql
-- Append-only enforcement, in the database rather than in application code,
-- so a future admin screen cannot bypass a history rule by accident.
--
-- Two tables are append-only:
--   buyer_feedback -- what a buyer said is the most valuable record in the
--                     system and the one most easily destroyed by a
--                     well-meant edit. A correction is a new row.
--   activities     -- the history spine. It doubles as the status-change
--                     audit, which is why no parallel audit table exists.
--
-- The rule blocks application writes, not referential maintenance. Both
-- tables carry ON DELETE SET NULL keys, and Postgres implements that as an
-- UPDATE on the child row -- so deleting a broker, a meeting or a contact
-- would otherwise be refused by the very rule that protects the history.
--
-- The escape is a session variable that has to be set deliberately and
-- expires with the transaction. Nothing can bypass the rule by accident:
-- an admin screen would have to opt in by name, and the opt-in is greppable.
-- Seeding and tenant purge use it; ordinary writes never do.

create or replace function cld_append_only() returns trigger as $fn$
begin
  if coalesce(current_setting('cld.allow_history_write', true), 'off') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  raise exception
    '% is append-only: % is not permitted. Insert a new row instead.',
    tg_table_name, tg_op;
end;
$fn$ language plpgsql;

/* -- buyer_feedback --------------------------------------------------- */

drop trigger buyer_feedback_touch on buyer_feedback;

create trigger buyer_feedback_no_update before update on buyer_feedback
  for each row execute function cld_append_only();

create trigger buyer_feedback_no_delete before delete on buyer_feedback
  for each row execute function cld_append_only();

/* -- activities ------------------------------------------------------- */

drop trigger activities_touch on activities;

create trigger activities_no_update before update on activities
  for each row execute function cld_append_only();

create trigger activities_no_delete before delete on activities
  for each row execute function cld_append_only();

-- samples are not append-only. Filling in sent_at or received_at on an open
-- sample is completing a record, not rewriting one. What is forbidden there
-- is reusing a row for a second round, and that is a write-path rule rather
-- than a constraint: "Additional samples requested" inserts a new row.
