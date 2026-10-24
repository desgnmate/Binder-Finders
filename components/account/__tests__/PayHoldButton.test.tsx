import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PayHoldButton } from "../PayHoldButton";

beforeEach(() => {
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "12345678-1234-4234-8234-123456789012",
  });
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("keeps checkout disabled while Stripe credentials are not configured", () => {
  render(<PayHoldButton id="11111111-1111-4111-8111-111111111111" enabled={false} />);

  const button = screen.getByRole("button", { name: "Online payments coming soon" });
  expect(button).toBeDisabled();
  expect(screen.getByText(/preparing secure online payments/)).toBeInTheDocument();

  fireEvent.click(button);
  expect(global.fetch).not.toHaveBeenCalled();
});

it("uses a new payment attempt after an expired checkout session", async () => {
  const firstKey = "12345678-1234-4234-8234-123456789012";
  const retryKey = "87654321-4321-4321-8321-210987654321";
  const nextKey = jest.fn().mockReturnValueOnce(firstKey).mockReturnValueOnce(retryKey);
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: nextKey,
  });
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Checkout session expired" }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Try again later" }) });
  global.fetch = fetchMock;

  render(<PayHoldButton id="11111111-1111-4111-8111-111111111111" />);
  fireEvent.click(screen.getByRole("button", { name: "Pay securely with Stripe" }));
  await screen.findByText("Checkout session expired");

  fireEvent.click(screen.getByRole("button", { name: "Pay securely with Stripe" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  expect(JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey).toBe(firstKey);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).idempotencyKey).toBe(retryKey);
});
