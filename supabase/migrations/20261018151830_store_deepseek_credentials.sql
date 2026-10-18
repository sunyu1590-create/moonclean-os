-- Store encrypted DeepSeek credentials. Only the server-side secret key may access this table.
create table if not exists public.store_ai_credentials (
  store_id uuid primary key references public.stores(id) on delete cascade,
  provider text not null default 'deepseek' check (provider = 'deepseek'),
  key_ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.store_ai_credentials enable row level security;
revoke all on public.store_ai_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.store_ai_credentials to service_role;
