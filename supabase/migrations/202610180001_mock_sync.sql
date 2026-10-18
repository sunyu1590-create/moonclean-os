-- Phase 3: mock platform synchronization. No official credentials or API calls.
create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  platform text not null default 'pinduoduo' check (platform='pinduoduo'),
  mode text not null default 'mock' check (mode in ('mock','official')),
  status text not null default 'demo' check (status in ('demo','unauthorized','authorized','expired','failed')),
  display_name text not null,
  auto_sync boolean not null default false,
  last_synced_at timestamptz,
  last_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  unique(store_id,platform,mode)
);
create index if not exists platform_connections_store_idx on public.platform_connections(store_id);
-- Reserved for future official adapter. Never grant browser roles any access.
create table if not exists private.platform_credentials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  client_id_ciphertext bytea,
  client_secret_ciphertext bytea,
  access_token_ciphertext bytea,
  refresh_token_ciphertext bytea,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(connection_id)
);
create table if not exists public.external_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  external_id text not null,
  name text not null,
  updated_at timestamptz not null,
  is_demo boolean not null default true,
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(connection_id,external_id),
  unique(id,store_id)
);
create table if not exists public.external_skus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  product_id uuid not null,
  external_id text not null,
  sku_code text,
  name text not null,
  selling_price numeric(18,2) not null default 0 check(selling_price>=0),
  updated_at timestamptz not null,
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  foreign key(product_id,store_id) references public.external_products(id,store_id) on delete restrict,
  unique(connection_id,external_id),
  unique(id,store_id),
  unique(id,store_id,connection_id)
);
create table if not exists public.external_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  external_id text not null,
  status text not null check(status in ('paid','shipped','completed','refunded','cancelled')),
  placed_at timestamptz not null,
  gross_sales numeric(18,2) not null check(gross_sales>=0),
  updated_at timestamptz not null,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(connection_id,external_id),
  unique(id,store_id)
);
create index if not exists external_orders_store_date_idx on public.external_orders(store_id,placed_at desc);
create table if not exists public.external_order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  external_sku_id text not null,
  quantity integer not null check(quantity>0),
  gross_sales numeric(18,2) not null check(gross_sales>=0),
  foreign key(order_id,store_id) references public.external_orders(id,store_id) on delete restrict,
  unique(order_id,external_sku_id)
);
create table if not exists public.external_refunds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  order_id uuid not null,
  external_id text not null,
  amount numeric(18,2) not null check(amount>=0),
  status text not null check(status in ('pending','succeeded','rejected')),
  updated_at timestamptz not null,
  is_demo boolean not null default true,
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  foreign key(order_id,store_id) references public.external_orders(id,store_id) on delete restrict,
  unique(connection_id,external_id)
);
create index if not exists external_refunds_order_idx on public.external_refunds(order_id);
create table if not exists public.platform_sku_mappings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  external_sku_id uuid not null,
  sku_id uuid not null,
  match_kind text not null check(match_kind in ('auto','manual')),
  created_at timestamptz not null default now(),
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  foreign key(external_sku_id,store_id,connection_id) references public.external_skus(id,store_id,connection_id) on delete restrict,
  foreign key(sku_id,store_id) references public.skus(id,store_id) on delete restrict,
  unique(connection_id,external_sku_id),
  unique(connection_id,sku_id)
);
create table if not exists public.platform_sku_mapping_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  connection_id uuid not null,
  external_sku_id uuid not null,
  sku_id uuid,
  action text not null check(action in ('bound','unbound')),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  kind text not null check(kind in ('orders','products','refunds')),
  status text not null default 'running' check(status in ('pending','running','success','partial_success','failed','cancelled')),
  success_count integer not null default 0 check(success_count>=0),
  failure_count integer not null default 0 check(failure_count>=0),
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  actor_user_id uuid references auth.users(id) on delete set null,
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(id,store_id)
);
drop index if exists public.sync_one_running_idx;
create unique index sync_one_running_idx on public.sync_jobs(connection_id) where status='running';
create index if not exists sync_jobs_store_time_idx on public.sync_jobs(store_id,started_at desc);
create table if not exists public.sync_cursors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  kind text not null check(kind in ('orders','products','refunds')),
  cursor_value text,
  updated_at timestamptz not null default now(),
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(connection_id,kind)
);
create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  job_id uuid not null,
  level text not null check(level in ('info','warn','error')),
  message text not null,
  created_at timestamptz not null default now(),
  foreign key(job_id,store_id) references public.sync_jobs(id,store_id) on delete restrict
);
create index if not exists sync_logs_job_idx on public.sync_logs(job_id,created_at);
-- Mutable platform-side fixtures. The adapter overlays these on deterministic seed rows.
create table if not exists public.mock_platform_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  connection_id uuid not null,
  kind text not null check(kind in ('order','refund')),
  external_id text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  updated_at timestamptz not null default now(),
  foreign key(connection_id,store_id) references public.platform_connections(id,store_id) on delete restrict,
  unique(connection_id,kind,external_id)
);

do $$ declare t text; begin
  foreach t in array array['platform_connections','external_products','external_skus','external_orders','external_order_items','external_refunds','platform_sku_mappings','platform_sku_mapping_history','sync_jobs','sync_cursors','sync_logs','mock_platform_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('drop policy if exists tenant_select on public.%I',t);
    execute format('create policy tenant_select on public.%I for select to authenticated using(private.is_member(store_id))',t);
  end loop;
end $$;
alter table private.platform_credentials enable row level security;
revoke all on private.platform_credentials from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.platform_credentials to service_role;
-- Mock source data and SKU mappings are editable only by store editors and above.
grant insert,update,delete on public.mock_platform_events,public.platform_sku_mappings to authenticated;
drop policy if exists mock_insert on public.mock_platform_events;
create policy mock_insert on public.mock_platform_events for insert to authenticated with check(private.can_edit(store_id) and exists(select 1 from public.platform_connections c where c.id=connection_id and c.store_id=store_id and c.mode='mock'));
drop policy if exists mock_update on public.mock_platform_events;
create policy mock_update on public.mock_platform_events for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists mock_delete on public.mock_platform_events;
create policy mock_delete on public.mock_platform_events for delete to authenticated using(private.can_edit(store_id));
drop policy if exists mapping_insert on public.platform_sku_mappings;
create policy mapping_insert on public.platform_sku_mappings for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists mapping_update on public.platform_sku_mappings;
create policy mapping_update on public.platform_sku_mappings for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists mapping_delete on public.platform_sku_mappings;
create policy mapping_delete on public.platform_sku_mappings for delete to authenticated using(private.can_edit(store_id));
grant update(auto_sync) on public.platform_connections to authenticated;
drop policy if exists connection_update on public.platform_connections;
create policy connection_update on public.platform_connections for update to authenticated using(private.can_admin(store_id)) with check(private.can_admin(store_id));

create or replace function private.lock_platform_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.store_id,new.connection_id) is distinct from (old.store_id,old.connection_id) then
    raise exception 'platform tenant identity is immutable' using errcode='42501';
  end if;
  if tg_table_name='mock_platform_events' and (new.kind,new.external_id) is distinct from (old.kind,old.external_id) then
    raise exception 'platform event identity is immutable' using errcode='42501';
  end if;
  if tg_table_name='platform_sku_mappings' and new.external_sku_id is distinct from old.external_sku_id then
    raise exception 'mapping identity is immutable' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists lock_event_identity on public.mock_platform_events;
create trigger lock_event_identity before update on public.mock_platform_events for each row execute function private.lock_platform_identity();
drop trigger if exists lock_mapping_identity on public.platform_sku_mappings;
create trigger lock_mapping_identity before update on public.platform_sku_mappings for each row execute function private.lock_platform_identity();

create or replace function private.mapping_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if tg_op='DELETE' then r:=old; else r:=new; end if;
  insert into public.platform_sku_mapping_history(store_id,connection_id,external_sku_id,sku_id,action,actor_user_id)
  values(r.store_id,r.connection_id,r.external_sku_id,r.sku_id,case when tg_op='DELETE' then 'unbound' else 'bound' end,auth.uid());
  return r;
end $$;
drop trigger if exists mapping_audit on public.platform_sku_mappings;
create trigger mapping_audit after insert or update or delete on public.platform_sku_mappings for each row execute function private.mapping_audit();

create or replace function public.create_mock_store() returns uuid language plpgsql security definer set search_path='' as $$
declare v_store uuid; v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  insert into public.stores(created_by,name,platform) values(v_actor,'月明净拼多多旗舰店（模拟）','pinduoduo') returning id into v_store;
  insert into public.platform_connections(store_id,display_name) values(v_store,'月明净拼多多旗舰店（模拟）');
  return v_store;
end $$;
create or replace function public.create_mock_connection(p_store uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text;
begin
  if not private.can_admin(p_store) then raise exception 'connection management forbidden' using errcode='42501'; end if;
  select name into v_name from public.stores where id=p_store and platform='pinduoduo' and status='active';
  if v_name is null then raise exception 'active Pinduoduo store required'; end if;
  insert into public.platform_connections(store_id,display_name) values(p_store,v_name||'（模拟连接）')
    on conflict(store_id,platform,mode) do update set display_name=excluded.display_name returning id into v_id;
  return v_id;
end $$;
create or replace function public.start_mock_sync(p_store uuid,p_connection uuid,p_kind text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_job uuid;
begin
  if not private.can_edit(p_store) and coalesce(auth.role(),'')<>'service_role' then raise exception 'write forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.platform_connections where id=p_connection and store_id=p_store and mode='mock') then raise exception 'mock connection not found'; end if;
  if p_kind not in ('orders','products','refunds') then raise exception 'invalid sync kind'; end if;
  update public.sync_jobs set status='failed',error_summary='任务超时，可安全重试',finished_at=now()
    where connection_id=p_connection and kind=p_kind and status='running' and started_at<now()-interval '2 minutes';
  insert into public.sync_jobs(store_id,connection_id,kind,actor_user_id) values(p_store,p_connection,p_kind,auth.uid()) returning id into v_job;
  insert into public.sync_logs(store_id,job_id,level,message) values(p_store,v_job,'info','模拟同步开始');
  return v_job;
end $$;
create or replace function public.apply_mock_batch(p_job uuid,p_records jsonb,p_cursor text) returns integer
language plpgsql security definer set search_path='' as $$
declare j public.sync_jobs%rowtype; r jsonb; v_id uuid; v_product uuid; v_order uuid; v_count integer:=0; item jsonb;
begin
  select * into j from public.sync_jobs where id=p_job for update;
  if j.id is null or j.status<>'running' or (not private.can_edit(j.store_id) and coalesce(auth.role(),'')<>'service_role') then raise exception 'sync job unavailable' using errcode='42501'; end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>100 then raise exception 'invalid batch'; end if;
  for r in select value from jsonb_array_elements(p_records) loop
    if j.kind='orders' then
      if length(coalesce(r->>'externalId',''))=0 then raise exception 'order ID missing'; end if;
      insert into public.external_orders(store_id,connection_id,external_id,status,placed_at,gross_sales,updated_at)
      values(j.store_id,j.connection_id,r->>'externalId',r->>'status',(r->>'placedAt')::timestamptz,(r->>'grossSales')::numeric,(r->>'updatedAt')::timestamptz)
      on conflict(connection_id,external_id) do update set status=excluded.status,placed_at=excluded.placed_at,gross_sales=excluded.gross_sales,updated_at=excluded.updated_at
      where excluded.updated_at>=public.external_orders.updated_at
      returning id into v_id;
      if v_id is not null then
        delete from public.external_order_items where order_id=v_id;
        for item in select value from jsonb_array_elements(coalesce(r->'items','[]'::jsonb)) loop
          insert into public.external_order_items(store_id,order_id,external_sku_id,quantity,gross_sales)
          values(j.store_id,v_id,item->>'externalSkuId',(item->>'quantity')::integer,(item->>'grossSales')::numeric);
        end loop;
      end if;
    elsif j.kind='products' then
      insert into public.external_products(store_id,connection_id,external_id,name,updated_at)
      values(j.store_id,j.connection_id,r->>'externalId',r->>'name',(r->>'updatedAt')::timestamptz)
      on conflict(connection_id,external_id) do update set name=excluded.name,updated_at=excluded.updated_at
      where excluded.updated_at>=public.external_products.updated_at;
      select id into v_product from public.external_products where connection_id=j.connection_id and external_id=r->>'externalId';
      for item in select value from jsonb_array_elements(coalesce(r->'skus','[]'::jsonb)) loop
        insert into public.external_skus(store_id,connection_id,product_id,external_id,sku_code,name,selling_price,updated_at)
        values(j.store_id,j.connection_id,v_product,item->>'externalId',item->>'code',item->>'name',(item->>'price')::numeric,(r->>'updatedAt')::timestamptz)
        on conflict(connection_id,external_id) do update set name=excluded.name,sku_code=excluded.sku_code,selling_price=excluded.selling_price,updated_at=excluded.updated_at
        where excluded.updated_at>=public.external_skus.updated_at;
      end loop;
    else
      select id into v_order from public.external_orders where connection_id=j.connection_id and external_id=r->>'orderExternalId';
      if v_order is null then raise exception 'refund order missing: %',r->>'orderExternalId'; end if;
      insert into public.external_refunds(store_id,connection_id,order_id,external_id,amount,status,updated_at)
      values(j.store_id,j.connection_id,v_order,r->>'externalId',(r->>'amount')::numeric,r->>'status',(r->>'updatedAt')::timestamptz)
      on conflict(connection_id,external_id) do update set amount=excluded.amount,status=excluded.status,updated_at=excluded.updated_at
      where excluded.updated_at>=public.external_refunds.updated_at;
    end if;
    v_count:=v_count+1;
    v_id:=null;
  end loop;
  update public.sync_jobs set success_count=success_count+v_count where id=p_job;
  insert into public.sync_cursors(store_id,connection_id,kind,cursor_value) values(j.store_id,j.connection_id,j.kind,p_cursor)
    on conflict(connection_id,kind) do update set cursor_value=excluded.cursor_value,updated_at=now();
  insert into public.sync_logs(store_id,job_id,level,message) values(j.store_id,p_job,'info','批次完成：'||v_count||' 条');
  return v_count;
end $$;
create or replace function public.finish_mock_sync(p_job uuid,p_status text,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare j public.sync_jobs%rowtype;
begin
  select * into j from public.sync_jobs where id=p_job for update;
  if j.id is null or (not private.can_edit(j.store_id) and coalesce(auth.role(),'')<>'service_role') then raise exception 'sync job unavailable' using errcode='42501'; end if;
  if j.status<>'running' or p_status not in ('success','partial_success','failed','cancelled') then raise exception 'invalid completion'; end if;
  update public.sync_jobs set status=p_status,error_summary=left(p_error,500),finished_at=now(),failure_count=case when p_status in ('failed','partial_success') then 1 else 0 end where id=p_job;
  update public.platform_connections set last_synced_at=now(),last_result=p_status,updated_at=now() where id=j.connection_id;
  insert into public.sync_logs(store_id,job_id,level,message) values(j.store_id,p_job,case when p_status='success' then 'info' else 'error' end,coalesce(left(p_error,500),'模拟同步'||p_status));
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary)
    values(j.store_id,auth.uid(),'mock_sync','sync_jobs',p_job,jsonb_build_object('kind',j.kind,'status',p_status));
end $$;
create or replace function public.reset_mock_connection(p_store uuid,p_connection uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.can_admin(p_store) then raise exception 'reset forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.platform_connections where id=p_connection and store_id=p_store and mode='mock') then raise exception 'mock connection not found'; end if;
  if exists(select 1 from public.sync_jobs where connection_id=p_connection and status='running') then raise exception 'sync in progress'; end if;
  delete from public.mock_platform_events where connection_id=p_connection;
  delete from public.platform_sku_mappings where connection_id=p_connection;
  delete from public.external_refunds where connection_id=p_connection;
  delete from public.external_order_items where order_id in (select id from public.external_orders where connection_id=p_connection);
  delete from public.external_orders where connection_id=p_connection;
  delete from public.external_skus where connection_id=p_connection;
  delete from public.external_products where connection_id=p_connection;
  delete from public.sync_cursors where connection_id=p_connection;
  update public.platform_connections set last_synced_at=null,last_result=null,updated_at=now() where id=p_connection;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary)
    values(p_store,auth.uid(),'mock_reset','platform_connections',p_connection,'{"mode":"mock"}'::jsonb);
end $$;
revoke all on function public.create_mock_store(),public.create_mock_connection(uuid),public.start_mock_sync(uuid,uuid,text),public.apply_mock_batch(uuid,jsonb,text),public.finish_mock_sync(uuid,text,text) from public,anon;
grant execute on function public.create_mock_store(),public.create_mock_connection(uuid),public.start_mock_sync(uuid,uuid,text),public.apply_mock_batch(uuid,jsonb,text),public.finish_mock_sync(uuid,text,text) to authenticated;
grant execute on function public.start_mock_sync(uuid,uuid,text),public.apply_mock_batch(uuid,jsonb,text),public.finish_mock_sync(uuid,text,text) to service_role;
grant select on public.platform_connections,public.mock_platform_events,public.sync_cursors,public.external_skus,public.platform_sku_mappings,public.skus to service_role;
revoke all on function public.reset_mock_connection(uuid,uuid) from public,anon;
grant execute on function public.reset_mock_connection(uuid,uuid) to authenticated;

-- Provenance for manually entered and CSV data. Platform rows stay in separate tables.
alter table public.daily_metrics add column if not exists data_source text not null default 'manual'
  check(data_source in ('manual','csv_import'));
alter table public.ad_metrics add column if not exists data_source text not null default 'manual'
  check(data_source in ('manual','csv_import'));
create or replace function public.save_daily_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date; v_old date; v_key text; v_value text; v_source text; v_data_source text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  v_source:=coalesce(nullif(p_row->>'costSource',''),'manual');
  v_data_source:=coalesce(nullif(p_row->>'source',''),'manual');
  if v_source not in ('manual','sku') or v_data_source not in ('manual','csv_import') then raise exception 'invalid data source'; end if;
  if v_source='sku' and v_old<>v_date then raise exception 'SKU-derived metric date cannot be moved'; end if;
  if v_old<>v_date then
    delete from public.product_daily_sales where store_id=p_store and metric_date=v_old;
    update public.daily_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old;
  end if;
  insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses,product_cost,packaging_cost,shipping_cost,platform_fee,cost_source,data_source,is_demo)
  values(p_store,v_date,(p_row->>'sales')::numeric,(p_row->>'refunds')::numeric,(p_row->>'orders')::integer,(p_row->>'otherExpenses')::numeric,
    case when v_source='manual' then nullif(p_row->>'productCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'packagingCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'logisticsCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'platformFees','')::numeric else null end,v_source,v_data_source,coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set gross_sales=excluded.gross_sales,refunds=excluded.refunds,order_count=excluded.order_count,other_expenses=excluded.other_expenses,
    product_cost=excluded.product_cost,packaging_cost=excluded.packaging_cost,shipping_cost=excluded.shipping_cost,platform_fee=excluded.platform_fee,cost_source=excluded.cost_source,data_source=excluded.data_source,is_demo=excluded.is_demo
  returning id into v_id;
  delete from public.product_daily_sales where store_id=p_store and metric_date=v_date;
  for v_key,v_value in select key,value from jsonb_each_text(coalesce(p_row->'productSales','{}'::jsonb)) loop
    if not exists(select 1 from public.products where id=v_key::uuid and store_id=p_store) then raise exception 'product allocation outside store' using errcode='42501'; end if;
    insert into public.product_daily_sales(store_id,product_id,metric_date,gross_sales) values(p_store,v_key::uuid,v_date,v_value::numeric);
  end loop;
  return v_id;
end $$;
create or replace function public.save_ad_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date; v_old date; v_data_source text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  v_data_source:=coalesce(nullif(p_row->>'source',''),'manual');
  if v_data_source not in ('manual','csv_import') then raise exception 'invalid data source'; end if;
  if v_old<>v_date then update public.ad_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old; end if;
  insert into public.ad_metrics(store_id,metric_date,advertising_spend,attributed_revenue,attributed_orders,data_source,is_demo)
  values(p_store,v_date,(p_row->>'spend')::numeric,(p_row->>'attributedSales')::numeric,coalesce(nullif(p_row->>'attributedOrders','')::integer,0),v_data_source,coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set advertising_spend=excluded.advertising_spend,attributed_revenue=excluded.attributed_revenue,attributed_orders=excluded.attributed_orders,data_source=excluded.data_source,is_demo=excluded.is_demo
  returning id into v_id;
  return v_id;
end $$;
