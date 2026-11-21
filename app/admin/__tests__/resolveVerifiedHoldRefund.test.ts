jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));

jest.mock("../../../lib/supabase/server", () => ({
  requireAdmin: jest.fn(),
  serviceClient: jest.fn(),
}));

jest.mock("../../../lib/stripe-reconciliation", () => ({
  closeOpenCheckouts: jest.fn(),
}));

jest.mock("../../../lib/hold-refund-verification", () => ({
  verifyHoldFullRefund: jest.fn(),
}));

import { resolveVerifiedHoldRefund } from "../actions";
import { requireAdmin, serviceClient } from "../../../lib/supabase/server";
import { verifyHoldFullRefund } from "../../../lib/hold-refund-verification";

const adminAuth = requireAdmin as jest.Mock;
const service = serviceClient as jest.Mock;
const verify = verifyHoldFullRefund as jest.Mock;

const ownerId = "11111111-1111-4111-8111-111111111111";
const holdId = "22222222-2222-4222-8222-222222222222";
const intentId = "pi_test_verified_hold";

const validHold = {
  status: "expired",
  payment_status: "paid",
  currency: "AUD",
  stripe_payment_intent_id: intentId,
  stripe_payment_review_required: true,
  stripe_payment_review_resolved_at: null,
};

let db: {
  from: jest.Mock;
  rpc: jest.Mock;
};

let holds: {
  select: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
};

let attempts: {
  select: jest.Mock;
  eq: jest.Mock;
  limit: jest.Mock;
};

beforeEach(() => {
  jest.resetAllMocks();

  holds = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { ...validHold },
      error: null,
    }),
  };

  attempts = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [{ amount_cents: 1250, currency: "aud" }],
      error: null,
    }),
  };

  db = {
    from: jest.fn((table: string) => {
      if (table === "hold_requests") return holds;
      if (table === "payment_attempts") return attempts;
      throw new Error("Unexpected table");
    }),
    rpc: jest.fn().mockResolvedValue({ error: null }),
  };

  adminAuth.mockResolvedValue({
    user: { id: ownerId },
    role: "owner",
  });

  service.mockReturnValue(db);

  verify.mockResolvedValue({
    refundIds: ["re_test_confirmed"],
    refundedCents: 1250,
  });
});

describe("Admin verified Hold refund resolution", () => {
  it("requires owner-level authorization", async () => {
    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result).toEqual({ ok: true });
    expect(adminAuth).toHaveBeenCalledWith(true);
  });

  it("rejects invalid Hold IDs before accessing data", async () => {
    const result = await resolveVerifiedHoldRefund("invalid");

    expect(result.ok).toBe(false);
    expect(adminAuth).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("blocks unauthorized users", async () => {
    adminAuth.mockRejectedValue(new Error("Unauthorized"));

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(service).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects Holds without a review flag", async () => {
    holds.single.mockResolvedValue({
      data: {
        ...validHold,
        stripe_payment_review_required: false,
      },
      error: null,
    });

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing paid payment history", async () => {
    attempts.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("rejects mismatched payment currency", async () => {
    attempts.limit.mockResolvedValue({
      data: [{ amount_cents: 1250, currency: "usd" }],
      error: null,
    });

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("does not record a refund when Stripe verification fails", async () => {
    verify.mockRejectedValue(new Error("Refund pending"));

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("records only Stripe-verified refund details", async () => {
    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result).toEqual({ ok: true });

    expect(verify).toHaveBeenCalledWith(
      intentId, 1250, "aud"
    );

    expect(db.rpc).toHaveBeenCalledWith(
      "cms_record_verified_hold_refund",
      {
        p_hold_id: holdId,
        p_payment_intent_id: intentId,
        p_refund_ids: ["re_test_confirmed"],
        p_amount_cents: 1250,
        p_verified_by: ownerId,
      }
    );
  });

  it("reports failure when database resolution is rejected", async () => {
    db.rpc.mockResolvedValue({
      error: { message: "Resolution rejected" },
    });

    const result = await resolveVerifiedHoldRefund(holdId);

    expect(result.ok).toBe(false);
    expect(verify).toHaveBeenCalled();
  });
});