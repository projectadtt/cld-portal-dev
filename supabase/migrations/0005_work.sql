-- 0005_work.sql
-- actions and activities. Both come last among the entity tables because
-- between them they reference almost everything else.
--
-- No priority column on actions. Due date plus status already carries
-- urgency, and the Actions screen groups on exactly that. A separate
-- priority creates a second urgency signal that can contradict the first.

/* -- actions --------------------------------------------------------- */
--
-- Four columns are required: retailer, owner, label, status. Everything else
-- is optional, so "call the Metro buyer back" with no product, no item, no
-- meeting and no date is a valid row.
--
-- workstream_item_id is the reversal of WorkstreamRecord.actionId. That
-- single-value field already loses act-01 on ws-01, because act-02 occupies
-- the slot. Many actions per item is the correct cardinality.
--
-- due is nullable here though it is required on every current record. The
-- portal's "no date" action group can never populate while it is required.

create table actions (
  id                 text primary key,
  retailer_id        text not null references retailers (id) on delete cascade,
  owner_id           text not null references brokers (id) on delete restrict,
  label              text not null,
  status             text not null default 'Open' references lookup_action_status (value),
  due                date,
  product_id         text references products (id) on delete set null,
  workstream_item_id text references workstream_items (id) on delete set null,
  meeting_id         text references meetings (id) on delete set null,
  description        text,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- There is deliberately no "Done implies completed_at" constraint. act-01 is
-- Done in the current data and nothing records when it was finished; a
-- constraint here would force a fabricated date onto a historical row. The
-- rule belongs on the write path in Phase 5, where a real completion time
-- exists at the moment the status changes.

create index actions_retailer_idx on actions (retailer_id);
create index actions_owner_idx    on actions (owner_id);
create index actions_product_idx  on actions (product_id);
create index actions_item_idx     on actions (workstream_item_id);
create index actions_meeting_idx  on actions (meeting_id);
create index actions_due_idx      on actions (due) where status <> 'Done';

create trigger actions_touch before update on actions
  for each row execute function cld_touch_updated_at();

/* -- activities ------------------------------------------------------ */
--
-- Append-only. This is the history spine and doubles as the status-change
-- audit, which is why no parallel audit table exists. The append-only rule
-- is enforced in migration 0007.

create table activities (
  id                 text primary key,
  retailer_id        text not null references retailers (id) on delete cascade,
  occurred_at        timestamptz not null,
  type               text not null references lookup_activity_type (value),
  description        text not null,
  person_id          text references brokers (id) on delete set null,
  product_id         text references products (id) on delete set null,
  workstream_item_id text references workstream_items (id) on delete set null,
  meeting_id         text references meetings (id) on delete set null,
  is_system          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index activities_retailer_idx on activities (retailer_id);
create index activities_when_idx     on activities (occurred_at desc);
create index activities_person_idx   on activities (person_id);
create index activities_product_idx  on activities (product_id);
create index activities_item_idx     on activities (workstream_item_id);
create index activities_meeting_idx  on activities (meeting_id);

create trigger activities_touch before update on activities
  for each row execute function cld_touch_updated_at();
