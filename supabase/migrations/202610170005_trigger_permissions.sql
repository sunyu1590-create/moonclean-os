-- Trigger handlers need table trigger execution, not direct RPC access.
-- PostgreSQL does not check EXECUTE privilege when firing an existing trigger.
revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.create_store_owner() from public, anon, authenticated;
