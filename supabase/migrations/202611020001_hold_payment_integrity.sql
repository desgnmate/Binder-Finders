-- Protect payment state across the admin and Stripe paths:
-- * a paid hold cannot be cancelled, rejected or expired until it is refunded;
-- * an admin save cannot undo a Stripe payment or clear its reference;
-- * an admin cannot record payment or complete a sale while Checkout is open;
-- * an accepted hold always leaves the customer enough time to pay;
-- * a late webhook for an old Checkout session cannot fail a newer one.
begin;

create or replace function public.cms_guard_hold_payment()
returns trigger language plpgsql security definer set search_path='' as $$
declare stripe_paid boolean; active_checkout boolean;
begin
  if new.status in ('cancelled','rejected','expired')
    and old.status is distinct from new.status
    and new.payment_status = 'paid' then
    raise exception 'This hold has been paid. Refund the payment in Stripe and mark it refunded before cancelling.';
  end if;

  -- Stripe's own updates run as the service role; only admin edits are fenced.
  if not public.cms_is_admin() then return new; end if;

  select
    exists(select 1 from public.payment_attempts where hold_id = old.id and status = 'paid'),
    exists(select 1 from public.payment_attempts where hold_id = old.id and status in ('created','open'))
  into stripe_paid, active_checkout;

  if stripe_paid then
    if new.payment_status not in ('paid','refunded') then
      raise exception 'This hold was paid through Stripe. Mark it refunded only after refunding it in Stripe.';
    end if;
    new.payment_reference := coalesce(new.payment_reference, old.payment_reference);
  end if;

  if active_checkout and (
    new.payment_status is distinct from old.payment_status
    or (new.status = 'completed' and old.status is distinct from 'completed')
  ) then
    raise exception 'The customer has a Stripe checkout open for this hold. Wait for it to finish or expire before recording payment.';
  end if;

  if new.status = 'accepted'
    and new.expires_at is distinct from old.expires_at
    and new.expires_at is not null
    and new.expires_at < now() + interval '31 minutes'
    and new.payment_status not in ('paid','refunded') then
    raise exception 'Give the customer at least 31 minutes to pay. Stripe checkout needs 30 minutes.';
  end if;
  return new;
end $$;

drop trigger if exists hold_payment_guard on public.hold_requests;
create trigger hold_payment_guard
before update on public.hold_requests
for each row execute function public.cms_guard_hold_payment();
revoke all on function public.cms_guard_hold_payment() from public, anon, authenticated;

create or replace function public.cms_record_stripe_webhook(
  p_event_id text,
  p_event_type text,
  p_attempt_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_result text,
  p_reason text default null
) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts; inserted_count integer;
begin
  if p_event_id is null or length(trim(p_event_id)) < 8 then raise exception 'Invalid Stripe event'; end if;
  if p_result not in ('success','pending','failed','expired') then raise exception 'Invalid payment result'; end if;
  insert into public.stripe_webhook_events(event_id,event_type,attempt_id)
  values(trim(p_event_id),p_event_type,p_attempt_id)
  on conflict (event_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return true; end if;

  select * into a from public.payment_attempts where id = p_attempt_id for update;
  if not found then return true; end if;
  -- An event for a session this attempt no longer tracks is stale. Raising
  -- would make Stripe retry it for days without ever applying.
  if p_session_id is not null and a.checkout_session_id is distinct from p_session_id then
    return true;
  end if;

  if p_result = 'success' then
    update public.payment_attempts
    set status = 'paid', payment_intent_id = coalesce(p_payment_intent_id,payment_intent_id), updated_at = clock_timestamp()
    where id = a.id;
    update public.hold_requests
    set payment_status = 'paid', payment_reference = coalesce(p_payment_intent_id,p_session_id,payment_reference),
        stripe_payment_intent_id = coalesce(p_payment_intent_id,stripe_payment_intent_id), paid_at = coalesce(paid_at,clock_timestamp()),
        payment_failure_reason = null, updated_at = clock_timestamp()
    where id = a.hold_id and payment_status not in ('paid','refunded');
  elsif p_result = 'pending' then
    update public.payment_attempts
    set status = 'open', updated_at = clock_timestamp()
    where id = a.id and status not in ('paid','failed','expired');
    update public.hold_requests
    set payment_status = 'pending', updated_at = clock_timestamp()
    where id = a.hold_id and payment_status not in ('paid','refunded');
  else
    update public.payment_attempts
    set status = p_result, failure_reason = left(coalesce(p_reason,'Payment was not completed'),1000), updated_at = clock_timestamp()
    where id = a.id and status <> 'paid';
    -- Only the attempt the hold is currently waiting on may mark it failed.
    -- A late event for a superseded session leaves a newer Checkout alone.
    if a.status in ('created','open') and not exists (
      select 1 from public.payment_attempts other
      where other.hold_id = a.hold_id and other.id <> a.id and other.status in ('created','open')
    ) then
      update public.hold_requests
      set payment_status = 'failed', payment_failure_reason = left(coalesce(p_reason,'Payment was not completed'),1000), updated_at = clock_timestamp()
      where id = a.hold_id and payment_status not in ('paid','refunded');
    end if;
  end if;
  return true;
end $$;

revoke all on function public.cms_record_stripe_webhook(text,text,uuid,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.cms_record_stripe_webhook(text,text,uuid,text,text,text,text)
to service_role;

notify pgrst,'reload schema';
commit;
