begin;

create table public.guest_checkout_rate_limits (
  request_key uuid primary key,
  ip_hash text not null,
  email_hash text not null,
  created_at timestamptz not null default clock_timestamp(),

  constraint guest_checkout_rate_limits_ip_hash_check
    check(length(ip_hash) between 32 and 128),

  constraint guest_checkout_rate_limits_email_hash_check
    check(length(email_hash) between 32 and 128)
);

create index guest_checkout_rate_limits_ip_created_idx
  on public.guest_checkout_rate_limits(ip_hash, created_at desc);

create index guest_checkout_rate_limits_email_hash_created_idx
  on public.guest_checkout_rate_limits(email_hash, created_at desc);

create index guest_checkout_rate_limits_created_idx
  on public.guest_checkout_rate_limits(created_at);

alter table public.guest_checkout_rate_limits enable row level security;

revoke all on public.guest_checkout_rate_limits
from public, anon, authenticated;

grant select, insert, delete on public.guest_checkout_rate_limits
to service_role;

create function public.cms_check_guest_checkout_rate_limit(
  p_request_key uuid,
  p_ip_hash text,
  p_email_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip_hash text := btrim(coalesce(p_ip_hash, ''));
  v_email_hash text := btrim(coalesce(p_email_hash, ''));
  v_ip_count integer;
  v_email_count integer;
  v_inserted boolean := false;
begin
  if p_request_key is null
    or length(v_ip_hash) not between 32 and 128
    or length(v_email_hash) not between 32 and 128 then
    raise exception 'Invalid Guest Checkout rate-limit request';
  end if;

  -- Rate-limit identities are short-lived anti-abuse data. Keep only a
  -- bounded retention window beyond the 15-minute enforcement period.
  delete from public.guest_checkout_rate_limits
  where created_at < clock_timestamp() - interval '24 hours';

  -- Exact retries with the same request key are idempotent and do not
  -- consume additional rate-limit capacity.
  if exists (
    select 1
    from public.guest_checkout_rate_limits
    where request_key = p_request_key
      and ip_hash = v_ip_hash
      and email_hash = v_email_hash
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.guest_checkout_rate_limits
    where request_key = p_request_key
  ) then
    raise exception 'Guest Checkout request key was already used';
  end if;

  -- Serialize checks for the same IP/email buckets.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('guest-rate-ip:' || v_ip_hash, 0)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('guest-rate-email:' || v_email_hash, 0)
  );

  select count(*)
  into v_ip_count
  from public.guest_checkout_rate_limits
  where ip_hash = v_ip_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_ip_count >= 8 then
    return false;
  end if;

  select count(*)
  into v_email_count
  from public.guest_checkout_rate_limits
  where email_hash = v_email_hash
    and created_at > clock_timestamp() - interval '15 minutes';

  if v_email_count >= 4 then
    return false;
  end if;

  insert into public.guest_checkout_rate_limits(
    request_key,
    ip_hash,
    email_hash
  )
  values(
    p_request_key,
    v_ip_hash,
    v_email_hash
  )
  on conflict(request_key) do nothing
  returning true
  into v_inserted;

  if coalesce(v_inserted, false) then
    return true;
  end if;

  -- Another transaction may have claimed this request key after our
  -- initial checks. Only allow the retry when it belongs to the same
  -- IP/email identity; otherwise fail closed.
  if exists (
    select 1
    from public.guest_checkout_rate_limits
    where request_key = p_request_key
      and ip_hash = v_ip_hash
      and email_hash = v_email_hash
  ) then
    return true;
  end if;

  raise exception 'Guest Checkout request key was already used';
end
$$;

revoke all on function public.cms_check_guest_checkout_rate_limit(
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.cms_check_guest_checkout_rate_limit(
  uuid,
  text,
  text
)
to service_role;

notify pgrst, 'reload schema';

commit;

