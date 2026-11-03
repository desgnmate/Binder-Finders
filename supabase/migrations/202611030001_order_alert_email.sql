-- Send "new hold request" alerts to one store inbox chosen by an owner, rather
-- than to every administrator login. The address lives outside store_settings
-- because that table is readable by storefront visitors.
begin;

create table if not exists public.store_private_settings (
  id boolean primary key default true check (id),
  order_alert_email text check (
    order_alert_email is null
    or (length(order_alert_email) <= 200 and order_alert_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  updated_at timestamptz not null default now()
);
alter table public.store_private_settings enable row level security;
revoke all on public.store_private_settings from public, anon, authenticated;
grant all on public.store_private_settings to service_role;
drop trigger if exists private_settings_audit on public.store_private_settings;
create trigger private_settings_audit after insert or update on public.store_private_settings
for each row execute function public.cms_audit();

insert into public.store_private_settings(id, order_alert_email)
values (true, 'binderfinders@gmail.com')
on conflict (id) do nothing;

create or replace function public.cms_get_order_alert_email()
returns text language plpgsql stable security definer set search_path='' as $$
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  return (select order_alert_email from public.store_private_settings where id);
end $$;

create or replace function public.cms_set_order_alert_email(p_email text)
returns void language plpgsql security definer set search_path='' as $$
declare next_email text := nullif(lower(trim(p_email)), '');
begin
  if not public.cms_is_owner() then raise exception 'Only an owner can change where order alerts go'; end if;
  if next_email is not null and (length(next_email) > 200 or next_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Enter a valid email address for order alerts';
  end if;
  insert into public.store_private_settings(id, order_alert_email, updated_at)
  values (true, next_email, clock_timestamp())
  on conflict (id) do update set order_alert_email = excluded.order_alert_email, updated_at = excluded.updated_at;
end $$;

create or replace function public.cms_hold_notifications_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare admin_email text; alert_email text;
begin
  if tg_op='INSERT' then
    perform public.cms_queue_hold_notification(new.id,'customer_request_received',new.email);
    select order_alert_email into alert_email from public.store_private_settings where id;
    if alert_email is not null then
      perform public.cms_queue_hold_notification(new.id,'staff_request_received',alert_email);
    else
      -- No store inbox chosen yet: fall back to every active administrator.
      for admin_email in select email from public.admin_users where active loop
        perform public.cms_queue_hold_notification(new.id,'staff_request_received',admin_email);
      end loop;
    end if;
  elsif row(old.status,old.fulfillment_status,old.fulfillment_note)
      is distinct from row(new.status,new.fulfillment_status,new.fulfillment_note)
    -- Starting or abandoning Checkout is not news to the customer; a payment
    -- landing or being refunded is.
    or (old.payment_status is distinct from new.payment_status
      and new.payment_status in ('paid','refunded')) then
    perform public.cms_queue_hold_notification(new.id,'customer_status_changed',new.email);
  end if;
  return new;
end $$;

revoke all on function public.cms_get_order_alert_email(),
  public.cms_set_order_alert_email(text),
  public.cms_hold_notifications_trigger()
from public, anon, authenticated;
grant execute on function public.cms_get_order_alert_email(),
  public.cms_set_order_alert_email(text) to authenticated;
notify pgrst, 'reload schema';
commit;
