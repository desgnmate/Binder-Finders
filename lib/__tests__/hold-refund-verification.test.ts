jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("../stripe", () => ({
  stripeClient: jest.fn(),
}));

import { stripeClient } from "../stripe";
import { verifyHoldFullRefund } from "../hold-refund-verification";

const mockRetrieve = jest.fn();
const mockList = jest.fn();

const intentId = "pi_test_binder_refund";

const mockStripeClient =
  stripeClient as jest.MockedFunction<typeof stripeClient>;

function refund(overrides: Record<string, unknown> = {}) {
  return {
    id: "re_test_full",
    payment_intent: intentId,
    status: "succeeded",
    currency: "aud",
    amount: 1250,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  mockStripeClient.mockReturnValue({
    paymentIntents: { retrieve: mockRetrieve },
    refunds: { list: mockList },
  } as unknown as ReturnType<typeof stripeClient>);

  mockRetrieve.mockResolvedValue({
    id: intentId,
    status: "succeeded",
    currency: "aud",
    amount_received: 1250,
  });

  mockList.mockResolvedValue({
    data: [refund()],
    has_more: false,
  });
});

describe("Stripe Hold refund verification", () => {
  it("accepts a complete successful refund", async () => {
    const result = await verifyHoldFullRefund(
      intentId, 1250, "AUD"
    );

    expect(result).toEqual({
      refundIds: ["re_test_full"],
      refundedCents: 1250,
    });

    expect(mockRetrieve).toHaveBeenCalledWith(intentId);
    expect(mockList).toHaveBeenCalledWith({
      payment_intent: intentId,
      limit: 100,
    });
  });

  it("rejects a partial refund", async () => {
    mockList.mockResolvedValue({
      data: [refund({ amount: 500 })],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/complete successful Stripe refund/);
  });

  it("rejects a pending refund", async () => {
    mockList.mockResolvedValue({
      data: [refund({ status: "pending" })],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/complete successful Stripe refund/);
  });

  it("rejects the wrong payment currency", async () => {
    mockRetrieve.mockResolvedValue({
      id: intentId,
      status: "succeeded",
      currency: "usd",
      amount_received: 1250,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/payment does not match/);
  });

  it("rejects a mismatched payment amount", async () => {
    mockRetrieve.mockResolvedValue({
      id: intentId,
      status: "succeeded",
      currency: "aud",
      amount_received: 2500,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/payment does not match/);
  });

  it("rejects refunds belonging to another PaymentIntent", async () => {
    mockList.mockResolvedValue({
      data: [refund({ payment_intent: "pi_wrong" })],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/different payment/);
  });

  it("rejects the wrong refund currency", async () => {
    mockList.mockResolvedValue({
      data: [refund({ currency: "usd" })],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/currency mismatch/);
  });

  it("accepts multiple successful refunds totaling the full amount", async () => {
    mockList
      .mockResolvedValueOnce({
        data: [refund({ id: "re_first", amount: 500 })],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [refund({ id: "re_second", amount: 750 })],
        has_more: false,
      });

    const result = await verifyHoldFullRefund(
      intentId, 1250, "aud"
    );

    expect(result).toEqual({
      refundIds: ["re_first", "re_second"],
      refundedCents: 1250,
    });

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenNthCalledWith(2, {
      payment_intent: intentId,
      limit: 100,
      starting_after: "re_first",
    });
  });

  it("rejects duplicate refund references", async () => {
    mockList.mockResolvedValue({
      data: [
        refund({ id: "re_duplicate", amount: 500 }),
        refund({ id: "re_duplicate", amount: 750 }),
      ],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/complete successful Stripe refund/);
  });

  it("rejects missing refund records", async () => {
    mockList.mockResolvedValue({
      data: [],
      has_more: false,
    });

    await expect(
      verifyHoldFullRefund(intentId, 1250, "aud")
    ).rejects.toThrow(/complete successful Stripe refund/);
  });

  it("rejects invalid input before contacting Stripe", async () => {
    await expect(
      verifyHoldFullRefund("invalid", -1, "AUD")
    ).rejects.toThrow(/Invalid payment verification/);

    expect(mockStripeClient).not.toHaveBeenCalled();
  });
});