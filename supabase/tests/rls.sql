-- Run against an isolated Supabase local database after migrations: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- This script rolls back all fixtures. Do not run against a production project.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-owner-a@example.test','',now(),'{}','{}'),
('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-owner-b@example.test','',now(),'{}','{}'),
('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-viewer@example.test','',now(),'{}','{}'),
('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-editor@example.test','',now(),'{}','{}'),
('10000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-admin@example.test','',now(),'{}','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.stores(id,created_by,name) values('20000000-0000-4000-8000-000000000001',auth.uid(),'Store A');
select public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-viewer@example.test','viewer','upsert');
select public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-editor@example.test','editor','upsert');
select public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-admin@example.test','admin','upsert');
insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('20000000-0000-4000-8000-000000000001','2026-10-17',100,0,1,0);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
insert into public.stores(id,created_by,name) values('20000000-0000-4000-8000-000000000002',auth.uid(),'Store B');
insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('20000000-0000-4000-8000-000000000002','2026-10-17',999,0,1,0);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.stores)<>1 then raise exception 'viewer saw another store'; end if;
  if (select count(*) from public.daily_metrics where store_id='20000000-0000-4000-8000-000000000002')<>0 then raise exception 'cross-store data leak'; end if;
  begin
    insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('20000000-0000-4000-8000-000000000001','2026-10-18',10,0,1,0);
    raise exception 'viewer write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','forged','stores',null,'{}');
    raise exception 'audit actor spoof unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-editor@example.test','owner','upsert');
    raise exception 'viewer member mutation unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
do $$ begin
  insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('20000000-0000-4000-8000-000000000001','2026-10-18',10,0,1,0);
  begin
    insert into public.daily_metrics(store_id,metric_date,gross_sales,refunds,order_count,other_expenses) values('20000000-0000-4000-8000-000000000002','2026-10-18',10,0,1,0);
    raise exception 'editor cross-store write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-viewer@example.test','admin','upsert');
    raise exception 'editor member mutation unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
do $$ begin
  begin
    perform public.manage_store_member('20000000-0000-4000-8000-000000000001','rls-admin@example.test','owner','upsert');
    raise exception 'admin self-elevation unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.store_members set role='owner' where store_id='20000000-0000-4000-8000-000000000001' and user_id=auth.uid();
    raise exception 'direct member update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.transfer_store_ownership('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
do $$ begin
  if (select count(*) from public.store_members where store_id='20000000-0000-4000-8000-000000000001' and role='owner')<>1 then raise exception 'store must have exactly one owner'; end if;
  if (select role from public.store_members where store_id='20000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000004')<>'owner' then raise exception 'ownership transfer failed'; end if;
end $$;
rollback;
