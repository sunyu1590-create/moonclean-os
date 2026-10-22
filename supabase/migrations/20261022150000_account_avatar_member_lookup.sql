-- Public avatars are non-sensitive profile images. Upload and deletion stay scoped
-- to the authenticated user's own folder; the existing profile column stores URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('moonclean-avatars','moonclean-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists moonclean_avatar_insert on storage.objects;
create policy moonclean_avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='moonclean-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists moonclean_avatar_delete on storage.objects;
create policy moonclean_avatar_delete on storage.objects for delete to authenticated
using(bucket_id='moonclean-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Preserve the existing role checks and verified-email requirement while returning
-- a clear, distinct failure for registered accounts that have not verified email.
create or replace function public.manage_store_member(p_store uuid,p_email text,p_role text,p_action text default 'upsert') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_actor_role text; v_target uuid; v_old_role text; v_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select role into v_actor_role from public.store_members where store_id=p_store and user_id=v_actor;
  if v_actor_role not in ('owner','admin') then raise exception 'member management forbidden' using errcode='42501'; end if;
  if p_action not in ('upsert','remove') then raise exception 'invalid action'; end if;
  select id into v_target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
  if v_target is null then
    if exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then
      raise exception 'member email not confirmed';
    end if;
    raise exception 'member account not found';
  end if;
  select id,role into v_id,v_old_role from public.store_members where store_id=p_store and user_id=v_target for update;
  if v_old_role='owner' then raise exception 'use ownership transfer' using errcode='42501'; end if;
  if v_actor_role='admin' and (v_old_role='admin' or p_role in ('owner','admin')) then raise exception 'admin cannot manage admin or owner' using errcode='42501'; end if;
  if p_action='remove' then
    if v_id is null then raise exception 'member not found'; end if;
    delete from public.store_members where id=v_id;
    insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values(p_store,v_actor,'member_remove','store_members',v_id,jsonb_build_object('old_role',v_old_role));
    return v_id;
  end if;
  if p_role not in ('admin','editor','viewer') or (v_actor_role='admin' and p_role='admin') then raise exception 'invalid role assignment' using errcode='42501'; end if;
  if v_id is null then
    insert into public.store_members(store_id,user_id,role) values(p_store,v_target,p_role) returning id into v_id;
  else
    update public.store_members set role=p_role where id=v_id;
  end if;
  insert into public.audit_logs(store_id,actor_user_id,action,target_table,target_id,change_summary) values(p_store,v_actor,'member_upsert','store_members',v_id,jsonb_build_object('old_role',v_old_role,'new_role',p_role));
  return v_id;
end $$;
revoke all on function public.manage_store_member(uuid,text,text,text) from public,anon;
grant execute on function public.manage_store_member(uuid,text,text,text) to authenticated;
