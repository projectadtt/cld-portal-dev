-- 0004_engagement.sql
-- meetings, meeting_attendees, samples, buyer_feedback.
--
-- meetings is created before buyer_feedback because buyer_feedback.meeting_id
-- is a foreign key to it. The implementation plan's proposed order had these
-- reversed, which would have failed at creation.

/* -- meetings -------------------------------------------------------- */
--
-- meeting_status has three values, not the portal's five. "Not scheduled"
-- and "Follow-up needed" describe an account, not a meeting: the first means
-- no meeting row exists, the second is the account's standing.

create table meetings (
  id           text primary key,
  retailer_id  text not null references retailers (id) on delete cascade,
  broker_id    text references brokers (id) on delete set null,
  scheduled_at timestamptz not null,
  status       text not null default 'Scheduled' references lookup_meeting_status (value),
  title        text not null,
  location     text,
  summary      text,
  decisions    text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index meetings_retailer_idx on meetings (retailer_id);
create index meetings_broker_idx   on meetings (broker_id);
create index meetings_when_idx     on meetings (scheduled_at desc);

create trigger meetings_touch before update on meetings
  for each row execute function cld_touch_updated_at();

/* -- meeting_attendees ----------------------------------------------- */
--
-- Today the attendee array mixes both kinds of people as prose:
-- ["Sarah Chen (CLD)", "Regional Category Buyer (demo contact)"]. Two
-- nullable keys plus a display fallback separates them without a
-- polymorphic table.

create table meeting_attendees (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   text not null references meetings (id) on delete cascade,
  contact_id   uuid references contacts (id) on delete set null,
  broker_id    text references brokers (id) on delete set null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint meeting_attendees_identified check (
    contact_id is not null or broker_id is not null or display_name is not null
  )
);

create index meeting_attendees_meeting_idx on meeting_attendees (meeting_id);
create index meeting_attendees_contact_idx on meeting_attendees (contact_id);
create index meeting_attendees_broker_idx  on meeting_attendees (broker_id);

create trigger meeting_attendees_touch before update on meeting_attendees
  for each row execute function cld_touch_updated_at();

/* -- samples --------------------------------------------------------- */
--
-- One row per physical send. A second round is a second row, never an
-- overwrite. Five nullable lifecycle dates, because each step happens at
-- most once per sample -- deliberately not a sample_events table.

create table samples (
  id                   uuid primary key default gen_random_uuid(),
  workstream_item_id   text not null references workstream_items (id) on delete cascade,
  status               text not null references lookup_sample_status (value),
  requested_at         date,
  prepared_at          date,
  sent_at              date,
  received_at          date,
  reviewed_at          date,
  quantity             integer,
  recipient_contact_id uuid references contacts (id) on delete set null,
  carrier_reference    text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index samples_item_idx    on samples (workstream_item_id);
create index samples_contact_idx on samples (recipient_contact_id);
create index samples_sent_idx    on samples (sent_at desc);

create trigger samples_touch before update on samples
  for each row execute function cld_touch_updated_at();

/* -- buyer_feedback -------------------------------------------------- */
--
-- Append-only. One row per thing a buyer said. A correction is a new row;
-- the append-only rule itself is enforced in migration 0007.
--
-- DEVIATION FROM SPECIFICATION, REPORTED, NOT SILENT:
-- occurred_at and source are specified as NOT NULL. Nine feedback strings
-- exist in the current data and only two carry a verifiable date. Making
-- these columns NOT NULL would force either a fabricated date on seven rows
-- or the loss of those seven records. Both are worse than a null. They are
-- nullable here and must be required at the point of entry in Phase 5.

create table buyer_feedback (
  id                 uuid primary key default gen_random_uuid(),
  workstream_item_id text not null references workstream_items (id) on delete cascade,
  quote              text not null,
  theme              text,
  sentiment          text references lookup_sentiment (value),
  contact_id         uuid references contacts (id) on delete set null,
  meeting_id         text references meetings (id) on delete set null,
  source             text references lookup_feedback_source (value),
  occurred_at        date,
  recorded_by        text references brokers (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index buyer_feedback_item_idx    on buyer_feedback (workstream_item_id);
create index buyer_feedback_contact_idx on buyer_feedback (contact_id);
create index buyer_feedback_meeting_idx on buyer_feedback (meeting_id);
create index buyer_feedback_broker_idx  on buyer_feedback (recorded_by);
create index buyer_feedback_when_idx    on buyer_feedback (occurred_at desc nulls last);

create trigger buyer_feedback_touch before update on buyer_feedback
  for each row execute function cld_touch_updated_at();
