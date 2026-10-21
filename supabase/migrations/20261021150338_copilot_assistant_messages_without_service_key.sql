-- Allow authenticated store editors to persist AI replies through their own session.
-- RLS still limits inserts to stores they can edit and conversations in that same store.
drop policy if exists copilot_messages_write on public.copilot_messages;
create policy copilot_messages_write on public.copilot_messages
for insert to authenticated
with check (
  role in ('user', 'assistant')
  and private.can_edit(store_id)
  and exists (
    select 1
    from public.copilot_conversations c
    where c.id = copilot_messages.conversation_id
      and c.store_id = copilot_messages.store_id
      and c.deleted_at is null
  )
);
