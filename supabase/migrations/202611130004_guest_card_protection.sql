-- Protect active Guest Checkout card reservations.
-- Future payment and release transitions require a separately
-- reviewed, authorized database workflow.
begin;

create function public.cms_guard_guest_reserved_card()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.guest_reserved_by is not null then
    if new.price_cents is distinct from old.price_cents
      or new.publication is distinct from old.publication
      or new.availability is distinct from old.availability
      or new.reserved_by is distinct from old.reserved_by
      or new.guest_reserved_by is distinct from old.guest_reserved_by
    then
      raise exception
        'This card has an active Guest Checkout reservation. Complete the authorized payment or release workflow first.';
    end if;
  end if;

  return new;
end
$$;

create trigger guard_guest_reserved_card
before update of
  price_cents,
  publication,
  availability,
  reserved_by,
  guest_reserved_by
on public.cards
for each row
execute function public.cms_guard_guest_reserved_card();

revoke all on function public.cms_guard_guest_reserved_card()
from public,anon,authenticated;

notify pgrst,'reload schema';
commit;