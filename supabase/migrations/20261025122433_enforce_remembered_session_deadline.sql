alter table public.user_device_sessions
  add column if not exists remember_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_device_sessions'::regclass
      and conname = 'user_device_sessions_remember_until_within_30_days'
  ) then
    alter table public.user_device_sessions
      add constraint user_device_sessions_remember_until_within_30_days
      check (
        remember_until is null
        or remember_until between created_at and created_at + interval '30 days'
      );
  end if;
end;
$$;

grant update (remember_until) on public.user_device_sessions to authenticated;

create or replace function public.current_device_session_active()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    (select auth.jwt() ->> 'session_id') is null
    or not exists (
      select 1
      from public.user_device_sessions as session
      where session.session_id = ((select auth.jwt()) ->> 'session_id')::uuid
        and (
          session.revoked_at is not null
          or session.remember_until <= now()
        )
    )
  );
$$;

revoke all on function public.current_device_session_active() from public, anon;
grant execute on function public.current_device_session_active() to authenticated;
