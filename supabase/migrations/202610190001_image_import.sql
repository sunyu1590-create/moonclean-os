-- Preserve the input method for OCR-imported operating and ad metrics.
alter table public.daily_metrics drop constraint if exists daily_metrics_data_source_check;
alter table public.daily_metrics add constraint daily_metrics_data_source_check
  check(data_source in ('manual','csv_import','image_import'));
alter table public.ad_metrics drop constraint if exists ad_metrics_data_source_check;
alter table public.ad_metrics add constraint ad_metrics_data_source_check
  check(data_source in ('manual','csv_import','image_import'));

create or replace function public.save_daily_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date; v_old date; v_key text; v_value text; v_source text; v_data_source text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  v_source:=coalesce(nullif(p_row->>'costSource',''),'manual');
  v_data_source:=coalesce(nullif(p_row->>'source',''),'manual');
  if v_source not in ('manual','sku') or v_data_source not in ('manual','csv_import','image_import') then raise exception 'invalid data source'; end if;
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
  if v_data_source not in ('manual','csv_import','image_import') then raise exception 'invalid data source'; end if;
  if v_old<>v_date then update public.ad_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old; end if;
  insert into public.ad_metrics(store_id,metric_date,advertising_spend,attributed_revenue,attributed_orders,data_source,is_demo)
  values(p_store,v_date,(p_row->>'spend')::numeric,(p_row->>'attributedSales')::numeric,coalesce(nullif(p_row->>'attributedOrders','')::integer,0),v_data_source,coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set advertising_spend=excluded.advertising_spend,attributed_revenue=excluded.attributed_revenue,attributed_orders=excluded.attributed_orders,data_source=excluded.data_source,is_demo=excluded.is_demo
  returning id into v_id;
  return v_id;
end $$;
