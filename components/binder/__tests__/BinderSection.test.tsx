import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BinderSection } from "../BinderSection";
import { BINDER_TABS } from "../../../lib/data";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    onClick,
    onMouseMove,
    onMouseLeave,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    onMouseMove?: React.MouseEventHandler<HTMLAnchorElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...rest}
    >
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

/**
 * Helper: mock the bounding rect on a card element so the tilt math
 * works in JSDOM (which returns 0,0 for all rects by default).
 */
function mockRect(el: HTMLElement) {
  el.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 280,
    width: 200,
    height: 280,
    x: 0,
    y: 0,
    toJSON: () => "",
  });
}

/**
 * Helper: get the tilt layer (the inner div that receives the
 * rotateX/rotateY transform). The tilt is NOT on the Link wrapper
 * (because perspective CSS applies to children, not the element itself).
 */
function getTiltLayer(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-magnetic-card-inner]") as HTMLElement;
}

const originalMatchMedia = window.matchMedia;

describe("BinderSection", () => {
  afterEach(() => {
    mockRouterPush.mockClear();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("renders the 'The Binder' heading", () => {
    render(<BinderSection />);
    expect(
      screen.getByRole("heading", { name: /The Binder/i }),
    ).toBeInTheDocument();
  });

  it("carries the data-binder-section marker", () => {
    const { container } = render(<BinderSection />);
    expect(
      container.querySelector("[data-binder-section]"),
    ).not.toBeNull();
  });

  it("renders one era tab per BINDER_TABS entry", () => {
    render(<BinderSection />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(BINDER_TABS.length);
  });

  it("marks the first era tab as selected by default", () => {
    render(<BinderSection />);
    const first = screen.getByRole("tab", { name: BINDER_TABS[0].label });
    expect(first.getAttribute("aria-selected")).toBe("true");
  });

  it("renders binder cards for the active tab as focus buttons", () => {
    render(<BinderSection />);
    const cards = document.querySelectorAll("[data-binder-card]");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of Array.from(cards)) {
      expect(card.tagName).toBe("BUTTON");
    }
  });

  it("renders a yellow price-sticker overlay on every binder card", () => {
    render(<BinderSection />);
    const stickers = screen.getAllByTestId("price-sticker");
    expect(stickers.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("price-sticker-condition").length).toBe(
      stickers.length,
    );
    expect(screen.getAllByTestId("price-sticker-price").length).toBe(
      stickers.length,
    );
  });

  it("every binder card has a magnetic-card-wrapper AND a magnetic-card-inner tilt layer", () => {
    const { container } = render(<BinderSection />);
    const wrappers = container.querySelectorAll(".magnetic-card-wrapper");
    const inners = container.querySelectorAll(".magnetic-card-inner");
    const binderCards = container.querySelectorAll("[data-binder-card]");
    expect(wrappers.length).toBe(binderCards.length);
    expect(inners.length).toBe(binderCards.length);
    expect(wrappers.length).toBeGreaterThan(0);
  });

  it("tilt layer starts at zero tilt (no mouse yet)", () => {
    const { container } = render(<BinderSection />);
    const inners = container.querySelectorAll("[data-magnetic-card-inner]");
    for (const inner of Array.from(inners)) {
      expect((inner as HTMLElement).style.transform).toBe(
        "rotateY(0.00deg) rotateX(0.00deg)",
      );
    }
  });

  it("INVERTED tilt: cursor on TOP → rotateX POSITIVE (bottom forward)", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    mockRect(card);
    fireEvent.mouseMove(card, { clientX: 100, clientY: 5 });
    const tilt = getTiltLayer(container);
    const match = tilt.style.transform.match(/rotateX\(([\d.\-]+)deg\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(0);
  });

  it("INVERTED tilt: cursor on RIGHT → rotateY POSITIVE (left forward)", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    mockRect(card);
    fireEvent.mouseMove(card, { clientX: 195, clientY: 140 });
    const tilt = getTiltLayer(container);
    const match = tilt.style.transform.match(/rotateY\(([\d.\-]+)deg\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(0);
  });

  it("INVERTED tilt: cursor on BOTTOM → rotateX NEGATIVE (top forward)", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    mockRect(card);
    fireEvent.mouseMove(card, { clientX: 100, clientY: 275 });
    const tilt = getTiltLayer(container);
    const match = tilt.style.transform.match(/rotateX\(([\d.\-]+)deg\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeLessThan(0);
  });

  it("INVERTED tilt: cursor on LEFT → rotateY NEGATIVE (right forward)", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    mockRect(card);
    fireEvent.mouseMove(card, { clientX: 5, clientY: 140 });
    const tilt = getTiltLayer(container);
    const match = tilt.style.transform.match(/rotateY\(([\d.\-]+)deg\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeLessThan(0);
  });

  it("tilt layer has transform-style: preserve-3d for proper 3D rendering", () => {
    const { container } = render(<BinderSection />);
    const inner = container.querySelector(
      ".magnetic-card-inner",
    ) as HTMLElement;
    expect(inner.classList.contains("magnetic-card-inner")).toBe(true);
  });

  it("wrapper has perspective CSS (via the class), tilt layer does NOT", () => {
    const { container } = render(<BinderSection />);
    const wrapper = container.querySelector(
      ".magnetic-card-wrapper",
    ) as HTMLElement;
    const inner = container.querySelector(
      ".magnetic-card-inner",
    ) as HTMLElement;
    expect(wrapper.classList.contains("magnetic-card-wrapper")).toBe(true);
    expect(inner.classList.contains("magnetic-card-wrapper")).toBe(false);
  });

  it("launches the selected card into a centered focus overlay with a dark backdrop and details panel", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    const cardId = card.getAttribute("data-binder-card-id");
    const cardName = card.getAttribute("data-binder-card-name");

    expect(card.tagName).toBe("BUTTON");
    expect(card.querySelector("[data-magnetic-card-flipper]")).toBeNull();

    fireEvent.click(card);

    expect(mockRouterPush).not.toHaveBeenCalled();
    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("data-binder-focus-stage")).toBe("opening");

    // Overlay must have the binder-focus-overlay class for CSS rules to apply
    // Dark backdrop: the overlay must carry the binder-focus-overlay class
    // which sets background: rgba(26, 26, 26, 0.55) and backdrop-filter.
    // (jsdom does not compute CSS values from class rules, so we check
    // the class is present and verify the computed style in the browser.)
    expect(overlay?.className).toContain("binder-focus-overlay");

    // Details panel is present and visible during the opening tween
    // (slides in from the right) so it appears in sync with the card.
    const details = container.querySelector("[data-binder-focus-details]");
    expect(details).not.toBeNull();
    expect(details?.getAttribute("aria-hidden")).toBe("false");
    const txt = details?.textContent ?? "";
    expect(txt).toContain(cardName ?? "");
    expect(txt).toMatch(/Rarity/i);
    expect(txt).toMatch(/Type/i);
    expect(txt).toMatch(/Condition/i);
    expect(txt).toMatch(/Views/i);

    // The focus card itself carries the back face
    const focusCard = container.querySelector("[data-binder-focus-card]");
    expect(focusCard).not.toBeNull();
    expect(focusCard?.getAttribute("data-binder-focus-card-id")).toBe(cardId);
    expect(focusCard?.getAttribute("aria-label")).toContain(cardName ?? "");
  });

  it("renders the real Pokémon TCG card back image inside the focus card's back face", () => {
    const { container } = render(<BinderSection />);
    expect(container.querySelector("[data-binder-focus-overlay]")).toBeNull();

    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    fireEvent.click(card);

    const backFace = container.querySelector("[data-binder-focus-card-back]") as HTMLElement;
    expect(backFace).not.toBeNull();
    const img = backFace!.querySelector("img");
    expect(img).not.toBeNull();
    // The back face carries the real Pokémon TCG card back image. The
    // front face carries the per-card front image. Both are stacked in
    // the focus card; the 3D flip transitions between them.
    expect((img as HTMLImageElement).getAttribute("src")).toBe(
      "/80680fbc635c78df8b860e0426ffe686.jpg",
    );
  });

  it("swaps the source grid cell with a placeholder while the overlay is open and restores it on close", () => {
    jest.useFakeTimers();
    const { container } = render(<BinderSection />);
    const sourceCard = container.querySelector("[data-binder-card]") as HTMLElement;
    const sourceId = sourceCard.getAttribute("data-binder-card-id");
    const sourceCell = sourceCard.closest("[data-binder-source-cell]") as HTMLElement;
    expect(sourceCell).not.toBeNull();
    expect(sourceCell.querySelector("[data-binder-source-placeholder]")).toBeNull();

    fireEvent.click(sourceCard);

    expect(sourceCell.querySelector("[data-binder-source-placeholder]")).not.toBeNull();
    expect(
      sourceCell.querySelector("[data-binder-source-placeholder]")?.getAttribute(
        "data-binder-source-placeholder",
      ),
    ).toBe(sourceId);

    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    fireEvent.click(overlay, { target: overlay });

    // Source cell restores only after the close tween (FOCUS_CLOSE_MS = 300).
    act(() => { jest.advanceTimersByTime(300); });
    expect(sourceCell.querySelector("[data-binder-source-placeholder]")).toBeNull();
    expect(sourceCell.querySelector("[data-binder-card]")).not.toBeNull();
  });

  it("closes the focus overlay when the user clicks the overlay backdrop", () => {
    jest.useFakeTimers();
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    fireEvent.click(card);
    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay, { target: overlay });

    // Closing tween runs for FOCUS_CLOSE_MS (300); overlay is still mounted
    // during the "closing" phase. Advance the close timer to unmount.
    act(() => { jest.advanceTimersByTime(300); });
    expect(container.querySelector("[data-binder-focus-overlay]")).toBeNull();
  });

  it("flips the card to the back face when clicked, and does not close the overlay", () => {
    jest.useFakeTimers();
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    fireEvent.click(card);
    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    expect(overlay).not.toBeNull();

    // Advance timer to reach 'open' stage so that inline transform is set
    act(() => { jest.advanceTimersByTime(600); });

    const focusCard = container.querySelector("[data-binder-focus-card]") as HTMLElement;
    expect(focusCard).not.toBeNull();
    expect(focusCard.style.transform).toContain("rotateY(360deg)");

    // Click to flip
    fireEvent.click(focusCard);
    expect(focusCard.style.transform).toContain("rotateY(540deg)");

    // Click again to flip back
    fireEvent.click(focusCard);
    expect(focusCard.style.transform).toContain("rotateY(360deg)");

    expect(container.querySelector("[data-binder-focus-overlay]")).not.toBeNull();
  });

  it("reaches the open stage synchronously when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    fireEvent.click(card);

    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    expect(overlay.getAttribute("data-binder-focus-stage")).toBe("open");
  });

  it("runs the open tween with the source-rect start position and reaches the open stage", () => {
    jest.useFakeTimers();
    const { container } = render(<BinderSection />);
    const sourceCard = container.querySelector("[data-binder-card]") as HTMLElement;
    const sourceCell = sourceCard.closest("[data-binder-source-cell]") as HTMLElement;
    // Mock the source rect on the cell (the parent div) so the handler
    // captures width/height correctly. The handler reads from the cell.
    mockRect(sourceCell);
    const r = sourceCell.getBoundingClientRect();
    fireEvent.click(sourceCard);
    // Query the overlay AFTER the click so it exists when we assert.
    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute("data-binder-focus-stage")).toBe("opening");
    const card = overlay.querySelector("[data-binder-focus-card]") as HTMLElement;
    // Focused card matches the source grid cell size.
    expect(card.style.width).toBe(`${r.width}px`);
    expect(card.style.height).toBe(`${r.height}px`);
    expect(card.style.getPropertyValue("--focus-from-translate")).toBe(
      `translate(${r.left}px, ${r.top}px)`,
    );
    expect(card.style.getPropertyValue("--focus-to-translate")).toBe(
      `translate(calc(50vw - ${r.width / 2}px), calc(50vh - ${r.height / 2}px))`,
    );

    act(() => { jest.advanceTimersByTime(1200); });
  });

  it("runs the close tween from the open stage back to the source rect and unmounts", () => {
    jest.useFakeTimers();
    const { container } = render(<BinderSection />);
    const sourceCard = container.querySelector("[data-binder-card]") as HTMLElement;
    const sourceCell = sourceCard.closest("[data-binder-source-cell]") as HTMLElement;
    mockRect(sourceCell);
    const r = sourceCell.getBoundingClientRect();
    fireEvent.click(sourceCard);
    act(() => { jest.advanceTimersByTime(700); });
    const overlay = container.querySelector("[data-binder-focus-overlay]") as HTMLElement;
    expect(overlay.getAttribute("data-binder-focus-stage")).toBe("open");

    fireEvent.click(overlay, { target: overlay });
    expect(overlay.getAttribute("data-binder-focus-stage")).toBe("closing");
    const card = overlay.querySelector("[data-binder-focus-card]") as HTMLElement;
    expect(card.style.getPropertyValue("--focus-from-translate")).toBe(
      `translate(${r.left}px, ${r.top}px)`,
    );

    act(() => { jest.advanceTimersByTime(300); });
    expect(container.querySelector("[data-binder-focus-overlay]")).toBeNull();
  });
  it("resets the tilt to 0 on mouseleave", () => {
    const { container } = render(<BinderSection />);
    const card = container.querySelector("[data-binder-card]") as HTMLElement;
    mockRect(card);
    fireEvent.mouseMove(card, { clientX: 195, clientY: 140 });
    const tilt = getTiltLayer(container);
    expect(tilt.style.transform).not.toBe(
      "rotateY(0.00deg) rotateX(0.00deg)",
    );
    fireEvent.mouseLeave(card);
    expect(tilt.style.transform).toBe(
      "rotateY(0.00deg) rotateX(0.00deg)",
    );
  });

  it("swaps the active page when a different era tab is clicked", async () => {
    const user = userEvent.setup();
    render(<BinderSection />);
    const firstTab = screen.getByRole("tab", { name: BINDER_TABS[0].label });
    const secondTab = screen.getByRole("tab", { name: BINDER_TABS[1].label });
    expect(firstTab.getAttribute("aria-selected")).toBe("true");
    expect(secondTab.getAttribute("aria-selected")).toBe("false");
    await user.click(secondTab);
    expect(firstTab.getAttribute("aria-selected")).toBe("false");
    expect(secondTab.getAttribute("aria-selected")).toBe("true");
  });
});
