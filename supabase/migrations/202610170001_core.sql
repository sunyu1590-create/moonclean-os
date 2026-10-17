-- MoonClean OS phase 2. Apply with Supabase migrations. All timestamps are timestamptz (UTC storage).
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (length(display_name) <= 100)
);
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  platform text not null default 'pinduoduo',
  currency text not null default 'CNY',
  timezone text not null default 'Asia/Shanghai',
  sales_target numeric(18,2) not null default 0,
  margin_alert numeric(5,2) not null default 12,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_name_length check (length(trim(name)) between 1 and 120),
  constraint stores_platform_check check (platform in ('pinduoduo','douyin','other')),
  constraint stores_currency_check check (currency in ('CNY','USD')),
  constraint stores_target_check check (sales_target >= 0),
  constraint stores_margin_check check (margin_alert between 0 and 100),
  constraint stores_status_check check (status in ('active','archived'))
);
create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  created_at timestamptz not null default now(),
  constraint store_members_role_check check (role in ('owner','admin','editor','viewer')),
  constraint store_members_unique unique (store_id,user_id)
);
create unique index if not exists one_owner_per_store on public.store_members(store_id) where role='owner';
create index if not exists store_members_user_idx on public.store_members(user_id,store_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null,
  category text not null default '',
  status text not null default 'active',
  legacy_id text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_check check (length(trim(name)) between 1 and 180),
  constraint products_status_check check (status in ('active','archived')),
  constraint products_store_id_unique unique (id,store_id)
);
create unique index if not exists products_legacy_unique on public.products(store_id,legacy_id) where legacy_id is not null;
create index if not exists products_store_status_idx on public.products(store_id,status,name);
create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  product_id uuid not null,
  sku_name text not null,
  sku_code text,
  selling_price numeric(18,2) not null default 0,
  status text not null default 'active',
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_product_fk foreign key(product_id,store_id) references public.products(id,store_id) on delete restrict,
  constraint skus_store_id_unique unique(id,store_id),
  constraint skus_price_check check(selling_price >= 0),
  constraint skus_name_check check(length(trim(sku_name)) between 1 and 180),
  constraint skus_status_check check(status in ('active','archived'))
);
create unique index if not exists skus_code_unique on public.skus(store_id,sku_code) where sku_code is not null;
create unique index if not exists skus_legacy_unique on public.skus(store_id,legacy_id) where legacy_id is not null;
create index if not exists skus_product_idx on public.skus(product_id,status);
create table if not exists public.sku_costs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sku_id uuid not null,
  product_cost numeric(18,2) not null,
  packaging_cost numeric(18,2) not null,
  shipping_cost numeric(18,2) not null,
  platform_fee numeric(18,2) not null,
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint sku_costs_sku_fk foreign key(sku_id,store_id) references public.skus(id,store_id) on delete restrict,
  constraint sku_costs_nonnegative check(product_cost >= 0 and packaging_cost >= 0 and shipping_cost >= 0 and platform_fee >= 0)
);
create index if not exists sku_costs_effective_idx on public.sku_costs(sku_id,effective_from desc,created_at desc);
create index if not exists sku_costs_store_idx on public.sku_costs(store_id);

create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  metric_date date not null,
  gross_sales numeric(18,2) not null default 0,
  refunds numeric(18,2) not null default 0,
  order_count integer not null default 0,
  other_expenses numeric(18,2) not null default 0,
  -- Manual aggregate snapshots preserve phase-1 finance. NULL means data incomplete.
  product_cost numeric(18,2),
  packaging_cost numeric(18,2),
  shipping_cost numeric(18,2),
  platform_fee numeric(18,2),
  cost_source text not null default 'manual',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_metrics_unique unique(store_id,metric_date),
  constraint daily_metrics_nonnegative check(gross_sales >= 0 and refunds >= 0 and refunds <= gross_sales and order_count >= 0 and other_expenses >= 0 and (product_cost is null or product_cost >= 0) and (packaging_cost is null or packaging_cost >= 0) and (shipping_cost is null or shipping_cost >= 0) and (platform_fee is null or platform_fee >= 0)),
  constraint daily_metrics_cost_source_check check(cost_source in ('manual','sku'))
);
create index if not exists daily_metrics_store_date_idx on public.daily_metrics(store_id,metric_date desc);
create table if not exists public.ad_metrics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  metric_date date not null,
  advertising_spend numeric(18,2) not null default 0,
  attributed_revenue numeric(18,2) not null default 0,
  attributed_orders integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_metrics_unique unique(store_id,metric_date),
  constraint ad_metrics_nonnegative check(advertising_spend >= 0 and attributed_revenue >= 0 and attributed_orders >= 0)
);
create index if not exists ad_metrics_store_date_idx on public.ad_metrics(store_id,metric_date desc);
create table if not exists public.sku_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  sku_id uuid not null,
  metric_date date not null,
  quantity_sold integer not null default 0,
  gross_sales numeric(18,2) not null default 0,
  refund_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_daily_metrics_sku_fk foreign key(sku_id,store_id) references public.skus(id,store_id) on delete restrict,
  constraint sku_daily_metrics_unique unique(store_id,sku_id,metric_date),
  constraint sku_daily_metrics_nonnegative check(quantity_sold >= 0 and gross_sales >= 0 and refund_amount >= 0 and refund_amount <= gross_sales)
);
create index if not exists sku_daily_metrics_store_date_idx on public.sku_daily_metrics(store_id,metric_date desc);
-- Product sales allocations from phase 1; these are rankings, never added to store gross sales.
create table if not exists public.product_daily_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  product_id uuid not null,
  metric_date date not null,
  gross_sales numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_daily_sales_product_fk foreign key(product_id,store_id) references public.products(id,store_id) on delete restrict,
  constraint product_daily_sales_unique unique(store_id,product_id,metric_date),
  constraint product_daily_sales_nonnegative check(gross_sales >= 0)
);
create index if not exists product_daily_sales_store_date_idx on public.product_daily_sales(store_id,metric_date desc);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  change_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_summary_object check(jsonb_typeof(change_summary)='object')
);
create index if not exists audit_logs_store_time_idx on public.audit_logs(store_id,created_at desc);
create table if not exists public.migration_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  source_kind text not null,
  source_id text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint migration_records_unique unique(store_id,source_kind,source_id)
);
create index if not exists migration_records_store_idx on public.migration_records(store_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
do $$ declare t text; begin
  foreach t in array array['profiles','stores','products','skus','daily_metrics','ad_metrics','sku_daily_metrics','product_daily_sales'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end loop;
end $$;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create or replace function public.create_store_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.store_members(store_id,user_id,role) values(new.id,new.created_by,'owner'); return new; end; $$;
drop trigger if exists on_store_created on public.stores;
create trigger on_store_created after insert on public.stores for each row execute function public.create_store_owner();
create or replace function public.protect_store_identity() returns trigger language plpgsql set search_path='' as $$
begin if new.id<>old.id or new.created_by<>old.created_by then raise exception 'store identity is immutable'; end if; if new.status<>old.status and (select role from public.store_members where store_id=old.id and user_id=auth.uid())<>'owner' then raise exception 'only owner may archive store' using errcode='42501'; end if; return new; end; $$;
drop trigger if exists protect_store_identity on public.stores;
create trigger protect_store_identity before update on public.stores for each row execute function public.protect_store_identity();
create or replace function public.prevent_owner_removal() returns trigger language plpgsql set search_path='' as $$
begin if old.role='owner' and tg_op='DELETE' then raise exception 'transfer ownership before removing owner'; end if; return old; end; $$;
drop trigger if exists prevent_owner_removal on public.store_members;
create trigger prevent_owner_removal before delete on public.store_members for each row execute function public.prevent_owner_removal();
create or replace function public.validate_store_timezone() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'invalid store timezone'; end if;
  return new;
end $$;
drop trigger if exists validate_store_timezone on public.stores;
create trigger validate_store_timezone before insert or update of timezone on public.stores for each row execute function public.validate_store_timezone();
