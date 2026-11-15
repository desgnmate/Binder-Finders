-- Guest Checkout settings: safe defaults and owner-only configuration.
-- This migration does not enable guest checkout or modify existing orders.
begin;

create or replace function public.cms_save_settings(
  p_settings jsonb,
  p_expected timestamptz
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  existing public.store_settings;
  duration_hours integer;
  guest_enabled boolean;
  shipping_fee bigint;
  next_settings jsonb;
begin
  if not public.cms_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'Invalid store settings';
  end if;

  select * into existing from public.store_settings where id for update;
  if not found then raise exception 'Store settings not found'; end if;

  if existing.updated_at is distinct from p_expected then
    raise exception 'Settings changed. Reload before saving.';
  end if;

  duration_hours := coalesce((p_settings->>'holdDurationHours')::integer,48);
  if duration_hours not between 1 and 720 then
    raise exception 'Hold duration must be between 1 and 720 hours';
  end if;

  if p_settings ? 'guestCheckoutEnabled'
    and jsonb_typeof(p_settings->'guestCheckoutEnabled') <> 'boolean' then
    raise exception 'Invalid guest checkout setting';
  end if;
  guest_enabled := coalesce((p_settings->>'guestCheckoutEnabled')::boolean,false);

  if p_settings ? 'shippingFeeCents'
    and jsonb_typeof(p_settings->'shippingFeeCents') not in ('number','null') then
    raise exception 'Invalid shipping fee';
  end if;

  if p_settings->>'shippingFeeCents' is not null then
    if (p_settings->>'shippingFeeCents')::numeric < 0
      or (p_settings->>'shippingFeeCents')::numeric > 1000000000
      or trunc((p_settings->>'shippingFeeCents')::numeric) <>
         (p_settings->>'shippingFeeCents')::numeric then
      raise exception 'Invalid shipping fee';
    end if;
    shipping_fee := (p_settings->>'shippingFeeCents')::bigint;
  else
    shipping_fee := null;
  end if;

  if not public.cms_is_owner() and (
    existing.data->'currency' is distinct from p_settings->'currency'
    or existing.data->'holdsEnabled' is distinct from p_settings->'holdsEnabled'
    or coalesce(existing.data->>'holdDurationHours','48') is distinct from duration_hours::text
    or coalesce((existing.data->>'guestCheckoutEnabled')::boolean,false) is distinct from guest_enabled
    or (existing.data->>'shippingFeeCents')::numeric is distinct from shipping_fee::numeric
  ) then
    raise exception 'Only an owner can change store settings';
  end if;

  if (coalesce((p_settings->>'holdsEnabled')::boolean,false) or guest_enabled)
    and p_settings->>'currency' not in
      ('AUD','USD','PHP','GBP','EUR','CAD','NZD','JPY') then
    raise exception 'Choose a currency';
  end if;

  next_settings := jsonb_set(
    jsonb_set(
      jsonb_set(
        p_settings,
        '{holdDurationHours}',to_jsonb(duration_hours),true
      ),
      '{guestCheckoutEnabled}',to_jsonb(guest_enabled),true
    ),
    '{shippingFeeCents}',coalesce(to_jsonb(shipping_fee),'null'::jsonb),true
  );

  update public.store_settings
  set data=next_settings,updated_at=clock_timestamp()
  where id;
end $$;

revoke all on function public.cms_save_settings(jsonb,timestamptz)
from public,anon,authenticated;
grant execute on function public.cms_save_settings(jsonb,timestamptz)
to authenticated;

notify pgrst,'reload schema';
commit;
