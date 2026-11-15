-- Guest Checkout Stripe payment attempt foundation.
-- Separate from Hold payment_attempts and Hold webhook processing.
-- No Stripe API calls, webhook transitions, or inventory release are performed here.
begin;

create table public.guest_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.guest_orders(id) on delete restrict,
  provider text not null default 'stripe'
    check(provider = 'stripe'),
  idempotency_key uuid not null unique,
  checkout_session_id text unique,
  payment_intent_id text,
  amount_cents bigint not null
    check(amount_cents > 0),
  currency text not null
    check(currency = lower(currency) and length(currency) = 3),
  status text not null default 'created'
    check(status in ('created','open','paid','failed','expired')),
  failure_reason text,
  reconcile_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guest_payment_attempts_order_idx
  on public.guest_payment_attempts(order_id,created_at desc);

create unique index guest_payment_attempts_active_order_idx
  on public.guest_payment_attempts(order_id)
  where status in ('created','open');

create table public.guest_stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  attempt_id uuid
    references public.guest_payment_attempts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.guest_payment_attempts enable row level security;
alter table public.guest_stripe_webhook_events enable row level security;

revoke all on
  public.guest_payment_attempts,
  public.guest_stripe_webhook_events
from public,anon,authenticated;

grant select,insert,update,delete on
  public.guest_payment_attempts,
  public.guest_stripe_webhook_events
to service_role;

notify pgrst,'reload schema';
commit;
