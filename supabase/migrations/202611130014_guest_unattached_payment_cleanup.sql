-- Close a Guest Stripe attempt only when a Checkout session was created by
-- the server but was never attached, and Stripe has been independently
-- confirmed unusable (for example, successfully expired).
--
-- This function never releases inventory. Reservation release remains the
-- responsibility of the reconciliation/expiry workflow.
begin;

create or replace function public.cms_close_unattached_guest_stripe_attempt(
  p_attempt_id uuid,
  p_status text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  o public.guest_orders;
  a public.guest_payment_attempts;
begin
  if p_attempt_id is null then
    raise exception 'Invalid payment attempt';
  end if;

  if p_status not in ('failed','expired') then
    raise exception 'Invalid payment attempt status';
  end if;

  -- Read ownership first, then follow the common Guest lock order:
  -- guest order -> payment attempt.
  select order_id
  into v_order_id
  from public.guest_payment_attempts
  where id = p_attempt_id;

  if not found then
    return false;
  end if;

  select *
  into o
  from public.guest_orders
  where id = v_order_id
  for update;

  if not found then
    return false;
  end if;

  select *
  into a
  from public.guest_payment_attempts
  where id = p_attempt_id
    and order_id = o.id
  for update;

  if not found then
    return false;
  end if;

  -- A concurrent attach or terminal transition wins. Never overwrite it.
  if a.status <> 'created'
    or a.checkout_session_id is not null then
    return false;
  end if;

  update public.guest_payment_attempts
  set
    status = p_status,
    failure_reason = left(
      coalesce(p_reason,'Checkout session could not be attached'),
      1000
    ),
    updated_at = clock_timestamp()
  where id = a.id
    and status = 'created'
    and checkout_session_id is null;

  return found;
end
$$;

revoke all on function
  public.cms_close_unattached_guest_stripe_attempt(uuid,text,text)
from public,anon,authenticated;

grant execute on function
  public.cms_close_unattached_guest_stripe_attempt(uuid,text,text)
to service_role;

notify pgrst,'reload schema';
commit;
