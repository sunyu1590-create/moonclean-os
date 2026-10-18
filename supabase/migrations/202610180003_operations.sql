-- Store-scoped stock ledger and operations tasks. Safe to replay.
create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  sku_id uuid not null,
  quantity integer not null default 0 check(quantity >= 0),
  low_stock_threshold integer not null default 10 check(low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique(store_id,sku_id),
  foreign key(sku_id,store_id) references public.skus(id,store_id) on delete restrict
);
create index if not exists inventory_balances_alert_idx on public.inventory_balances(store_id,quantity,low_stock_threshold);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  sku_id uuid not null,
  quantity_before integer not null check(quantity_before >= 0),
  quantity_after integer not null check(quantity_after >= 0),
  delta integer not null,
  note text not null check(length(trim(note)) between 1 and 240),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(sku_id,store_id) references public.skus(id,store_id) on delete restrict,
  check(quantity_after - quantity_before = delta)
);
create index if not exists inventory_movements_store_time_idx on public.inventory_movements(store_id,created_at desc);
create table if not exists public.operation_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  title text not null check(length(trim(title)) between 1 and 160),
  detail text not null default '' check(length(detail) <= 1000),
  priority text not null default 'normal' check(priority in ('low','normal','high')),
  status text not null default 'todo' check(status in ('todo','doing','done')),
  due_date date,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists operation_tasks_store_status_due_idx on public.operation_tasks(store_id,status,due_date);
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.operation_tasks enable row level security;
revoke all on public.inventory_balances,public.inventory_movements,public.operation_tasks from anon,authenticated;
grant select on public.inventory_balances,public.inventory_movements,public.operation_tasks to authenticated;
grant insert,delete on public.operation_tasks to authenticated;
grant update(title,detail,priority,status,due_date) on public.operation_tasks to authenticated;
drop policy if exists inventory_balances_read on public.inventory_balances;
create policy inventory_balances_read on public.inventory_balances for select to authenticated using(private.is_member(store_id));
drop policy if exists inventory_movements_read on public.inventory_movements;
create policy inventory_movements_read on public.inventory_movements for select to authenticated using(private.is_member(store_id));
drop policy if exists operation_tasks_read on public.operation_tasks;
create policy operation_tasks_read on public.operation_tasks for select to authenticated using(private.is_member(store_id));
drop policy if exists operation_tasks_insert on public.operation_tasks;
create policy operation_tasks_insert on public.operation_tasks for insert to authenticated with check(private.can_edit(store_id) and created_by=auth.uid());
drop policy if exists operation_tasks_update on public.operation_tasks;
create policy operation_tasks_update on public.operation_tasks for update to authenticated using(private.can_edit(store_id)) with check(private.can_edit(store_id));
drop policy if exists operation_tasks_delete on public.operation_tasks;
create policy operation_tasks_delete on public.operation_tasks for delete to authenticated using(private.can_edit(store_id));

create or replace function private.operation_task_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v_row public.operation_tasks%rowtype;
begin
  if tg_op='DELETE' then v_row:=old;
  else
    if tg_op='UPDATE' then
      if (new.store_id,new.created_by,new.created_at) is distinct from (old.store_id,old.created_by,old.created_at) then
        raise exception 'task identity is immutable' using errcode='42501';
      end if;
      new.updated_at:=now();
      new.completed_at:=case when new.status='done' then coalesce(old.completed_at,now()) else null end;
    else
      new.created_by:=auth.uid();
      new.completed_at:=case when new.status='done' then now() else null end;
    end if;
    v_row:=new;
  end if;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary)
  values(v_row.store_id,auth.uid(),lower(tg_op)||'_task','operation_tasks',v_row.id,
    jsonb_build_object('title',v_row.title,'status',v_row.status));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists operation_task_guard on public.operation_tasks;
create trigger operation_task_guard before insert or update or delete on public.operation_tasks
  for each row execute function private.operation_task_guard();

create or replace function public.set_inventory_balance(p_store uuid,p_sku uuid,p_quantity integer,p_threshold integer,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_old integer; v_id uuid;
begin
  if not private.can_edit(p_store) then raise exception 'write forbidden' using errcode='42501'; end if;
  if p_quantity is null or p_quantity<0 or p_quantity>100000000 or p_threshold is null or p_threshold<0 or p_threshold>100000000 then
    raise exception 'invalid inventory quantity';
  end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 240 then raise exception 'inventory note required'; end if;
  if not exists(select 1 from public.skus where id=p_sku and store_id=p_store and status='active') then
    raise exception 'active SKU unavailable' using errcode='42501';
  end if;
  insert into public.inventory_balances(store_id,sku_id) values(p_store,p_sku)
    on conflict(store_id,sku_id) do nothing;
  select quantity,id into v_old,v_id from public.inventory_balances
    where store_id=p_store and sku_id=p_sku for update;
  update public.inventory_balances set quantity=p_quantity,low_stock_threshold=p_threshold,updated_at=now() where id=v_id;
  if p_quantity<>v_old then
    insert into public.inventory_movements(store_id,sku_id,quantity_before,quantity_after,delta,note,actor_user_id)
      values(p_store,p_sku,v_old,p_quantity,p_quantity-v_old,trim(p_note),auth.uid());
  end if;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary)
    values(p_store,auth.uid(),'set_inventory','inventory_balances',v_id,
      jsonb_build_object('sku_id',p_sku,'before',v_old,'after',p_quantity,'threshold',p_threshold));
end $$;
revoke all on function public.set_inventory_balance(uuid,uuid,integer,integer,text) from public,anon;
grant execute on function public.set_inventory_balance(uuid,uuid,integer,integer,text) to authenticated;
