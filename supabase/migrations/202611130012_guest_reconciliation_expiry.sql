-- Guest Checkout reconciliation and safe reservation expiry foundation.
-- Reconciliation must run before expiry. Active Stripe attempts always block
-- inventory release, including created attempts without an attached session.
begin;

create or replace function public.cms_due_guest_stripe_attempts(
  p_limit integer default 20
)
returns table(
  attempt_id uuid,
  order_id uuid,
  session_id text,
  attempt_status text,
  idempotency_key uuid
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
      and o.expires_at <= now()
      and a.status in ('created','open')
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
      a.idempotency_key
  )
  select
    s.id,
    s.order_id,
    s.checkout_session_id,
    s.status,
    s.idempotency_key
  from stamped s;
end
$$;

create or replace function public.cms_expire_unpaid_guest_orders(
  p_limit integer default 50
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.guest_orders;
  expired_count integer := 0;
  reserved_count integer;
  item_count integer;
begin
  for o in
    select go.*
    from public.guest_orders go
    where go.status in ('reserved','checkout_open','review')
      and go.expires_at is not null
      and go.expires_at <= now()
      and not exists (
        select 1
        from public.guest_payment_attempts a
        where a.order_id = go.id
          and a.status in ('created','open')
      )
    order by go.expires_at,go.id
    limit greatest(1,least(coalesce(p_limit,50),200))
    for update of go skip locked
  loop
    -- Re-check after locking the order. Payment creation also locks the order
    -- first, so a newly-active attempt can never be released underneath.
    if exists (
      select 1
      from public.guest_payment_attempts a
      where a.order_id = o.id
        and a.status in ('created','open')
    ) then
      continue;
    end if;

    -- Lock this order's inventory deterministically.
    perform c.id
    from public.cards c
    where c.guest_reserved_by = o.id
    order by c.id
    for update;

    select count(*)
    into reserved_count
    from public.cards c
    where c.guest_reserved_by = o.id
      and c.availability = 'reserved';

    select count(*)
    into item_count
    from public.guest_order_items i
    where i.order_id = o.id;

    if reserved_count <> item_count then
      raise exception 'Guest order reservation conflict';
    end if;

    -- The card protection trigger permits release only after the owning
    -- Guest order has entered a terminal expired/cancelled state.
    update public.guest_orders
    set
      status = 'expired',
      updated_at = clock_timestamp()
    where id = o.id
      and status in ('reserved','checkout_open','review');

    update public.cards
    set
      availability = 'available',
      guest_reserved_by = null,
      updated_at = clock_timestamp()
    where guest_reserved_by = o.id;

    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end
$$;

revoke all on function
  public.cms_due_guest_stripe_attempts(integer),
  public.cms_expire_unpaid_guest_orders(integer)
from public,anon,authenticated;

grant execute on function
  public.cms_due_guest_stripe_attempts(integer),
  public.cms_expire_unpaid_guest_orders(integer)
to service_role;

notify pgrst,'reload schema';
commit;
