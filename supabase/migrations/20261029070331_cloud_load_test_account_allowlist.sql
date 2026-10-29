-- Keep the large synthetic load test available only to explicitly allowlisted accounts.
create table if not exists public.moonclean_load_test_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.moonclean_load_test_access enable row level security;
revoke all on table public.moonclean_load_test_access from anon, authenticated;
grant select on table public.moonclean_load_test_access to authenticated;

drop policy if exists moonclean_load_test_access_read_own on public.moonclean_load_test_access;
create policy moonclean_load_test_access_read_own
on public.moonclean_load_test_access for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists moonclean_load_test_read_own on storage.objects;
create policy moonclean_load_test_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.moonclean_load_test_access as access
    where access.user_id = (select auth.uid())
  )
);

drop policy if exists moonclean_load_test_insert_own on storage.objects;
create policy moonclean_load_test_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.moonclean_load_test_access as access
    where access.user_id = (select auth.uid())
  )
);

drop policy if exists moonclean_load_test_delete_own on storage.objects;
create policy moonclean_load_test_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.moonclean_load_test_access as access
    where access.user_id = (select auth.uid())
  )
);
