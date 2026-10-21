alter table public.store_ai_credentials
  add column if not exists key_salt text,
  add column if not exists key_iv text,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_at timestamptz;

alter table public.store_ai_credentials drop column if exists api_key;
alter table public.store_ai_credentials enable row level security;

revoke all on public.store_ai_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.store_ai_credentials to authenticated, service_role;

drop policy if exists store_ai_credentials_select_member on public.store_ai_credentials;
drop policy if exists store_ai_credentials_admin_manage on public.store_ai_credentials;
create policy store_ai_credentials_select_member
  on public.store_ai_credentials for select to authenticated
  using (private.is_member(store_id));
create policy store_ai_credentials_admin_manage
  on public.store_ai_credentials for all to authenticated
  using (private.can_admin(store_id))
  with check (private.can_admin(store_id));

create or replace function public.record_store_ai_credential_attempt(p_store uuid, p_success boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_failed integer;
  v_destroyed boolean;
begin
  if not private.is_member(p_store) then
    raise exception 'credential access forbidden' using errcode = '42501';
  end if;

  if p_success then
    update public.store_ai_credentials
      set failed_attempts = 0, updated_at = now()
      where store_id = p_store
        and failed_attempts < 5
        and key_ciphertext is not null
      returning failed_attempts into v_failed;
  else
    update public.store_ai_credentials
      set failed_attempts = least(failed_attempts + 1, 5),
          key_ciphertext = case when failed_attempts + 1 >= 5 then null else key_ciphertext end,
          key_salt = case when failed_attempts + 1 >= 5 then null else key_salt end,
          key_iv = case when failed_attempts + 1 >= 5 then null else key_iv end,
          locked_at = case when failed_attempts + 1 >= 5 then now() else locked_at end,
          updated_at = now()
      where store_id = p_store
        and failed_attempts < 5
        and key_ciphertext is not null
      returning failed_attempts into v_failed;
  end if;

  if not found then
    select failed_attempts into v_failed from public.store_ai_credentials where store_id = p_store;
  end if;
  v_failed := coalesce(v_failed, 0);
  v_destroyed := v_failed >= 5;
  return jsonb_build_object('failed_attempts', v_failed, 'destroyed', v_destroyed);
end;
$$;

revoke all on function public.record_store_ai_credential_attempt(uuid, boolean) from public, anon;
grant execute on function public.record_store_ai_credential_attempt(uuid, boolean) to authenticated;
