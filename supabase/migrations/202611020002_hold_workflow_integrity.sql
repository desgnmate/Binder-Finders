-- Keep hold workflow, reconciliation and customer emails consistent:
-- * payment and fulfilment can only change on an accepted hold; a completed or
--   cancelled hold may only be recorded as refunded (and a completed sale may
--   still progress through delivery);
-- * reconciliation rotates through overdue attempts so a few that keep failing
--   cannot stop every later hold from being checked and expired;
-- * a hold refunded before completion expires at its deadline like an unpaid one;
-- * customers are emailed for payment changes only when a payment lands or is refunded.
begin;

create or replace function public.cms_set_hold_workflow(
  p_id uuid,
  p_status text,
  p_payment_status text,
  p_fulfillment_status text,
  p_payment_reference text,
  p_fulfillment_note text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.hold_requests;
  next_payment text;
  next_fulfillment text;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into h from public.hold_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;

  next_payment := coalesce(p_payment_status, h.payment_status);
  next_fulfillment := coalesce(p_fulfillment_status, h.fulfillment_status);
  if next_payment not in ('unpaid', 'pending', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid payment status';
  end if;
  if next_fulfillment not in ('not_ready', 'ready', 'shipped', 'delivered', 'picked_up', 'cancelled') then
    raise exception 'Invalid fulfilment status';
  end if;

  -- The checks use the hold's current status, so a page loaded before the hold
  -- expired or was cancelled cannot record payment or delivery against it.
  if h.status = 'completed' then
    if next_payment is distinct from h.payment_status and next_payment <> 'refunded' then
      raise exception 'A completed sale can only be recorded as refunded';
    end if;
    if next_fulfillment not in ('ready', 'shipped', 'delivered', 'picked_up') then
      raise exception 'A completed sale must stay ready, shipped, delivered or picked up';
    end if;
  elsif h.status = 'cancelled' then
    if next_payment is distinct from h.payment_status and next_payment <> 'refunded' then
      raise exception 'This request was cancelled. It can only be recorded as refunded';
    end if;
    if next_fulfillment is distinct from h.fulfillment_status then
      raise exception 'This request was cancelled. Delivery can no longer be changed';
    end if;
  elsif h.status <> 'accepted' then
    if next_payment is distinct from h.payment_status
      or next_fulfillment is distinct from h.fulfillment_status then
      raise exception 'This request is %. Payment and delivery can no longer be changed', h.status;
    end if;
  end if;

  if p_status = 'completed' then
    if next_payment <> 'paid' then
      raise exception 'Record payment before completing this sale';
    end if;
    if next_fulfillment not in ('ready', 'shipped', 'delivered', 'picked_up') then
      raise exception 'Prepare fulfilment before completing this sale';
    end if;
  end if;

  if coalesce(p_status, h.status) in ('rejected', 'cancelled') then
    next_fulfillment := 'cancelled';
  end if;

  update public.hold_requests
  set
    payment_status = next_payment,
    payment_reference = nullif(trim(coalesce(p_payment_reference, payment_reference)), ''),
    fulfillment_status = next_fulfillment,
    fulfillment_note = nullif(trim(coalesce(p_fulfillment_note, fulfillment_note)), ''),
    updated_at = clock_timestamp()
  where id = p_id;

  if p_status is not null and p_status is distinct from h.status then
    perform public.cms_transition_hold(p_id, p_status);
  end if;
end
$$;

alter table public.payment_attempts
  add column if not exists reconcile_checked_at timestamptz;

-- Hands out the least recently checked overdue attempts and stamps them, so
-- each run moves on to attempts that have not been looked at yet.
create or replace function public.cms_due_stripe_attempts(p_limit integer default 20)
returns table(attempt_id uuid, session_id text, attempt_status text)
language plpgsql security definer set search_path='' as $$
begin
  return query with picked as (
    select a.id
    from public.payment_attempts a
    join public.hold_requests h on h.id=a.hold_id
    where h.status='accepted' and h.expires_at is not null and h.expires_at<=now()
      and a.status in ('created','open')
    order by a.reconcile_checked_at nulls first, h.expires_at, a.created_at
    limit greatest(1,least(coalesce(p_limit,20),100))
    for update of a skip locked
  ), stamped as (
    update public.payment_attempts a
    set reconcile_checked_at=clock_timestamp()
    from picked where a.id=picked.id
    returning a.id, a.checkout_session_id, a.status
  )
  select s.id, s.checkout_session_id, s.status from stamped s;
end $$;

create or replace function public.cms_expire_unpaid_holds(p_limit integer default 50)
returns integer language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; expired_count integer:=0;
begin
  for h in select * from public.hold_requests hr
    where hr.status='accepted' and hr.payment_status <> 'paid'
      and hr.expires_at is not null and hr.expires_at<=now()
      and not exists (
        select 1 from public.payment_attempts a
        where a.hold_id=hr.id and a.status in ('created','open')
      )
    order by hr.expires_at,hr.id limit greatest(1,least(coalesce(p_limit,50),200)) for update of hr skip locked
  loop
    update public.cards set availability='available',reserved_by=null,updated_at=clock_timestamp() where reserved_by=h.id;
    update public.hold_requests set status='expired',expires_at=null,fulfillment_status='cancelled',updated_at=clock_timestamp() where id=h.id;
    expired_count:=expired_count+1;
  end loop;
  return expired_count;
end $$;

create or replace function public.cms_hold_notifications_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare admin_email text;
begin
  if tg_op='INSERT' then
    perform public.cms_queue_hold_notification(new.id,'customer_request_received',new.email);
    for admin_email in select email from public.admin_users where active loop
      perform public.cms_queue_hold_notification(new.id,'staff_request_received',admin_email);
    end loop;
  elsif row(old.status,old.fulfillment_status,old.fulfillment_note)
      is distinct from row(new.status,new.fulfillment_status,new.fulfillment_note)
    -- Starting or abandoning Checkout is not news to the customer; a payment
    -- landing or being refunded is.
    or (old.payment_status is distinct from new.payment_status
      and new.payment_status in ('paid','refunded')) then
    perform public.cms_queue_hold_notification(new.id,'customer_status_changed',new.email);
  end if;
  return new;
end $$;

revoke all on function public.cms_set_hold_workflow(uuid, text, text, text, text, text),
  public.cms_due_stripe_attempts(integer),
  public.cms_expire_unpaid_holds(integer),
  public.cms_hold_notifications_trigger()
from public, anon, authenticated;
grant execute on function public.cms_set_hold_workflow(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.cms_due_stripe_attempts(integer),
  public.cms_expire_unpaid_holds(integer) to service_role;
notify pgrst, 'reload schema';
commit;
