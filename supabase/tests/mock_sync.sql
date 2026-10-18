-- Local/PGlite only. Fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-4000-8000-000000000001','sync-owner@example.test',now()),
 ('30000000-0000-4000-8000-000000000002','sync-other@example.test',now()),
 ('30000000-0000-4000-8000-000000000003','sync-viewer@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
insert into public.stores(id,created_by,name,platform)
values('40000000-0000-4000-8000-000000000001',auth.uid(),'Sync A','pinduoduo');
select public.manage_store_member('40000000-0000-4000-8000-000000000001','sync-viewer@example.test','viewer','upsert');
select public.create_mock_connection('40000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
insert into public.stores(id,created_by,name,platform)
values('40000000-0000-4000-8000-000000000002',auth.uid(),'Sync B','pinduoduo');
select public.create_mock_connection('40000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
do $$
declare c uuid; j uuid; r jsonb; external_sku uuid; internal_sku uuid; v_rejected boolean:=false;
begin
 select id into c from public.platform_connections where store_id='40000000-0000-4000-8000-000000000001';
 j:=public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'orders');
 r:='[{"externalId":"order-1","status":"paid","placedAt":"2026-10-18T00:00:00Z","updatedAt":"2026-10-18T01:00:00Z","grossSales":"29.90","items":[{"externalSkuId":"sku-1","quantity":1,"grossSales":"29.90"}]}]'::jsonb;
 perform public.apply_mock_batch(j,r,'cursor-1');
 perform public.apply_mock_batch(j,r,'cursor-1');
 perform public.apply_mock_batch(j,'[{"externalId":"order-1","status":"completed","placedAt":"2026-10-18T00:00:00Z","updatedAt":"2026-10-18T03:00:00Z","grossSales":"29.90","items":[{"externalSkuId":"sku-1","quantity":1,"grossSales":"29.90"}]}]'::jsonb,'cursor-2');
 if (select count(*) from public.external_orders where connection_id=c)<>1 then raise exception 'duplicate order'; end if;
 if (select status from public.external_orders where connection_id=c and external_id='order-1')<>'completed' then raise exception 'status update missing'; end if;
 if (select count(*) from public.external_order_items where store_id='40000000-0000-4000-8000-000000000001')<>1 then raise exception 'duplicate item'; end if;
 begin
   perform public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'orders');
   raise exception 'concurrent job accepted';
 exception when unique_violation then null; end;
 perform public.finish_mock_sync(j,'success');
 j:=public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'products');
 perform public.apply_mock_batch(j,'[{"externalId":"product-1","name":"模拟商品","updatedAt":"2026-10-18T01:00:00Z","skus":[{"externalId":"sku-1","name":"规格","code":"SKU-1","price":"29.90"}]}]'::jsonb,'product-cursor');
 perform public.finish_mock_sync(j,'success');
 insert into public.products(store_id,name,category) values('40000000-0000-4000-8000-000000000001','内部商品','清洁');
 insert into public.skus(store_id,product_id,sku_name,sku_code,selling_price)
 select '40000000-0000-4000-8000-000000000001',id,'规格','SKU-1',29.90 from public.products where store_id='40000000-0000-4000-8000-000000000001' returning id into internal_sku;
 select id into external_sku from public.external_skus where connection_id=c and external_id='sku-1';
 insert into public.platform_sku_mappings(store_id,connection_id,external_sku_id,sku_id,match_kind)
 values('40000000-0000-4000-8000-000000000001',c,external_sku,internal_sku,'manual');
 if (select count(*) from public.platform_sku_mapping_history where connection_id=c and action='bound')<>1 then raise exception 'mapping audit missing'; end if;
 delete from public.platform_sku_mappings where connection_id=c and external_sku_id=external_sku;
 if (select count(*) from public.platform_sku_mapping_history where connection_id=c and action='unbound')<>1 then raise exception 'unbinding audit missing'; end if;
 j:=public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'refunds');
 perform public.apply_mock_batch(j,'[{"externalId":"refund-1","orderExternalId":"order-1","amount":"5.00","status":"succeeded","updatedAt":"2026-10-18T02:00:00Z"}]'::jsonb,'refund-cursor');
 perform public.apply_mock_batch(j,'[{"externalId":"refund-1","orderExternalId":"order-1","amount":"5.00","status":"rejected","updatedAt":"2026-10-18T04:00:00Z"}]'::jsonb,'refund-cursor-2');
 perform public.finish_mock_sync(j,'success');
 if (select count(*) from public.external_refunds where connection_id=c)<>1 then raise exception 'refund missing'; end if;
 if (select status from public.external_refunds where connection_id=c) <> 'rejected' then raise exception 'refund status update missing'; end if;
 j:=public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'refunds');
 begin
   perform public.apply_mock_batch(j,'[{"externalId":"refund-too-large","orderExternalId":"order-1","amount":"30.00","status":"succeeded","updatedAt":"2026-10-18T05:00:00Z"}]'::jsonb,'invalid-cursor');
 exception when raise_exception then v_rejected:=true;
 end;
 if not v_rejected then raise exception 'oversized refund accepted'; end if;
 if exists(select 1 from public.sync_cursors where connection_id=c and kind='refunds' and cursor_value='invalid-cursor') then raise exception 'cursor advanced after failed refund'; end if;
 perform public.finish_mock_sync(j,'failed','expected validation failure');
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
do $$
declare c uuid;
begin
 if (select count(*) from public.external_orders)<>1 then raise exception 'tenant read isolation failed'; end if;
 select id into c from public.platform_connections where store_id='40000000-0000-4000-8000-000000000001';
 begin
   perform public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'orders');
   raise exception 'viewer started sync';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.mock_platform_events(store_id,connection_id,kind,external_id,payload)
   values('40000000-0000-4000-8000-000000000001',c,'order','fake','{}');
   raise exception 'viewer wrote mock event';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$
declare c uuid;
begin
 select id into c from public.platform_connections where store_id='40000000-0000-4000-8000-000000000001';
 begin
   perform public.start_mock_sync('40000000-0000-4000-8000-000000000001',c,'orders');
   raise exception 'cross-store sync accepted';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.external_orders)<>0 then raise exception 'cross-store order read'; end if;
end $$;
rollback;
