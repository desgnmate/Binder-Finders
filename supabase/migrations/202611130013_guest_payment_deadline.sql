-- Bind Guest Stripe payment creation to the authoritative reservation deadline.
-- Existing active attempts remain visible after the deadline so ambiguous Stripe
-- creation outcomes can still be reconciled safely.
begin;

create or replace function public.cms_begin_guest_stripe_payment(
  p_order_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.guest_orders;
  attempt public.guest_payment_attempts;
  active_attempt public.guest_payment_attempts;
  v_items jsonb;
  v_item_subtotal bigint;
begin
  if p_order_id is null or p_idempotency_key is null then
    raise exception 'Invalid payment request';
  end if;

  select * into o
  from public.guest_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if o.status = 'paid' then
    raise exception 'This order has already been paid';
  end if;

  if o.status in ('expired','cancelled') then
    raise exception 'This order is no longer available for payment';
  end if;

  if o.status not in ('reserved','checkout_open','review') then
    raise exception 'This order cannot be paid';
  end if;

  if o.expires_at is null then
    raise exception 'Guest Checkout reservation deadline is unavailable';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name',i.name,
          'priceCents',i.price_cents
        )
        order by i.card_id
      ),
      '[]'::jsonb
    ),
    coalesce(sum(i.price_cents),0)
  into v_items,v_item_subtotal
  from public.guest_order_items i
  where i.order_id = o.id;

  if v_item_subtotal <> o.subtotal_cents then
    raise exception 'Order pricing is inconsistent';
  end if;

  if o.total_cents <= 0 then
    raise exception 'No payment is due for this order';
  end if;

  -- Same-key retries remain recoverable even after the reservation deadline.
  -- The API can replay the same deterministic Stripe idempotency request to
  -- discover whether an ambiguous Checkout creation actually succeeded.
  select * into attempt
  from public.guest_payment_attempts
  where idempotency_key = p_idempotency_key
    and order_id = o.id
  for update;

  if found then
    if attempt.amount_cents <> o.total_cents
      or attempt.currency <> lower(o.currency) then
      raise exception 'Payment request no longer matches this order';
    end if;

    if attempt.status = 'paid' then
      return jsonb_build_object(
        'state','paid',
        'attemptId',attempt.id,
        'sessionId',attempt.checkout_session_id,
        'orderId',o.id,
        'expiresAt',o.expires_at
      );
    end if;

    if attempt.status in ('failed','expired') then
      raise exception 'This payment attempt is closed. Start payment again.';
    end if;

    return jsonb_build_object(
      'state',
        case
          when attempt.checkout_session_id is null then 'create'
          else 'existing'
        end,
      'attemptId',attempt.id,
      'sessionId',attempt.checkout_session_id,
      'orderId',o.id,
      'customerEmail',o.email,
      'customerName',o.name,
      'currency',lower(o.currency),
      'amountCents',o.total_cents,
      'items',v_items,
      'shippingFeeCents',o.shipping_fee_cents,
      'expiresAt',o.expires_at
    );
  end if;

  -- A different active attempt also remains visible so callers do not create
  -- another payment while reconciliation is still resolving the first one.
  select * into active_attempt
  from public.guest_payment_attempts
  where order_id = o.id
    and status in ('created','open')
  order by created_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'state',
        case
          when active_attempt.checkout_session_id is null then 'in_progress'
          else 'existing'
        end,
      'attemptId',active_attempt.id,
      'sessionId',active_attempt.checkout_session_id,
      'orderId',o.id,
      'customerEmail',o.email,
      'customerName',o.name,
      'currency',lower(o.currency),
      'amountCents',o.total_cents,
      'items',v_items,
      'shippingFeeCents',o.shipping_fee_cents,
      'expiresAt',o.expires_at
    );
  end if;

  -- No payment attempt exists to recover. Do not create a fresh one after the
  -- reservation deadline; the expiry workflow may now release the inventory.
  if o.expires_at <= now() then
    raise exception 'This Guest Checkout reservation has expired';
  end if;

  -- Stripe Checkout requires at least 30 minutes before expiration.
  -- Refuse a fresh attempt before inserting it so a too-short reservation
  -- does not leave a created attempt that unnecessarily blocks expiry.
  if o.expires_at - clock_timestamp() < interval '31 minutes' then
    raise exception 'At least 31 minutes must remain to start Guest Checkout payment';
  end if;

  insert into public.guest_payment_attempts(
    order_id,
    idempotency_key,
    amount_cents,
    currency
  )
  values(
    o.id,
    p_idempotency_key,
    o.total_cents,
    lower(o.currency)
  )
  returning * into attempt;

  return jsonb_build_object(
    'state','create',
    'attemptId',attempt.id,
    'sessionId',null,
    'orderId',o.id,
    'customerEmail',o.email,
    'customerName',o.name,
    'currency',lower(o.currency),
    'amountCents',o.total_cents,
    'items',v_items,
    'shippingFeeCents',o.shipping_fee_cents,
    'expiresAt',o.expires_at
  );
end
$$;

revoke all on function
  public.cms_begin_guest_stripe_payment(uuid,uuid)
from public,anon,authenticated;

grant execute on function
  public.cms_begin_guest_stripe_payment(uuid,uuid)
to service_role;

notify pgrst,'reload schema';
commit;

