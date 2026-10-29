begin;
insert into auth.users(id,email) values
  ('70000000-0000-4000-8000-000000000001','load-test-allowed@example.test'),
  ('70000000-0000-4000-8000-000000000002','load-test-denied@example.test');
insert into public.moonclean_load_test_access(user_id)
values ('70000000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values
  ('moonclean-load-test','70000000-0000-4000-8000-000000000001/run-allowed/part-01.bin'),
  ('moonclean-load-test','70000000-0000-4000-8000-000000000002/run-denied/part-01.bin');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from storage.objects where bucket_id='moonclean-load-test') <> 1 then
    raise exception 'allowlisted test user could not read its own load-test object';
  end if;
  insert into storage.objects(bucket_id,name)
  values ('moonclean-load-test','70000000-0000-4000-8000-000000000001/run-allowed/part-02.bin');
end $$;

select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000002',true);
do $$
begin
  if (select count(*) from storage.objects where bucket_id='moonclean-load-test') <> 0 then
    raise exception 'non-allowlisted user can read a load-test object';
  end if;
  begin
    insert into storage.objects(bucket_id,name)
    values ('moonclean-load-test','70000000-0000-4000-8000-000000000002/run-denied/part-02.bin');
    raise exception 'non-allowlisted user can upload a load-test object';
  exception when insufficient_privilege then
    null;
  end;
end $$;
rollback;
