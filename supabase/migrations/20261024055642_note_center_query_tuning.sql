-- Keep folder membership checks set-based and index the creator FK for safe deletes.
create index if not exists operation_note_folders_created_by_idx
  on public.operation_note_folders (created_by);

drop index if exists public.operation_note_folders_store_active_idx;

drop policy if exists operation_note_folders_insert on public.operation_note_folders;
create policy operation_note_folders_insert
  on public.operation_note_folders for insert to authenticated
  with check (private.can_edit(store_id) and created_by = (select auth.uid()));
