create table if not exists public.business_metric_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  business_date date not null,
  metric_type text not null check (metric_type in ('daily', 'advertising', 'sku_daily', 'sku_cost')),
  source_record_id uuid not null,
  action text not null check (action in ('baseline', 'insert', 'update', 'delete')),
  before_values jsonb,
  after_values jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint business_metric_revision_values check (
    (action in ('baseline', 'insert') and before_values is null and after_values is not null)
    or (action = 'update' and before_values is not null and after_values is not null)
    or (action = 'delete' and before_values is not null and after_values is null)
  )
);

create index if not exists business_metric_revisions_store_date_idx
  on public.business_metric_revisions(store_id, business_date desc, created_at desc);
create index if not exists business_metric_revisions_record_idx
  on public.business_metric_revisions(store_id, metric_type, source_record_id, created_at desc);

alter table public.business_metric_revisions enable row level security;
revoke all on public.business_metric_revisions from anon, authenticated;
grant select on public.business_metric_revisions to authenticated;
drop policy if exists business_metric_revisions_select on public.business_metric_revisions;
create policy business_metric_revisions_select on public.business_metric_revisions
  for select to authenticated using (private.is_member(store_id));

create or replace function private.capture_business_metric_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_type text;
  v_date date;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_action text;
  v_store uuid;
begin
  v_type := case when tg_table_name = 'daily_metrics' then 'daily' else 'advertising' end;
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) - array['updated_at']) is not distinct from (to_jsonb(new) - array['updated_at']) then
      return new;
    end if;
    v_date := new.metric_date;
    v_id := new.id;
    v_store := new.store_id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_action := 'update';
  elsif tg_op = 'INSERT' then
    v_date := new.metric_date;
    v_id := new.id;
    v_store := new.store_id;
    v_after := to_jsonb(new);
    v_action := 'insert';
  else
    v_date := old.metric_date;
    v_id := old.id;
    v_store := old.store_id;
    v_before := to_jsonb(old);
    v_action := 'delete';
  end if;

  insert into public.business_metric_revisions(
    store_id, business_date, metric_type, source_record_id, action,
    before_values, after_values, changed_by
  ) values (
    v_store, v_date, v_type, v_id, v_action,
    v_before, v_after, auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function private.capture_business_metric_revision() from public, anon, authenticated;
drop trigger if exists business_metric_revision_capture on public.daily_metrics;
create trigger business_metric_revision_capture
  after insert or update or delete on public.daily_metrics
  for each row execute function private.capture_business_metric_revision();
drop trigger if exists business_metric_revision_capture on public.ad_metrics;
create trigger business_metric_revision_capture
  after insert or update or delete on public.ad_metrics
  for each row execute function private.capture_business_metric_revision();

insert into public.business_metric_revisions(
  store_id, business_date, metric_type, source_record_id, action, after_values
)
select store_id, metric_date, 'daily', id, 'baseline', to_jsonb(daily_metrics)
from public.daily_metrics
on conflict do nothing;

insert into public.business_metric_revisions(
  store_id, business_date, metric_type, source_record_id, action, after_values
)
select store_id, metric_date, 'advertising', id, 'baseline', to_jsonb(ad_metrics)
from public.ad_metrics
on conflict do nothing;
