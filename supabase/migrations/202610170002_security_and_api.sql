-- Access control is enforced both by RLS and by checked SECURITY DEFINER functions.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create or replace function private.member_role(p_store uuid) returns text
language sql stable security definer set search_path='' as $$
  select role from public.store_members where store_id=p_store and user_id=auth.uid() limit 1
$$;
create or replace function private.is_member(p_store uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member_role(p_store) is not null
$$;
create or replace function private.can_edit(p_store uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(p_store) in ('owner','admin','editor'),false)
$$;
create or replace function private.can_admin(p_store uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(p_store) in ('owner','admin'),false)
$$;
create or replace function private.shares_store(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.store_members target join public.store_members mine on mine.store_id=target.store_id where target.user_id=p_user and mine.user_id=auth.uid())
$$;
revoke all on function private.member_role(uuid),private.is_member(uuid),private.can_edit(uuid),private.can_admin(uuid),private.shares_store(uuid) from public;
grant execute on function private.member_role(uuid),private.is_member(uuid),private.can_edit(uuid),private.can_admin(uuid),private.shares_store(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.sku_costs enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.ad_metrics enable row level security;
alter table public.sku_daily_metrics enable row level security;
alter table public.product_daily_sales enable row level security;
alter table public.audit_logs enable row level security;
alter table public.migration_records enable row level security;

revoke all on public.profiles,public.stores,public.store_members,public.products,public.skus,public.sku_costs,public.daily_metrics,public.ad_metrics,public.sku_daily_metrics,public.product_daily_sales,public.audit_logs,public.migration_records from anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.stores,public.products,public.skus,public.daily_metrics,public.ad_metrics,public.sku_daily_metrics,public.product_daily_sales to authenticated;
grant select on public.store_members,public.audit_logs,public.migration_records to authenticated;
grant select,insert on public.sku_costs to authenticated;

-- Do not grant DELETE on financial tables; products and SKUs use status='archived'.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or private.shares_store(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores for select to authenticated using(private.is_member(id));
drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores for insert to authenticated with check(created_by=auth.uid());
drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores for update to authenticated using(private.can_admin(id)) with check(private.can_admin(id));
drop policy if exists members_select on public.store_members;
create policy members_select on public.store_members for select to authenticated using(private.is_member(store_id));
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using(private.is_member(store_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists skus_select on public.skus;
create policy skus_select on public.skus for select to authenticated using(private.is_member(store_id));
drop policy if exists skus_insert on public.skus;
create policy skus_insert on public.skus for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists skus_update on public.skus;
create policy skus_update on public.skus for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists sku_costs_select on public.sku_costs;
create policy sku_costs_select on public.sku_costs for select to authenticated using(private.is_member(store_id));
drop policy if exists sku_costs_insert on public.sku_costs;
create policy sku_costs_insert on public.sku_costs for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists daily_select on public.daily_metrics;
create policy daily_select on public.daily_metrics for select to authenticated using(private.is_member(store_id));
drop policy if exists daily_insert on public.daily_metrics;
create policy daily_insert on public.daily_metrics for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists daily_update on public.daily_metrics;
create policy daily_update on public.daily_metrics for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists ads_select on public.ad_metrics;
create policy ads_select on public.ad_metrics for select to authenticated using(private.is_member(store_id));
drop policy if exists ads_insert on public.ad_metrics;
create policy ads_insert on public.ad_metrics for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists ads_update on public.ad_metrics;
create policy ads_update on public.ad_metrics for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists sku_daily_select on public.sku_daily_metrics;
create policy sku_daily_select on public.sku_daily_metrics for select to authenticated using(private.is_member(store_id));
drop policy if exists sku_daily_insert on public.sku_daily_metrics;
create policy sku_daily_insert on public.sku_daily_metrics for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists sku_daily_update on public.sku_daily_metrics;
create policy sku_daily_update on public.sku_daily_metrics for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists product_sales_select on public.product_daily_sales;
create policy product_sales_select on public.product_daily_sales for select to authenticated using(private.is_member(store_id));
drop policy if exists product_sales_insert on public.product_daily_sales;
create policy product_sales_insert on public.product_daily_sales for insert to authenticated with check(private.can_edit(store_id));
drop policy if exists product_sales_update on public.product_daily_sales;
create policy product_sales_update on public.product_daily_sales for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated using(private.can_admin(store_id));
drop policy if exists migration_select on public.migration_records;
create policy migration_select on public.migration_records for select to authenticated using(private.can_edit(store_id));

-- Restricted audit event: no request body, password, token, email or key is copied.
create or replace function private.audit_business_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; v_store uuid; v_id uuid; v_summary jsonb; v_changed jsonb;
begin
  if tg_op='DELETE' then r:=old; else r:=new; end if;
  if tg_table_name='stores' then v_store:=r.id; else v_store:=r.store_id; end if;
  v_id:=r.id;
  v_summary:=jsonb_build_object('operation',tg_op);
  if tg_op='UPDATE' then
    select coalesce(jsonb_agg(key),'[]'::jsonb) into v_changed from jsonb_each(to_jsonb(new)) where to_jsonb(new)->key is distinct from to_jsonb(old)->key;
    v_summary:=v_summary || jsonb_build_object('changed_fields',v_changed);
  end if;
  if tg_table_name in ('products','skus','stores') then
    v_summary:=v_summary || jsonb_build_object('status',r.status);
  end if;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary)
    values(v_store,auth.uid(),lower(tg_op),tg_table_name,v_id,v_summary);
  return r;
end $$;
do $$ declare t text; begin
  foreach t in array array['stores','products','skus','sku_costs','daily_metrics','ad_metrics','sku_daily_metrics','product_daily_sales'] loop
    execute format('drop trigger if exists audit_change on public.%I',t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_business_change()',t);
  end loop;
end $$;

-- Both member mutation and ownership transfer are the only supported paths.
create or replace function public.manage_store_member(p_store uuid,p_email text,p_role text,p_action text default 'upsert') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_actor_role text; v_target uuid; v_old_role text; v_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select role into v_actor_role from public.store_members where store_id=p_store and user_id=v_actor;
  if v_actor_role not in ('owner','admin') then raise exception 'member management forbidden' using errcode='42501'; end if;
  if p_action not in ('upsert','remove') then raise exception 'invalid action'; end if;
  select id into v_target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
  if v_target is null then raise exception 'confirmed user not found'; end if;
  select id,role into v_id,v_old_role from public.store_members where store_id=p_store and user_id=v_target for update;
  if v_old_role='owner' then raise exception 'use ownership transfer' using errcode='42501'; end if;
  if v_actor_role='admin' and (v_old_role='admin' or p_role in ('owner','admin')) then raise exception 'admin cannot manage admin or owner' using errcode='42501'; end if;
  if p_action='remove' then
    if v_id is null then raise exception 'member not found'; end if;
    delete from public.store_members where id=v_id;
    insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values(p_store,v_actor,'member_remove','store_members',v_id,jsonb_build_object('old_role',v_old_role));
    return v_id;
  end if;
  if p_role not in ('admin','editor','viewer') or (v_actor_role='admin' and p_role='admin') then raise exception 'invalid role assignment' using errcode='42501'; end if;
  if v_id is null then
    insert into public.store_members(store_id,user_id,role) values(p_store,v_target,p_role) returning id into v_id;
  else
    update public.store_members set role=p_role where id=v_id;
  end if;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values(p_store,v_actor,'member_upsert','store_members',v_id,jsonb_build_object('old_role',v_old_role,'new_role',p_role));
  return v_id;
end $$;
create or replace function public.transfer_store_ownership(p_store uuid,p_target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_target_role text;
begin
  if v_actor is null or private.member_role(p_store)<>'owner' then raise exception 'owner required' using errcode='42501'; end if;
  if v_actor=p_target_user then raise exception 'target must differ from owner'; end if;
  perform 1 from public.stores where id=p_store for update;
  select role into v_target_role from public.store_members where store_id=p_store and user_id=p_target_user for update;
  if v_target_role is null then raise exception 'target must be an existing member'; end if;
  update public.store_members set role='admin' where store_id=p_store and user_id=v_actor and role='owner';
  update public.store_members set role='owner' where store_id=p_store and user_id=p_target_user;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values(p_store,v_actor,'ownership_transfer','store_members',p_target_user,jsonb_build_object('previous_owner',v_actor,'new_owner',p_target_user));
end $$;
revoke all on function public.manage_store_member(uuid,text,text,text),public.transfer_store_ownership(uuid,uuid) from public,anon;
grant execute on function public.manage_store_member(uuid,text,text,text),public.transfer_store_ownership(uuid,uuid) to authenticated;
create or replace function public.list_store_members(p_store uuid)
returns table(user_id uuid,email text,display_name text,role text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.can_admin(p_store) then raise exception 'member list forbidden' using errcode='42501'; end if;
  return query select m.user_id,u.email,p.display_name,m.role,m.created_at from public.store_members m join auth.users u on u.id=m.user_id left join public.profiles p on p.id=m.user_id where m.store_id=p_store order by m.created_at;
end $$;
revoke all on function public.list_store_members(uuid) from public,anon;
grant execute on function public.list_store_members(uuid) to authenticated;
