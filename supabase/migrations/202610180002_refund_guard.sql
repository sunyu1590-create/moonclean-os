-- Keep synchronized refunds within the related order's gross value, even under concurrent writes.
create or replace function private.validate_external_refund() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_gross numeric; v_other numeric;
begin
  select gross_sales into v_gross from public.external_orders
    where id=new.order_id and store_id=new.store_id and connection_id=new.connection_id for update;
  if v_gross is null then raise exception 'refund order unavailable'; end if;
  if new.amount>v_gross then raise exception 'refund exceeds order gross'; end if;
  if new.status='succeeded' then
    select coalesce(sum(amount),0) into v_other from public.external_refunds
      where order_id=new.order_id and status='succeeded' and id<>new.id;
    if v_other+new.amount>v_gross then raise exception 'total refunds exceed order gross'; end if;
  end if;
  return new;
end $$;
drop trigger if exists validate_external_refund on public.external_refunds;
create trigger validate_external_refund before insert or update on public.external_refunds
for each row execute function private.validate_external_refund();
