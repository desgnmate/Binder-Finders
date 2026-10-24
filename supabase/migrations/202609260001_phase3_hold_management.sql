-- Phase 3 completion: deadlines, status history, customer cancellation and
-- automatic expiry. This migration is additive and preserves existing holds.
begin;

alter table public.hold_requests
  drop constraint if exists hold_requests_status_check;
alter table public.hold_requests
  add constraint hold_requests_status_check
  check (status in ('pending','accepted','completed','rejected','cancelled','expired'));

alter table public.hold_requests
  add column if not exists approved_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists hold_requests_expiry_idx
  on public.hold_requests(status, payment_status, expires_at)
  where status = 'accepted' and expires_at is not null;

create table if not exists public.hold_status_history (
  id bigint generated always as identity primary key,
  hold_id uuid not null references public.hold_requests(id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('pending','accepted','completed','rejected','cancelled','expired')),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('customer','admin','system')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists hold_status_history_hold_idx
  on public.hold_status_history(hold_id, created_at, id);
alter table public.hold_status_history enable row level security;
revoke all on public.hold_status_history from public, anon, authenticated;
grant select on public.hold_status_history to authenticated;

drop policy if exists customer_hold_history_read on public.hold_status_history;
create policy customer_hold_history_read on public.hold_status_history
  for select to authenticated using (
    exists (
      select 1 from public.hold_requests h
      where h.id = hold_id and h.customer_user_id = (select auth.uid())
    ) or public.cms_is_admin()
  );

create or replace function public.cms_record_hold_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor_kind_value text;
begin
  actor_kind_value := case
    when public.cms_is_admin() then 'admin'
    when auth.uid() is null then 'system'
    else 'customer'
  end;
  if tg_op = 'INSERT' then
    insert into public.hold_status_history(hold_id,from_status,to_status,actor_id,actor_kind)
    values(new.id,null,new.status,auth.uid(),actor_kind_value);
  elsif old.status is distinct from new.status then
    insert into public.hold_status_history(hold_id,from_status,to_status,actor_id,actor_kind)
    values(new.id,old.status,new.status,auth.uid(),actor_kind_value);
  end if;
  return new;
end $$;
drop trigger if exists hold_status_history_trigger on public.hold_requests;
create trigger hold_status_history_trigger
after insert or update of status on public.hold_requests
for each row execute function public.cms_record_hold_history();
revoke all on function public.cms_record_hold_history() from public, anon, authenticated;

-- Keep older settings rows valid. The application schema supplies 48 when the
-- field is absent; owners can change it from the CMS settings screen.
create or replace function public.cms_save_settings(p_settings jsonb,p_expected timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare existing public.store_settings; duration_hours integer;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into existing from public.store_settings where id for update;
  if existing.updated_at is distinct from p_expected then raise exception 'Settings changed. Reload before saving.'; end if;
  duration_hours := coalesce((p_settings->>'holdDurationHours')::integer,48);
  if duration_hours not between 1 and 720 then raise exception 'Hold duration must be between 1 and 720 hours'; end if;
  if not public.cms_is_owner() and (
    existing.data->'currency' is distinct from p_settings->'currency'
    or existing.data->'holdsEnabled' is distinct from p_settings->'holdsEnabled'
    or coalesce(existing.data->>'holdDurationHours','48') is distinct from duration_hours::text
  ) then raise exception 'Only an owner can change store settings'; end if;
  if coalesce((p_settings->>'holdsEnabled')::boolean,false)
    and p_settings->>'currency' not in ('AUD','USD','PHP','GBP','EUR','CAD','NZD','JPY') then
    raise exception 'Choose a currency';
  end if;
  update public.store_settings
  set data = jsonb_set(p_settings,'{holdDurationHours}',to_jsonb(duration_hours),true),
      updated_at = clock_timestamp()
  where id;
end $$;

create or replace function public.cms_transition_hold(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; ids text[]; settings jsonb; duration_hours integer;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('accepted','rejected','cancelled','completed') then raise exception 'Invalid request transition'; end if;
  select * into h from public.hold_requests where id=p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not ((h.status='pending' and p_status in ('accepted','rejected','cancelled'))
    or (h.status='accepted' and p_status in ('completed','cancelled'))) then
    raise exception 'Invalid request transition. Refresh the list.';
  end if;
  select array_agg(card_id order by card_id) into ids
  from public.hold_request_items where request_id=p_id;
  perform id from public.cards where id=any(ids) order by id for update;
  if p_status='accepted' then
    if (select count(*) from public.cards where id=any(ids) and publication='published' and availability='available')<>array_length(ids,1) then
      raise exception 'One or more cards are no longer available';
    end if;
    if exists(select 1 from public.cards c join public.hold_request_items i on i.card_id=c.id
      where i.request_id=p_id and i.price_cents<>c.price_cents) then
      raise exception 'Prices changed since this request. Contact the customer before creating a new request.';
    end if;
    select data into settings from public.store_settings where id;
    duration_hours := greatest(1,least(coalesce((settings->>'holdDurationHours')::integer,48),720));
    update public.cards set availability='reserved',reserved_by=p_id,updated_at=clock_timestamp() where id=any(ids);
    update public.hold_requests set status='accepted',approved_at=clock_timestamp(),expires_at=clock_timestamp()+make_interval(hours=>duration_hours),updated_at=clock_timestamp() where id=p_id;
  elsif p_status='completed' then
    if h.payment_status <> 'paid' then raise exception 'Record payment before completing this sale'; end if;
    if h.fulfillment_status not in ('ready','shipped','delivered','picked_up') then raise exception 'Prepare fulfilment before completing this sale'; end if;
    if (select count(*) from public.cards where id=any(ids) and reserved_by=p_id)<>array_length(ids,1) then raise exception 'Reservation conflict'; end if;
    update public.cards set availability='sold',reserved_by=null,updated_at=clock_timestamp() where reserved_by=p_id;
    update public.hold_requests set status='completed',expires_at=null,updated_at=clock_timestamp() where id=p_id;
  else
    if h.status='accepted' and (select count(*) from public.cards where id=any(ids) and reserved_by=p_id)<>array_length(ids,1) then
      raise exception 'Reservation conflict';
    end if;
    update public.cards set availability='available',reserved_by=null,updated_at=clock_timestamp() where reserved_by=p_id;
    update public.hold_requests set status=p_status,expires_at=null,fulfillment_status='cancelled',updated_at=clock_timestamp() where id=p_id;
  end if;
end $$;

create or replace function public.cms_set_hold_deadline(p_id uuid,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into h from public.hold_requests where id=p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if h.status <> 'accepted' or h.payment_status in ('paid','refunded') then raise exception 'Only unpaid accepted holds can be extended'; end if;
  if p_expires_at <= now() or p_expires_at > now()+interval '30 days' then raise exception 'Choose a deadline between now and 30 days from now'; end if;
  update public.hold_requests set expires_at=p_expires_at,updated_at=clock_timestamp() where id=p_id;
  insert into public.hold_status_history(hold_id,from_status,to_status,actor_id,actor_kind,note)
  values(p_id,h.status,h.status,auth.uid(),'admin','Deadline extended to '||to_char(p_expires_at at time zone 'UTC','YYYY-MM-DD HH24:MI UTC'));
end $$;

create or replace function public.cms_cancel_customer_hold(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests;
begin
  select * into h from public.hold_requests where id=p_id and customer_user_id=auth.uid() for update;
  if not found then raise exception 'Request not found'; end if;
  if h.status not in ('pending','accepted') then raise exception 'This request can no longer be cancelled'; end if;
  if h.payment_status in ('paid','refunded') then raise exception 'Paid requests must be cancelled by the store'; end if;
  perform public.cms_transition_customer_cancel(p_id);
end $$;

-- Internal helper keeps customer cancellation inside one transaction while
-- reusing the same reservation-release rules as the admin transition.
create or replace function public.cms_transition_customer_cancel(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests;
begin
  select * into h from public.hold_requests where id=p_id for update;
  update public.cards set availability='available',reserved_by=null,updated_at=clock_timestamp() where reserved_by=p_id;
  update public.hold_requests set status='cancelled',expires_at=null,fulfillment_status='cancelled',updated_at=clock_timestamp() where id=p_id;
  update public.hold_status_history set note='Cancelled by customer'
  where id=(select max(id) from public.hold_status_history where hold_id=p_id and to_status='cancelled');
end $$;

create or replace function public.cms_expire_unpaid_holds(p_limit integer default 50)
returns integer language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; expired_count integer:=0;
begin
  for h in select * from public.hold_requests
    where status='accepted' and payment_status not in ('paid','refunded')
      and expires_at is not null and expires_at<=now()
    order by expires_at,id limit greatest(1,least(coalesce(p_limit,50),200)) for update skip locked
  loop
    update public.cards set availability='available',reserved_by=null,updated_at=clock_timestamp() where reserved_by=h.id;
    update public.hold_requests set status='expired',expires_at=null,fulfillment_status='cancelled',updated_at=clock_timestamp() where id=h.id;
    expired_count:=expired_count+1;
  end loop;
  return expired_count;
end $$;

revoke all on function public.cms_set_hold_deadline(uuid,timestamptz),public.cms_cancel_customer_hold(uuid),public.cms_transition_customer_cancel(uuid),public.cms_expire_unpaid_holds(integer),public.cms_record_hold_history(),public.cms_save_settings(jsonb,timestamptz),public.cms_transition_hold(uuid,text) from public,anon,authenticated;
grant execute on function public.cms_set_hold_deadline(uuid,timestamptz),public.cms_save_settings(jsonb,timestamptz),public.cms_transition_hold(uuid,text) to authenticated;
grant execute on function public.cms_cancel_customer_hold(uuid) to authenticated;
grant execute on function public.cms_expire_unpaid_holds(integer) to service_role;
notify pgrst,'reload schema';
commit;
