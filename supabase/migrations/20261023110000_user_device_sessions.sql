create table if not exists public.user_device_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default '未知设备',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists user_device_sessions_user_last_seen_idx
  on public.user_device_sessions (user_id, last_seen_at desc);

alter table public.user_device_sessions enable row level security;
revoke all on public.user_device_sessions from anon, authenticated;
grant select on public.user_device_sessions to authenticated;
create policy "users can view their device sessions"
  on public.user_device_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.register_current_device_session(p_device_label text, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  if v_user_id is null or v_session_id is null then raise exception '未登录'; end if;
  if exists (select 1 from public.user_device_sessions where session_id = v_session_id and revoked_at is not null) then
    raise exception '此设备会话已撤销，请重新登录';
  end if;
  insert into public.user_device_sessions(session_id,user_id,device_label,user_agent)
  values(v_session_id,v_user_id,left(coalesce(p_device_label,'未知设备'),100),left(coalesce(p_user_agent,''),500))
  on conflict(session_id) do update set device_label=excluded.device_label,user_agent=excluded.user_agent,last_seen_at=now();
end $$;

create or replace function public.revoke_device_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.user_device_sessions set revoked_at=coalesce(revoked_at,now())
  where session_id=p_session_id and user_id=auth.uid()
    and session_id <> (auth.jwt() ->> 'session_id')::uuid;
  if not found then raise exception '设备不存在、已是当前设备或无权操作'; end if;
end $$;

grant execute on function public.register_current_device_session(text,text) to authenticated;
grant execute on function public.revoke_device_session(uuid) to authenticated;

