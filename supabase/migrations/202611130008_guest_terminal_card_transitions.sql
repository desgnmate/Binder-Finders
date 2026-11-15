-- Allow only authorized terminal Guest Checkout inventory transitions.
-- Active reservations remain protected. A reserved card may be released only
-- after its owning Guest order has already entered the matching terminal state.
begin;

create or replace function public.cms_guard_guest_reserved_card()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_status text;
begin
  if old.guest_reserved_by is not null then
    if new.price_cents is distinct from old.price_cents
      or new.publication is distinct from old.publication
      or new.availability is distinct from old.availability
      or new.reserved_by is distinct from old.reserved_by
      or new.guest_reserved_by is distinct from old.guest_reserved_by
    then
      select status into v_order_status
      from public.guest_orders
      where id = old.guest_reserved_by;

      -- A terminal workflow may only release ownership while preserving
      -- price, publication and Hold ownership.
      if new.price_cents is not distinct from old.price_cents
        and new.publication is not distinct from old.publication
        and new.reserved_by is not distinct from old.reserved_by
        and new.guest_reserved_by is null
        and (
          (v_order_status = 'paid' and new.availability = 'sold')
          or
          (v_order_status in ('expired','cancelled') and new.availability = 'available')
        )
      then
        return new;
      end if;

      raise exception
        'This card has an active Guest Checkout reservation. Complete the authorized payment or release workflow first.';
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.cms_guard_guest_reserved_card()
from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
