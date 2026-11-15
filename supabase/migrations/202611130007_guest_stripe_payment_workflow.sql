-- Guest Checkout Stripe payment preparation.
-- A created attempt remains recoverable until a Stripe session is safely attached
-- or a later authorized reconciliation/release workflow closes it.
begin;

create function public.cms_begin_guest_stripe_payment(
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
        'sessionId',attempt.checkout_session_id
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
      'shippingFeeCents',o.shipping_fee_cents
    );
  end if;

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
      'shippingFeeCents',o.shipping_fee_cents
    );
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
    'shippingFeeCents',o.shipping_fee_cents
  );
end
$$;

create function public.cms_attach_guest_stripe_session(
  p_attempt_id uuid,
  p_session_id text
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
  v_session_id text;
begin
  v_session_id := trim(coalesce(p_session_id,''));

  if length(v_session_id) < 8 then
    return false;
  end if;

  -- Read the owning order first, then lock in the same order used by
  -- cms_begin_guest_stripe_payment: guest order before payment attempt.
  select order_id into v_order_id
  from public.guest_payment_attempts
  where id = p_attempt_id;

  if not found then
    return false;
  end if;

  select * into o
  from public.guest_orders
  where id = v_order_id
  for update;

  if not found
    or o.status not in ('reserved','checkout_open','review') then
    return false;
  end if;

  select * into a
  from public.guest_payment_attempts
  where id = p_attempt_id
    and order_id = o.id
  for update;

  if not found
    or a.status <> 'created'
    or a.checkout_session_id is not null then
    return false;
  end if;

  if o.stripe_session_id is not null
    and o.stripe_session_id is distinct from v_session_id then
    return false;
  end if;

  update public.guest_payment_attempts
  set
    checkout_session_id = v_session_id,
    status = 'open',
    failure_reason = null,
    updated_at = clock_timestamp()
  where id = a.id;

  update public.guest_orders
  set
    status = 'checkout_open',
    stripe_session_id = v_session_id,
    updated_at = clock_timestamp()
  where id = o.id;

  return true;
end
$$;
revoke all on function
  public.cms_begin_guest_stripe_payment(uuid,uuid),
  public.cms_attach_guest_stripe_session(uuid,text)
from public,anon,authenticated;

grant execute on function
  public.cms_begin_guest_stripe_payment(uuid,uuid),
  public.cms_attach_guest_stripe_session(uuid,text)
to service_role;

notify pgrst,'reload schema';
commit;



