drop function if exists public.record_store_ai_credential_attempt(uuid, boolean);
create or replace function public.record_store_ai_credential_attempt(p_store uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_failed integer;
begin
  if not private.is_member(p_store) then
    raise exception 'credential access forbidden' using errcode = '42501';
  end if;

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

  if not found then
    select failed_attempts into v_failed from public.store_ai_credentials where store_id = p_store;
  end if;
  v_failed := coalesce(v_failed, 0);
  return jsonb_build_object('failed_attempts', v_failed, 'destroyed', v_failed >= 5);
end;
$$;
revoke all on function public.record_store_ai_credential_attempt(uuid) from public, anon;
grant execute on function public.record_store_ai_credential_attempt(uuid) to authenticated;
