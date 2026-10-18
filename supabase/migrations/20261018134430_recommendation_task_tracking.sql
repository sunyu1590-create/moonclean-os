-- Keep AI/rule-based recommendation follow-ups tied to their baseline metrics.
alter table public.operation_tasks
  add column if not exists recommendation_key text,
  add column if not exists recommendation_baseline jsonb;

alter table public.operation_tasks
  drop constraint if exists operation_tasks_recommendation_key_check,
  add constraint operation_tasks_recommendation_key_check
    check (recommendation_key is null or recommendation_key ~ '^[a-z0-9_-]{1,80}$'),
  drop constraint if exists operation_tasks_recommendation_baseline_check,
  add constraint operation_tasks_recommendation_baseline_check
    check (recommendation_baseline is null or jsonb_typeof(recommendation_baseline) = 'object');

-- Prevent duplicate active tasks generated from the same recommendation.
create unique index if not exists operation_tasks_active_recommendation_idx
  on public.operation_tasks(store_id, recommendation_key)
  where recommendation_key is not null and status in ('todo', 'doing');
