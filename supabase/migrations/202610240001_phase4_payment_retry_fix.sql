-- Repeated payment requests must never discard a Checkout session that can still
-- be paid. A reused client key now returns its active session, and a finished
-- attempt is never reset because Stripe caches the old request's idempotency key.
-- Late webhooks for a superseded session are acknowledged without changing state.
begin;

create or replace function public.cms_begin_stripe_payment(
  p_hold_id uuid,
  p_customer_user_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  h public.hold_requests;
  attempt public.payment_attempts;
  active_attempt public.payment_attempts;
  has_active boolean := false;
  items jsonb;
  total_cents bigint;
begin
  if p_customer_user_id is null or p_idempotency_key is null then
    raise exception 'Invalid payment request';
  end if;

  select * into h
  from public.hold_requests
  where id = p_hold_id and customer_user_id = p_customer_user_id
  for update;
  if not found then raise exception 'Request not found'; end if;
  if h.status <> 'accepted' then raise exception 'Only accepted requests can be paid'; end if;
  if h.payment_status in ('paid','refunded') then raise exception 'This request has already been paid'; end if;
  if h.expires_at is null or h.expires_at <= now() then raise exception 'This hold has expired'; end if;

  select * into attempt
  from public.payment_attempts
  where idempotency_key = p_idempotency_key and hold_id = p_hold_id
  for update;

  if found then
    if attempt.status = 'paid' then
      return jsonb_build_object('state','paid','attemptId',attempt.id,'sessionId',attempt.checkout_session_id);
    end if;
    if attempt.status in ('failed','expired') then
      raise exception 'This payment session has expired. Start payment again from the order.';
    end if;
    active_attempt := attempt;
    has_active := true;
  else
    select * into active_attempt
    from public.payment_attempts
    where hold_id = p_hold_id and status in ('created','open')
    order by created_at desc
    limit 1
    for update;
    has_active := found;
  end if;

  if has_active and active_attempt.status = 'created' and active_attempt.created_at < now() - interval '10 minutes' then
    update public.payment_attempts
    set status = 'failed', failure_reason = 'Checkout session creation timed out', updated_at = clock_timestamp()
    where id = active_attempt.id;
    if active_attempt.idempotency_key = p_idempotency_key then
      raise exception 'This payment session has expired. Start payment again from the order.';
    end if;
    has_active := false;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'priceCents',i.price_cents) order by i.card_id),'[]'::jsonb), coalesce(sum(i.price_cents),0)
  into items,total_cents
  from public.hold_request_items i where i.request_id = p_hold_id;

  if has_active then
    return jsonb_build_object(
      'state', case when active_attempt.checkout_session_id is null then 'in_progress' else 'existing' end,
      'attemptId', active_attempt.id,
      'sessionId', active_attempt.checkout_session_id,
      'holdId', h.id,
      'customerEmail', h.email,
      'customerName', h.name,
      'currency', lower(h.currency),
      'amountCents', total_cents,
      'items', items
    );
  end if;

  if total_cents <= 0 then raise exception 'No payment is due for this request'; end if;

  insert into public.payment_attempts(hold_id,customer_user_id,idempotency_key,amount_cents,currency)
  values (p_hold_id,p_customer_user_id,p_idempotency_key,total_cents,lower(h.currency))
  returning * into attempt;

  update public.hold_requests
  set payment_status = 'pending', payment_failure_reason = null, updated_at = clock_timestamp()
  where id = p_hold_id;

  return jsonb_build_object(
    'state','create',
    'attemptId',attempt.id,
    'sessionId',null,
    'holdId',h.id,
    'customerEmail',h.email,
    'customerName',h.name,
    'currency',lower(h.currency),
    'amountCents',total_cents,
    'items',items
  );
end $$;

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
    update public.hold_requests
    set payment_status = 'failed', payment_failure_reason = left(coalesce(p_reason,'Payment was not completed'),1000), updated_at = clock_timestamp()
    where id = a.hold_id and payment_status not in ('paid','refunded');
  end if;
  return true;
end $$;

revoke all on function public.cms_begin_stripe_payment(uuid,uuid,uuid),
  public.cms_record_stripe_webhook(text,text,uuid,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.cms_begin_stripe_payment(uuid,uuid,uuid),
  public.cms_record_stripe_webhook(text,text,uuid,text,text,text,text)
to service_role;
notify pgrst,'reload schema';
commit;
