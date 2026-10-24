-- Keep inventory reserved while a Stripe Checkout session can still be paid.
-- An expired or completed session is reconciled by the notification cron before
-- the normal hold-expiry function releases inventory.
begin;

create or replace function public.cms_guard_active_checkout()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status = 'accepted'
    and (
      new.status in ('cancelled','expired','rejected')
      or (new.expires_at is not null and old.expires_at is not null and new.expires_at < old.expires_at)
    )
    and exists (
      select 1 from public.payment_attempts
      where hold_id = old.id and status in ('created','open')
    ) then
    raise exception 'Payment is in progress. Wait for checkout to finish before changing this hold.';
  end if;
  return new;
end $$;

drop trigger if exists guard_active_checkout on public.hold_requests;
create trigger guard_active_checkout
before update of status, expires_at on public.hold_requests
for each row execute function public.cms_guard_active_checkout();

create or replace function public.cms_expire_unpaid_holds(p_limit integer default 50)
returns integer language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; expired_count integer:=0;
begin
  for h in select * from public.hold_requests hr
    where hr.status='accepted' and hr.payment_status not in ('paid','refunded')
      and hr.expires_at is not null and hr.expires_at<=now()
      and not exists (
        select 1 from public.payment_attempts a
        where a.hold_id=hr.id and a.status in ('created','open')
      )
    order by hr.expires_at,hr.id limit greatest(1,least(coalesce(p_limit,50),200)) for update of hr skip locked
  loop
    update public.cards set availability='available',reserved_by=null,updated_at=clock_timestamp() where reserved_by=h.id;
    update public.hold_requests set status='expired',expires_at=null,fulfillment_status='cancelled',updated_at=clock_timestamp() where id=h.id;
    expired_count:=expired_count+1;
  end loop;
  return expired_count;
end $$;

create or replace function public.cms_due_stripe_attempts(p_limit integer default 20)
returns table(attempt_id uuid, session_id text, attempt_status text)
language sql security definer set search_path='' as $$
  select a.id, a.checkout_session_id, a.status
  from public.payment_attempts a
  join public.hold_requests h on h.id=a.hold_id
  where h.status='accepted' and h.expires_at is not null and h.expires_at<=now()
    and a.status in ('created','open')
  order by h.expires_at,a.created_at
  limit greatest(1,least(coalesce(p_limit,20),100))
$$;

revoke all on function public.cms_guard_active_checkout(),
  public.cms_expire_unpaid_holds(integer),public.cms_due_stripe_attempts(integer)
from public,anon,authenticated;
grant execute on function public.cms_expire_unpaid_holds(integer),
  public.cms_due_stripe_attempts(integer) to service_role;
notify pgrst,'reload schema';
commit;
