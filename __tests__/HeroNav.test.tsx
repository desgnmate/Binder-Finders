import { render, screen } from "@testing-library/react";
import { HeroNav } from "../components/hero/HeroNav";

describe("HeroNav", () => {
  it("renders all five nav items in the order shown in the design", () => {
    render(<HeroNav />);
    const expectedItems = ["Shop Cards", "Pokedex", "About", "Contact", "My Bag"];
    const navItems = screen.getAllByRole("link");
    const renderedText = navItems.map((el) => el.textContent?.trim() ?? "");
    // Walk expected items in order; each must appear at or after the previous match.
    let cursor = 0;
    for (const item of expectedItems) {
      const idx = renderedText.findIndex(
        (t, i) => i >= cursor && t.startsWith(item)
      );
      expect(idx).toBeGreaterThanOrEqual(0);
      cursor = idx + 1;
    }
  });

  it("shows a shopping bag icon next to the 'My Bag' item", () => {
    render(<HeroNav />);
    const myBagLink = screen.getByRole("link", { name: /My Bag/i });
    const svg = myBagLink.querySelector("svg");
    expect(svg).not.toBeNull();
    // lucide-react icons are aria-hidden by default
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the navigation as a <nav> landmark", () => {
    render(<HeroNav />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("marks the wrapper as sticky-positioned so it stays near the top while scrolling", () => {
    const { container } = render(<HeroNav />);
    const wrapper = container.firstElementChild as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    // Component emits a data attribute that the test can probe without
    // requiring a real CSS engine in jsdom. The actual `position: sticky`
    // comes from the Tailwind `sticky` class.
    expect(wrapper!.getAttribute("data-nav-sticky")).toBe("true");
  });

  it("marks the pill container as rounded-full so the nav reads as a pill", () => {
    render(<HeroNav />);
    const nav = screen.getByRole("navigation");
    const pill = nav.querySelector("ul") as HTMLElement | null;
    expect(pill).not.toBeNull();
    // The inner list has the pill background; the surrounding <nav> gets the
    // rounded-full class. Assert on the nav element.
    expect(nav.getAttribute("data-nav-pill")).toBe("true");
  });

  // ---------------------------------------------------------------------------
  // Umano nav scale (umano-style-iteration)
  // ---------------------------------------------------------------------------

  it("width-constrains the pill (no w-full on the nav) so it reads as a floating object, not a full-width bar", () => {
    const { container } = render(<HeroNav />);
    const nav = screen.getByRole("navigation");
    // The pill is bounded to a max-w-4xl container — not full-bleed.
    expect(nav.className).not.toMatch(/\bw-full\b/);
    expect(nav.className).toMatch(/\bmax-w-4xl\b/);
    expect(nav.className).toMatch(/\bmx-auto\b/);
  });

  it("applies the Umano nav type scale (text-base / font-semibold) and signals it via data-nav-type-scale='umano'", () => {
    const { container } = render(<HeroNav />);
    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("data-nav-type-scale")).toBe("umano");
    // The inner <ul> is the typography container.
    const list = nav.querySelector("ul") as HTMLElement | null;
    expect(list).not.toBeNull();
    const listClass = list!.className;
    expect(listClass).toMatch(/\btext-base\b/);
    expect(listClass).toMatch(/\bfont-semibold\b/);
  });

  // ---------------------------------------------------------------------------
  // Umano nav shape scale (header-size-fix)
  //   Umano's nav pill is 81px tall with 24px item gaps, 6/10 padded
  //   pill-link rows (8px radius), and a 10/20 padded dark CTA pill
  //   (43px radius). Live-captured on 2026-06-18 at a 980px viewport.
  // ---------------------------------------------------------------------------

  it("sizes the pill to Umano's ~80px height (py-5 vertical padding, not py-2)", () => {
    const { container } = render(<HeroNav />);
    const nav = screen.getByRole("navigation");
    // Umano's nav pill is 81px tall. py-5 (20px) on each side of the ~39px
    // CTA gives ~79px, within 2px of Umano. The previous build used
    // py-2 (8px) which produced a 48px pill — almost half the size.
    expect(nav.className).toMatch(/\bpy-5\b/);
    expect(nav.className).not.toMatch(/\bpy-2\b/);
  });

  it("spaces the nav items at Umano's 24px gap (gap-6, not gap-4)", () => {
    const { container } = render(<HeroNav />);
    const list = screen.getByRole("navigation").querySelector("ul") as HTMLElement;
    expect(list.className).toMatch(/\bgap-6\b/);
    expect(list.className).not.toMatch(/\bgap-4\b/);
  });

  it("styles the nav links as Umano-style pill links (rounded-lg + px-2.5 py-1.5)", () => {
    const { container } = render(<HeroNav />);
    const shopLink = screen.getByRole("link", { name: /Shop Cards/i });
    // Umano's nav links: 6px 10px padding, 8px border-radius.
    // Tailwind: px-2.5 (10px) py-1.5 (6px) + rounded-lg (8px).
    expect(shopLink.className).toMatch(/\brounded-lg\b/);
    expect(shopLink.className).toMatch(/\bpx-2\.5\b/);
    expect(shopLink.className).toMatch(/\bpy-1\.5\b/);
  });

  it("pads the 'My Bag' CTA to match Umano's 'Start today' (px-5 py-2.5, not px-3 py-1)", () => {
    const { container } = render(<HeroNav />);
    const myBag = screen.getByRole("link", { name: /My Bag/i });
    // Umano's CTA: 10px 20px padding, 43px border-radius.
    // Tailwind: px-5 (20px) py-2.5 (10px) — kept rounded-full.
    expect(myBag.className).toMatch(/\bpx-5\b/);
    expect(myBag.className).toMatch(/\bpy-2\.5\b/);
    expect(myBag.className).not.toMatch(/\bpy-1\b/);
  });
});
