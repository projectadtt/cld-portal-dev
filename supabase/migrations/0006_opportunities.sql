-- 0006_opportunities.sql
-- opportunities and its two join tables. Last, because the joins reference
-- three tables between them.
--
-- notYet folds in here with status = 'Deferred', so a decision not to act
-- sits in the same register as a decision to act.
--
-- DEVIATION FROM SPECIFICATION, REPORTED, NOT SILENT:
-- type and confidence are specified as NOT NULL. The three notYet records
-- carry a label and a reason and nothing else -- no type, no signal, no
-- confidence. Making those columns unconditionally NOT NULL would require
-- inventing a type and a confidence for each. Instead they are required only
-- while an opportunity is Active, which is where they carry meaning.

create table opportunities (
  id                 text primary key,
  client_id          text not null references clients (id) on delete cascade,
  title              text not null,
  type               text references lookup_opportunity_type (value),
  confidence         text references lookup_confidence (value),
  signal             text,
  recommendation     text,
  recommended_action text,
  status             text not null default 'Active' references lookup_opportunity_status (value),
  deferral_reason    text,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint opportunities_active_is_classified check (
    status <> 'Active' or (type is not null and confidence is not null)
  ),
  constraint opportunities_deferred_has_reason check (
    status <> 'Deferred' or deferral_reason is not null
  )
);

create index opportunities_client_idx on opportunities (client_id);
create index opportunities_status_idx on opportunities (status);

create trigger opportunities_touch before update on opportunities
  for each row execute function cld_touch_updated_at();

/* -- scope joins ----------------------------------------------------- */
--
-- Replaces the inline productIds / retailerIds arrays and makes the scope of
-- an opportunity queryable from either direction.

create table opportunity_products (
  opportunity_id text not null references opportunities (id) on delete cascade,
  product_id     text not null references products (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, product_id)
);

create index opportunity_products_product_idx on opportunity_products (product_id);

create table opportunity_retailers (
  opportunity_id text not null references opportunities (id) on delete cascade,
  retailer_id    text not null references retailers (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, retailer_id)
);

create index opportunity_retailers_retailer_idx on opportunity_retailers (retailer_id);
