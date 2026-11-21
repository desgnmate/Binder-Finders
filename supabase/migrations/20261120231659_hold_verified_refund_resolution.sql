-- Record a full Stripe refund verified by a trusted server action.
-- This function does NOT contact Stripe or issue a refund.
begin;

alter table public.hold_requests
  add column stripe_payment_review_resolved_at timestamptz,
  add column stripe_payment_review_refund_ids text[],
  add column stripe_payment_review_refunded_cents bigint,
  add column stripe_payment_review_verified_by uuid;

alter table public.hold_requests
  add constraint hold_verified_refund_resolution_consistent
  check (
    (
      stripe_payment_review_resolved_at is null
      and stripe_payment_review_refund_ids is null
      and stripe_payment_review_refunded_cents is null
      and stripe_payment_review_verified_by is null
    )
    or
    (
      stripe_payment_review_resolved_at is not null
      and stripe_payment_review_required = true
      and payment_status = 'refunded'
      and cardinality(stripe_payment_review_refund_ids) > 0
      and stripe_payment_review_refunded_cents > 0
      and stripe_payment_review_verified_by is not null
    )
  );

create or replace function public.cms_record_verified_hold_refund(
  p_hold_id uuid,
  p_payment_intent_id text,
  p_refund_ids text[],
  p_amount_cents bigint,
  p_verified_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.hold_requests;
  paid_count integer;
  expected_amount bigint;
begin
  select * into h
  from public.hold_requests
  where id = p_hold_id
  for update;

  if not found then
    raise exception 'Hold not found';
  end if;

  if h.status not in ('expired', 'cancelled', 'rejected')
     or h.stripe_payment_review_required is not true
     or h.payment_status <> 'paid'
     or h.stripe_payment_review_resolved_at is not null
  then
    raise exception 'Hold is not eligible for late-payment refund resolution';
  end if;

  if h.stripe_payment_intent_id is distinct from p_payment_intent_id
     or p_payment_intent_id is null
  then
    raise exception 'PaymentIntent does not match Hold';
  end if;

  if p_refund_ids is null
     or cardinality(p_refund_ids) = 0
     or exists (
       select 1 from unnest(p_refund_ids) as rid
       where rid is null or length(trim(rid)) = 0
     )
     or (
       select count(distinct rid)
       from unnest(p_refund_ids) as rid
     ) <> cardinality(p_refund_ids)
  then
    raise exception 'Invalid refund references';
  end if;

  select count(*)::integer, max(amount_cents)
  into paid_count, expected_amount
  from public.payment_attempts
  where hold_id = p_hold_id
    and status = 'paid'
    and payment_intent_id = p_payment_intent_id;

  if paid_count <> 1
     or p_amount_cents is distinct from expected_amount
  then
    raise exception 'Verified refund amount does not match payment history';
  end if;

  if not exists (
    select 1 from public.admin_users
    where user_id = p_verified_by
  ) then
    raise exception 'Administrator identity is invalid';
  end if;

  update public.hold_requests
  set
    payment_status = 'refunded',
    stripe_payment_review_resolved_at = clock_timestamp(),
    stripe_payment_review_refund_ids = p_refund_ids,
    stripe_payment_review_refunded_cents = p_amount_cents,
    stripe_payment_review_verified_by = p_verified_by,
    updated_at = clock_timestamp()
  where id = p_hold_id;
end;
$$;

revoke all on function public.cms_record_verified_hold_refund(
  uuid, text, text[], bigint, uuid
) from public, anon, authenticated;

grant execute on function public.cms_record_verified_hold_refund(
  uuid, text, text[], bigint, uuid
) to service_role;

commit;