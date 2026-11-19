begin;

create table if not exists public.guest_notification_outbox (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.guest_orders(id) on delete cascade,
  kind text not null check (kind in ('staff_guest_purchase_paid')),
  to_email text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  event_key text not null,
  claim_token uuid,
  leased_at timestamptz,
  first_attempt_at timestamptz,
  delivery_body jsonb
);

create index if not exists guest_notification_outbox_ready_idx
  on public.guest_notification_outbox(status, available_at, created_at);

create index if not exists guest_notification_outbox_order_idx
  on public.guest_notification_outbox(order_id, created_at);

create unique index if not exists guest_notification_outbox_event_idx
  on public.guest_notification_outbox(order_id, kind, event_key);

alter table public.guest_notification_outbox enable row level security;

revoke all on public.guest_notification_outbox
  from public, anon, authenticated;

grant select, insert, update on public.guest_notification_outbox
  to service_role;

grant usage, select on sequence public.guest_notification_outbox_id_seq
  to service_role;


create or replace function public.cms_queue_guest_purchase_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alert_email text;
  order_items jsonb;
begin
  if new.status <> 'paid'
    or old.status is not distinct from new.status then
    return new;
  end if;

  select s.order_alert_email
  into alert_email
  from public.store_private_settings s
  where s.id = true;

  if alert_email is null or btrim(alert_email) = '' then
    return new;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cardId', i.card_id,
        'name', i.name,
        'priceCents', i.price_cents
      )
      order by i.name, i.card_id
    ),
    '[]'::jsonb
  )
  into order_items
  from public.guest_order_items i
  where i.order_id = new.id;

  insert into public.guest_notification_outbox(
    order_id,
    kind,
    to_email,
    event_key,
    payload
  )
  values(
    new.id,
    'staff_guest_purchase_paid',
    alert_email,
    'paid',
    jsonb_build_object(
      'orderId', new.id,
      'name', new.name,
      'email', new.email,
      'fulfillmentMethod', new.fulfillment_method,
      'shippingAddress', new.shipping_address,
      'currency', new.currency,
      'subtotalCents', new.subtotal_cents,
      'shippingFeeCents', new.shipping_fee_cents,
      'totalCents', new.total_cents,
      'shippingService', new.shipping_service,
      'insuranceSelected', new.insurance_selected,
      'insuranceFeeCents', new.insurance_fee_cents,
      'paidAt', new.paid_at,
      'items', order_items
    )
  )
  on conflict (order_id, kind, event_key) do nothing;

  return new;
end
$$;

drop trigger if exists cms_guest_purchase_notification
  on public.guest_orders;

create constraint trigger cms_guest_purchase_notification
after update of status on public.guest_orders
deferrable initially deferred
for each row
execute function public.cms_queue_guest_purchase_notification();


create or replace function public.cms_claim_guest_notification_outbox(
  p_limit integer default 5
)
returns table(
  id bigint,
  kind text,
  to_email text,
  payload jsonb,
  claim_token uuid,
  delivery_body jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guest_notification_outbox o
  set
    status = 'failed',
    attempts = greatest(o.attempts, 5),
    claim_token = null,
    leased_at = null,
    last_error =
      'Delivery requires review: retry limit or safe idempotency window exceeded'
  where (
      o.status = 'pending'
      or (
        o.status = 'sending'
        and o.leased_at <= now() - interval '5 minutes'
      )
    )
    and (
      o.attempts >= 5
      or o.first_attempt_at <= now() - interval '23 hours'
    );

  return query
  with picked as (
    select o.id
    from public.guest_notification_outbox o
    where (
        (
          o.status = 'pending'
          and o.available_at <= now()
        )
        or (
          o.status = 'sending'
          and o.leased_at <= now() - interval '5 minutes'
        )
      )
      and o.attempts < 5
      and (
        o.first_attempt_at is null
        or o.first_attempt_at > now() - interval '23 hours'
      )
    order by o.created_at, o.id
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  )
  update public.guest_notification_outbox o
  set
    status = 'sending',
    attempts = o.attempts + 1,
    leased_at = now(),
    claim_token = gen_random_uuid(),
    first_attempt_at = coalesce(o.first_attempt_at, now())
  from picked
  where o.id = picked.id
  returning
    o.id,
    o.kind,
    o.to_email,
    o.payload,
    o.claim_token,
    o.delivery_body;
end
$$;


create or replace function public.cms_prepare_guest_notification(
  p_id bigint,
  p_claim_token uuid,
  p_body jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  update public.guest_notification_outbox o
  set delivery_body = coalesce(o.delivery_body, p_body)
  where o.id = p_id
    and o.status = 'sending'
    and o.claim_token = p_claim_token
    and o.leased_at > now() - interval '5 minutes'
  returning o.delivery_body into result;

  if result is null then
    raise exception 'Guest notification lease expired';
  end if;

  return result;
end
$$;


create or replace function public.cms_finish_guest_notification(
  p_id bigint,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.guest_notification_outbox o
  set
    status = case
      when p_success then 'sent'
      when o.attempts >= 5 then 'failed'
      else 'pending'
    end,
    available_at = case
      when p_success then o.available_at
      else now() + interval '5 minutes' * least(o.attempts, 12)
    end,
    last_error = case
      when p_success then null
      else left(coalesce(p_error, 'Delivery failed'), 1000)
    end,
    sent_at = case
      when p_success then now()
      else o.sent_at
    end,
    claim_token = null,
    leased_at = null
  where o.id = p_id
    and o.status = 'sending'
    and o.claim_token = p_claim_token
    and o.leased_at > now() - interval '5 minutes';

  get diagnostics affected = row_count;
  return affected = 1;
end
$$;


revoke all on function
  public.cms_queue_guest_purchase_notification(),
  public.cms_claim_guest_notification_outbox(integer),
  public.cms_prepare_guest_notification(bigint, uuid, jsonb),
  public.cms_finish_guest_notification(bigint, uuid, boolean, text)
from public, anon, authenticated;

grant execute on function
  public.cms_claim_guest_notification_outbox(integer),
  public.cms_prepare_guest_notification(bigint, uuid, jsonb),
  public.cms_finish_guest_notification(bigint, uuid, boolean, text)
to service_role;

notify pgrst, 'reload schema';

commit;