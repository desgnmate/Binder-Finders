import { render, screen } from "@testing-library/react";
import AccountPage from "../page";
import CustomerProfilePage from "../profile/page";

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
jest.mock("../../../lib/supabase/server", () => ({ sessionClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }) }));
jest.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
jest.mock("../../../components/account/CustomerProfileForm", () => ({ CustomerProfileForm: () => <form aria-label="Edit profile" /> }));

const user = { id: "customer-123", email: "collector@example.com", email_confirmed_at: "2026-09-01", user_metadata: { name: "Avery" } };
function query(result: object) {
  const chain = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn(), then: (resolve: (result: object) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of [chain.select, chain.eq, chain.in, chain.order, chain.limit, chain.maybeSingle]) method.mockReturnValue(chain);
  return chain;
}

beforeEach(() => { jest.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user } }); });

it.each([AccountPage, CustomerProfilePage])("protects signed-in pages before querying private data", async (page) => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  await expect(page()).rejects.toThrow("redirect:/account/login");
  expect(mockFrom).not.toHaveBeenCalled();
});

it.each([AccountPage, CustomerProfilePage])("requires a verified email before querying private data", async (page) => {
  mockGetUser.mockResolvedValue({ data: { user: { ...user, email_confirmed_at: null } } });
  await expect(page()).rejects.toThrow("redirect:/account/verify");
  expect(mockFrom).not.toHaveBeenCalled();
});

it("shows real request data and scopes every query to the signed-in customer", async () => {
  const queries = [
    query({ data: { name: "Avery Collector" } }),
    query({ data: [{ id: "12345678-test", status: "accepted", currency: "AUD", created_at: "2026-09-20T12:00:00Z", hold_request_items: [{ card_id: "venusaur", name: "Venusaur", price_cents: 6500 }] }] }),
    query({ count: 25 }), query({ count: 2 }), query({ count: 19 }),
  ];
  queries.forEach(result => mockFrom.mockReturnValueOnce(result));
  render(await AccountPage());
  expect(screen.getByRole("heading", { name: "Welcome back, Avery." })).toBeInTheDocument();
  expect(screen.getByText("25")).toBeInTheDocument();
  expect(screen.getByText("Reserved")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Venusaur/ })).toHaveAttribute("href", "/account/orders/12345678-test");
  expect(screen.getByText("AUD 65.00")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Browse cards/ })).toHaveAttribute("href", "/shop");
  expect(screen.getByText("How a hold becomes an order").closest("summary")).toBeInTheDocument();
  expect(screen.getByText(/Stripe checkout opens in Orders after confirmation/)).toBeInTheDocument();
  expect(queries[0].eq).toHaveBeenCalledWith("user_id", user.id);
  queries.slice(1).forEach(result => expect(result.eq).toHaveBeenCalledWith("customer_user_id", user.id));
  expect(queries[1].limit).toHaveBeenCalledWith(4);
  expect(queries[2].select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  expect(queries[3].in).toHaveBeenCalledWith("status", ["pending", "accepted"]);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("distinguishes a failed query from an empty order history", async () => {
  mockFrom.mockImplementation(() => query({ data: null, count: null, error: { message: "offline" } }));
  render(await AccountPage());
  expect(screen.getByText(/recent requests are temporarily unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Some order totals are temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByText("Your next find starts here")).not.toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});

it("provides a shop action for a new account with no requests", async () => {
  mockFrom.mockImplementation(() => query({ data: [], count: 0, error: null }));
  render(await AccountPage());
  expect(screen.getByText("Your next find starts here")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Explore the cards/ })).toHaveAttribute("href", "/shop");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
