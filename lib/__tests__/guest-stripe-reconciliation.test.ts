/** @jest-environment node */

import { reconcileDueGuestStripeAttempts } from "../guest-stripe-reconciliation";

jest.mock("server-only", () => ({}));

const mockRpc = jest.fn();

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      expire: jest.fn(),
    },
  },
};

let mockConfigured = true;

jest.mock("../supabase/server", () => ({
  serviceClient: () => ({
    rpc: mockRpc,
  }),
}));

jest.mock("../stripe", () => ({
  stripeClient: () => mockStripe,
  stripePaymentsConfigured: () => mockConfigured,
}));

jest.mock("../guest-stripe-session", () => ({
  guestStripeIdempotencyKey: (key: string) =>
    `binderfinders-guest-${key}`,
  guestStripeSessionParams: (payment: { orderId: string }) => ({
    mode: "payment",
    client_reference_id: payment.orderId,
  }),
}));

const attempt = {
  attempt_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  session_id: null,
  attempt_status: "created",
  idempotency_key: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  amount_cents: 1500,
  customer_email: "guest@example.com",
  currency: "aud",
  items: [{ name: "Charizard", priceCents: 1500 }],
  shipping_fee_cents: 0,
  shipping_service: null,
  insurance_fee_cents: 0,
  expires_at: "2026-11-13T12:00:00.000Z",
};

beforeEach(() => {
  jest.resetAllMocks();
  mockConfigured = true;

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_due_guest_stripe_attempts") {
      return { data: [attempt], error: null };
    }

    return { data: true, error: null };
  });
});

it("does nothing when Stripe payments are not configured", async () => {
  mockConfigured = false;

  const result = await reconcileDueGuestStripeAttempts();

  expect(result).toEqual({ reconciled: 0, errors: 0 });
  expect(mockRpc).not.toHaveBeenCalled();
});

it("expires an attached open Guest Checkout before inventory release", async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_due_guest_stripe_attempts") {
      return {
        data: [{ ...attempt, session_id: "cs_open", attempt_status: "open" }],
        error: null,
      };
    }

    return { data: true, error: null };
  });

  mockStripe.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_open",
    status: "open",
    payment_status: "unpaid",
    payment_intent: null,
  });

  mockStripe.checkout.sessions.expire.mockResolvedValue({
    id: "cs_open",
    status: "expired",
    payment_status: "unpaid",
    payment_intent: null,
  });

  const result = await reconcileDueGuestStripeAttempts();

  expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_open");

  expect(mockRpc).toHaveBeenCalledWith(
    "cms_record_guest_stripe_webhook",
    expect.objectContaining({
      p_attempt_id: attempt.attempt_id,
      p_session_id: "cs_open",
      p_result: "expired",
    }),
  );

  expect(result).toEqual({ reconciled: 1, errors: 0 });
});

it("records a Guest payment that completed before reconciliation", async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_due_guest_stripe_attempts") {
      return {
        data: [{ ...attempt, session_id: "cs_paid", attempt_status: "open" }],
        error: null,
      };
    }

    return { data: true, error: null };
  });

  mockStripe.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_paid",
    status: "complete",
    payment_status: "paid",
    payment_intent: "pi_paid",
  });

  const result = await reconcileDueGuestStripeAttempts();

  expect(mockRpc).toHaveBeenCalledWith(
    "cms_record_guest_stripe_webhook",
    expect.objectContaining({
      p_attempt_id: attempt.attempt_id,
      p_session_id: "cs_paid",
      p_payment_intent_id: "pi_paid",
      p_result: "success",
    }),
  );

  expect(result).toEqual({ reconciled: 1, errors: 0 });
});

it("keeps a complete but unpaid Guest Checkout reserved", async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_due_guest_stripe_attempts") {
      return {
        data: [{ ...attempt, session_id: "cs_async", attempt_status: "open" }],
        error: null,
      };
    }

    return { data: true, error: null };
  });

  mockStripe.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_async",
    status: "complete",
    payment_status: "unpaid",
    payment_intent: "pi_async",
  });

  const result = await reconcileDueGuestStripeAttempts();

  expect(mockRpc).not.toHaveBeenCalledWith(
    "cms_record_guest_stripe_webhook",
    expect.anything(),
  );

  expect(result).toEqual({ reconciled: 0, errors: 0 });
});

it("recovers an ambiguous created attempt before expiry with the original Stripe idempotency key", async () => {
  const futureAttempt = {
    ...attempt,
    expires_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
  };

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_due_guest_stripe_attempts") {
      return { data: [futureAttempt], error: null };
    }

    return { data: true, error: null };
  });

  mockStripe.checkout.sessions.create.mockResolvedValue({
    id: "cs_recovered",
    status: "open",
    payment_status: "unpaid",
    payment_intent: null,
    url: "https://checkout.stripe.test/recovered",
  });

  const result = await reconcileDueGuestStripeAttempts();

  expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
    expect.any(Object),
    {
      idempotencyKey:
        `binderfinders-guest-${attempt.idempotency_key}`,
    },
  );

  expect(mockRpc).toHaveBeenCalledWith(
    "cms_attach_guest_stripe_session",
    {
      p_attempt_id: attempt.attempt_id,
      p_session_id: "cs_recovered",
    },
  );

  expect(mockStripe.checkout.sessions.expire).not.toHaveBeenCalled();

  expect(mockRpc).not.toHaveBeenCalledWith(
    "cms_record_guest_stripe_webhook",
    expect.objectContaining({
      p_result: "expired",
    }),
  );

  expect(result).toEqual({ reconciled: 1, errors: 0 });
});

it("leaves an ambiguous created attempt reserved when Stripe replay is uncertain", async () => {
  mockStripe.checkout.sessions.create.mockRejectedValue(
    new Error("Connection reset"),
  );

  const result = await reconcileDueGuestStripeAttempts();

  expect(mockRpc).not.toHaveBeenCalledWith(
    "cms_close_unattached_guest_stripe_attempt",
    expect.anything(),
  );

  expect(result).toEqual({ reconciled: 0, errors: 1 });
});


