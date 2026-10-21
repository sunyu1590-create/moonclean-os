-- Store DeepSeek keys without an application-managed encryption secret.
-- The table remains inaccessible to anon/authenticated roles and is accessed only by service_role.
alter table public.store_ai_credentials
  add column if not exists api_key text;

alter table public.store_ai_credentials
  alter column key_ciphertext drop not null;

comment on column public.store_ai_credentials.api_key is
  'Plaintext DeepSeek API key; access remains restricted to service_role.';
