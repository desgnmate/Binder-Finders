-- Give the Guest Stripe reconciler the complete authoritative payload needed
-- to replay an ambiguous Checkout creation using the original idempotency key
-- and exactly the same Stripe Checkout parameters.
begin;

drop function if exists public.cms_due_guest_stripe_attempts(integer);

create function public.cms_due_guest_stripe_attempts(
  p_limit integer default 20
)
returns table(
  attempt_id uuid,
  order_id uuid,
  session_id text,
  attempt_status text,
  idempotency_key uuid,
  amount_cents bigint,
  customer_email text,
  currency text,
  items jsonb,
  shipping_fee_cents bigint,
  expires_at timestamptz
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
      and (
        (
          a.status = 'created'
          and a.checkout_session_id is null
          and o.expires_at <= now() + interval '40 minutes'
        )
        or
        (
          a.status in ('created','open')
          and o.expires_at <= now()
        )
      )
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
      a.idempotency_key,
      a.amount_cents
  )
  select
    s.id,
    s.order_id,
    s.checkout_session_id,
    s.status,
    s.idempotency_key,
    s.amount_cents,
    o.email,
    lower(o.currency),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name',i.name,
            'priceCents',i.price_cents
          )
          order by i.card_id
        )
        from public.guest_order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    ),
    o.shipping_fee_cents,
    o.expires_at
  from stamped s
  join public.guest_orders o
    on o.id = s.order_id;
end
$$;

revoke all on function
  public.cms_due_guest_stripe_attempts(integer)
from public,anon,authenticated;

grant execute on function
  public.cms_due_guest_stripe_attempts(integer)
to service_role;

notify pgrst,'reload schema';
commit;


