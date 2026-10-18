-- Local/PGlite only. Fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('50000000-0000-4000-8000-000000000001','ops-owner@example.test',now()),
 ('50000000-0000-4000-8000-000000000002','ops-editor@example.test',now()),
 ('50000000-0000-4000-8000-000000000003','ops-viewer@example.test',now()),
 ('50000000-0000-4000-8000-000000000004','ops-other@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
insert into public.stores(id,created_by,name,platform)
 values('60000000-0000-4000-8000-000000000001',auth.uid(),'Operations A','pinduoduo');
select public.manage_store_member('60000000-0000-4000-8000-000000000001','ops-editor@example.test','editor','upsert');
select public.manage_store_member('60000000-0000-4000-8000-000000000001','ops-viewer@example.test','viewer','upsert');
insert into public.products(id,store_id,name,category)
 values('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Product','清洁');
insert into public.skus(id,store_id,product_id,sku_name,selling_price)
 values('80000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','SKU',19.90);
select public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',8,10,'initial count');
select public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',8,5,'threshold only');
do $$ begin
 if (select count(*) from public.inventory_movements)<>1 then raise exception 'duplicate inventory movement'; end if;
 if (select quantity from public.inventory_balances where sku_id='80000000-0000-4000-8000-000000000001')<>8 then raise exception 'inventory quantity wrong'; end if;
 begin
  perform public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',-1,5,'invalid');
  raise exception 'negative stock accepted';
 exception when raise_exception then
  if sqlerrm='negative stock accepted' then raise; end if;
 end;
end $$;
insert into public.operation_tasks(store_id,title,priority,due_date,recommendation_key,recommendation_baseline)
 values('60000000-0000-4000-8000-000000000001','Replenish','high',current_date,'profit_negative','{"profit":"-12.00","coverage_days":7}');
do $$ begin
 begin
  insert into public.operation_tasks(store_id,title,recommendation_key)
   values('60000000-0000-4000-8000-000000000001','Duplicate recommendation','profit_negative');
  raise exception 'duplicate active recommendation accepted';
 exception when unique_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
select public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',12,5,'restocked');
update public.operation_tasks set status='done' where store_id='60000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.inventory_movements)<>2 then raise exception 'inventory ledger mismatch'; end if;
 if (select count(*) from public.operation_tasks where status='done')<>1 then raise exception 'editor task update failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.operation_tasks)<>1 then raise exception 'viewer cannot read'; end if;
 begin
  perform public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',20,5,'viewer attempt');
  raise exception 'viewer adjusted stock';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.operation_tasks(store_id,title) values('60000000-0000-4000-8000-000000000001','viewer attempt');
  raise exception 'viewer created task';
 exception when insufficient_privilege then null; end;
 begin
  update public.operation_tasks set status='todo';
  if found then raise exception 'viewer edited task'; end if;
 exception when insufficient_privilege then null; end;
 begin
  update public.inventory_balances set quantity=999;
  raise exception 'viewer direct inventory update';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000004',true);
do $$ begin
 if exists(select 1 from public.inventory_balances) or exists(select 1 from public.operation_tasks) then raise exception 'cross-store read'; end if;
 begin
  perform public.set_inventory_balance('60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',999,5,'other');
  raise exception 'cross-store stock changed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.operation_tasks(store_id,title) values('60000000-0000-4000-8000-000000000001','other');
  raise exception 'cross-store task created';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
