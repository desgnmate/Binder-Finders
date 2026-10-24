import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BagProvider } from "../../bag/BagContext";
import { CheckoutMartClient } from "../CheckoutMartClient";
import { SHOP_CARDS } from "../../../lib/data";
const mockPush = jest.fn();
jest.mock('next/navigation',()=>({useRouter:()=>({refresh:jest.fn(),push:mockPush})}));
let mockCurrency = 'AUD';
jest.mock('../../CatalogProvider',()=>({useCatalog:()=>({cards:require('../../../lib/data').SHOP_CARDS,settings:{...require('../../../lib/cms/types').defaultSettings,holdsEnabled:true,currency:mockCurrency}})}));

/**
 * CheckoutMartClient — bag-driven, responsive, functional checkout.
 */

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

function renderWithBag(ui: React.ReactElement) {
  return render(<BagProvider>{ui}</BagProvider>);
}

const testCustomer = { email: "", name: "" };

beforeEach(() => {
  mockCurrency = 'AUD';
  mockPush.mockClear();
  localStorage.clear();
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({reference:'12345678-1234-4234-8234-123456789012'})});
  Object.defineProperty(global.crypto,'randomUUID',{value:()=> '12345678-1234-4234-8234-123456789012',configurable:true});
});

afterEach(() => {
  localStorage.clear();
});

describe("CheckoutMartClient", () => {
  it.each(['', 'AUD', 'PHP'])('uses only the configured currency (%s) for totals and items', currency => {
    mockCurrency = currency;
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    const expected = currency ? `${currency} 8,500` : '8,500';
    expect(document.querySelector('[data-checkout-total]')?.textContent?.trim()).toBe(expected);
    const item = document.querySelector('[data-checkout-item="true"]');
    expect(item?.textContent).toContain(expected);
    expect(item?.textContent).not.toContain('$');
  });

  it('labels selected cards as in the bag, not already on hold', () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByText('1 Item in bag')).toBeInTheDocument();
    expect(screen.queryByText(/\bon hold\b/i)).not.toBeInTheDocument();
  });

  it('labels an empty bag without implying a reservation', () => {
    renderWithBag(<CheckoutMartClient customer={testCustomer} />);
    expect(screen.getByText('0 Items in bag')).toBeInTheDocument();
  });

  it("renders an empty-bag state when no items", () => {
    renderWithBag(<CheckoutMartClient customer={testCustomer} />);
    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("seeds a card from ?card= when bag is empty", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByText("Charizard")).toBeInTheDocument();
  });

  it("renders bag items with prices", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    // The item appears in a checkout-item container
    const item = document.querySelector('[data-checkout-item="true"]');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain("8,500");
  });

  it("renders a total based on bag contents", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    const totalEl = document.querySelector("[data-checkout-total]");
    expect(totalEl?.textContent).toContain("8,500");
  });

  it("allows removing an item from the bag", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    const removeBtn = screen.getByRole("button", { name: /remove/i });
    await user.click(removeBtn);

    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("renders contact form fields", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByLabelText(/name|full name|contact name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email|e-mail/i)).toBeInTheDocument();
  });

  it("shows a Request Hold button", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(
      screen.getByRole("button", { name: /request hold|submit|place hold/i }),
    ).toBeInTheDocument();
  });

  it("shows a confirmation after submitting Request Hold with valid contact info", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.type(screen.getByLabelText(/name/i), "Ash Ketchum");
    await user.type(screen.getByLabelText(/email/i), "ash@example.com");
    await user.click(screen.getByRole("button", { name: /request hold/i }));

    expect(await screen.findByRole("heading", { name: /hold received/i })).toBeInTheDocument();
  });

  it("prevents submission when contact fields are empty", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.click(screen.getByRole("button", { name: /request hold/i }));

    expect(screen.queryByRole("heading", { name: /hold received/i })).not.toBeInTheDocument();
  });

  it('keeps the bag when the server rejects a request',async()=>{
    (global.fetch as jest.Mock).mockResolvedValueOnce({ok:false,json:async()=>({error:'A card price changed. Refresh your bag.'})});
    const user=userEvent.setup();renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer}/>);
    await user.type(screen.getByLabelText(/name/i),'Ash');await user.type(screen.getByLabelText(/email/i),'ash@example.com');
    await user.click(screen.getByRole('button',{name:/request hold/i}));
    expect(await screen.findByRole('alert')).toHaveTextContent('price changed');
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('binderfinders:bag:v1')||'[]')).toContain('charizard-base1');
  });

  it('sends signed-out customers to login without clearing the bag', async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={null} />);
    const signIn = screen.getByRole('button', { name: /sign in to request/i });
    expect(signIn).toBeEnabled();
    await user.click(signIn);
    expect(mockPush).toHaveBeenCalledWith('/account/login?next=%2Fcheckout');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('binderfinders:bag:v1') || '[]')).toContain('charizard-base1');
  });

  it("uses a 100vh / viewport-contained layout class", () => {
    const { container } = renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    const main = container.querySelector("main");
    expect(main?.className).toMatch(/h-screen|min-h-screen|100vh|min-h-\[100svh\]/);
  });
});
