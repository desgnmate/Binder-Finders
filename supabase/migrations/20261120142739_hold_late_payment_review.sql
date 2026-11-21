-- Track successful Stripe payments received after a Hold has closed.
-- This does not issue Stripe refunds or restore released inventory.
begin;

alter table public.hold_requests
  add column if not exists stripe_payment_review_required
    boolean not null default false,
  add column if not exists stripe_payment_review_reason text;

create or replace function public.cms_flag_hold_late_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid'
     and new.status in ('expired', 'cancelled', 'rejected')
  then
    new.stripe_payment_review_required := true;
    new.stripe_payment_review_reason :=
      'Stripe payment received after Hold closure; manual payment review required.';
  end if;

  -- Ordinary updates cannot silently erase a payment-review flag.
  if old.stripe_payment_review_required
     and not new.stripe_payment_review_required
  then
    raise exception 'Late Stripe payment review cannot be silently cleared';
  end if;

  return new;
end;
$$;

revoke all on function public.cms_flag_hold_late_payment()
  from public, anon, authenticated;

drop trigger if exists hold_late_stripe_payment_review
  on public.hold_requests;

create trigger hold_late_stripe_payment_review
before update on public.hold_requests
for each row
execute function public.cms_flag_hold_late_payment();

-- A closed paid Hold must never be silently unflagged.
alter table public.hold_requests
  add constraint hold_closed_paid_requires_review
  check (
    status not in ('expired', 'cancelled', 'rejected')
    or payment_status <> 'paid'
    or stripe_payment_review_required
  );


-- LATE_HOLD_EMAIL_GUARD
create or replace function public.cms_hold_notifications_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare admin_email text; alert_email text;
begin
  -- Same as 202611030001_order_alert_email.sql for new requests.
  if tg_op = 'INSERT' then
    perform public.cms_queue_hold_notification(new.id, 'customer_request_received', new.email);
    select order_alert_email into alert_email from public.store_private_settings where id;
    if alert_email is not null then
      perform public.cms_queue_hold_notification(new.id, 'staff_request_received', alert_email);
    else
      -- No store inbox chosen yet: fall back to every active administrator.
      for admin_email in select email from public.admin_users where active loop
        perform public.cms_queue_hold_notification(new.id, 'staff_request_received', admin_email);
      end loop;
    end if;
  elsif new.stripe_payment_review_required = true
    and new.payment_status = 'paid'
    and new.status in ('expired', 'cancelled', 'rejected') then
    -- Late payment needs review, not an ordinary purchase confirmation.
    null;
  elsif row(old.status, old.fulfillment_status) is distinct from row(new.status, new.fulfillment_status)
    -- A new tracking or handover note is news once the customer has paid.
    or (old.fulfillment_note is distinct from new.fulfillment_note and new.payment_status = 'paid')
    -- Starting or abandoning Checkout is not news to the customer; a payment
    -- landing or being refunded is.
    or (old.payment_status is distinct from new.payment_status
      and new.payment_status in ('paid', 'refunded')) then
    perform public.cms_queue_hold_notification(new.id, 'customer_status_changed', new.email);
    -- Tell the email which change this is, so it can pick the right message.
    update public.notification_outbox
      set payload = payload || jsonb_build_object(
        'statusChanged', old.status is distinct from new.status,
        'refundedNow', old.payment_status is distinct from new.payment_status and new.payment_status = 'refunded'
      )
      where hold_id = new.id
        and kind = 'customer_status_changed'
        and event_key = txid_current()::text
        and status = 'pending';
  end if;
  return new;
end $$;

commit;