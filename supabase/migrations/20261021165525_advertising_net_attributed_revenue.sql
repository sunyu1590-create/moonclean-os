alter table public.ad_metrics
  add column if not exists net_attributed_revenue numeric(18,2);

alter table public.ad_metrics
  drop constraint if exists ad_metrics_net_attributed_revenue_nonnegative;
alter table public.ad_metrics
  add constraint ad_metrics_net_attributed_revenue_nonnegative
  check (net_attributed_revenue is null or net_attributed_revenue >= 0);

create or replace function public.save_ad_metric(p_store uuid,p_row jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_date date; v_old date; v_data_source text;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  v_date:=(p_row->>'date')::date; v_old:=coalesce(nullif(p_row->>'originalDate','')::date,v_date);
  v_data_source:=coalesce(nullif(p_row->>'source',''),'manual');
  if v_data_source not in ('manual','csv_import','image_import') then raise exception 'invalid data source'; end if;
  if v_old<>v_date then update public.ad_metrics set metric_date=v_date where store_id=p_store and metric_date=v_old; end if;
  insert into public.ad_metrics(store_id,metric_date,advertising_spend,attributed_revenue,net_attributed_revenue,attributed_orders,data_source,is_demo)
  values(p_store,v_date,(p_row->>'spend')::numeric,(p_row->>'attributedSales')::numeric,nullif(p_row->>'netAttributedSales','')::numeric,coalesce(nullif(p_row->>'attributedOrders','')::integer,0),v_data_source,coalesce((p_row->>'isDemo')::boolean,false))
  on conflict(store_id,metric_date) do update set advertising_spend=excluded.advertising_spend,attributed_revenue=excluded.attributed_revenue,net_attributed_revenue=excluded.net_attributed_revenue,attributed_orders=excluded.attributed_orders,data_source=excluded.data_source,is_demo=excluded.is_demo
  returning id into v_id;
  return v_id;
end $$;
