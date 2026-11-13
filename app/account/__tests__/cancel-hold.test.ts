/** @jest-environment node */
import { cancelCustomerHold } from "../actions";

const mockClose = jest.fn();
const mockRpc = jest.fn();
const mockHold = jest.fn();
jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("../../../lib/stripe-reconciliation", () => ({ closeOpenCheckouts: (...args: unknown[]) => mockClose(...args) }));
jest.mock("../../../lib/supabase/server", () => ({
  sessionClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email_confirmed_at: "2026-11-01" } } }) },
    rpc: mockRpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockHold }) }) }) }),
  }),
}));

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const form = () => {
  const data = new FormData();
  data.set("id", id);
  return data;
};

beforeEach(() => {
  jest.resetAllMocks();
  mockRpc.mockResolvedValue({ error: null });
});

it("closes an open Stripe checkout before cancelling", async () => {
  mockHold.mockResolvedValue({ data: { id, payment_status: "pending" } });
  expect(await cancelCustomerHold({}, form())).toEqual({ success: true });
  expect(mockClose).toHaveBeenCalledWith(id, "customer");
  expect(mockRpc).toHaveBeenCalledWith("cms_cancel_customer_hold", { p_id: id });
});

it("doesn't cancel when the payment has just gone through", async () => {
  mockHold.mockResolvedValue({ data: { id, payment_status: "pending" } });
  mockClose.mockRejectedValue(new Error("Your payment has just gone through, so this hold can no longer be cancelled. Refresh the page."));
  expect(await cancelCustomerHold({}, form())).toEqual({ error: expect.stringContaining("just gone through") });
  expect(mockRpc).not.toHaveBeenCalled();
});

it("only cancels the customer's own requests", async () => {
  mockHold.mockResolvedValue({ data: null });
  expect(await cancelCustomerHold({}, form())).toEqual({ error: "This request could not be found." });
  expect(mockClose).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});
