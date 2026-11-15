-- Record Guest Checkout Stripe events without touching the existing Hold flow.
-- Successful payment finalizes the Guest order and its reserved inventory
-- atomically. Failed/expired attempts do not release inventory here; release
-- is handled separately after reconciliation proves it is safe.
begin;

create function public.cms_record_guest_stripe_webhook(
  p_event_id text,
  p_event_type text,
  p_attempt_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_result text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.guest_payment_attempts;
  o public.guest_orders;
  v_order_id uuid;
  inserted_count integer;
begin
  if p_event_id is null or length(trim(p_event_id)) < 8 then
    raise exception 'Invalid Stripe event';
  end if;

  if p_result not in ('success','pending','failed','expired') then
    raise exception 'Invalid payment result';
  end if;

  -- Read ownership first so all Guest payment paths lock in the same order:
  -- guest order -> payment attempt -> cards.
  select order_id into v_order_id
  from public.guest_payment_attempts
  where id = p_attempt_id;

  if not found then
    return true;
  end if;

  select * into o
  from public.guest_orders
  where id = v_order_id
  for update;

  if not found then
    return true;
  end if;

  select * into a
  from public.guest_payment_attempts
  where id = p_attempt_id
    and order_id = o.id
  for update;

  if not found then
    return true;
  end if;

  -- A webhook for a session this attempt does not track is stale.
  -- Acknowledge it so Stripe does not retry it indefinitely.
  if p_session_id is not null
    and a.checkout_session_id is distinct from p_session_id then
    return true;
  end if;

  if o.stripe_session_id is not null
    and p_session_id is not null
    and o.stripe_session_id is distinct from p_session_id then
    return true;
  end if;

  insert into public.guest_stripe_webhook_events(
    event_id,
    event_type,
    attempt_id
  )
  values(
    trim(p_event_id),
    p_event_type,
    p_attempt_id
  )
  on conflict(event_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return true;
  end if;

  -- Stripe may deliver more than one distinct success event for the same
  -- Checkout session. Once both records are paid, acknowledge later success
  -- events without trying to finalize already-sold inventory again.
  if p_result = 'success'
    and a.status = 'paid'
    and o.status = 'paid' then
    return true;
  end if;

  if p_result = 'success' then
    if o.status in ('expired','cancelled') then
      raise exception 'Paid Guest order is already closed and requires review';
    end if;

    update public.guest_payment_attempts
    set
      status = 'paid',
      payment_intent_id = coalesce(
        p_payment_intent_id,
        payment_intent_id
      ),
      failure_reason = null,
      updated_at = clock_timestamp()
    where id = a.id
      and status <> 'paid';

    update public.guest_orders
    set
      status = 'paid',
      paid_at = coalesce(paid_at,clock_timestamp()),
      updated_at = clock_timestamp()
    where id = o.id
      and status in ('reserved','checkout_open','review');

    -- Lock inventory deterministically before the terminal transition.
    perform c.id
    from public.cards c
    where c.guest_reserved_by = o.id
    order by c.id
    for update;

    if (
      select count(*)
      from public.cards c
      where c.guest_reserved_by = o.id
        and c.availability = 'reserved'
    ) <> (
      select count(*)
      from public.guest_order_items i
      where i.order_id = o.id
    ) then
      raise exception 'Guest order reservation conflict';
    end if;

    update public.cards
    set
      availability = 'sold',
      guest_reserved_by = null,
      updated_at = clock_timestamp()
    where guest_reserved_by = o.id;

  elsif p_result = 'pending' then
    update public.guest_payment_attempts
    set
      status = 'open',
      updated_at = clock_timestamp()
    where id = a.id
      and status not in ('paid','failed','expired');

    update public.guest_orders
    set
      status = 'checkout_open',
      updated_at = clock_timestamp()
    where id = o.id
      and status in ('reserved','checkout_open','review');

  else
    update public.guest_payment_attempts
    set
      status = p_result,
      failure_reason = left(
        coalesce(p_reason,'Payment was not completed'),
        1000
      ),
      updated_at = clock_timestamp()
    where id = a.id
      and status <> 'paid';

    -- Do not release cards here. Stripe failure/expiry and inventory release
    -- remain separate so delayed/out-of-order events can be reconciled first.
  end if;

  return true;
end
$$;

revoke all on function
  public.cms_record_guest_stripe_webhook(
    text,text,uuid,text,text,text,text
  )
from public,anon,authenticated;

grant execute on function
  public.cms_record_guest_stripe_webhook(
    text,text,uuid,text,text,text,text
  )
to service_role;

notify pgrst,'reload schema';
commit;

