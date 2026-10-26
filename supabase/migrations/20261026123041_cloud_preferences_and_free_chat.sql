-- User-owned appearance and interaction preferences. These are explicitly
-- saved/restored by the user and are separate from store business settings.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
create policy user_preferences_select_own on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_insert_own on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_preferences_update_own on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.free_ai_chat_conversations (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (length(title) between 1 and 240),
  conversation jsonb not null check (jsonb_typeof(conversation) = 'object' and pg_column_size(conversation) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, store_id, id)
);
create index if not exists free_ai_chat_conversations_recent_idx
  on public.free_ai_chat_conversations (user_id, store_id, updated_at desc);

alter table public.free_ai_chat_conversations enable row level security;
revoke all on public.free_ai_chat_conversations from anon, authenticated;
grant select, insert, update, delete on public.free_ai_chat_conversations to authenticated;
create policy free_ai_chat_conversations_select_own on public.free_ai_chat_conversations
  for select to authenticated using ((select auth.uid()) = user_id and private.is_member(store_id));
create policy free_ai_chat_conversations_insert_own on public.free_ai_chat_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id and private.is_member(store_id));
create policy free_ai_chat_conversations_update_own on public.free_ai_chat_conversations
  for update to authenticated using ((select auth.uid()) = user_id and private.is_member(store_id))
  with check ((select auth.uid()) = user_id and private.is_member(store_id));
create policy free_ai_chat_conversations_delete_own on public.free_ai_chat_conversations
  for delete to authenticated using ((select auth.uid()) = user_id and private.is_member(store_id));
