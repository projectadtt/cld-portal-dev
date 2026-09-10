-- 0001_lookups.sql
-- Status lookup tables. Created before every entity table, because nine
-- tables carry a status column constrained by one of these.
--
-- Lookup tables rather than native Postgres enums, per the approved
-- specification: adding a status becomes an INSERT rather than a migration,
-- and CLD can relabel a status for a client without touching stored data.
-- Every stored value uses the workbook's wording verbatim.

-- gen_random_uuid() is core Postgres since 13, so no extension is required
-- here or on Supabase.

-- Shared updated_at maintenance. Infrastructure, not an entity.
create or replace function cld_touch_updated_at() returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

/* -- Account level -------------------------------------------------- */

create table lookup_pipeline_status (
  value         text primary key,
  display_label text    not null,
  sort_order    integer not null unique,
  is_terminal   boolean not null default false
);

insert into lookup_pipeline_status (value, display_label, sort_order, is_terminal) values
  ('Not reached out yet',               'Not started',       10,  false),
  ('Intro planned',                     'Intro planned',     20,  false),
  ('Reached out - waiting on response', 'Awaiting response', 30,  false),
  ('Asked for meeting',                 'Meeting requested', 40,  false),
  ('Meeting scheduled',                 'Meeting scheduled', 50,  false),
  ('Meeting completed',                 'Meeting completed', 60,  false),
  ('Samples requested',                 'Samples requested', 70,  false),
  ('Samples sent',                      'Samples sent',      80,  false),
  ('Samples reviewed',                  'Samples reviewed',  90,  false),
  ('Pricing requested',                 'Pricing requested', 100, false),
  ('Pricing submitted',                 'Pricing submitted', 110, false),
  ('Line review / category review',     'Category review',   120, false),
  ('Buyer evaluating',                  'Buyer evaluating',  130, false),
  ('Approved / onboarding',             'Approved',          140, false),
  ('Live - online',                     'Live online',       150, true),
  ('Live - stores',                     'Live in store',     160, true);

create table lookup_current_target (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_current_target values
  ('Current',             'Current',             10),
  ('Target',              'Target',              20),
  ('Current + Expansion', 'Current + Expansion', 30),
  ('Do Not Pursue',       'Do not pursue',       40),
  ('Benchmark',           'Benchmark',           50);

create table lookup_priority (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_priority values ('High', 'High', 10), ('Medium', 'Medium', 20), ('Low', 'Low', 30);

create table lookup_tier (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_tier values ('Tier 1', 'Tier 1', 10), ('Tier 2', 'Tier 2', 20), ('Tier 3', 'Tier 3', 30);

create table lookup_fit (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_fit values
  ('High', 'High', 10), ('Medium', 'Medium', 20), ('Low', 'Low', 30), ('Unknown', 'Unknown', 40);

/* -- Item and sample level ------------------------------------------ */

create table lookup_item_status (
  value text primary key, display_label text not null, sort_order integer not null unique,
  is_terminal boolean not null default false
);
insert into lookup_item_status (value, display_label, sort_order, is_terminal) values
  ('Not pitched',       'Not pitched',       10,  false),
  ('Pitch planned',     'Pitch planned',     20,  false),
  ('Pitched',           'Pitched',           30,  false),
  ('Samples requested', 'Samples requested', 40,  false),
  ('Samples sent',      'Samples sent',      50,  false),
  ('Samples reviewed',  'Samples reviewed',  60,  false),
  ('Pricing requested', 'Pricing requested', 70,  false),
  ('Pricing submitted', 'Pricing submitted', 80,  false),
  ('Buyer evaluating',  'Buyer evaluating',  90,  false),
  ('Accepted',          'Accepted',          100, true),
  ('Rejected',          'Rejected',          110, true);

-- is_with_retailer replaces the hardcoded SAMPLE_IN_MARKET list in status.ts.
create table lookup_sample_status (
  value text primary key, display_label text not null, sort_order integer not null unique,
  is_with_retailer boolean not null default false
);
insert into lookup_sample_status (value, display_label, sort_order, is_with_retailer) values
  ('Not discussed',                'Not discussed',                10, false),
  ('Requested',                    'Requested',                    20, false),
  ('Preparing',                    'Preparing',                    30, false),
  ('Sent',                         'Sent',                         40, true),
  ('Received',                     'Received',                     50, true),
  ('Reviewed - positive',          'Reviewed positive',            60, true),
  ('Reviewed - neutral',           'Reviewed neutral',             70, true),
  ('Reviewed - concerns',          'Reviewed concerns',            80, true),
  ('Additional samples requested', 'Additional samples requested', 90, false);

/* -- Product --------------------------------------------------------- */

create table lookup_readiness (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_readiness values
  ('Retail ready', 'Retail ready', 10), ('In preparation', 'In preparation', 20), ('Needs work', 'Needs work', 30);

/* -- People ---------------------------------------------------------- */

create table lookup_broker_status (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_broker_status values ('Active', 'Active', 10), ('Paused', 'Paused', 20);

/* -- Work ------------------------------------------------------------ */

create table lookup_action_status (
  value text primary key, display_label text not null, sort_order integer not null unique,
  is_open boolean not null default true, carries_attention boolean not null default false
);
insert into lookup_action_status (value, display_label, sort_order, is_open, carries_attention) values
  ('Open',        'Open',        10, true,  false),
  ('In Progress', 'In Progress', 20, true,  false),
  ('Blocked',     'Blocked',     30, true,  true),
  ('Done',        'Done',        40, false, false);

create table lookup_meeting_status (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_meeting_status values
  ('Scheduled', 'Scheduled', 10), ('Completed', 'Completed', 20), ('Cancelled', 'Cancelled', 30);

create table lookup_activity_type (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_activity_type values
  ('Sample sent',       'Sample sent',       10),
  ('Buyer feedback',    'Buyer feedback',    20),
  ('Broker update',     'Broker update',     30),
  ('Meeting completed', 'Meeting completed', 40),
  ('Pricing requested', 'Pricing requested', 50),
  ('Action created',    'Action created',    60),
  ('Status change',     'Status change',     70),
  ('Email',             'Email',             80),
  ('Call',              'Call',              90),
  ('Internal note',     'Internal note',     100);

/* -- Feedback -------------------------------------------------------- */

create table lookup_sentiment (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_sentiment values ('Positive', 'Positive', 10), ('Neutral', 'Neutral', 20), ('Concern', 'Concern', 30);

create table lookup_feedback_source (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_feedback_source values
  ('Meeting',       'Meeting',       10),
  ('Email',         'Email',         20),
  ('Call',          'Call',          30),
  ('Broker relay',  'Broker relay',  40),
  ('Sample review', 'Sample review', 50);

/* -- Opportunities --------------------------------------------------- */

create table lookup_opportunity_type (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_opportunity_type values
  ('Product / packaging', 'Product / packaging', 10),
  ('Positioning',         'Positioning',         20),
  ('Category expansion',  'Category expansion',  30),
  ('Commercial',          'Commercial',          40);

create table lookup_opportunity_status (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_opportunity_status values
  ('Active', 'Active', 10), ('Deferred', 'Deferred', 20), ('Closed', 'Closed', 30);

create table lookup_confidence (
  value text primary key, display_label text not null, sort_order integer not null unique
);
insert into lookup_confidence values ('High', 'High', 10), ('Medium', 'Medium', 20), ('Low', 'Low', 30);
