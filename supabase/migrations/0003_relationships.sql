-- 0003_relationships.sql
-- contacts and workstream_items.
--
-- contacts comes first: samples, buyer_feedback and meeting_attendees all
-- reference it. It is created here but carries no personal data on seed --
-- P0-3 is unresolved, so name holds the source string verbatim and email,
-- phone and title stay null.
--
-- workstream_items is the atomic operational record: one product at one
-- account, unique on that pair.

/* -- contacts -------------------------------------------------------- */

create table contacts (
  id          uuid primary key default gen_random_uuid(),
  retailer_id text not null references retailers (id) on delete cascade,
  name        text not null,
  title       text,
  email       text,
  phone       text,
  is_primary  boolean not null default false,
  notes       text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contacts_retailer_idx on contacts (retailer_id);

-- One primary contact per retailer, among the contacts still in play.
create unique index contacts_one_primary_per_retailer
  on contacts (retailer_id)
  where is_primary and archived_at is null;

create trigger contacts_touch before update on contacts
  for each row execute function cld_touch_updated_at();

/* -- workstream_items ------------------------------------------------ */
--
-- Removed from the row, now derived from children:
--   sample_status                 -> samples
--   buyer_feedback, feedback_theme -> buyer_feedback
--   next_action, next_action_date, action_id -> actions
--
-- The last one is the important reversal. Today WorkstreamRecord.actionId
-- holds a single action, which already loses act-01 on ws-01. The key now
-- lives on actions.workstream_item_id, so an item can carry many actions.

create table workstream_items (
  id                   text primary key,
  retailer_id          text not null references retailers (id) on delete cascade,
  product_id           text not null references products (id) on delete restrict,
  broker_id            text references brokers (id) on delete set null,
  owner_id             text references brokers (id) on delete set null,
  current_target       text not null default 'Target'
                         references lookup_current_target (value),
  item_status          text not null default 'Not pitched'
                         references lookup_item_status (value),
  fit                  text references lookup_fit (value),
  requested_retail     numeric(10,2),
  quoted_cost          numeric(10,2),
  moq                  integer,
  estimated_doors      integer,
  units_per_store_week numeric(6,2),
  estimated_annual_units integer generated always as (
    (estimated_doors * units_per_store_week * 52)::integer
  ) stored,
  notes                text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint workstream_items_pair_unique unique (retailer_id, product_id),
  constraint workstream_doors_non_negative check (estimated_doors is null or estimated_doors >= 0)
);

create index workstream_items_retailer_idx on workstream_items (retailer_id);
create index workstream_items_product_idx  on workstream_items (product_id);
create index workstream_items_broker_idx   on workstream_items (broker_id);
create index workstream_items_owner_idx    on workstream_items (owner_id);
create index workstream_items_status_idx   on workstream_items (item_status);

create trigger workstream_items_touch before update on workstream_items
  for each row execute function cld_touch_updated_at();
