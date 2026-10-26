-- Isolated private storage for an authenticated user's synthetic load test.
-- Four 50 MB objects stay under Supabase Free's 50 MiB per-file ceiling.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'moonclean-load-test',
  'moonclean-load-test',
  false,
  50000000,
  array['application/octet-stream']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy moonclean_load_test_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy moonclean_load_test_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy moonclean_load_test_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'moonclean-load-test'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
