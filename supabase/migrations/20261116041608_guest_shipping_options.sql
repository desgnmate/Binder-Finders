begin;

-- Shipping choices and optional insurance for Guest Checkout.
-- Nullable shipping_service preserves compatibility with legacy orders.
alter table public.guest_orders
  add column shipping_service text
    check (shipping_service in ('tracked', 'express')),
  add column insurance_selected boolean not null default false,
  add column insurance_fee_cents bigint not null default 0
    check (insurance_fee_cents >= 0);

-- The authoritative total now includes optional insurance.
alter table public.guest_orders
  drop constraint if exists guest_orders_check;

alter table public.guest_orders
  add constraint guest_orders_total_cents_check
  check (
    total_cents =
      subtotal_cents + shipping_fee_cents + insurance_fee_cents
  );

-- Additional checkout functions will be added below before deployment.
-- Authoritative AUD shipping and optional insurance calculation.
create or replace function public.cms_guest_shipping_quote(
  p_subtotal_cents bigint,
  p_method text,
  p_service text,
  p_insurance boolean
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_shipping bigint := 0;
  v_insurance bigint := 0;
begin
  if p_subtotal_cents is null or p_subtotal_cents < 0 then
    raise exception 'Invalid card subtotal';
  end if;

  if p_method = 'pickup' then
    if p_service is not null or coalesce(p_insurance, false) then
      raise exception 'Pickup cannot include shipping or insurance';
    end if;
  elsif p_method = 'shipping' then
    if p_service = 'tracked' then
      v_shipping := 1000;
    elsif p_service = 'express' then
      v_shipping := 1500;
    else
      raise exception 'Invalid shipping service';
    end if;

    if coalesce(p_insurance, false) then
      v_insurance :=
        ceil(p_subtotal_cents::numeric / 10000)::bigint * 250;
    end if;
  else
    raise exception 'Invalid fulfillment method';
  end if;

  return jsonb_build_object(
    'shippingFeeCents', v_shipping,
    'insuranceFeeCents', v_insurance,
    'totalCents', p_subtotal_cents + v_shipping + v_insurance
  );
end
$$;

revoke all on function
  public.cms_guest_shipping_quote(bigint,text,text,boolean)
from public,anon,authenticated;

grant execute on function
  public.cms_guest_shipping_quote(bigint,text,text,boolean)
to service_role;

-- Updated Guest Checkout reservation function.
create or replace function public.cms_begin_guest_checkout(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid;
  v_existing public.guest_orders;
  v_settings jsonb;
  v_ids text[];
  v_count integer;
  v_unique_count integer;
  v_name text;
  v_email text;
  v_method text;
  v_address jsonb;
  v_currency text;
  v_shipping bigint;
  v_service text;
  v_insurance_selected boolean;
  v_insurance_fee bigint := 0;
  v_shipping_quote jsonb;
  v_subtotal bigint;
  v_order_id uuid;
  v_locked_count integer;
  v_duration_minutes integer;
  v_expires_at timestamptz;
begin
  if jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'Invalid checkout request';
  end if;

  if jsonb_typeof(p_request->'requestKey') is distinct from 'string'
    or coalesce(p_request->>'requestKey','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'Invalid checkout request key';
  end if;

  v_key := (p_request->>'requestKey')::uuid;
  v_name := btrim(coalesce(p_request->>'name',''));
  v_email := lower(btrim(coalesce(p_request->>'email','')));
  v_method := p_request->>'fulfillmentMethod';
  v_address := p_request->'shippingAddress';
  v_service := p_request->>'shippingService';

  if jsonb_typeof(p_request->'insuranceSelected') is distinct from 'boolean' then
    raise exception 'Invalid insurance selection';
  end if;

  v_insurance_selected := (p_request->>'insuranceSelected')::boolean;

  if v_method = 'shipping' then
    if v_service not in ('tracked','express') or v_service is null then
      raise exception 'Select a valid shipping service';
    end if;
  elsif v_method = 'pickup' then
    if v_service is not null or v_insurance_selected then
      raise exception 'Pickup cannot include shipping or insurance';
    end if;
  end if;

  if jsonb_typeof(p_request->'name') is distinct from 'string'
    or jsonb_typeof(p_request->'email') is distinct from 'string'
    or length(v_name) not between 1 and 120
    or length(v_email) not between 3 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid contact details';
  end if;

  if v_method not in ('pickup','shipping')
    or jsonb_typeof(p_request->'fulfillmentMethod') is distinct from 'string' then
    raise exception 'Invalid fulfillment method';
  end if;

  if v_method = 'shipping' then
    if jsonb_typeof(v_address) is distinct from 'object'
      or length(btrim(coalesce(v_address->>'line1',''))) not between 1 and 200
      or length(btrim(coalesce(v_address->>'city',''))) not between 1 and 120
      or length(btrim(coalesce(v_address->>'postalCode',''))) not between 1 and 30
      or length(btrim(coalesce(v_address->>'country',''))) not between 2 and 100 then
      raise exception 'Invalid shipping address';
    end if;
  else
    if v_address is not null and v_address <> 'null'::jsonb then
      raise exception 'Pickup does not require a shipping address';
    end if;
    v_address := null;
  end if;

  if jsonb_typeof(p_request->'cardIds') is distinct from 'array' then
    raise exception 'Invalid selected cards';
  end if;

  select count(*),count(distinct value)
  into v_count,v_unique_count
  from jsonb_array_elements(p_request->'cardIds');

  if v_count not between 1 and 30 or v_unique_count <> v_count
    or exists (
      select 1
      from jsonb_array_elements(p_request->'cardIds') as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or length(item.value #>> '{}') not between 1 and 100
    ) then
    raise exception 'Select between 1 and 30 unique cards';
  end if;

  select array_agg(value order by value)
  into v_ids
  from jsonb_array_elements_text(p_request->'cardIds');

  -- Serialize retries using the same request key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('guest-checkout:' || v_key::text,0)
  );

  select * into v_existing
  from public.guest_orders
  where request_key = v_key
  for update;

  if found then
    if v_existing.name <> v_name
      or v_existing.email <> v_email
      or v_existing.fulfillment_method <> v_method
      or v_existing.shipping_address is distinct from v_address
      or v_existing.shipping_service is distinct from v_service
      or v_existing.insurance_selected is distinct from v_insurance_selected
      or (
        select array_agg(card_id order by card_id)
        from public.guest_order_items
        where order_id = v_existing.id
      ) is distinct from v_ids then
      raise exception 'Checkout request key was already used';
    end if;

    return jsonb_build_object(
      'orderId',v_existing.id,
      'status',v_existing.status,
      'currency',v_existing.currency,
      'subtotalCents',v_existing.subtotal_cents,
      'shippingFeeCents',v_existing.shipping_fee_cents,
      'shippingService',v_existing.shipping_service,
      'insuranceSelected',v_existing.insurance_selected,
      'insuranceFeeCents',v_existing.insurance_fee_cents,
      'totalCents',v_existing.total_cents,
      'expiresAt',v_existing.expires_at,
      'existing',true
    );
  end if;

  select data into v_settings
  from public.store_settings
  where id = true;

  if not coalesce((v_settings->>'guestCheckoutEnabled')::boolean,false) then
    raise exception 'Guest Checkout is currently unavailable';
  end if;

  v_currency := v_settings->>'currency';

  if v_currency not in ('AUD','USD','PHP','GBP','EUR','CAD','NZD','JPY')
    or v_currency is null then
    raise exception 'Checkout currency is not configured';
  end if;

  v_duration_minutes := coalesce(
    (v_settings->>'guestCheckoutDurationMinutes')::integer,
    60
  );

  if v_duration_minutes not between 60 and 1440 then
    raise exception 'Guest Checkout duration is not configured correctly';
  end if;

  v_expires_at :=
    clock_timestamp() + pg_catalog.make_interval(mins => v_duration_minutes);

  -- Shipping and insurance are calculated from the authoritative
  -- card subtotal after inventory validation.

  -- Lock inventory in deterministic order.
  perform id
  from public.cards
  where id = any(v_ids)
  order by id
  for update;

  select count(*),coalesce(sum(price_cents),0)
  into v_locked_count,v_subtotal
  from public.cards
  where id = any(v_ids)
    and publication = 'published'
    and availability = 'available'
    and reserved_by is null
    and guest_reserved_by is null;

  if v_locked_count <> v_count then
    raise exception 'A selected card is no longer available. Please refresh your bag.';
  end if;
  if v_currency <> 'AUD' then
    raise exception 'Shipping rates are configured for AUD only';
  end if;

  v_shipping_quote := public.cms_guest_shipping_quote(
    v_subtotal,
    v_method,
    v_service,
    v_insurance_selected
  );

  v_shipping := (v_shipping_quote->>'shippingFeeCents')::bigint;
  v_insurance_fee := (v_shipping_quote->>'insuranceFeeCents')::bigint;

  insert into public.guest_orders (
    request_key,
    name,
    email,
    fulfillment_method,
    shipping_address,
    currency,
    subtotal_cents,
    shipping_fee_cents,
    shipping_service,
    insurance_selected,
    insurance_fee_cents,
    total_cents,
    status,
    expires_at
  ) values (
    v_key,
    v_name,
    v_email,
    v_method,
    v_address,
    v_currency,
    v_subtotal,
    v_shipping,
    v_service,
    v_insurance_selected,
    v_insurance_fee,
    v_subtotal + v_shipping + v_insurance_fee,
    'reserved',
    v_expires_at
  )
  returning id into v_order_id;

  insert into public.guest_order_items (
    order_id,card_id,name,price_cents
  )
  select
    v_order_id,id,data->>'name',price_cents
  from public.cards
  where id = any(v_ids);

  update public.cards
  set
    availability = 'reserved',
    guest_reserved_by = v_order_id,
    updated_at = clock_timestamp()
  where id = any(v_ids);

  return jsonb_build_object(
    'orderId',v_order_id,
    'status','reserved',
    'currency',v_currency,
    'subtotalCents',v_subtotal,
    'shippingFeeCents',v_shipping,
    'shippingService',v_service,
    'insuranceSelected',v_insurance_selected,
    'insuranceFeeCents',v_insurance_fee,
    'totalCents',v_subtotal + v_shipping + v_insurance_fee,
    'expiresAt',v_expires_at,
    'existing',false
  );
end
$$;


-- Updated Guest Stripe payment payload.
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
      'shippingService',o.shipping_service,
      'insuranceSelected',o.insurance_selected,
      'insuranceFeeCents',o.insurance_fee_cents,
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
      'shippingService',o.shipping_service,
      'insuranceSelected',o.insurance_selected,
      'insuranceFeeCents',o.insurance_fee_cents,
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
      'shippingService',o.shipping_service,
      'insuranceSelected',o.insurance_selected,
      'insuranceFeeCents',o.insurance_fee_cents,
    'expiresAt',o.expires_at
  );
end
$$;


-- Updated Guest Stripe reconciliation payload.
drop function if exists public.cms_due_guest_stripe_attempts(integer);

create function public.cms_due_guest_stripe_attempts(
  p_limit integer default 20
)
returns table(
  attempt_id uuid,
  order_id uuid,
  session_id text,
  attempt_status text,
  idempotency_key uuid,
  amount_cents bigint,
  customer_email text,
  currency text,
  items jsonb,
  shipping_fee_cents bigint,
  insurance_fee_cents bigint,
  shipping_service text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select a.id
    from public.guest_orders o
    join public.guest_payment_attempts a
      on a.order_id = o.id
    where o.status in ('reserved','checkout_open','review')
      and o.expires_at is not null
      and (
        (
          a.status = 'created'
          and a.checkout_session_id is null
          and o.expires_at <= now() + interval '40 minutes'
        )
        or
        (
          a.status in ('created','open')
          and o.expires_at <= now()
        )
      )
    order by
      a.reconcile_checked_at nulls first,
      o.expires_at,
      a.created_at
    limit greatest(1,least(coalesce(p_limit,20),100))
    for update of o skip locked
  ),
  stamped as (
    update public.guest_payment_attempts a
    set reconcile_checked_at = clock_timestamp()
    from picked
    where a.id = picked.id
      and a.status in ('created','open')
    returning
      a.id,
      a.order_id,
      a.checkout_session_id,
      a.status,
      a.idempotency_key,
      a.amount_cents
  )
  select
    s.id,
    s.order_id,
    s.checkout_session_id,
    s.status,
    s.idempotency_key,
    s.amount_cents,
    o.email,
    lower(o.currency),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name',i.name,
            'priceCents',i.price_cents
          )
          order by i.card_id
        )
        from public.guest_order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    ),
    o.shipping_fee_cents,
    o.insurance_fee_cents,
    o.shipping_service,
    o.expires_at
  from stamped s
  join public.guest_orders o
    on o.id = s.order_id;
end
$$;

revoke all on function
  public.cms_due_guest_stripe_attempts(integer)
from public,anon,authenticated;

grant execute on function
  public.cms_due_guest_stripe_attempts(integer)
to service_role;


-- Preserve restricted access to Guest Checkout database functions.
revoke all on function public.cms_begin_guest_checkout(jsonb)
from public, anon, authenticated;

grant execute on function public.cms_begin_guest_checkout(jsonb)
to service_role;

revoke all on function public.cms_begin_guest_stripe_payment(uuid,uuid)
from public, anon, authenticated;

grant execute on function public.cms_begin_guest_stripe_payment(uuid,uuid)
to service_role;

notify pgrst, 'reload schema';

commit;