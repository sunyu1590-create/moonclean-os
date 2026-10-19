-- Tenant-scoped operations workbench. All deletes are soft deletes or archival.
create table if not exists public.operation_notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 240),
  body_markdown text not null default '' check (length(body_markdown) <= 100000),
  category text not null default '未分类' check (length(trim(category)) between 1 and 80),
  tags text[] not null default '{}',
  folder text not null default '' check (length(folder) <= 80),
  is_favorite boolean not null default false,
  is_pinned boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  related_type text check (related_type in ('product','sku','experiment','competitor','service_case','copilot_conversation')),
  related_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  check (cardinality(tags) <= 30),
  check ((related_type is null) = (related_id is null))
);
create index if not exists operation_notes_store_updated_idx on public.operation_notes(store_id,deleted_at,archived_at,updated_at desc);
create index if not exists operation_notes_store_category_idx on public.operation_notes(store_id,category,updated_at desc);
create index if not exists operation_notes_tags_gin_idx on public.operation_notes using gin(tags);

create table if not exists public.operation_note_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  note_id uuid not null,
  version_number integer not null check (version_number > 0),
  title text not null,
  body_markdown text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(note_id,version_number),
  foreign key(note_id,store_id) references public.operation_notes(id,store_id) on delete cascade
);
create index if not exists operation_note_versions_note_idx on public.operation_note_versions(store_id,note_id,version_number desc);

create table if not exists public.operation_experiments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check(length(trim(name)) between 1 and 180),
  experiment_type text not null check(experiment_type in ('main_image','title','detail','price','sku_mix','promotion','custom')),
  status text not null default 'draft' check(status in ('draft','planned','running','paused','completed','cancelled')),
  test_design text not null default 'before_after' check(test_design in ('randomized_ab','before_after')),
  product_id uuid,
  source_note_id uuid,
  goal text not null default '' check(length(goal)<=2000),
  hypothesis text not null default '' check(length(hypothesis)<=4000),
  original_plan text not null default '' check(length(original_plan)<=6000),
  new_plan text not null default '' check(length(new_plan)<=6000),
  start_date date,
  end_date date,
  baseline_metrics jsonb not null default '{}'::jsonb check(jsonb_typeof(baseline_metrics)='object'),
  result_metrics jsonb not null default '{}'::jsonb check(jsonb_typeof(result_metrics)='object'),
  assets jsonb not null default '[]'::jsonb check(jsonb_typeof(assets)='array'),
  conclusion text not null default '' check(length(conclusion)<=6000),
  next_steps text not null default '' check(length(next_steps)<=3000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  foreign key(product_id,store_id) references public.products(id,store_id) on delete restrict,
  foreign key(source_note_id,store_id) references public.operation_notes(id,store_id) on delete restrict,
  check(start_date is null or end_date is null or end_date>=start_date)
);
create index if not exists operation_experiments_store_status_idx on public.operation_experiments(store_id,status,updated_at desc);
create index if not exists operation_experiments_product_idx on public.operation_experiments(store_id,product_id,start_date desc);
create index if not exists operation_experiments_source_note_idx on public.operation_experiments(store_id,source_note_id) where source_note_id is not null;

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  brand text not null default '' check(length(brand)<=120),
  product_name text not null check(length(trim(product_name)) between 1 and 240),
  product_url text not null default '' check(length(product_url)<=2048),
  platform text not null default 'pinduoduo' check(platform in ('pinduoduo','douyin','taobao','jd','other')),
  specifications text not null default '' check(length(specifications)<=1000),
  current_price numeric(18,2) not null default 0 check(current_price>=0),
  unit_quantity numeric(18,4) check(unit_quantity is null or unit_quantity>0),
  unit_name text not null default '件' check(length(unit_name)<=24),
  selling_points text[] not null default '{}',
  promotion text not null default '' check(length(promotion)<=2000),
  image_url text not null default '' check(length(image_url)<=2048),
  source text not null default 'manual' check(source in ('manual','external')),
  source_note text not null default '' check(length(source_note)<=1000),
  our_product_id uuid,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  foreign key(our_product_id,store_id) references public.products(id,store_id) on delete restrict,
  check(cardinality(selling_points)<=30)
);
create index if not exists competitors_store_updated_idx on public.competitors(store_id,archived_at,updated_at desc);
create index if not exists competitors_store_product_idx on public.competitors(store_id,our_product_id);

create table if not exists public.competitor_price_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  competitor_id uuid not null,
  recorded_on date not null,
  price numeric(18,2) not null check(price>=0),
  source_note text not null default '' check(length(source_note)<=1000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(competitor_id,store_id) references public.competitors(id,store_id) on delete restrict,
  unique(store_id,competitor_id,recorded_on,price)
);
create index if not exists competitor_price_history_date_idx on public.competitor_price_history(store_id,competitor_id,recorded_on desc);

create table if not exists public.service_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  title text not null check(length(trim(title)) between 1 and 180),
  category text not null check(category in ('presales','specification','usage','logistics','leakage','refund','complaint','negative_review','follow_up','other')),
  body text not null check(length(body) between 1 and 12000),
  variables text[] not null default '{}',
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  check(cardinality(variables)<=20)
);
create index if not exists service_templates_store_category_idx on public.service_templates(store_id,archived_at,category,updated_at desc);
create table if not exists public.service_template_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  template_id uuid not null,
  version_number integer not null check(version_number>0),
  title text not null,
  category text not null,
  body text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(template_id,version_number),
  foreign key(template_id,store_id) references public.service_templates(id,store_id) on delete cascade
);
create index if not exists service_template_versions_idx on public.service_template_versions(store_id,template_id,version_number desc);

create table if not exists public.service_cases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  order_number text not null default '' check(length(order_number)<=120),
  customer_name text not null default '' check(length(customer_name)<=120),
  product_id uuid,
  issue_category text not null check(issue_category in ('presales','specification','usage','logistics','leakage','refund','complaint','negative_review','follow_up','other')),
  description text not null check(length(trim(description)) between 1 and 6000),
  attachment_paths text[] not null default '{}',
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'open' check(status in ('open','processing','waiting_customer','resolved','closed')),
  resolution text not null default '' check(length(resolution)<=6000),
  compensation_amount numeric(18,2) not null default 0 check(compensation_amount>=0),
  linked_note_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  foreign key(product_id,store_id) references public.products(id,store_id) on delete restrict,
  foreign key(linked_note_id,store_id) references public.operation_notes(id,store_id) on delete restrict,
  check(cardinality(attachment_paths)<=20)
);
create index if not exists service_cases_store_status_idx on public.service_cases(store_id,status,updated_at desc);
create index if not exists service_cases_store_category_idx on public.service_cases(store_id,issue_category,created_at desc);
create index if not exists service_cases_product_idx on public.service_cases(store_id,product_id,created_at desc);
create table if not exists public.service_case_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  case_id uuid not null,
  action text not null check(action in ('created','status_changed','note_added','assigned','resolved','attachment_added')),
  detail text not null default '' check(length(detail)<=3000),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(case_id,store_id) references public.service_cases(id,store_id) on delete cascade
);
create index if not exists service_case_logs_case_time_idx on public.service_case_logs(store_id,case_id,created_at desc);

create table if not exists public.copilot_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  title text not null default '新对话' check(length(title)<=180),
  product_ids uuid[] not null default '{}',
  competitor_ids uuid[] not null default '{}',
  deleted_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,store_id),
  check(cardinality(product_ids)<=30 and cardinality(competitor_ids)<=30)
);
create index if not exists copilot_conversations_store_updated_idx on public.copilot_conversations(store_id,deleted_at,updated_at desc);
create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  conversation_id uuid not null,
  role text not null check(role in ('user','assistant')),
  content text not null check(length(content) between 1 and 24000),
  citations jsonb not null default '[]'::jsonb check(jsonb_typeof(citations)='array'),
  suggestions jsonb not null default '[]'::jsonb check(jsonb_typeof(suggestions)='array'),
  model text,
  prompt_tokens integer check(prompt_tokens is null or prompt_tokens>=0),
  completion_tokens integer check(completion_tokens is null or completion_tokens>=0),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,store_id) references public.copilot_conversations(id,store_id) on delete cascade
);
create index if not exists copilot_messages_conversation_idx on public.copilot_messages(store_id,conversation_id,created_at asc);
create table if not exists public.copilot_usage_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'deepseek' check(provider='deepseek'),
  model text not null check(length(model)<=100),
  outcome text not null check(outcome in ('success','failed')),
  http_status integer check(http_status between 100 and 599),
  prompt_tokens integer check(prompt_tokens is null or prompt_tokens>=0),
  completion_tokens integer check(completion_tokens is null or completion_tokens>=0),
  duration_ms integer not null check(duration_ms>=0),
  error_code text check(error_code is null or length(error_code)<=80),
  created_at timestamptz not null default now()
);
create index if not exists copilot_usage_store_created_idx on public.copilot_usage_logs(store_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['operation_notes','operation_note_versions','operation_experiments','competitors','competitor_price_history','service_templates','service_template_versions','service_cases','service_case_logs','copilot_conversations','copilot_messages','copilot_usage_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  foreach t in array array['operation_notes','operation_experiments','competitors','service_templates','service_cases','copilot_conversations'] loop
    execute format('grant insert,update on public.%I to authenticated',t);
  end loop;
  foreach t in array array['competitor_price_history','service_case_logs','copilot_messages'] loop
    execute format('grant insert on public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists operation_notes_read on public.operation_notes;
create policy operation_notes_read on public.operation_notes for select to authenticated using(private.is_member(store_id));
drop policy if exists operation_notes_write on public.operation_notes;
drop policy if exists operation_notes_insert on public.operation_notes;
create policy operation_notes_insert on public.operation_notes for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists operation_notes_update on public.operation_notes;
create policy operation_notes_update on public.operation_notes for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists operation_note_versions_read on public.operation_note_versions;
create policy operation_note_versions_read on public.operation_note_versions for select to authenticated using(private.is_member(store_id));
drop policy if exists operation_experiments_read on public.operation_experiments;
create policy operation_experiments_read on public.operation_experiments for select to authenticated using(private.is_member(store_id));
drop policy if exists operation_experiments_write on public.operation_experiments;
drop policy if exists operation_experiments_write on public.operation_experiments;
drop policy if exists operation_experiments_insert on public.operation_experiments;
create policy operation_experiments_insert on public.operation_experiments for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists operation_experiments_update on public.operation_experiments;
create policy operation_experiments_update on public.operation_experiments for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists competitors_read on public.competitors;
create policy competitors_read on public.competitors for select to authenticated using(private.is_member(store_id));
drop policy if exists competitors_write on public.competitors;
drop policy if exists competitors_write on public.competitors;
drop policy if exists competitors_insert on public.competitors;
create policy competitors_insert on public.competitors for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists competitors_update on public.competitors;
create policy competitors_update on public.competitors for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists competitor_price_history_read on public.competitor_price_history;
create policy competitor_price_history_read on public.competitor_price_history for select to authenticated using(private.is_member(store_id));
drop policy if exists competitor_price_history_write on public.competitor_price_history;
create policy competitor_price_history_write on public.competitor_price_history for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists service_templates_read on public.service_templates;
create policy service_templates_read on public.service_templates for select to authenticated using(private.is_member(store_id));
drop policy if exists service_templates_write on public.service_templates;
drop policy if exists service_templates_write on public.service_templates;
drop policy if exists service_templates_insert on public.service_templates;
create policy service_templates_insert on public.service_templates for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists service_templates_update on public.service_templates;
create policy service_templates_update on public.service_templates for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists service_template_versions_read on public.service_template_versions;
create policy service_template_versions_read on public.service_template_versions for select to authenticated using(private.is_member(store_id));
drop policy if exists service_cases_read on public.service_cases;
create policy service_cases_read on public.service_cases for select to authenticated using(private.is_member(store_id));
drop policy if exists service_cases_write on public.service_cases;
drop policy if exists service_cases_write on public.service_cases;
drop policy if exists service_cases_insert on public.service_cases;
create policy service_cases_insert on public.service_cases for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists service_cases_update on public.service_cases;
create policy service_cases_update on public.service_cases for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists service_case_logs_read on public.service_case_logs;
create policy service_case_logs_read on public.service_case_logs for select to authenticated using(private.is_member(store_id));
drop policy if exists service_case_logs_write on public.service_case_logs;
create policy service_case_logs_write on public.service_case_logs for insert to authenticated with check(private.can_edit(store_id) and actor_user_id=auth.uid());
drop policy if exists copilot_conversations_read on public.copilot_conversations;
create policy copilot_conversations_read on public.copilot_conversations for select to authenticated using(private.is_member(store_id));
drop policy if exists copilot_conversations_write on public.copilot_conversations;
drop policy if exists copilot_conversations_write on public.copilot_conversations;
drop policy if exists copilot_conversations_insert on public.copilot_conversations;
create policy copilot_conversations_insert on public.copilot_conversations for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists copilot_conversations_update on public.copilot_conversations;
create policy copilot_conversations_update on public.copilot_conversations for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists copilot_messages_read on public.copilot_messages;
create policy copilot_messages_read on public.copilot_messages for select to authenticated using(private.is_member(store_id));
drop policy if exists copilot_messages_write on public.copilot_messages;
create policy copilot_messages_write on public.copilot_messages for insert to authenticated with check(private.can_edit(store_id) and exists(select 1 from public.copilot_conversations c where c.id=copilot_messages.conversation_id and c.store_id=copilot_messages.store_id and c.deleted_at is null));

-- Keep tenant ownership and creator identity immutable, including direct PostgREST writes.
create or replace function private.guard_workspace_identity() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid;
begin
  if tg_op='INSERT' then
    actor:=auth.uid();
    if actor is not null then new:=jsonb_populate_record(new,jsonb_build_object(tg_argv[0],actor)); end if;
    return new;
  end if;
  if (to_jsonb(new)->>'store_id') is distinct from (to_jsonb(old)->>'store_id') then raise exception 'store_id is immutable'; end if;
  if (to_jsonb(new)->>tg_argv[0]) is distinct from (to_jsonb(old)->>tg_argv[0]) then raise exception 'actor identity is immutable'; end if;
  return new;
end $$;
create or replace function private.check_operation_note_relation() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent_exists boolean:=false;
begin
  if new.related_id is null or new.related_type is null then return new; end if;
  case new.related_type
    when 'product' then select exists(select 1 from public.products where id=new.related_id and store_id=new.store_id) into parent_exists;
    when 'sku' then select exists(select 1 from public.skus where id=new.related_id and store_id=new.store_id) into parent_exists;
    when 'experiment' then select exists(select 1 from public.operation_experiments where id=new.related_id and store_id=new.store_id) into parent_exists;
    when 'competitor' then select exists(select 1 from public.competitors where id=new.related_id and store_id=new.store_id) into parent_exists;
    when 'service_case' then select exists(select 1 from public.service_cases where id=new.related_id and store_id=new.store_id) into parent_exists;
    when 'copilot_conversation' then select exists(select 1 from public.copilot_conversations where id=new.related_id and store_id=new.store_id) into parent_exists;
  end case;
  if not parent_exists then raise exception '关联记录不存在或不属于当前店铺'; end if;
  return new;
end $$;
drop trigger if exists operation_note_relation_guard on public.operation_notes;
create constraint trigger operation_note_relation_guard after insert or update of related_type,related_id,store_id on public.operation_notes deferrable initially immediate for each row execute function private.check_operation_note_relation();
do $$ declare t text; identity_column text; begin
  foreach t in array array['operation_notes','operation_experiments','competitors','competitor_price_history','service_templates','service_cases','service_case_logs','copilot_conversations'] loop
    identity_column:=case when t='service_case_logs' then 'actor_user_id' else 'created_by' end;
    execute format('drop trigger if exists guard_workspace_identity on public.%I',t);
    execute format('create trigger guard_workspace_identity before insert or update on public.%I for each row execute function private.guard_workspace_identity(%L)',t,identity_column);
  end loop;
  foreach t in array array['operation_notes','operation_experiments','competitors','service_templates','service_cases','copilot_conversations'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end loop;
end $$;

-- Add privacy-safe audit metadata for module mutations; record only the table and changed field names.
do $$ declare t text; begin
  foreach t in array array['operation_notes','operation_experiments','competitors','competitor_price_history','service_templates','service_cases','service_case_logs','copilot_conversations','copilot_messages','copilot_usage_logs'] loop
    execute format('drop trigger if exists audit_change on public.%I',t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_business_change()',t);
  end loop;
end $$;

-- Browser clients can create user messages. Assistant messages are written only by the server AI route.
drop policy if exists copilot_messages_write on public.copilot_messages;
create policy copilot_messages_write on public.copilot_messages for insert to authenticated with check(role='user' and private.can_edit(store_id) and exists(select 1 from public.copilot_conversations c where c.id=copilot_messages.conversation_id and c.store_id=copilot_messages.store_id and c.deleted_at is null));
drop policy if exists copilot_usage_logs_read on public.copilot_usage_logs;
create policy copilot_usage_logs_read on public.copilot_usage_logs for select to authenticated using(private.is_member(store_id));

create or replace function private.capture_operation_note_version() returns trigger language plpgsql security definer set search_path='' as $$
declare v_version integer;
begin
  if tg_op='UPDATE' and (new.title,new.body_markdown) is not distinct from (old.title,old.body_markdown) then return new; end if;
  select coalesce(max(version_number),0)+1 into v_version from public.operation_note_versions where store_id=new.store_id and note_id=new.id;
  insert into public.operation_note_versions(store_id,note_id,version_number,title,body_markdown,actor_user_id)
    values(new.store_id,new.id,v_version,new.title,new.body_markdown,auth.uid());
  return new;
end $$;
drop trigger if exists operation_notes_version_after_write on public.operation_notes;
create trigger operation_notes_version_after_write after insert or update on public.operation_notes for each row execute function private.capture_operation_note_version();

create or replace function private.capture_service_template_version() returns trigger language plpgsql security definer set search_path='' as $$
declare v_version integer;
begin
  if tg_op='UPDATE' and (new.title,new.category,new.body,new.variables) is not distinct from (old.title,old.category,old.body,old.variables) then return new; end if;
  select coalesce(max(version_number),0)+1 into v_version from public.service_template_versions where store_id=new.store_id and template_id=new.id;
  insert into public.service_template_versions(store_id,template_id,version_number,title,category,body,actor_user_id)
    values(new.store_id,new.id,v_version,new.title,new.category,new.body,auth.uid());
  return new;
end $$;
drop trigger if exists service_templates_version_after_write on public.service_templates;
create trigger service_templates_version_after_write after insert or update on public.service_templates for each row execute function private.capture_service_template_version();

-- Private attachments are scoped to a store UUID as the first path segment.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('moonclean-service-attachments','moonclean-service-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists moonclean_attachment_read on storage.objects;
create policy moonclean_attachment_read on storage.objects for select to authenticated using(bucket_id='moonclean-service-attachments' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and private.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists moonclean_attachment_insert on storage.objects;
create policy moonclean_attachment_insert on storage.objects for insert to authenticated with check(bucket_id='moonclean-service-attachments' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and private.can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists moonclean_attachment_delete on storage.objects;
create policy moonclean_attachment_delete on storage.objects for delete to authenticated using(bucket_id='moonclean-service-attachments' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and private.can_edit(((storage.foldername(name))[1])::uuid));

-- Existing task center links remain additive and can return to their source record.
alter table public.operation_tasks
  add column if not exists source_module text,
  add column if not exists source_id uuid;
alter table public.operation_tasks drop constraint if exists operation_tasks_source_pair_check;
alter table public.operation_tasks add constraint operation_tasks_source_pair_check
  check ((source_module is null and source_id is null) or (source_module in ('notes','experiments','competitors','service-cases','copilot-conversations') and source_id is not null));
create index if not exists operation_tasks_source_idx on public.operation_tasks(store_id,source_module,source_id) where source_id is not null;

create or replace function private.validate_operation_task_source() returns trigger
language plpgsql set search_path='' as $$
declare v_exists boolean := false;
begin
  if new.source_id is null then return new; end if;
  case new.source_module
    when 'notes' then select exists(select 1 from public.operation_notes where id=new.source_id and store_id=new.store_id) into v_exists;
    when 'experiments' then select exists(select 1 from public.operation_experiments where id=new.source_id and store_id=new.store_id) into v_exists;
    when 'competitors' then select exists(select 1 from public.competitors where id=new.source_id and store_id=new.store_id) into v_exists;
    when 'service-cases' then select exists(select 1 from public.service_cases where id=new.source_id and store_id=new.store_id) into v_exists;
    when 'copilot-conversations' then select exists(select 1 from public.copilot_conversations where id=new.source_id and store_id=new.store_id) into v_exists;
    else raise exception 'Invalid task source module';
  end case;
  if not v_exists then raise exception 'Task source must belong to the same store'; end if;
  return new;
end $$;
drop trigger if exists operation_task_source_guard on public.operation_tasks;
create trigger operation_task_source_guard before insert or update of source_module,source_id,store_id on public.operation_tasks
for each row execute function private.validate_operation_task_source();
