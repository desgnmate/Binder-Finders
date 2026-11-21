-- Keep Hold records when Stripe payment attempts exist.
-- Prevents deletion from cascading into payment history.
-- No Stripe API calls or automatic refunds.

begin;

create or replace function public.cms_preserve_hold_payment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.payment_attempts
    where hold_id = old.id
  ) then
    raise exception
      'This Hold has Stripe payment history and cannot be deleted. Retain it for reconciliation.';
  end if;

  return old;
end;
$$;

revoke all on function public.cms_preserve_hold_payment_history()
from public, anon, authenticated;

drop trigger if exists hold_preserve_payment_history
on public.hold_requests;

create trigger hold_preserve_payment_history
before delete on public.hold_requests
for each row
execute function public.cms_preserve_hold_payment_history();

commit;