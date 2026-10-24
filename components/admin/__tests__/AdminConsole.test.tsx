import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { AdminConsole } from "../AdminConsole";
import { defaultSettings, type Hold } from "../../../lib/cms/types";

const mockRefresh = jest.fn();
const mockUpdate = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
}));
jest.mock("../../../lib/supabase/browser", () => ({
  browserClient: jest.fn(),
}));
jest.mock("../../../app/admin/actions", () => ({
  updateHoldWorkflow: (...args: unknown[]) => mockUpdate(...args),
}));
jest.mock("next/dynamic", () => () => () => null);

const hold: Hold = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test buyer",
  email: "buyer@example.test",
  note: "",
  status: "completed",
  currency: "AUD",
  payment_status: "paid",
  fulfillment_status: "ready",
  created_at: "2026-09-22T00:00:00Z",
  payment_reference: "payment-1",
  fulfillment_note: "Packed",
  hold_request_items: [
    { card_id: "card-1", name: "Test card", price_cents: 1000 },
  ],
};
const props: ComponentProps<typeof AdminConsole> = {
  view: "holds",
  user: { id: "owner", email: "owner@example.test", role: "owner" },
  cards: [],
  collectionCards: [],
  collections: [],
  settings: defaultSettings,
  settingsUpdatedAt: "2026-09-22",
  holds: [hold],
  audit: [],
  admins: [],
  pendingHoldCount: 0,
  stats: { available: 0, drafts: 0, newRequests: 0, sold: 1 },
  live: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ ok: true });
});

it("keeps completed-order controls available and saves shipping details", async () => {
  render(<AdminConsole {...props} />);
  fireEvent.change(screen.getByLabelText("Fulfilment"), {
    target: { value: "shipped" },
  });
  fireEvent.change(
    screen.getByLabelText("Fulfilment note (visible to customer)"),
    { target: { value: "Tracking ABC" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save workflow" }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(hold.id, {
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      paymentReference: "payment-1",
      fulfillmentNote: "Tracking ABC",
      expiresAt: "",
    }),
  );
  expect(mockRefresh).toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Complete sale" }),
  ).not.toBeInTheDocument();
});
it("allows recording an external refund for a cancelled request", async () => {
  render(
    <AdminConsole
      {...props}
      holds={[
        { ...hold, status: "cancelled", fulfillment_status: "cancelled" },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Payment"), {
    target: { value: "refunded" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save workflow" }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      hold.id,
      expect.objectContaining({ paymentStatus: "refunded" }),
    ),
  );
  expect(
    screen.getByText(/does not charge or refund money/),
  ).toBeInTheDocument();
});
it("shows database rejection instead of a success notice", async () => {
  mockUpdate.mockResolvedValue({
    ok: false,
    error: "A completed sale must remain paid or be recorded as refunded",
  });
  render(<AdminConsole {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Save workflow" }));
  expect(await screen.findByText(/must remain paid/)).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it("opens the requested hold and protects unsaved edits when switching requests", async () => {
  const other = {
    ...hold,
    id: "22222222-2222-4222-8222-222222222222",
    name: "Second buyer",
    payment_reference: "second-reference",
  };
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <AdminConsole {...props} holds={[hold, other]} initialHoldId={other.id} />,
  );
  expect(
    screen.getByRole("region", { name: "Request from Second buyer" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Payment reference"), {
    target: { value: "unsaved" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Test buyer/ }));
  expect(confirm).toHaveBeenCalledWith(
    "Discard unsaved changes to this request?",
  );
  expect(screen.getByLabelText("Payment reference")).toHaveValue("unsaved");
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: /Test buyer/ }));
  expect(
    screen.getByRole("region", { name: "Request from Test buyer" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Payment reference")).toHaveValue("payment-1");
  confirm.mockRestore();
});

it("keeps all requests reachable through filters and reports empty searches", () => {
  render(
    <AdminConsole
      {...props}
      holds={[
        hold,
        { ...hold, id: "new", name: "New buyer", status: "pending" },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /^New 1$/ }));
  expect(screen.getByRole("button", { name: /New buyer/ })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Test buyer/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search hold requests" }),
    { target: { value: "does not match" } },
  );
  expect(
    screen.getByText("No requests match this search."),
  ).toBeInTheDocument();
  // Filtering does not unmount or discard the selected workflow.
  expect(screen.getByLabelText("Payment reference")).toHaveValue("payment-1");
});

it("does not offer completion before payment and fulfilment are recorded", () => {
  const { rerender } = render(
    <AdminConsole
      {...props}
      holds={[
        {
          ...hold,
          status: "accepted",
          payment_status: "pending",
          fulfillment_status: "not_ready",
        },
      ]}
    />,
  );
  expect(screen.getByRole("button", { name: "Complete sale" })).toBeDisabled();
  rerender(
    <AdminConsole {...props} holds={[{ ...hold, status: "accepted" }]} />,
  );
  expect(screen.getByRole("button", { name: "Complete sale" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Payment reference"), {
    target: { value: "unsaved" },
  });
  expect(screen.getByRole("button", { name: "Complete sale" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Cancel & release" }),
  ).toBeDisabled();
});

it("shows the real Stripe configuration and links to the specific request", () => {
  render(
    <AdminConsole
      {...props}
      view="dashboard"
      stripeReady
      holds={[{ ...hold, status: "accepted" }]}
      stats={{ ...props.stats, reserved: 2 }}
    />,
  );
  expect(screen.getByText("Stripe checkout configured")).toBeInTheDocument();
  expect(screen.queryByText("Arranged manually")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Review hold/ })).toHaveAttribute(
    "href",
    `/admin?view=holds&hold=${hold.id}`,
  );
});

it("filters and sorts listings without changing their data", () => {
  const base = {
    id: "first",
    name: "First card",
    pokemonId: 1,
    set: "Base Set",
    year: 1999,
    number: "1",
    rarity: "Common" as const,
    condition: "RAW NM" as const,
    type: "Grass" as const,
    price: 20,
    imageUrl: "",
    backImageUrl: "",
    additionalImages: [],
    description: "",
    publication: "published" as const,
    availability: "available" as const,
    featuredOrder: null,
  };
  render(
    <AdminConsole
      {...props}
      view="cards"
      cards={[
        base,
        {
          ...base,
          id: "second",
          name: "Second card",
          price: 10,
          availability: "reserved",
        },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Sort listings"), {
    target: { value: "price-low" },
  });
  expect(
    within(screen.getAllByRole("row")[1]).getByText("Second card"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /On hold 1/ }));
  expect(screen.getByText("Second card")).toBeInTheDocument();
  expect(screen.queryByText("First card")).not.toBeInTheDocument();
  expect(mockUpdate).not.toHaveBeenCalled();
});
