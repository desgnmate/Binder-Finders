import { render, screen } from "@testing-library/react";
import { HeroCardShowcase } from "../HeroCardShowcase";
import { SHOP_CARDS, formatPrice, shortCondition } from "../../../lib/data";

/**
 * HeroCardShowcase — an infinite horizontal marquee of real TCG cards that
 * slides along the bottom of the hero and clips through the bottom edge.
 *
 * Tests cover:
 *   - Renders a marquee track with the card sets.
 *   - The set is duplicated (two copies) for a seamless infinite loop.
 *   - No links / no navigation inside the showcase.
 *   - Each card shows the real TCG image with name + price in the alt text.
 *   - Cards carry per-card tilt + lift custom properties for depth.
 *   - Exposes a data-inview hook (IntersectionObserver pause point).
 *   - No pill label / "New Arrivals" text.
 */
describe("HeroCardShowcase", () => {
  it("renders a marquee track containing two card sets (for seamless loop)", () => {
    const { container } = render(<HeroCardShowcase />);
    const track = container.querySelector(".hero-marquee__track");
    expect(track).not.toBeNull();
    // The set is rendered twice so the loop snaps seamlessly.
    const sets = container.querySelectorAll(".hero-marquee__set");
    expect(sets.length).toBe(2);
  });

  it("renders every shop card in each set", () => {
    const { container } = render(<HeroCardShowcase />);
    // Each set should contain one card per SHOP_CARDS entry.
    const sets = container.querySelectorAll(".hero-marquee__set");
    expect(sets[0].querySelectorAll(".hero-marquee__card").length).toBe(
      SHOP_CARDS.length,
    );
    expect(sets[1].querySelectorAll(".hero-marquee__card").length).toBe(
      SHOP_CARDS.length,
    );
  });

  it("does NOT render any links or navigation", () => {
    const { container } = render(<HeroCardShowcase />);
    expect(container.querySelectorAll("a").length).toBe(0);
  });

  it("does NOT render any pill label (no 'New Arrivals' text)", () => {
    render(<HeroCardShowcase />);
    expect(screen.queryByText(/New Arrivals/i)).toBeNull();
  });

  it("each card image carries name + condition + price in its alt text", () => {
    render(<HeroCardShowcase />);
    const sample = SHOP_CARDS[0];
    const imgs = screen.getAllByAltText(new RegExp(sample.name));
    expect(imgs.length).toBeGreaterThan(0);
    const first = imgs[0];
    expect(first.getAttribute("alt")).toContain(shortCondition(sample.condition));
    expect(first.getAttribute("alt")).toContain(formatPrice(sample.price));
  });

  it("cards carry per-card tilt + lift for depth variation", () => {
    const { container } = render(<HeroCardShowcase />);
    const cards = container.querySelectorAll<HTMLElement>(".hero-marquee__card");
    expect(cards.length).toBeGreaterThan(0);
    // At least one card sets a non-zero tilt and lift via custom props.
    const tilts = Array.from(cards).map((c) =>
      c.style.getPropertyValue("--card-tilt"),
    );
    const lifts = Array.from(cards).map((c) =>
      c.style.getPropertyValue("--card-lift"),
    );
    expect(tilts.some((t) => t !== "" && t !== "0deg")).toBe(true);
    expect(lifts.some((l) => l !== "" && l !== "0px")).toBe(true);
  });

  it("exposes a data-inview hook for the IntersectionObserver pause logic", () => {
    const { container } = render(<HeroCardShowcase />);
    const showcase = container.querySelector('[data-hero-card-showcase="true"]');
    expect(showcase).not.toBeNull();
    // Default in-view state is "true" until the observer says otherwise.
    expect(showcase!.getAttribute("data-inview")).toBe("true");
  });
});
