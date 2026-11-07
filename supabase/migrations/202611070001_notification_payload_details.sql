-- Give order emails what the branded templates show: the hold id for links to
-- the order and the store manager, the payment deadline, when it was paid, and
-- each card's set and number. Rows queued before this keep their old payload;
-- the templates fall back gracefully when these fields are missing.
begin;

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
    'cardId',i.card_id,'name',i.name,'priceCents',i.price_cents,
    'set',c.data->>'set','number',c.data->>'number'
  ) order by i.card_id),'[]'::jsonb), coalesce(sum(i.price_cents),0)
  into items,total_cents
  from public.hold_request_items i left join public.cards c on c.id=i.card_id
  where i.request_id=h.id;
  insert into public.notification_outbox(hold_id,kind,to_email,event_key,payload)
  values(h.id,p_kind,lower(trim(p_to_email)),txid_current()::text,jsonb_build_object(
    'holdId',h.id,
    'reference',upper(left(replace(h.id::text,'-',''),8)),
    'name',h.name,'email',h.email,'status',h.status,'currency',h.currency,
    'totalCents',total_cents,'paymentStatus',h.payment_status,
    'fulfillmentStatus',h.fulfillment_status,'paymentReference',h.payment_reference,
    'fulfillmentNote',h.fulfillment_note,'items',items,'note',h.note,'createdAt',h.created_at,
    'expiresAt',h.expires_at,'paidAt',h.paid_at
  )) on conflict(hold_id,kind,to_email,event_key) where event_key is not null do nothing;
end $$;

revoke all on function public.cms_queue_hold_notification(uuid,text,text) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
