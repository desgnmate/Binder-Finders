/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";

jest.mock("server-only", () => ({}));

const mockRpc = jest.fn();
const mockRevalidateTag = jest.fn();
const mockBelowMinimum = jest.fn();

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      expire: jest.fn(),
    },
  },
};

jest.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

jest.mock("../../../../lib/stripe", () => ({
  stripeClient: () => mockStripe,
  stripePaymentsConfigured: () => true,
}));

jest.mock("../../../../lib/cms/payments", () => ({
  belowMinimumMessage: "Payment amount is below the card payment minimum.",
  belowCardPaymentMinimum: (...args: unknown[]) => mockBelowMinimum(...args),
}));

jest.mock("../../../../lib/guest-stripe-session", () => ({
  guestStripeIdempotencyKey: (key: string) =>
    `binderfinders-guest-${key}`,
  guestStripeSessionParams: jest.fn(),
}));

jest.mock("../../../../lib/supabase/server", () => ({
  serviceClient: () => ({
    rpc: mockRpc,
  }),
}));

const requestKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paymentKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const orderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeEach(() => {
  jest.resetAllMocks();
  process.env.CMS_ENABLED = "true";
  delete process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT;
  mockBelowMinimum.mockReturnValue(true);

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return {
        data: true,
        error: null,
      };
    }

    if (name === "cms_begin_guest_checkout") {
      return {
        data: {
          orderId,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_begin_guest_stripe_payment") {
      return {
        data: {
          state: "create",
          attemptId,
          sessionId: null,
          orderId,
          customerEmail: "guest@example.com",
          customerName: "Guest Buyer",
          currency: "aud",
          amountCents: 25,
          items: [
            {
              name: "Test Card",
              priceCents: 25,
            },
          ],
          shippingFeeCents: 0,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_close_unattached_guest_stripe_attempt") {
      return {
        data: true,
        error: null,
      };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  });
});

afterAll(() => {
  delete process.env.CMS_ENABLED;
  delete process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT;
});

function guestRequest() {
  return new NextRequest(
    "http://localhost:3000/api/guest-checkout",
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        name: "Guest Buyer",
        email: "guest@example.com",
        fulfillmentMethod: "pickup",
        shippingAddress: null,
        cardIds: ["card-1"],
        requestKey,
        paymentKey,
        website: "",
      }),
    },
  );
}

it("rate-limits Guest Checkout before reserving inventory", async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return {
        data: false,
        error: null,
      };
    }

    throw new Error(`Unexpected RPC after rate limit: ${name}`);
  });

  const request = new NextRequest(
    "http://localhost:3000/api/guest-checkout",
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        name: "Guest Buyer",
        email: "guest@example.com",
        fulfillmentMethod: "pickup",
        shippingAddress: null,
        cardIds: ["card-1"],
        requestKey,
        paymentKey,
        website: "",
      }),
    },
  );

  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(429);
  expect(body.error).toBe(
    "Too many checkout attempts. Please wait a few minutes and try again.",
  );

  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith(
    "cms_check_guest_checkout_rate_limit",
    expect.objectContaining({
      p_request_key: requestKey,
      p_email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }),
  );

  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mockRevalidateTag).not.toHaveBeenCalled();
});

it("closes a below-minimum unattached attempt without creating a Stripe session", async () => {
  const request = new NextRequest(
    "http://localhost:3000/api/guest-checkout",
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Guest Buyer",
        email: "guest@example.com",
        fulfillmentMethod: "pickup",
        shippingAddress: null,
        cardIds: ["card-1"],
        requestKey,
        paymentKey,
        website: "",
      }),
    },
  );

  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.error).toBe(
    "Payment amount is below the card payment minimum.",
  );

  expect(mockRpc).toHaveBeenCalledWith(
    "cms_close_unattached_guest_stripe_attempt",
    {
      p_attempt_id: attemptId,
      p_status: "failed",
      p_reason: "Amount is below the Stripe card payment minimum",
    },
  );

  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mockRevalidateTag).toHaveBeenCalledWith("store-catalog");
});

it("fails closed when the Guest Checkout rate limiter RPC is unavailable", async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return {
        data: null,
        error: { message: "database unavailable" },
      };
    }

    throw new Error(`Unexpected RPC after limiter failure: ${name}`);
  });

  const response = await POST(guestRequest());
  const body = await response.json();

  expect(response.status).toBe(502);
  expect(body.error).toBe(
    "Unable to start Guest Checkout. Your reserved cards are safe while payment is being resolved. Please try again.",
  );
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mockRevalidateTag).not.toHaveBeenCalled();
});

it("rejects missing or short production rate-limit salts before touching inventory", async () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";

    for (const salt of [undefined, "too-short"]) {
      mockRpc.mockClear();
      mockRevalidateTag.mockClear();

      if (salt === undefined) {
        delete process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT;
      } else {
        process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT = salt;
      }

      const response = await POST(guestRequest());
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.error).toBe(
        "Unable to start Guest Checkout. Your reserved cards are safe while payment is being resolved. Please try again.",
      );
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT;
  }
});

it("keeps an ambiguous Stripe create recoverable instead of closing the attempt", async () => {
  mockBelowMinimum.mockReturnValue(false);
  mockStripe.checkout.sessions.create.mockRejectedValueOnce(
    new Error("connection reset"),
  );

  const response = await POST(guestRequest());
  const body = await response.json();

  expect(response.status).toBe(502);
  expect(body.error).toBe(
    "Unable to start Guest Checkout. Your reserved cards are safe while payment is being resolved. Please try again.",
  );

  expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  expect(mockRpc).not.toHaveBeenCalledWith(
    "cms_close_unattached_guest_stripe_attempt",
    expect.anything(),
  );
  expect(mockRevalidateTag).toHaveBeenCalledWith("store-catalog");
});

it("closes an unattached attempt only after Stripe confirms the session expired", async () => {
  mockBelowMinimum.mockReturnValue(false);

  mockStripe.checkout.sessions.create.mockResolvedValueOnce({
    id: "cs_test_attach_failed",
    url: "https://checkout.stripe.test/session",
    status: "open",
    payment_status: "unpaid",
    payment_intent: null,
  });

  mockStripe.checkout.sessions.expire.mockResolvedValueOnce({
    id: "cs_test_attach_failed",
    status: "expired",
  });

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return { data: true, error: null };
    }

    if (name === "cms_begin_guest_checkout") {
      return {
        data: {
          orderId,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_begin_guest_stripe_payment") {
      return {
        data: {
          state: "create",
          attemptId,
          sessionId: null,
          orderId,
          customerEmail: "guest@example.com",
          customerName: "Guest Buyer",
          currency: "aud",
          amountCents: 250,
          items: [{ name: "Test Card", priceCents: 250 }],
          shippingFeeCents: 0,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_attach_guest_stripe_session") {
      return {
        data: false,
        error: { message: "attach failed" },
      };
    }

    if (name === "cms_close_unattached_guest_stripe_attempt") {
      return {
        data: true,
        error: null,
      };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  });

  const response = await POST(guestRequest());

  expect(response.status).toBe(502);
  expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith(
    "cs_test_attach_failed",
  );
  expect(mockRpc).toHaveBeenCalledWith(
    "cms_close_unattached_guest_stripe_attempt",
    {
      p_attempt_id: attemptId,
      p_status: "expired",
      p_reason: "Checkout session could not be attached and was expired",
    },
  );
});

it("keeps an attach failure recoverable when Stripe terminal state is ambiguous", async () => {
  mockBelowMinimum.mockReturnValue(false);

  mockStripe.checkout.sessions.create.mockResolvedValueOnce({
    id: "cs_test_attach_ambiguous",
    url: "https://checkout.stripe.test/session",
    status: "open",
    payment_status: "unpaid",
    payment_intent: null,
  });

  mockStripe.checkout.sessions.expire.mockRejectedValueOnce(
    new Error("expire request failed"),
  );
  mockStripe.checkout.sessions.retrieve.mockRejectedValueOnce(
    new Error("retrieve request failed"),
  );

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return { data: true, error: null };
    }

    if (name === "cms_begin_guest_checkout") {
      return {
        data: {
          orderId,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_begin_guest_stripe_payment") {
      return {
        data: {
          state: "create",
          attemptId,
          sessionId: null,
          orderId,
          customerEmail: "guest@example.com",
          customerName: "Guest Buyer",
          currency: "aud",
          amountCents: 250,
          items: [{ name: "Test Card", priceCents: 250 }],
          shippingFeeCents: 0,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_attach_guest_stripe_session") {
      return {
        data: false,
        error: { message: "attach failed" },
      };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  });

  const response = await POST(guestRequest());

  expect(response.status).toBe(502);
  expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith(
    "cs_test_attach_ambiguous",
  );
  expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith(
    "cs_test_attach_ambiguous",
  );
  expect(mockRpc).not.toHaveBeenCalledWith(
    "cms_close_unattached_guest_stripe_attempt",
    expect.anything(),
  );
});

it("returns the Stripe session ID when an existing Guest payment is already paid", async () => {
  const paidSessionId = "cs_test_guest_paid";

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "cms_check_guest_checkout_rate_limit") {
      return { data: true, error: null };
    }

    if (name === "cms_begin_guest_checkout") {
      return {
        data: {
          orderId,
          expiresAt: "2026-11-14T12:00:00.000Z",
        },
        error: null,
      };
    }

    if (name === "cms_begin_guest_stripe_payment") {
      return {
        data: {
          state: "paid",
          attemptId,
          sessionId: paidSessionId,
          orderId,
        },
        error: null,
      };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  });

  const response = await POST(guestRequest());
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual({
    status: "paid",
    orderId,
    sessionId: paidSessionId,
  });
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});




