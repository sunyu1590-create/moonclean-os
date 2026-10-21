drop policy if exists store_ai_credentials_admin_manage on public.store_ai_credentials;
create policy store_ai_credentials_admin_insert
  on public.store_ai_credentials for insert to authenticated
  with check (private.can_admin(store_id));
create policy store_ai_credentials_admin_update
  on public.store_ai_credentials for update to authenticated
  using (private.can_admin(store_id))
  with check (private.can_admin(store_id));
create policy store_ai_credentials_admin_delete
  on public.store_ai_credentials for delete to authenticated
  using (private.can_admin(store_id));
