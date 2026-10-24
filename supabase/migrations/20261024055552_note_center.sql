-- Note-center additions are additive: existing notes and Markdown bodies stay intact.
alter table public.operation_notes
  add column if not exists title_is_auto boolean not null default false;

create table if not exists public.operation_note_folders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, store_id)
);

create unique index if not exists operation_note_folders_store_name_active_idx
  on public.operation_note_folders (store_id, lower(name))
  where deleted_at is null;
create index if not exists operation_note_folders_store_active_idx
  on public.operation_note_folders (store_id, created_at desc)
  where deleted_at is null;

-- Preserve folder strings already stored on notes by materializing each existing name.
insert into public.operation_note_folders (store_id, name, created_by)
select distinct on (n.store_id, lower(trim(n.folder)))
  n.store_id,
  trim(n.folder),
  n.created_by
from public.operation_notes n
where trim(n.folder) <> ''
  and n.deleted_at is null
order by n.store_id, lower(trim(n.folder)), trim(n.folder), n.created_at
on conflict do nothing;

alter table public.operation_notes
  add column if not exists folder_id uuid;
update public.operation_notes n
set folder_id = f.id
from public.operation_note_folders f
where n.folder_id is null
  and trim(coalesce(n.folder, '')) <> ''
  and f.store_id = n.store_id
  and lower(f.name) = lower(trim(n.folder))
  and f.deleted_at is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'operation_notes_folder_store_fk') then
    alter table public.operation_notes
      add constraint operation_notes_folder_store_fk
      foreign key (folder_id, store_id)
      references public.operation_note_folders (id, store_id)
      on delete restrict;
  end if;
end $$;
create index if not exists operation_notes_store_folder_active_idx
  on public.operation_notes (store_id, folder_id, updated_at desc)
  where deleted_at is null and archived_at is null;

alter table public.operation_note_folders enable row level security;
revoke all on public.operation_note_folders from anon, authenticated;
grant select, insert, update on public.operation_note_folders to authenticated;

drop policy if exists operation_note_folders_read on public.operation_note_folders;
create policy operation_note_folders_read
  on public.operation_note_folders for select to authenticated
  using (private.is_member(store_id));
drop policy if exists operation_note_folders_insert on public.operation_note_folders;
create policy operation_note_folders_insert
  on public.operation_note_folders for insert to authenticated
  with check (private.can_edit(store_id) and created_by = auth.uid());
drop policy if exists operation_note_folders_update on public.operation_note_folders;
create policy operation_note_folders_update
  on public.operation_note_folders for update to authenticated
  using (private.can_edit(store_id))
  with check (private.can_edit(store_id));

drop trigger if exists guard_workspace_identity on public.operation_note_folders;
create trigger guard_workspace_identity before insert or update on public.operation_note_folders
  for each row execute function private.guard_workspace_identity('created_by');
drop trigger if exists set_updated_at on public.operation_note_folders;
create trigger set_updated_at before update on public.operation_note_folders
  for each row execute function public.set_updated_at();
drop trigger if exists audit_change on public.operation_note_folders;
create trigger audit_change after insert or update or delete on public.operation_note_folders
  for each row execute function private.audit_business_change();
