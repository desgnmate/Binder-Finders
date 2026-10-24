-- Additive repair: preserve orders/inventory, enforce completion at the table,
-- coalesce customer updates, and lease notification work with fenced retries.
begin;

create or replace function public.cms_guard_hold_workflow()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    if new.payment_status <> 'paid' then
      raise exception 'Record payment before completing this sale';
    end if;
    if new.fulfillment_status not in ('ready', 'shipped', 'delivered', 'picked_up') then
      raise exception 'Prepare fulfilment before completing this sale';
    end if;
  elsif new.status = 'completed' and new.payment_status not in ('paid', 'refunded') then
    raise exception 'A completed sale must remain paid or be recorded as refunded';
  end if;
  if new.status in ('rejected', 'cancelled') then
    new.fulfillment_status := 'cancelled';
  end if;
  if length(new.payment_reference) > 200 or length(new.fulfillment_note) > 1000 then
    raise exception 'Workflow reference or note is too long';
  end if;
  return new;
end $$;
create trigger hold_workflow_guard before update on public.hold_requests
for each row execute function public.cms_guard_hold_workflow();
revoke all on function public.cms_guard_hold_workflow() from public, anon, authenticated;

alter table public.notification_outbox
  add column event_key text,
  add column claim_token uuid,
  add column leased_at timestamptz,
  add column first_attempt_at timestamptz,
  add column delivery_body jsonb;
-- NULL keys preserve historical rows. Each recipient gets one final snapshot
-- for a given kind/transaction, even if the workflow RPC updates twice.
create unique index notification_outbox_event_idx
on public.notification_outbox(hold_id, kind, to_email, event_key)
where event_key is not null;

-- Legacy attempts did not use provider idempotency. Do not blindly resend
-- messages whose delivery is unknown; preserve them for operator review.
update public.notification_outbox
set status='failed', attempts=greatest(attempts,5),
    last_error='Legacy delivery outcome unknown; review provider logs before retrying'
where status in ('pending','sending','failed') and attempts > 0;

create or replace function public.cms_queue_hold_notification(
  p_hold_id uuid, p_kind text, p_to_email text
) returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; items jsonb; total_cents bigint;
begin
  if p_kind not in ('customer_request_received','customer_status_changed','staff_request_received') then
    raise exception 'Invalid notification type';
  end if;
  select * into h from public.hold_requests where id=p_hold_id;
  if not found then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'cardId',i.card_id,'name',i.name,'priceCents',i.price_cents
  ) order by i.card_id),'[]'::jsonb), coalesce(sum(i.price_cents),0)
  into items,total_cents from public.hold_request_items i where i.request_id=h.id;
  insert into public.notification_outbox(hold_id,kind,to_email,event_key,payload)
  values(h.id,p_kind,lower(trim(p_to_email)),txid_current()::text,jsonb_build_object(
    'reference',upper(left(replace(h.id::text,'-',''),8)),
    'name',h.name,'email',h.email,'status',h.status,'currency',h.currency,
    'totalCents',total_cents,'paymentStatus',h.payment_status,
    'fulfillmentStatus',h.fulfillment_status,'paymentReference',h.payment_reference,
    'fulfillmentNote',h.fulfillment_note,'items',items,'note',h.note,'createdAt',h.created_at
  )) on conflict(hold_id,kind,to_email,event_key) where event_key is not null do nothing;
end $$;

create or replace function public.cms_hold_notifications_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare admin_email text;
begin
  if tg_op='INSERT' then
    perform public.cms_queue_hold_notification(new.id,'customer_request_received',new.email);
    for admin_email in select email from public.admin_users where active loop
      perform public.cms_queue_hold_notification(new.id,'staff_request_received',admin_email);
    end loop;
  elsif row(old.status,old.payment_status,old.fulfillment_status,old.payment_reference,old.fulfillment_note)
    is distinct from row(new.status,new.payment_status,new.fulfillment_status,new.payment_reference,new.fulfillment_note) then
    perform public.cms_queue_hold_notification(new.id,'customer_status_changed',new.email);
  end if;
  return new;
end $$;
drop trigger hold_notifications_on_status on public.hold_requests;
create constraint trigger hold_notifications_on_status after update on public.hold_requests
deferrable initially deferred for each row execute function public.cms_hold_notifications_trigger();

-- Replace the claim return shape. Old workers fail closed until deployed.
drop function public.cms_claim_notification_outbox(integer);
create function public.cms_claim_notification_outbox(p_limit integer default 5)
returns table(id bigint, kind text, to_email text, payload jsonb, claim_token uuid, delivery_body jsonb)
language plpgsql security definer set search_path='' as $$
begin
  -- Resend retains idempotency keys for 24h. Stop automatic retries before
  -- that window closes rather than risk duplicating an ambiguously sent email.
  update public.notification_outbox o
  set status='failed', attempts=greatest(o.attempts,5), claim_token=null, leased_at=null,
      last_error='Delivery requires review: retry limit or safe idempotency window exceeded'
  where (o.status='pending' or (o.status='sending' and o.leased_at <= now()-interval '5 minutes'))
    and (o.attempts>=5 or o.first_attempt_at <= now()-interval '23 hours');

  return query with picked as (
    select o.id from public.notification_outbox o
    where ((o.status='pending' and o.available_at<=now())
      or (o.status='sending' and o.leased_at<=now()-interval '5 minutes'))
      and o.attempts<5
      and (o.first_attempt_at is null or o.first_attempt_at>now()-interval '23 hours')
    order by o.created_at,o.id
    limit greatest(1,least(coalesce(p_limit,5),20)) for update skip locked
  ) update public.notification_outbox o
    set status='sending', attempts=o.attempts+1, leased_at=now(),
        claim_token=gen_random_uuid(), first_attempt_at=coalesce(o.first_attempt_at,now())
    from picked where o.id=picked.id
    returning o.id,o.kind,o.to_email,o.payload,o.claim_token,o.delivery_body;
end $$;

-- Freeze the exact provider request before sending. Retries must use the same
-- body as well as the same idempotency key, even after a template deployment.
create function public.cms_prepare_notification(p_id bigint,p_claim_token uuid,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  update public.notification_outbox o set delivery_body=coalesce(o.delivery_body,p_body)
  where o.id=p_id and o.status='sending' and o.claim_token=p_claim_token
    and o.leased_at>now()-interval '5 minutes'
  returning o.delivery_body into result;
  if result is null then raise exception 'Notification lease expired'; end if;
  return result;
end $$;

drop function public.cms_finish_notification(bigint,boolean,text);
create function public.cms_finish_notification(
  p_id bigint,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.notification_outbox o
  set status=case when p_success then 'sent' when o.attempts>=5 then 'failed' else 'pending' end,
      available_at=case when p_success then o.available_at else now()+interval '5 minutes'*least(o.attempts,12) end,
      last_error=case when p_success then null else left(coalesce(p_error,'Delivery failed'),1000) end,
      sent_at=case when p_success then now() else o.sent_at end,
      claim_token=null,leased_at=null
  where o.id=p_id and o.status='sending' and o.claim_token=p_claim_token
    and o.leased_at>now()-interval '5 minutes';
  get diagnostics affected=row_count;
  return affected=1;
end $$;

revoke all on function public.cms_claim_notification_outbox(integer),
 public.cms_prepare_notification(bigint,uuid,jsonb),
 public.cms_finish_notification(bigint,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.cms_claim_notification_outbox(integer),
 public.cms_prepare_notification(bigint,uuid,jsonb),
 public.cms_finish_notification(bigint,uuid,boolean,text) to service_role;
notify pgrst,'reload schema';
commit;
