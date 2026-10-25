alter function public.register_current_device_session_for_device(uuid, text, text) security invoker;
alter function public.revoke_device_sessions_for_device(uuid) security invoker;
alter function public.revoke_unidentified_device_sessions() security invoker;

grant insert (session_id, device_id, user_id, device_label, user_agent)
  on public.user_device_sessions to authenticated;
grant update (device_id, device_label, user_agent, last_seen_at, revoked_at)
  on public.user_device_sessions to authenticated;

drop policy if exists "users can register their current device session" on public.user_device_sessions;
create policy "users can register their current device session"
  on public.user_device_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and session_id = (((select auth.jwt()) ->> 'session_id')::uuid)
  );

drop policy if exists "users can refresh their current device session" on public.user_device_sessions;
create policy "users can refresh their current device session"
  on public.user_device_sessions for update to authenticated
  using (
    user_id = (select auth.uid())
    and session_id = (((select auth.jwt()) ->> 'session_id')::uuid)
    and revoked_at is null
  )
  with check (
    user_id = (select auth.uid())
    and session_id = (((select auth.jwt()) ->> 'session_id')::uuid)
    and revoked_at is null
  );

drop policy if exists "users can revoke their device sessions" on public.user_device_sessions;
create policy "users can revoke their device sessions"
  on public.user_device_sessions for update to authenticated
  using (user_id = (select auth.uid()) and revoked_at is null)
  with check (user_id = (select auth.uid()) and revoked_at is not null);
