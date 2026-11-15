-- Client feedback, November 2026:
--   * the store can delete hold requests it no longer needs (spam, tests,
--     declined or cancelled requests that never took a payment);
--   * a hold records where the cards are going, so the admin can see the
--     customer's delivery address.
begin;

alter table public.hold_requests
  add column if not exists delivery jsonb;

create or replace function public.cms_submit_hold(
  p_request jsonb,
  p_ip_hash text,
  p_customer_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  result uuid;
  c public.cards;
  settings jsonb;
  ids text[];
  k text;
  attempts_now integer;
  d jsonb := p_request->'delivery';
  v_delivery jsonb;
begin
  if p_customer_user_id is null or not exists (
    select 1
    from auth.users
    where id = p_customer_user_id
      and email_confirmed_at is not null
  ) then
    raise exception 'Verified customer account required';
  end if;

  select id into result
  from public.hold_requests
  where request_key = (p_request->>'requestKey')::uuid;

  if found then
    if not exists (
      select 1
      from public.hold_requests
      where id = result
        and customer_user_id = p_customer_user_id
        and email = lower(p_request->>'email')
    ) then
      raise exception 'Invalid request';
    end if;
    return result;
  end if;

  select data into settings from public.store_settings where id;
  if not coalesce((settings->>'holdsEnabled')::boolean, false) then
    raise exception 'Hold requests are currently unavailable. Please contact the store.';
  end if;
  if length(coalesce(p_request->>'name', '')) not between 1 and 120
    or length(coalesce(p_request->>'email', '')) not between 3 and 200
    or length(coalesce(p_request->>'note', '')) > 2000 then
    raise exception 'Invalid contact details';
  end if;

  -- Where the cards go. Older clients send no delivery details; those holds
  -- keep a null address and the delivery choice in the customer's note.
  if d is not null and jsonb_typeof(d) = 'object' then
    if d->>'method' = 'pickup' then
      v_delivery := jsonb_build_object('method', 'pickup', 'phone', left(btrim(coalesce(d->>'phone', '')), 40));
    elsif d->>'method' = 'post' then
      v_delivery := jsonb_build_object(
        'method', 'post',
        'recipient', btrim(coalesce(d->>'recipient', '')),
        'phone', btrim(coalesce(d->>'phone', '')),
        'line1', btrim(coalesce(d->>'line1', '')),
        'line2', btrim(coalesce(d->>'line2', '')),
        'suburb', btrim(coalesce(d->>'suburb', '')),
        'state', upper(btrim(coalesce(d->>'state', ''))),
        'postcode', btrim(coalesce(d->>'postcode', '')),
        'country', 'Australia'
      );
      if length(v_delivery->>'recipient') not between 1 and 120
        or length(v_delivery->>'phone') > 40
        or length(v_delivery->>'line1') not between 1 and 200
        or length(v_delivery->>'line2') > 200
        or length(v_delivery->>'suburb') not between 1 and 100
        or v_delivery->>'state' not in ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA')
        or v_delivery->>'postcode' !~ '^[0-9]{4}$' then
        raise exception 'Check your delivery address';
      end if;
    else
      raise exception 'Choose post or pickup';
    end if;
  end if;

  select array_agg(distinct value order by value)
  into ids
  from jsonb_array_elements_text(p_request->'cardIds');
  if coalesce(array_length(ids, 1), 0) not between 1 and 30 then
    raise exception 'Select between 1 and 30 cards';
  end if;

  foreach k in array array['ip:' || p_ip_hash, 'email:' || lower(p_request->>'email')] loop
    insert into public.hold_rate_limits(key, started_at, attempts)
    values (k, now(), 1)
    on conflict (key) do update set
      attempts = case
        when public.hold_rate_limits.started_at < now() - interval '15 minutes' then 1
        else public.hold_rate_limits.attempts + 1
      end,
      started_at = case
        when public.hold_rate_limits.started_at < now() - interval '15 minutes' then now()
        else public.hold_rate_limits.started_at
      end
    returning attempts into attempts_now;
    if attempts_now > 5 then
      raise exception 'Too many requests. Please try again later.';
    end if;
  end loop;

  perform id from public.cards where id = any(ids) order by id for update;
  if (
    select count(*)
    from public.cards
    where id = any(ids)
      and publication = 'published'
      and availability = 'available'
  ) <> array_length(ids, 1) then
    raise exception 'A selected card is no longer available. Please refresh your bag.';
  end if;

  for c in select * from public.cards where id = any(ids) loop
    if coalesce((p_request->'prices'->>c.id)::bigint, -1) <> c.price_cents then
      raise exception 'A card price changed. Refresh your bag and review the new total.';
    end if;
  end loop;

  insert into public.hold_requests(
    request_key, customer_user_id, name, email, note, currency, delivery
  ) values (
    (p_request->>'requestKey')::uuid,
    p_customer_user_id,
    p_request->>'name',
    lower(p_request->>'email'),
    coalesce(p_request->>'note', ''),
    settings->>'currency',
    v_delivery
  ) returning id into result;

  insert into public.hold_request_items(request_id, card_id, name, price_cents)
    select result, id, data->>'name', price_cents
    from public.cards
    where id = any(ids);

  return result;
end
$$;
revoke all on function public.cms_submit_hold(jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.cms_submit_hold(jsonb, text, uuid)
  to service_role;

-- Deleting removes the request, its cards list, history, queued emails and
-- payment attempts. Sales records stay: accepted and completed holds, and any
-- hold that took (or is taking) a payment, cannot be deleted.
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

  insert into public.audit_log(table_name, record_id, actor_id, old_data, new_data)
  values ('hold_requests', p_id::text, auth.uid(), to_jsonb(h), null);
  update public.cards set reserved_by = null where reserved_by = p_id;
  delete from public.hold_request_items where request_id = p_id;
  delete from public.hold_requests where id = p_id;
end
$$;
revoke all on function public.cms_delete_hold(uuid) from public, anon, authenticated;
grant execute on function public.cms_delete_hold(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
