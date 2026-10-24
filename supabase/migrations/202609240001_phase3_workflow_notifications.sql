-- Phase 3: auditable payment/fulfilment workflow and transactional email outbox.
-- The existing hold transition RPC remains the source of truth for inventory.
begin;

alter table public.hold_requests
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  add column if not exists payment_reference text,
  add column if not exists fulfillment_status text not null default 'not_ready'
    check (fulfillment_status in ('not_ready', 'ready', 'shipped', 'delivered', 'picked_up', 'cancelled')),
  add column if not exists fulfillment_note text;

create index if not exists hold_requests_workflow_idx
  on public.hold_requests(status, payment_status, fulfillment_status, created_at desc);

create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  hold_id uuid not null references public.hold_requests(id) on delete cascade,
  kind text not null check (kind in (
    'customer_request_received',
    'customer_status_changed',
    'staff_request_received'
  )),
  to_email text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_outbox_ready_idx
  on public.notification_outbox(status, available_at, created_at);
create index if not exists notification_outbox_hold_idx
  on public.notification_outbox(hold_id, created_at);

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;
grant select, insert, update on public.notification_outbox to service_role;
grant usage, select on sequence public.notification_outbox_id_seq to service_role;

create or replace function public.cms_queue_hold_notification(
  p_hold_id uuid,
  p_kind text,
  p_to_email text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.hold_requests;
  items jsonb;
  total_cents bigint;
begin
  if p_kind not in ('customer_request_received', 'customer_status_changed', 'staff_request_received') then
    raise exception 'Invalid notification type';
  end if;

  select * into h
  from public.hold_requests
  where id = p_hold_id;
  if not found then return; end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'cardId', i.card_id,
        'name', i.name,
        'priceCents', i.price_cents
      ) order by i.card_id
    ), '[]'::jsonb),
    coalesce(sum(i.price_cents), 0)
  into items, total_cents
  from public.hold_request_items i
  where i.request_id = h.id;

  insert into public.notification_outbox(hold_id, kind, to_email, payload)
  values (
    h.id,
    p_kind,
    lower(trim(p_to_email)),
    jsonb_build_object(
      'reference', upper(left(replace(h.id::text, '-', ''), 8)),
      'name', h.name,
      'email', h.email,
      'status', h.status,
      'currency', h.currency,
      'totalCents', total_cents,
      'paymentStatus', h.payment_status,
      'fulfillmentStatus', h.fulfillment_status,
      'paymentReference', h.payment_reference,
      'fulfillmentNote', h.fulfillment_note,
      'items', items,
      'note', h.note,
      'createdAt', h.created_at
    )
  );
end
$$;

create or replace function public.cms_hold_notifications_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare admin_email text;
begin
  if tg_op = 'INSERT' then
    -- This trigger is deferred so all hold items are present in the payload.
    perform public.cms_queue_hold_notification(new.id, 'customer_request_received', new.email);
    for admin_email in
      select email from public.admin_users where active
    loop
      perform public.cms_queue_hold_notification(new.id, 'staff_request_received', admin_email);
    end loop;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform public.cms_queue_hold_notification(new.id, 'customer_status_changed', new.email);
  end if;
  return new;
end
$$;

drop trigger if exists hold_notifications_on_insert on public.hold_requests;
create constraint trigger hold_notifications_on_insert
after insert on public.hold_requests
deferrable initially deferred
for each row execute function public.cms_hold_notifications_trigger();

drop trigger if exists hold_notifications_on_status on public.hold_requests;
create trigger hold_notifications_on_status
after update of status on public.hold_requests
for each row execute function public.cms_hold_notifications_trigger();

-- Claim a bounded batch atomically so two cron invocations cannot send the same row.
create or replace function public.cms_claim_notification_outbox(p_limit integer default 10)
returns table(id bigint, kind text, to_email text, payload jsonb)
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with picked as (
    select o.id
    from public.notification_outbox o
    where o.status in ('pending', 'failed')
      and o.available_at <= now()
      and o.attempts < 5
    order by o.created_at
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  )
  update public.notification_outbox o
  set status = 'sending', attempts = o.attempts + 1
  from picked
  where o.id = picked.id
  returning o.id, o.kind, o.to_email, o.payload;
end
$$;

create or replace function public.cms_finish_notification(
  p_id bigint,
  p_success boolean,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.notification_outbox
  set
    status = case
      when p_success then 'sent'
      when attempts >= 5 then 'failed'
      else 'pending'
    end,
    available_at = case
      when p_success then available_at
      else now() + interval '5 minutes' * least(attempts, 12)
    end,
    last_error = case when p_success then null else left(coalesce(p_error, 'Delivery failed'), 1000) end,
    sent_at = case when p_success then now() else sent_at end
  where id = p_id and status = 'sending';
end
$$;

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

  -- Write workflow metadata before changing the hold status so the deferred
  -- status email contains the final payment/fulfilment state. If inventory
  -- transition fails, the surrounding transaction rolls the metadata back.
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

revoke all on function public.cms_queue_hold_notification(uuid, text, text),
  public.cms_hold_notifications_trigger(),
  public.cms_claim_notification_outbox(integer),
  public.cms_finish_notification(bigint, boolean, text),
  public.cms_set_hold_workflow(uuid, text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.cms_claim_notification_outbox(integer),
  public.cms_finish_notification(bigint, boolean, text)
to service_role;
grant execute on function public.cms_set_hold_workflow(uuid, text, text, text, text, text)
to authenticated;

notify pgrst, 'reload schema';
commit;
