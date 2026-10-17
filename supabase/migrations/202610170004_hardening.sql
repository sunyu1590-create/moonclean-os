-- Tenant keys and financial references are immutable even for users who edit multiple stores.
create or replace function private.protect_tenant_identity() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.store_id<>old.store_id then raise exception 'tenant identity is immutable' using errcode='42501'; end if;
  if tg_table_name='skus' then if new.product_id<>old.product_id then raise exception 'SKU product is immutable' using errcode='42501'; end if; end if;
  if tg_table_name='sku_daily_metrics' then if new.sku_id<>old.sku_id then raise exception 'SKU metric owner is immutable' using errcode='42501'; end if; end if;
  if tg_table_name='product_daily_sales' then if new.product_id<>old.product_id then raise exception 'product sales owner is immutable' using errcode='42501'; end if; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['products','skus','daily_metrics','ad_metrics','sku_daily_metrics','product_daily_sales'] loop
    execute format('drop trigger if exists protect_tenant_identity on public.%I',t);
    execute format('create trigger protect_tenant_identity before update on public.%I for each row execute function private.protect_tenant_identity()',t);
  end loop;
end $$;
-- Archived stores are read-only. Product/SKU history remains visible through financial tables.
create or replace function private.protect_archived_store() returns trigger
language plpgsql set search_path='' as $$
declare v_store uuid;
begin
  if tg_table_name='stores' then return new; end if;
  v_store:=new.store_id;
  if exists(select 1 from public.stores where id=v_store and status='archived') then raise exception 'archived store is read-only' using errcode='42501'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['products','skus','sku_costs','daily_metrics','ad_metrics','sku_daily_metrics','product_daily_sales'] loop
    execute format('drop trigger if exists protect_archived_store on public.%I',t);
    execute format('create trigger protect_archived_store before insert or update on public.%I for each row execute function private.protect_archived_store()',t);
  end loop;
end $$;
