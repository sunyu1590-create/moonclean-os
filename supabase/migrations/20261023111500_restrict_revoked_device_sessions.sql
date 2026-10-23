create or replace function public.current_device_session_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    auth.jwt() ->> 'session_id' is null or not exists (
      select 1 from public.user_device_sessions s
      where s.session_id = (auth.jwt() ->> 'session_id')::uuid and s.revoked_at is not null
    )
  )
$$;
grant execute on function public.current_device_session_active() to authenticated;

do $$
declare table_name text;
begin
  for table_name in
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname <> 'user_device_sessions'
  loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (public.current_device_session_active()) with check (public.current_device_session_active())', 'active_device_session_' || table_name, table_name);
  end loop;
end $$;
