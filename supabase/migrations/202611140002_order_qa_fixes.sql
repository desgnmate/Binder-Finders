-- Order QA fixes, November 2026:
--   * deleting a request waits until its queued emails have been sent, so a
--     customer is never left without the decline or cancellation notice;
--   * the history note for an extended deadline uses Melbourne time, the same
--     time zone every page and email shows, instead of UTC;
--   * status emails say what changed: a hold cancelled after a refund gets the
--     cancellation email (not a second refund email), and editing the
--     fulfilment note on an unpaid hold no longer re-sends "cards reserved".
begin;

create or replace function public.cms_delete_hold(p_id uuid) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.hold_requests;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into h from public.hold_requests where id = p_id for update;
  if not found then raise exception 'Request not found. Refresh the list.'; end if;
  if h.status = 'accepted' then
    raise exception 'This hold is active. Cancel it before deleting it';
  end if;
  if h.status = 'completed' then
    raise exception 'Completed sales are kept for your records';
  end if;
  if coalesce(h.payment_status, 'unpaid') in ('pending', 'paid', 'refunded') then
    raise exception 'Requests with a payment are kept for your records';
  end if;
  if exists (
    select 1 from public.payment_attempts
    where hold_id = p_id and status in ('created', 'open')
  ) then
    raise exception 'A payment is in progress for this request';
  end if;

  -- Deleting would also drop the customer's queued status email (e.g. the
  -- "we couldn't hold these cards" notice), so wait until it has gone out.
  if exists (
    select 1 from public.notification_outbox
    where hold_id = p_id
      and (status in ('pending', 'sending') or (status = 'failed' and attempts < 5))
  ) then
    raise exception 'An email about this request is still being sent. Try again in a few minutes';
  end if;

  insert into public.audit_log(table_name, record_id, actor_id, old_data, new_data)
  values ('hold_requests', p_id::text, auth.uid(), to_jsonb(h), null);
  update public.cards set reserved_by = null where reserved_by = p_id;
  delete from public.hold_request_items where request_id = p_id;
  delete from public.hold_requests where id = p_id;
end
$$;
revoke all on function public.cms_delete_hold(uuid) from public, anon, authenticated;
grant execute on function public.cms_delete_hold(uuid) to authenticated;

create or replace function public.cms_set_hold_deadline(p_id uuid, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.hold_requests;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into h from public.hold_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if h.status <> 'accepted' or h.payment_status in ('paid', 'refunded') then
    raise exception 'Only unpaid accepted holds can be extended';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'Choose a deadline between now and 30 days from now';
  end if;
  update public.hold_requests set expires_at = p_expires_at, updated_at = clock_timestamp() where id = p_id;
  insert into public.hold_status_history(hold_id, from_status, to_status, actor_id, actor_kind, note)
  values (
    p_id, h.status, h.status, auth.uid(), 'admin',
    'Deadline extended to ' || trim(to_char(p_expires_at at time zone 'Australia/Melbourne', 'FMDD Mon YYYY, FMHH12:MI AM')) || ' Melbourne time'
  );
end
$$;
revoke all on function public.cms_set_hold_deadline(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.cms_set_hold_deadline(uuid, timestamptz) to authenticated;

create or replace function public.cms_hold_notifications_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare admin_email text; alert_email text;
begin
  -- Same as 202611030001_order_alert_email.sql for new requests.
  if tg_op = 'INSERT' then
    perform public.cms_queue_hold_notification(new.id, 'customer_request_received', new.email);
    select order_alert_email into alert_email from public.store_private_settings where id;
    if alert_email is not null then
      perform public.cms_queue_hold_notification(new.id, 'staff_request_received', alert_email);
    else
      -- No store inbox chosen yet: fall back to every active administrator.
      for admin_email in select email from public.admin_users where active loop
        perform public.cms_queue_hold_notification(new.id, 'staff_request_received', admin_email);
      end loop;
    end if;
  elsif row(old.status, old.fulfillment_status) is distinct from row(new.status, new.fulfillment_status)
    -- A new tracking or handover note is news once the customer has paid.
    or (old.fulfillment_note is distinct from new.fulfillment_note and new.payment_status = 'paid')
    -- Starting or abandoning Checkout is not news to the customer; a payment
    -- landing or being refunded is.
    or (old.payment_status is distinct from new.payment_status
      and new.payment_status in ('paid', 'refunded')) then
    perform public.cms_queue_hold_notification(new.id, 'customer_status_changed', new.email);
    -- Tell the email which change this is, so it can pick the right message.
    update public.notification_outbox
      set payload = payload || jsonb_build_object(
        'statusChanged', old.status is distinct from new.status,
        'refundedNow', old.payment_status is distinct from new.payment_status and new.payment_status = 'refunded'
      )
      where hold_id = new.id
        and kind = 'customer_status_changed'
        and event_key = txid_current()::text
        and status = 'pending';
  end if;
  return new;
end $$;
revoke all on function public.cms_hold_notifications_trigger() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
