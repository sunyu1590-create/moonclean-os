alter table public.user_device_sessions
  add column if not exists device_id uuid;

-- Leave existing rows NULL: historical sessions do not contain a reliable
-- browser identifier and must not be guessed into physical-device groups.

create index if not exists user_device_sessions_user_device_last_seen_idx
  on public.user_device_sessions (user_id, device_id, last_seen_at desc);

create or replace function public.register_current_device_session_for_device(
  p_device_id uuid,
  p_device_label text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  if v_user_id is null or v_session_id is null then
    raise exception '未登录';
  end if;
  if p_device_id is null then
    raise exception '设备标识无效';
  end if;
  if exists (
    select 1 from public.user_device_sessions
    where session_id = v_session_id and revoked_at is not null
  ) then
    raise exception '此设备会话已撤销，请重新登录';
  end if;
  insert into public.user_device_sessions(session_id, device_id, user_id, device_label, user_agent)
  values (
    v_session_id,
    p_device_id,
    v_user_id,
    left(coalesce(p_device_label, '未知设备'), 100),
    left(coalesce(p_user_agent, ''), 500)
  )
  on conflict (session_id) do update set
    device_id = excluded.device_id,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    last_seen_at = now();
end;
$$;

create or replace function public.revoke_device_sessions_for_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_device_id is null then
    raise exception '设备会话无效';
  end if;
  update public.user_device_sessions
  set revoked_at = coalesce(revoked_at, now())
  where user_id = auth.uid()
    and device_id = p_device_id
    and session_id <> (auth.jwt() ->> 'session_id')::uuid
    and revoked_at is null;
  if not found then
    raise exception '设备不存在、已是当前设备或无权操作';
  end if;
end;
$$;

create or replace function public.revoke_unidentified_device_sessions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '未登录';
  end if;
  update public.user_device_sessions
  set revoked_at = coalesce(revoked_at, now())
  where user_id = auth.uid()
    and device_id is null
    and session_id <> (auth.jwt() ->> 'session_id')::uuid
    and revoked_at is null;
  if not found then
    raise exception '没有可清理的旧版会话';
  end if;
end;
$$;

revoke all on function public.register_current_device_session_for_device(uuid, text, text) from public, anon;
revoke all on function public.revoke_device_sessions_for_device(uuid) from public, anon;
revoke all on function public.revoke_unidentified_device_sessions() from public, anon;
grant execute on function public.register_current_device_session_for_device(uuid, text, text) to authenticated;
grant execute on function public.revoke_device_sessions_for_device(uuid) to authenticated;
grant execute on function public.revoke_unidentified_device_sessions() to authenticated;
