import { render, screen } from "@testing-library/react";
import { Hero } from "../components/hero/Hero";

// Mock the hook using requestAnimationFrame for test runs.
// Drive scroll amount directly. The hook is the single source of truth for
// "how far the user has scrolled" — Hero.tsx must consume it.
const mockUseScrollProgress = jest.fn();
jest.mock("../hooks/useScrollProgress", () => ({
  useScrollProgress: () => mockUseScrollProgress(),
  SCROLL_RANGE: 150,
  __esModule: true,
}));

describe("Hero", () => {
  beforeEach(() => {
    // Default: at rest, no motion preference.
    mockUseScrollProgress.mockReturnValue({ progress: 0 });
  });

  it("renders both the floating nav and the headline/subtext/cta content inside the hero", () => {
    render(<Hero />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /Home of Vintage/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Shop Now/i })
    ).toBeInTheDocument();
  });

  it("applies the brand-yellow background color to the hero section at rest and at full scroll", () => {
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section")!;
    expect(sectionIdle.getAttribute("data-hero-bg")).toBe("brand-yellow");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const scrolledSection = container.querySelector("section")!;
    expect(scrolledSection.getAttribute("data-hero-bg")).toBe("brand-yellow");
  });

  it("signals the Umano scroll-linked style via data-hero-style='umano' (replaces the boolean animates marker)", () => {
    const { container } = render(<Hero />);
    const section = container.querySelector("section")!;
    expect(section.getAttribute("data-hero-style")).toBe("umano");
  });

  it("exposes the scroll amount as a quantized data-hero-progress attribute (0.00 / 0.50 / 1.00)", () => {
    const { container, rerender } = render(<Hero />);
    expect(
      container.querySelector("section")!.getAttribute("data-hero-progress")
    ).toBe("0.00");

    mockUseScrollProgress.mockReturnValue({ progress: 0.5 });
    rerender(<Hero />);
    expect(
      container.querySelector("section")!.getAttribute("data-hero-progress")
    ).toBe("0.50");

    mockUseScrollProgress.mockReturnValue({ progress: 0.99 });
    rerender(<Hero />);
    expect(
      container.querySelector("section")!.getAttribute("data-hero-progress")
    ).toBe("0.99");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    expect(
      container.querySelector("section")!.getAttribute("data-hero-progress")
    ).toBe("1.00");
  });

  it("interpolates marginLeft and marginRight inline-style from the scroll amount (0px → 16px → 32px)", () => {
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section") as HTMLElement;
    expect(sectionIdle.style.marginLeft).toBe("0px");
    expect(sectionIdle.style.marginRight).toBe("0px");

    mockUseScrollProgress.mockReturnValue({ progress: 0.5 });
    rerender(<Hero />);
    const sectionMid = container.querySelector("section") as HTMLElement;
    expect(sectionMid.style.marginLeft).toBe("16px");
    expect(sectionMid.style.marginRight).toBe("16px");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const sectionEnd = container.querySelector("section") as HTMLElement;
    expect(sectionEnd.style.marginLeft).toBe("32px");
    expect(sectionEnd.style.marginRight).toBe("32px");
  });

  it("compensates the section width so the scroll-linked margin is visible on BOTH sides (no viewport overflow clipping)", () => {
    // Regression: section has w-full (100% width) PLUS marginLeft/marginRight.
    // The total outer width becomes 100% + 2*margin, which causes the
    // right margin to overflow the viewport. With `overflow-hidden` on
    // the section, the right side is clipped — so the user sees the
    // left margin but NOT the right margin. Fix: write
    //   width: calc(100% - 2*marginPx)
    // so the section always fits within the viewport with symmetric gutters.
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section") as HTMLElement;
    expect(sectionIdle.style.width).toBe("calc(100% - 0px)");

    mockUseScrollProgress.mockReturnValue({ progress: 0.5 });
    rerender(<Hero />);
    const sectionMid = container.querySelector("section") as HTMLElement;
    expect(sectionMid.style.width).toBe("calc(100% - 32px)");

    mockUseScrollProgress.mockReturnValue({ progress: 0.99 });
    rerender(<Hero />);
    const sectionAlmostEnd = container.querySelector("section") as HTMLElement;
    expect(almostEndWidth(sectionAlmostEnd)).toBe("calc(100% - 63.36px)");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const sectionEnd = container.querySelector("section") as HTMLElement;
    expect(sectionEnd.style.width).toBe("calc(100% - 64px)");
  });

  function almostEndWidth(el: HTMLElement): string {
    return el.style.width;
  }

  it("interpolates border-bottom-radius from 0 to --radius-hero (var) as progress increases", () => {
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section") as HTMLElement;
    expect(sectionIdle.style.borderBottomLeftRadius).toBe("0px");
    expect(sectionIdle.style.borderBottomRightRadius).toBe("0px");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const sectionEnd = container.querySelector("section") as HTMLElement;
    // At progress=1, the value must reference the full --radius-hero token.
    // The exact string is the test's contract; Hero.tsx MUST use
    // var(--radius-hero) at the settled state.
    expect(sectionEnd.style.borderBottomLeftRadius).toBe(
      "var(--radius-hero)"
    );
    expect(sectionEnd.style.borderBottomRightRadius).toBe(
      "var(--radius-hero)"
    );
  });

  it("keeps the hero at min-h-screen regardless of scroll state (height does NOT shrink)", () => {
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section") as HTMLElement;
    expect(sectionIdle.className).toMatch(/\bmin-h-screen\b/);
    expect(sectionIdle.className).not.toMatch(/\bh-\[50vh\]\b/);

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const scrolledSection = container.querySelector("section") as HTMLElement;
    expect(scrolledSection.className).toMatch(/\bmin-h-screen\b/);
    expect(scrolledSection.className).not.toMatch(/\bh-\[50vh\]\b/);
  });

  it("keeps the hero full width in both states (no horizontal overflow)", () => {
    const { container, rerender } = render(<Hero />);
    const sectionIdle = container.querySelector("section")!;
    expect(sectionIdle.getAttribute("data-hero-full-width")).toBe("true");

    mockUseScrollProgress.mockReturnValue({ progress: 1 });
    rerender(<Hero />);
    const scrolledSection = container.querySelector("section")!;
    expect(scrolledSection.getAttribute("data-hero-full-width")).toBe("true");
  });

  it("carries data-hero-reduced-motion='false' on the section when motion is allowed", () => {
    const { container } = render(<Hero />);
    const section = container.querySelector("section")!;
    expect(section.getAttribute("data-hero-reduced-motion")).toBe("false");
  });

  it("carries the mobile-aware radius scale marker on the section", () => {
    const { container } = render(<Hero />);
    const section = container.querySelector("section")!;
    expect(section.getAttribute("data-hero-radius-scale")).toBe(
      "clamp(24px,4vw,42px)"
    );
  });

  it("carries data-hero-reduced-motion='true' and snaps the inline style to the settled state when matchMedia matches", () => {
    // Mock matchMedia to report reduced-motion BEFORE rendering.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Even with progress=0, reduced motion forces the settled card-lift.
    mockUseScrollProgress.mockReturnValue({ progress: 0 });
    const { container } = render(<Hero />);
    const section = container.querySelector("section") as HTMLElement;
    expect(section.getAttribute("data-hero-reduced-motion")).toBe("true");
    // Settled values: 32px margin, full --radius-hero radius, AND the
    // width compensation so the card sits inside the viewport symmetrically.
    expect(section.style.marginLeft).toBe("32px");
    expect(section.style.marginRight).toBe("32px");
    expect(section.style.width).toBe("calc(100% - 64px)");
    expect(section.style.borderBottomLeftRadius).toBe("var(--radius-hero)");
    expect(section.style.borderBottomRightRadius).toBe("var(--radius-hero)");
  });
});
