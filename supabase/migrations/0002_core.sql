-- 0002_core.sql
-- Tenant root and the three master entities.
--
-- Creation order is forced by the foreign keys: clients before brokers,
-- brokers before retailers (retailers.assigned_broker_id points at them),
-- products independent of retailers but after clients.
--
-- Primary keys are text holding the existing slugs. The specification calls
-- for uuid on high-volume tables, but every id in the current dataset is a
-- slug that also serves as a route segment, and the standing rule is that no
-- existing id changes. Genuinely new tables (contacts, samples,
-- buyer_feedback, meeting_attendees) use uuid.
--
-- retailers.standing is deliberately absent here. It is P0-1 and lives in
-- its own reversible migration, 0007.

/* -- clients: tenant root -------------------------------------------- */

create table clients (
  id         text primary key,
  name       text not null,
  workspace  text not null,
  tagline    text,
  category   text,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_touch before update on clients
  for each row execute function cld_touch_updated_at();

/* -- brokers --------------------------------------------------------- */

create table brokers (
  id          text primary key,
  client_id   text not null references clients (id) on delete cascade,
  name        text not null,
  short_name  text not null,
  role        text,
  coverage    text,
  initials    text,
  status      text not null default 'Active' references lookup_broker_status (value),
  email       text,
  phone       text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint brokers_client_name_unique unique (client_id, name)
);

create index brokers_client_idx on brokers (client_id);

create trigger brokers_touch before update on brokers
  for each row execute function cld_touch_updated_at();

/* -- retailers ------------------------------------------------------- */
--
-- Four columns present on the current record are deliberately absent:
-- sample_status, meeting_status, meeting_date and next_action/date. All four
-- are roll-ups of child records, and three have already drifted in a
-- nine-row dataset. They become calculated.

create table retailers (
  id                   text primary key,
  client_id            text not null references clients (id) on delete cascade,
  name                 text not null,
  short_name           text not null,
  channel              text not null,
  geography            text,
  assigned_broker_id   text references brokers (id) on delete set null,
  current_target       text not null default 'Target'
                         references lookup_current_target (value),
  pipeline_status      text not null default 'Not reached out yet'
                         references lookup_pipeline_status (value),
  tier                 text references lookup_tier (value),
  priority             text references lookup_priority (value),
  fit                  text references lookup_fit (value),
  categories           text[] not null default '{}',
  approximate_doors    integer,
  assumed_skus         integer,
  units_per_store_week numeric(6,2),
  last_contact         date,
  attention_reason     text,
  notes                text,
  source_url           text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint retailers_client_name_unique unique (client_id, name),
  constraint retailers_doors_non_negative check (approximate_doors is null or approximate_doors >= 0)
);

create index retailers_client_idx on retailers (client_id);
create index retailers_broker_idx on retailers (assigned_broker_id);
create index retailers_status_idx on retailers (pipeline_status);

create trigger retailers_touch before update on retailers
  for each row execute function cld_touch_updated_at();

/* -- products -------------------------------------------------------- */

create table products (
  id              text primary key,
  client_id       text not null references clients (id) on delete cascade,
  item_id         text not null,
  name            text not null,
  category        text not null,
  pack_size       text,
  positioning     text,
  spec_notes      text,
  fob_cost        numeric(10,2),
  landed_cost     numeric(10,2),
  suggested_retail numeric(10,2),
  moq             integer,
  case_pack       integer,
  lead_time_days  integer,
  readiness       text not null default 'In preparation'
                    references lookup_readiness (value),
  upc             varchar(14),
  image_url       text,
  source_notes    text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint products_client_item_unique unique (client_id, item_id)
);

create index products_client_idx on products (client_id);

create trigger products_touch before update on products
  for each row execute function cld_touch_updated_at();

-- retailer_margin_pct is deliberately not a column. It is
-- (suggested_retail - landed_cost) / suggested_retail, and a stored copy is
-- free to disagree with its own inputs.
