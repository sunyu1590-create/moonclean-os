-- Let signed-in store editors append their own privacy-safe AI usage records.
grant insert on public.copilot_usage_logs to authenticated;
drop policy if exists copilot_usage_logs_insert on public.copilot_usage_logs;
create policy copilot_usage_logs_insert on public.copilot_usage_logs
for insert to authenticated
with check (private.can_edit(store_id) and user_id = (select auth.uid()));
