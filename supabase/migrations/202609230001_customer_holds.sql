-- Phase 2 customer holds. Additive and backward-compatible with the
-- service-only two-argument hold RPC used by older deployments.
begin;

alter table public.hold_requests
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists hold_requests_customer_created_idx
  on public.hold_requests(customer_user_id, created_at desc);

grant select on public.hold_requests, public.hold_request_items to authenticated;

drop policy if exists customer_hold_read on public.hold_requests;
create policy customer_hold_read on public.hold_requests
  for select to authenticated
  using (customer_user_id = (select auth.uid()));

drop policy if exists customer_hold_items_read on public.hold_request_items;
create policy customer_hold_items_read on public.hold_request_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.hold_requests h
      where h.id = request_id
        and h.customer_user_id = (select auth.uid())
    )
  );

-- New authenticated submission path. The old two-argument service RPC remains
-- available until every deployment has moved to this function signature.
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
    request_key, customer_user_id, name, email, note, currency
  ) values (
    (p_request->>'requestKey')::uuid,
    p_customer_user_id,
    p_request->>'name',
    lower(p_request->>'email'),
    coalesce(p_request->>'note', ''),
    settings->>'currency'
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

notify pgrst, 'reload schema';
commit;
