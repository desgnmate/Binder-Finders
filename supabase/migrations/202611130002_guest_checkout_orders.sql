begin;

-- Guest orders are separate from customer Hold requests.
create table public.guest_orders (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  name text not null check(length(name) between 1 and 120),
  email text not null check(length(email) between 3 and 254),
  fulfillment_method text not null check(fulfillment_method in ('pickup','shipping')),
  shipping_address jsonb,
  currency text not null check(currency in ('AUD','USD','PHP','GBP','EUR','CAD','NZD','JPY')),
  subtotal_cents bigint not null check(subtotal_cents >= 0),
  shipping_fee_cents bigint not null check(shipping_fee_cents >= 0),
  total_cents bigint not null check(total_cents = subtotal_cents + shipping_fee_cents),
  status text not null default 'reserved'
    check(status in ('reserved','checkout_open','paid','expired','cancelled','review')),
  stripe_session_id text unique,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_order_items (
  order_id uuid not null references public.guest_orders(id) on delete restrict,
  card_id text not null references public.cards(id) on delete restrict,
  name text not null,
  price_cents bigint not null check(price_cents >= 0),
  primary key(order_id,card_id)
);

-- Keep the original Hold reservation reference unchanged.
alter table public.cards
  add column guest_reserved_by uuid
  references public.guest_orders(id) on delete restrict;

-- A card cannot belong to a Hold and Guest order simultaneously.
alter table public.cards
  add constraint cards_one_reservation_owner
  check(not (reserved_by is not null and guest_reserved_by is not null));

alter table public.cards
  add constraint cards_guest_reservation_state
  check(guest_reserved_by is null or availability = 'reserved');

create index cards_guest_reserved_idx
  on public.cards(guest_reserved_by)
  where guest_reserved_by is not null;

create index guest_orders_status_expiry_idx
  on public.guest_orders(status,expires_at);

-- Guest personal information is never exposed to public roles.
alter table public.guest_orders enable row level security;
alter table public.guest_order_items enable row level security;

revoke all on public.guest_orders,public.guest_order_items
  from public,anon,authenticated;

grant select,insert,update,delete
  on public.guest_orders,public.guest_order_items
  to service_role;

notify pgrst,'reload schema';
commit;