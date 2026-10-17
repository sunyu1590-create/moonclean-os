-- Run only in an isolated Supabase local database after migrations. All fixtures are rolled back.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('30000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','constraint-owner@example.test','',now(),'{}','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
insert into public.stores(id,created_by,name) values('40000000-0000-4000-8000-000000000001',auth.uid(),'Constraint Store');
insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('40000000-0000-4000-8000-000000000001','2026-10-17',100,0,1,0);
do $$ begin
  begin
    insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('40000000-0000-4000-8000-000000000001','2026-10-17',10,0,1,0);
    raise exception 'duplicate date accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.ad_metrics(store_id,metric_date,advertising_spend,attributed_revenue,attributed_orders) values('40000000-0000-4000-8000-000000000001','2026-10-17',-1,0,0);
    raise exception 'negative money accepted';
  exception when check_violation then null; end;
  begin
    insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('40000000-0000-4000-8000-000000000001','2026-10-18',10,11,1,0);
    raise exception 'refund greater than sales accepted';
  exception when check_violation then null; end;
end $$;
select public.save_product('40000000-0000-4000-8000-000000000001',jsonb_build_object('id','50000000-0000-4000-8000-000000000001','name','History Product','category','test','skus',jsonb_build_array(jsonb_build_object('id','60000000-0000-4000-8000-000000000001','name','A','price','30.00','cost',jsonb_build_object('production','5.00','packaging','1.00','logistics','2.00','platform','1.00')))));
select public.save_product('40000000-0000-4000-8000-000000000001',jsonb_build_object('id','50000000-0000-4000-8000-000000000001','name','History Product','category','test','skus',jsonb_build_array(jsonb_build_object('id','60000000-0000-4000-8000-000000000001','name','A','price','30.00','cost',jsonb_build_object('production','8.00','packaging','1.00','logistics','2.00','platform','1.00')))));
do $$ begin
  if (select count(*) from public.sku_costs where sku_id='60000000-0000-4000-8000-000000000001')<>2 then raise exception 'cost history overwritten'; end if;
  begin
    update public.sku_costs set product_cost=99 where sku_id='60000000-0000-4000-8000-000000000001';
    raise exception 'cost update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select public.save_sku_daily_metric('40000000-0000-4000-8000-000000000001',jsonb_build_object('skuId','60000000-0000-4000-8000-000000000001','date','2026-10-17','quantitySold',2,'grossSales','100.00','refundAmount','0.00'));
select public.save_sku_daily_metric('40000000-0000-4000-8000-000000000001',jsonb_build_object('skuId','60000000-0000-4000-8000-000000000001','date','2026-10-17','quantitySold',2,'grossSales','100.00','refundAmount','0.00'));
do $$ begin
  if (select count(*) from public.sku_daily_metrics where sku_id='60000000-0000-4000-8000-000000000001')<>1 then raise exception 'SKU daily upsert duplicated data'; end if;
  if (select cost_source from public.daily_metrics where store_id='40000000-0000-4000-8000-000000000001' and metric_date='2026-10-17')<>'sku' then raise exception 'SKU cost source not activated'; end if;
end $$;
select public.archive_product('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');
do $$ begin
  if (select count(*) from public.sku_costs where sku_id='60000000-0000-4000-8000-000000000001')<>2 then raise exception 'archive deleted cost history'; end if;
end $$;
rollback;
