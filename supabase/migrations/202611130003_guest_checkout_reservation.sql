-- Atomic Guest Checkout reservation foundation.
-- No Stripe session is created by this function.
-- No reservation expiration or release is performed here.
begin;

create function public.cms_begin_guest_checkout(p_request jsonb)
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
  v_subtotal bigint;
  v_order_id uuid;
  v_locked_count integer;
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
      'totalCents',v_existing.total_cents,
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

  if v_method = 'shipping' then
    if v_settings->>'shippingFeeCents' is null then
      raise exception 'Shipping is not configured';
    end if;
    v_shipping := (v_settings->>'shippingFeeCents')::bigint;
  else
    v_shipping := 0;
  end if;

  if v_shipping < 0 or v_shipping > 1000000000 then
    raise exception 'Invalid shipping fee configuration';
  end if;

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

  insert into public.guest_orders (
    request_key,name,email,fulfillment_method,shipping_address,
    currency,subtotal_cents,shipping_fee_cents,total_cents,status
  ) values (
    v_key,v_name,v_email,v_method,v_address,
    v_currency,v_subtotal,v_shipping,v_subtotal+v_shipping,'reserved'
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
  set availability = 'reserved',
      guest_reserved_by = v_order_id,
      updated_at = clock_timestamp()
  where id = any(v_ids);

  return jsonb_build_object(
    'orderId',v_order_id,
    'status','reserved',
    'currency',v_currency,
    'subtotalCents',v_subtotal,
    'shippingFeeCents',v_shipping,
    'totalCents',v_subtotal+v_shipping,
    'existing',false
  );
end
$$;

revoke all on function public.cms_begin_guest_checkout(jsonb)
from public,anon,authenticated;

grant execute on function public.cms_begin_guest_checkout(jsonb)
to service_role;

notify pgrst,'reload schema';
commit;