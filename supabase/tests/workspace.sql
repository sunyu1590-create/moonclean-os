-- Local/PGlite and isolated Supabase test only. All fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('51000000-0000-4000-8000-000000000001','workspace-owner@example.test',now()),
 ('51000000-0000-4000-8000-000000000002','workspace-editor@example.test',now()),
 ('51000000-0000-4000-8000-000000000003','workspace-viewer@example.test',now()),
 ('51000000-0000-4000-8000-000000000004','workspace-other@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
insert into public.stores(id,created_by,name,platform)
 values('61000000-0000-4000-8000-000000000001',auth.uid(),'Workspace A','pinduoduo');
select public.manage_store_member('61000000-0000-4000-8000-000000000001','workspace-editor@example.test','editor','upsert');
select public.manage_store_member('61000000-0000-4000-8000-000000000001','workspace-viewer@example.test','viewer','upsert');
insert into public.products(id,store_id,name,category)
 values('71000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Laundry','cleaning');
insert into public.operation_notes(id,store_id,title,body_markdown,created_by)
 values('81000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Owner note','baseline',auth.uid());
insert into public.operation_note_folders(id,store_id,name,created_by)
 values('85000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','运营复盘',auth.uid());
update public.operation_notes set folder='运营复盘',folder_id='85000000-0000-4000-8000-000000000001'
 where id='81000000-0000-4000-8000-000000000001';
insert into public.operation_tasks(store_id,title,source_module,source_id)
 values('61000000-0000-4000-8000-000000000001','Review note link','notes','81000000-0000-4000-8000-000000000001');
insert into public.operation_experiments(id,store_id,name,experiment_type,product_id,source_note_id)
 values('82000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Main image test','main_image','71000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001');
insert into public.competitors(id,store_id,product_name,current_price,our_product_id)
 values('83000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Rival cleaner',29.90,'71000000-0000-4000-8000-000000000001');
insert into public.copilot_conversations(id,store_id,title,created_by)
 values('84000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Question',auth.uid());
update public.operation_notes set related_type='copilot_conversation',related_id='84000000-0000-4000-8000-000000000001'
 where id='81000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.operation_note_versions where note_id='81000000-0000-4000-8000-000000000001')<>1 then raise exception 'note first version missing'; end if;
 if (select count(*) from public.operation_notes n join public.operation_note_folders f on f.id=n.folder_id and f.store_id=n.store_id where n.id='81000000-0000-4000-8000-000000000001' and f.name='运营复盘')<>1 then raise exception 'note folder association missing'; end if;
 if (select count(*) from public.operation_tasks where source_module='notes' and source_id='81000000-0000-4000-8000-000000000001')<>1 then raise exception 'task source link missing'; end if;
 if (select count(*) from public.operation_notes where related_type='copilot_conversation' and related_id='84000000-0000-4000-8000-000000000001')<>1 then raise exception 'copilot note link missing'; end if;
 if (select count(*) from public.service_template_versions where template_id='81000000-0000-4000-8000-000000000001')<>0 then raise exception 'unrelated template version'; end if;
 begin
  insert into public.competitors(store_id,product_name,current_price) values('61000000-0000-4000-8000-000000000001','Negative',-1);
  raise exception 'negative competitor price accepted';
 exception when check_violation then null; end;
 begin
  insert into public.operation_tasks(store_id,title,source_module,source_id) values('61000000-0000-4000-8000-000000000001','Invalid source link','notes','81000000-0000-4000-8000-000000000099');
  raise exception 'invalid task source accepted';
 exception when raise_exception then
  if sqlerrm='invalid task source accepted' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
update public.operation_notes set body_markdown='editor update' where id='81000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.operation_note_versions where note_id='81000000-0000-4000-8000-000000000001')<>2 then raise exception 'note history not appended'; end if;
 begin
  update public.operation_notes set created_by='51000000-0000-4000-8000-000000000002' where id='81000000-0000-4000-8000-000000000001';
  raise exception 'created_by spoof unexpectedly allowed';
 exception when raise_exception then
  if sqlerrm='created_by spoof unexpectedly allowed' then raise; end if;
 end;
 begin
  update public.operation_notes set store_id='61000000-0000-4000-8000-000000000002' where id='81000000-0000-4000-8000-000000000001';
  raise exception 'tenant reassignment unexpectedly allowed';
 exception when raise_exception then
  if sqlerrm='tenant reassignment unexpectedly allowed' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.operation_notes)<>1 then raise exception 'viewer cannot read note'; end if;
 if (select count(*) from public.operation_note_folders where id='85000000-0000-4000-8000-000000000001')<>1 then raise exception 'viewer cannot read note folder'; end if;
 begin
  insert into public.operation_notes(store_id,title,created_by) values('61000000-0000-4000-8000-000000000001','Viewer note',auth.uid());
  raise exception 'viewer note insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.operation_notes set title='Viewer edit' where id='81000000-0000-4000-8000-000000000001';
  if found then raise exception 'viewer note update allowed'; end if;
 exception when insufficient_privilege then null; end;
 begin
  insert into public.copilot_messages(store_id,conversation_id,role,content) values('61000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','user','viewer message');
  raise exception 'viewer message insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000004',true);
do $$ begin
 if exists(select 1 from public.operation_notes) or exists(select 1 from public.competitors) or exists(select 1 from public.operation_note_folders) then raise exception 'cross-store workspace read'; end if;
 begin
  insert into public.operation_experiments(store_id,name,experiment_type) values('61000000-0000-4000-8000-000000000001','Other store','custom');
  raise exception 'cross-store experiment write allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
