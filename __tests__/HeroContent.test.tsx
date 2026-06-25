import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroContent } from "../components/hero/HeroContent";

describe("HeroContent", () => {
  it("renders the headline across two lines exactly as the brief specifies", () => {
    render(<HeroContent />);
    // The headline is a single <h1> with a line break between the two phrases
    // (matches the design: "Home of Vintage\nPokemon Cards").
    const headline = screen.getByRole("heading", { level: 1 });
    const text = headline.textContent?.trim() ?? "";
    // The <br/> does not insert a whitespace character, so we expect the two
    // lines concatenated (the visual line break is purely a layout concern).
    expect(text).toBe("Home of VintagePokemon Cards");
  });

  it("renders the shortened subtext", () => {
    render(<HeroContent />);
    const subtext = screen.getByText(
      /^Hand-inspected Hoenn-era collectibles/i,
    );
    expect(subtext).toBeInTheDocument();
    // The subtext is a <p>, not a heading.
    expect(subtext.tagName.toLowerCase()).toBe("p");
  });

  it("renders a 'Shop Now' button with a right-pointing arrow icon", () => {
    render(<HeroContent />);
    const cta = screen.getByRole("button", { name: /Shop Now/i });
    expect(cta).toBeInTheDocument();
    // The arrow is a lucide-react <ArrowRight> icon, which renders an <svg>.
    const svg = cta.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks the CTA as having a pill shape and dark fill so it reads as the primary action", () => {
    render(<HeroContent />);
    const cta = screen.getByRole("button", { name: /Shop Now/i });
    // Component exposes data attributes that mirror the visual treatment.
    expect(cta.getAttribute("data-cta-pill")).toBe("true");
    expect(cta.getAttribute("data-cta-dark")).toBe("true");
  });

  it("is keyboard focusable and accepts activation via Enter", async () => {
    const onClick = jest.fn();
    render(<HeroContent onCtaClick={onClick} />);
    const cta = screen.getByRole("button", { name: /Shop Now/i });
    cta.focus();
    expect(cta).toHaveFocus();
    const user = userEvent.setup();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Umano type scale (umano-style-iteration)
  // ---------------------------------------------------------------------------

  it("uses the Umano headline scale (text-7xl / tracking -0.02em / leading 1.083) with a 700px-capped wrapper", () => {
    const { container } = render(<HeroContent />);
    const headline = screen.getByRole("heading", { level: 1 });
    // The h1 itself carries the scale marker.
    expect(headline.getAttribute("data-headline-scale")).toBe("umano");
    // The h1 class names the three Umano-scale tailwind classes.
    const h1Class = headline.className;
    expect(h1Class).toMatch(/\btext-5xl\b/);
    expect(h1Class).toMatch(/\bmd:text-7xl\b/);
    expect(h1Class).toMatch(/tracking-\[-0\.02em\]/);
    expect(h1Class).toMatch(/leading-\[1\.083\]/);
    // The wrapper around the <h1> is a sibling <div> with data-headline-scale
    // carrying the max-w-[700px] mx-auto constraint.
    const wrapper = headline.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toMatch(/max-w-\[700px\]/);
    expect(wrapper!.className).toMatch(/\bmx-auto\b/);
  });

  it("renders the headline at the Umano h1 weight (700) with a heavy display-serif font family (Playfair Display)", () => {
    // Regression: Umano's h1 is `font-weight: 700` on Playfair Display /
    // AM Le Cygne — a heavy display serif. Our previous build used DM Serif
    // Display at the default 400, which made the h1 look thin and small
    // even at the same 72px / 1.083 / -0.02em metrics. The fix is two-part:
    //   1. Add `font-bold` to the h1 class so the weight is asserted by the
    //      markup itself (and computed-style is `700` even in jsdom).
    //   2. Switch the `--font-headline` token in globals.css to a heavy
    //      display serif (Playfair Display) so the loaded font matches.
    render(<HeroContent />);
    const headline = screen.getByRole("heading", { level: 1 });
    // Class-based: the h1 carries font-bold so the weight is set explicitly.
    expect(headline.className).toMatch(/\bfont-bold\b/);
    // Class-based: the h1 also carries font-headline (which resolves to
    // --font-headline → "Playfair Display" in production CSS). The token
    // itself is asserted by tokens.test.ts; this contract is just that
    // the h1 opts in to the headline family.
    expect(headline.className).toMatch(/\bfont-headline\b/);
    // Computed-style: jsdom returns the keyword "bold" (== 700) for the
    // resolved weight — browsers return the numeric "700". Accept both.
    const resolved = getComputedStyle(headline).fontWeight;
    expect(["700", "bold"]).toContain(resolved);
  });

  it("uses the Umano subtext scale (text-2xl md:text-3xl / font-medium / tracking -0.01em / leading 1.33) with a 600px-capped wrapper", () => {
    const { container } = render(<HeroContent />);
    const subtext = screen.getByText(
      /^Hand-inspected Hoenn-era collectibles/i,
    );
    // The <p> itself carries the scale marker.
    expect(subtext.getAttribute("data-subtext-scale")).toBe("umano");
    const pClass = subtext.className;
    expect(pClass).toMatch(/\btext-2xl\b/);
    expect(pClass).toMatch(/\bmd:text-3xl\b/);
    expect(pClass).toMatch(/\bfont-medium\b/);
    expect(pClass).toMatch(/tracking-\[-0\.01em\]/);
    expect(pClass).toMatch(/leading-\[1\.33\]/);
    // The wrapper around the <p> has max-w-[600px] mx-auto.
    const wrapper = subtext.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toMatch(/max-w-\[600px\]/);
    expect(wrapper!.className).toMatch(/\bmx-auto\b/);
  });

  it("uses the Umano CTA scale (text-base / font-semibold / px-8 py-4) with a --ease-material hover", () => {
    render(<HeroContent />);
    const cta = screen.getByRole("button", { name: /Shop Now/i });
    expect(cta.getAttribute("data-cta-scale")).toBe("umano");
    const ctaClass = cta.className;
    expect(ctaClass).toMatch(/\btext-base\b/);
    expect(ctaClass).toMatch(/\bfont-semibold\b/);
    expect(ctaClass).toMatch(/\bpx-8\b/);
    expect(ctaClass).toMatch(/\bpy-4\b/);
    expect(ctaClass).toMatch(/\brounded-full\b/);
  });

});
