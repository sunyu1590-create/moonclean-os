-- OAuth credentials stay in the existing private table. These invoker functions
-- are reachable through PostgREST only to service_role and never return tokens.
create or replace function public.save_pdd_oauth_credentials(
  p_store_id uuid,
  p_connection_id uuid,
  p_client_id_ciphertext bytea,
  p_client_secret_ciphertext bytea,
  p_access_token_ciphertext bytea,
  p_refresh_token_ciphertext bytea,
  p_expires_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.platform_connections c
    where c.id = p_connection_id
      and c.store_id = p_store_id
      and c.platform = 'pinduoduo'
      and c.mode = 'official'
  ) then
    raise exception 'official Pinduoduo connection unavailable' using errcode = '23503';
  end if;

  insert into private.platform_credentials (
    store_id, connection_id, client_id_ciphertext, client_secret_ciphertext,
    access_token_ciphertext, refresh_token_ciphertext, expires_at, updated_at
  ) values (
    p_store_id, p_connection_id, p_client_id_ciphertext, p_client_secret_ciphertext,
    p_access_token_ciphertext, p_refresh_token_ciphertext, p_expires_at, pg_catalog.now()
  )
  on conflict (connection_id) do update set
    client_id_ciphertext = excluded.client_id_ciphertext,
    client_secret_ciphertext = excluded.client_secret_ciphertext,
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    expires_at = excluded.expires_at,
    updated_at = pg_catalog.now()
  where private.platform_credentials.store_id = excluded.store_id;
end;
$$;

revoke all on function public.save_pdd_oauth_credentials(uuid, uuid, bytea, bytea, bytea, bytea, timestamptz) from public, anon, authenticated;
grant execute on function public.save_pdd_oauth_credentials(uuid, uuid, bytea, bytea, bytea, bytea, timestamptz) to service_role;

create or replace function public.get_pdd_oauth_expiries(p_store_id uuid)
returns table(connection_id uuid, expires_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select credentials.connection_id, credentials.expires_at
  from private.platform_credentials credentials
  join public.platform_connections connection
    on connection.id = credentials.connection_id
   and connection.store_id = credentials.store_id
  where credentials.store_id = p_store_id;
$$;

revoke all on function public.get_pdd_oauth_expiries(uuid) from public, anon, authenticated;
grant execute on function public.get_pdd_oauth_expiries(uuid) to service_role;
