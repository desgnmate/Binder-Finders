import { render, screen } from "@testing-library/react";
import CardPage, { generateMetadata } from "../[id]/page";
import { BagProvider } from "../../../../components/bag/BagContext";
import { SHOP_CARDS } from "../../../../lib/data";
import { defaultSettings } from "../../../../lib/cms/types";

const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
jest.mock("next/navigation", () => ({
  usePathname: () => "/cards/charizard-base1",
  notFound: () => mockNotFound(),
}));
jest.mock("../../../../lib/cms/catalog", () => ({
  getCatalog: async () => ({
    cards: require("../../../../lib/data").SHOP_CARDS,
    settings: { ...require("../../../../lib/cms/types").defaultSettings, currency: "AUD" },
  }),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("card page", () => {
  it("shows the card with its price, details and product data", async () => {
    render(<BagProvider>{await CardPage(params("charizard-base1"))}</BagProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "Charizard" })).toBeInTheDocument();
    expect(screen.getByText("AUD 8,500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to bag/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ask about this card/i })).toHaveAttribute("href", "/contact?topic=card&card=charizard-base1");
    const data = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(data[0]).toMatchObject({ "@type": "Product", sku: "charizard-base1" });
    expect(screen.getByRole("heading", { name: "More from Base Set" })).toBeInTheDocument();
  });

  it("uses the card's own canonical address", async () => {
    const meta = await generateMetadata(params("charizard-base1"));
    expect(meta.alternates).toEqual({ canonical: "/cards/charizard-base1" });
  });

  it("returns a 404 for unknown cards", async () => {
    await expect(CardPage(params("missingno"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await generateMetadata(params("missingno"))).robots).toEqual({ index: false, follow: true });
  });
});
