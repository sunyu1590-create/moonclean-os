-- Transactional business mutations. All functions use the caller's auth.uid(), never a caller-supplied actor.
create or replace function public.save_product(p_store uuid,p_product jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_sku_id uuid; v_input_id text; v_sku jsonb; v_cost jsonb; v_latest public.sku_costs%rowtype; v_seen uuid[]:=array[]::uuid[]; v_zone text; v_effective date; v_existing uuid;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  select timezone into v_zone from public.stores where id=p_store and status='active';
  if v_zone is null then raise exception 'store not found'; end if;
  v_effective:=(now() at time zone v_zone)::date;
  if jsonb_typeof(p_product->'skus')<>'array' or jsonb_array_length(p_product->'skus')=0 then raise exception 'at least one SKU required'; end if;
  if length(trim(coalesce(p_product->>'name','')))=0 then raise exception 'product name required'; end if;
  v_input_id:=nullif(p_product->>'id','');
  v_id:=coalesce(v_input_id::uuid,gen_random_uuid());
  select id into v_existing from public.products where id=v_id and store_id=p_store for update;
  if v_existing is null then
    insert into public.products(id,store_id,name,category,status,is_demo) values(v_id,p_store,p_product->>'name',coalesce(p_product->>'category',''),'active',coalesce((p_product->>'isDemo')::boolean,false));
  else
    update public.products set name=p_product->>'name',category=coalesce(p_product->>'category',''),status='active',is_demo=coalesce((p_product->>'isDemo')::boolean,false) where id=v_id and store_id=p_store;
  end if;
  for v_sku in select value from jsonb_array_elements(p_product->'skus') loop
    if length(trim(coalesce(v_sku->>'name','')))=0 then raise exception 'SKU name required'; end if;
    v_input_id:=nullif(v_sku->>'id','');
    v_sku_id:=coalesce(v_input_id::uuid,gen_random_uuid());
    v_seen:=array_append(v_seen,v_sku_id);
    select id into v_existing from public.skus where id=v_sku_id and product_id=v_id and store_id=p_store for update;
    if v_existing is null then
      insert into public.skus(id,store_id,product_id,sku_name,sku_code,selling_price,status)
      values(v_sku_id,p_store,v_id,v_sku->>'name',nullif(v_sku->>'code',''),(v_sku->>'price')::numeric,'active');
    else
      update public.skus set sku_name=v_sku->>'name',sku_code=nullif(v_sku->>'code',''),selling_price=(v_sku->>'price')::numeric,status='active' where id=v_sku_id and product_id=v_id and store_id=p_store;
    end if;
    v_cost:=v_sku->'cost';
    if v_cost is null then raise exception 'SKU cost required'; end if;
    select * into v_latest from public.sku_costs where sku_id=v_sku_id and store_id=p_store and effective_from<=v_effective order by effective_from desc,created_at desc,id desc limit 1;
    if v_latest.id is null or (v_latest.product_cost,v_latest.packaging_cost,v_latest.shipping_cost,v_latest.platform_fee)
       is distinct from ((v_cost->>'production')::numeric,(v_cost->>'packaging')::numeric,(v_cost->>'logistics')::numeric,(v_cost->>'platform')::numeric) then
      insert into public.sku_costs(store_id,sku_id,product_cost,packaging_cost,shipping_cost,platform_fee,effective_from)
      values(p_store,v_sku_id,(v_cost->>'production')::numeric,(v_cost->>'packaging')::numeric,(v_cost->>'logistics')::numeric,(v_cost->>'platform')::numeric,v_effective);
    end if;
  end loop;
  update public.skus set status='archived' where product_id=v_id and store_id=p_store and not (id=any(v_seen)) and status='active';
  return v_id;
end $$;
create or replace function public.archive_product(p_store uuid,p_product uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  update public.products set status='archived' where id=p_product and store_id=p_store and status='active';
  if not found then raise exception 'product not found'; end if;
  update public.skus set status='archived' where product_id=p_product and store_id=p_store and status='active';
end $$;
create or replace function public.save_daily_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date; v_old date; v_key text; v_value text; v_source text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  v_source:=coalesce(nullif(p_row->>'costSource',''),'manual');
  if v_source not in ('manual','sku') then raise exception 'invalid cost source'; end if;
  if v_source='sku' and v_old<>v_date then raise exception 'SKU-derived metric date cannot be moved'; end if;
  if v_old<>v_date then
    delete from public.product_daily_sales where store_id=p_store and metric_date=v_old;
    update public.daily_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old;
  end if;
  insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses,product_cost,packaging_cost,shipping_cost,platform_fee,cost_source,is_demo)
  values(p_store,v_date,(p_row->>'sales')::numeric,(p_row->>'refunds')::numeric,(p_row->>'orders')::integer,(p_row->>'otherExpenses')::numeric,
    case when v_source='manual' then nullif(p_row->>'productCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'packagingCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'logisticsCost','')::numeric else null end,case when v_source='manual' then nullif(p_row->>'platformFees','')::numeric else null end,v_source,coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set gross_sales=excluded.gross_sales,refunds=excluded.refunds,order_count=excluded.order_count,other_expenses=excluded.other_expenses,
    product_cost=excluded.product_cost,packaging_cost=excluded.packaging_cost,shipping_cost=excluded.shipping_cost,platform_fee=excluded.platform_fee,cost_source=excluded.cost_source,is_demo=excluded.is_demo
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
declare v_id uuid; v_date date; v_old date;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  if v_old<>v_date then update public.ad_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old; end if;
  insert into public.ad_metrics(store_id,metric_date,advertising_spend,attributed_revenue,attributed_orders,is_demo)
  values(p_store,v_date,(p_row->>'spend')::numeric,(p_row->>'attributedSales')::numeric,coalesce(nullif(p_row->>'attributedOrders','')::integer,0),coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set advertising_spend=excluded.advertising_spend,attributed_revenue=excluded.attributed_revenue,attributed_orders=excluded.attributed_orders,is_demo=excluded.is_demo
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.save_product(uuid,jsonb),public.archive_product(uuid,uuid),public.save_daily_metric(uuid,jsonb),public.save_ad_metric(uuid,jsonb) from public,anon;
grant execute on function public.save_product(uuid,jsonb),public.archive_product(uuid,uuid),public.save_daily_metric(uuid,jsonb),public.save_ad_metric(uuid,jsonb) to authenticated;

-- Legacy import RPCs have one-record transactions and stable source IDs. A repeated call returns the original target ID.
create or replace function public.import_legacy_product(p_store uuid,p_source_id text,p_product jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_sku jsonb; v_skus jsonb:='[]'::jsonb; v_sku_id uuid; v_mapping jsonb:='{}'::jsonb; v_legacy text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  if length(trim(p_source_id))=0 then raise exception 'source ID required'; end if;
  perform 1 from public.stores where id=p_store for update;
  select target_id into v_id from public.migration_records where store_id=p_store and source_kind='product' and source_id=p_source_id;
  if v_id is not null then return v_id; end if;
  if exists(select 1 from public.products where store_id=p_store and status='active' and lower(name)=lower(p_product->>'name') and lower(category)=lower(coalesce(p_product->>'category',''))) then raise exception 'potential duplicate product name'; end if;
  v_id:=gen_random_uuid();
  for v_sku in select value from jsonb_array_elements(p_product->'skus') loop
    v_sku_id:=gen_random_uuid(); v_legacy:=v_sku->>'id';
    v_skus:=v_skus || jsonb_build_array(jsonb_set(v_sku,'{id}',to_jsonb(v_sku_id::text)));
    v_mapping:=v_mapping || jsonb_build_object(v_sku_id::text,v_legacy);
  end loop;
  perform public.save_product(p_store,jsonb_build_object('id',v_id,'name',p_product->>'name','category',p_product->>'category','skus',v_skus,'isDemo',coalesce((p_product->>'isDemo')::boolean,false)));
  update public.products set legacy_id=p_source_id where id=v_id and store_id=p_store;
  update public.skus s set legacy_id=v_mapping->>s.id::text where product_id=v_id and store_id=p_store;
  insert into public.migration_records(store_id,source_kind,source_id,target_id) values(p_store,'product',p_source_id,v_id);
  return v_id;
end $$;
create or replace function public.import_legacy_daily(p_store uuid,p_source_id text,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_key text; v_value jsonb; v_product uuid; v_sales jsonb:='{}'::jsonb; v_date date;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  perform 1 from public.stores where id=p_store for update;
  select target_id into v_id from public.migration_records where store_id=p_store and source_kind='daily' and source_id=p_source_id;
  if v_id is not null then return v_id; end if;
  v_date:=(p_row->>'date')::date;
  if exists(select 1 from public.daily_metrics where store_id=p_store and metric_date=v_date) then raise exception 'daily date already exists: %',v_date using errcode='23505'; end if;
  for v_key,v_value in select key,value from jsonb_each(coalesce(p_row->'productSales','{}'::jsonb)) loop
    select target_id into v_product from public.migration_records where store_id=p_store and source_kind='product' and source_id=v_key;
    if v_product is null then raise exception 'product mapping missing: %',v_key; end if;
    v_sales:=v_sales || jsonb_build_object(v_product::text,v_value);
  end loop;
  v_id:=public.save_daily_metric(p_store,jsonb_set(p_row,'{productSales}',v_sales));
  insert into public.migration_records(store_id,source_kind,source_id,target_id) values(p_store,'daily',p_source_id,v_id);
  return v_id;
end $$;
create or replace function public.import_legacy_ad(p_store uuid,p_source_id text,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  perform 1 from public.stores where id=p_store for update;
  select target_id into v_id from public.migration_records where store_id=p_store and source_kind='advertising' and source_id=p_source_id;
  if v_id is not null then return v_id; end if;
  v_date:=(p_row->>'date')::date;
  if exists(select 1 from public.ad_metrics where store_id=p_store and metric_date=v_date) then raise exception 'ad date already exists: %',v_date using errcode='23505'; end if;
  v_id:=public.save_ad_metric(p_store,p_row);
  insert into public.migration_records(store_id,source_kind,source_id,target_id) values(p_store,'advertising',p_source_id,v_id);
  return v_id;
end $$;
revoke all on function public.import_legacy_product(uuid,text,jsonb),public.import_legacy_daily(uuid,text,jsonb),public.import_legacy_ad(uuid,text,jsonb) from public,anon;
grant execute on function public.import_legacy_product(uuid,text,jsonb),public.import_legacy_daily(uuid,text,jsonb),public.import_legacy_ad(uuid,text,jsonb) to authenticated;
create or replace function public.save_sku_daily_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_sku uuid; v_date date;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_sku:=(p_row->>'skuId')::uuid;v_date:=(p_row->>'date')::date;
  if not exists(select 1 from public.skus where id=v_sku and store_id=p_store and status='active') then raise exception 'SKU not found in store' using errcode='42501'; end if;
  if not exists(select 1 from public.daily_metrics where store_id=p_store and metric_date=v_date) then raise exception 'enter store daily metric first'; end if;
  insert into public.sku_daily_metrics(store_id,sku_id,metric_date,quantity_sold,gross_sales,refund_amount)
  values(p_store,v_sku,v_date,(p_row->>'quantitySold')::integer,(p_row->>'grossSales')::numeric,(p_row->>'refundAmount')::numeric)
  on conflict(store_id,sku_id,metric_date) do update set quantity_sold=excluded.quantity_sold,gross_sales=excluded.gross_sales,refund_amount=excluded.refund_amount returning id into v_id;
  update public.daily_metrics set cost_source='sku',product_cost=null,packaging_cost=null,shipping_cost=null,platform_fee=null where store_id=p_store and metric_date=v_date;
  delete from public.product_daily_sales where store_id=p_store and metric_date=v_date;
  return v_id;
end $$;
revoke all on function public.save_sku_daily_metric(uuid,jsonb) from public,anon;
grant execute on function public.save_sku_daily_metric(uuid,jsonb) to authenticated;
