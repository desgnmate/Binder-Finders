import { renderHook, act } from "@testing-library/react";
import { useScrollProgress, SCROLL_RANGE } from "../hooks/useScrollProgress";

describe("useScrollProgress", () => {
  function setScrollY(value: number) {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value,
    });
  }

  function fireScroll() {
    window.dispatchEvent(new Event("scroll"));
  }

  function mockMatchMedia(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  beforeEach(() => {
    setScrollY(0);
    // Default: motion is fine.
    mockMatchMedia(false);
  });

  it("exports SCROLL_RANGE = 150 (Umano's settle point)", () => {
    expect(SCROLL_RANGE).toBe(150);
  });

  it("returns progress=0 when scrollY is 0 (initial value at rest)", () => {
    const { result } = renderHook(() => useScrollProgress());
    expect(result.current.progress).toBe(0);
  });

  it("reaches progress=1 once scrollY >= SCROLL_RANGE", async () => {
    setScrollY(SCROLL_RANGE);
    const { result } = renderHook(() => useScrollProgress());
    act(() => {
      fireScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.progress).toBe(1);
  });

  it("is monotonic non-decreasing as scrollY increases", async () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollProgress());
    expect(result.current.progress).toBe(0);

    setScrollY(50);
    act(() => {
      fireScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const mid = result.current.progress;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);

    setScrollY(SCROLL_RANGE + 200);
    act(() => {
      fireScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.progress).toBe(1);
    expect(result.current.progress).toBeGreaterThanOrEqual(mid);
  });

  it("clamps progress to 0 when scrollY is negative (over-scroll on touch)", async () => {
    setScrollY(-100);
    const { result } = renderHook(() => useScrollProgress());
    act(() => {
      fireScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.progress).toBe(0);
  });

  it("coalesces rapid scroll events via requestAnimationFrame (10 events → ≤ 1 setState per frame)", async () => {
    // Spy on rAF to confirm the hook schedules at most one frame per burst.
    const rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        // Run synchronously so the test doesn't need to wait.
        cb(performance.now());
        return 1;
      });

    setScrollY(0);
    const { result } = renderHook(() => useScrollProgress());
    // Initial evaluate triggers one rAF.
    const initialCalls = rafSpy.mock.calls.length;

    // 10 rapid scroll events while the frame is in-flight.
    act(() => {
      for (let i = 0; i < 10; i++) {
        setScrollY(SCROLL_RANGE);
        fireScroll();
      }
    });

    // After the burst, the hook should have scheduled at most ONE more
    // rAF (it skipped 9 duplicates because a frame was already in flight).
    const burstCalls = rafSpy.mock.calls.length - initialCalls;
    expect(burstCalls).toBeLessThanOrEqual(1);

    rafSpy.mockRestore();
  });

  it("registers and removes a single scroll listener on the window", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useScrollProgress());
    const added = addSpy.mock.calls.filter(([n]) => n === "scroll");
    expect(added.length).toBe(1);

    unmount();
    const removed = removeSpy.mock.calls.filter(([n]) => n === "scroll");
    expect(removed.length).toBe(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("returns progress=1 immediately and does NOT register a scroll listener when prefers-reduced-motion is on", () => {
    mockMatchMedia(true);

    const addSpy = jest.spyOn(window, "addEventListener");
    const { result } = renderHook(() => useScrollProgress());

    // Progress snaps to settled state.
    expect(result.current.progress).toBe(1);

    // No scroll listener registered (accessibility: no animation).
    const added = addSpy.mock.calls.filter(([n]) => n === "scroll");
    expect(added.length).toBe(0);

    addSpy.mockRestore();
  });
});
