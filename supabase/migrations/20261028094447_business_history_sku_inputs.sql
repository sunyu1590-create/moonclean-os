alter table public.business_metric_revisions
  drop constraint if exists business_metric_revisions_metric_type_check;
alter table public.business_metric_revisions
  add constraint business_metric_revisions_metric_type_check
  check (metric_type in ('daily', 'advertising', 'sku_daily', 'sku_cost'));

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
  v_type := case tg_table_name
    when 'daily_metrics' then 'daily'
    when 'ad_metrics' then 'advertising'
    when 'sku_daily_metrics' then 'sku_daily'
    else 'sku_cost'
  end;
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) - array['updated_at']) is not distinct from (to_jsonb(new) - array['updated_at']) then
      return new;
    end if;
    v_date := case when tg_table_name = 'sku_costs' then new.effective_from else new.metric_date end;
    v_id := new.id;
    v_store := new.store_id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_action := 'update';
  elsif tg_op = 'INSERT' then
    v_date := case when tg_table_name = 'sku_costs' then new.effective_from else new.metric_date end;
    v_id := new.id;
    v_store := new.store_id;
    v_after := to_jsonb(new);
    v_action := 'insert';
  else
    v_date := case when tg_table_name = 'sku_costs' then old.effective_from else old.metric_date end;
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

drop trigger if exists business_metric_revision_capture on public.daily_metrics;
create trigger business_metric_revision_capture after insert or update or delete on public.daily_metrics for each row execute function private.capture_business_metric_revision();
drop trigger if exists business_metric_revision_capture on public.ad_metrics;
create trigger business_metric_revision_capture after insert or update or delete on public.ad_metrics for each row execute function private.capture_business_metric_revision();
drop trigger if exists business_metric_revision_capture on public.sku_daily_metrics;
create trigger business_metric_revision_capture after insert or update or delete on public.sku_daily_metrics for each row execute function private.capture_business_metric_revision();
drop trigger if exists business_metric_revision_capture on public.sku_costs;
create trigger business_metric_revision_capture after insert or update or delete on public.sku_costs for each row execute function private.capture_business_metric_revision();

insert into public.business_metric_revisions(store_id, business_date, metric_type, source_record_id, action, after_values)
select store_id, metric_date, 'sku_daily', id, 'baseline', to_jsonb(sku_daily_metrics)
from public.sku_daily_metrics;

insert into public.business_metric_revisions(store_id, business_date, metric_type, source_record_id, action, after_values)
select store_id, effective_from, 'sku_cost', id, 'baseline', to_jsonb(sku_costs)
from public.sku_costs;
