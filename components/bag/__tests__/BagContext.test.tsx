import { render, renderHook, act } from "@testing-library/react";
import { BagProvider, useBag } from "../BagContext";
import { SHOP_CARDS } from "../../../lib/data";

/**
 * BagContext — local bag/cart state with localStorage persistence.
 */

const STORAGE_KEY = "binderfinders:bag:v1";

function wrapper({ children }: { children: React.ReactNode }) {
  return <BagProvider>{children}</BagProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("BagContext", () => {
  it("starts empty with count 0 and total 0", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it("addCard adds an item and updates count/total", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("charizard-base1");
    expect(result.current.count).toBe(1);
    expect(result.current.total).toBe(SHOP_CARDS[0].price);
  });

  it("addCard does not create duplicate rows for the same card", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
      result.current.addCard("charizard-base1");
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it("removeCard removes an item and updates count/total", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
      result.current.addCard("blastoise-base1");
    });
    act(() => {
      result.current.removeCard("charizard-base1");
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("blastoise-base1");
    expect(result.current.count).toBe(1);
  });

  it("clearBag empties the bag", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
      result.current.addCard("blastoise-base1");
      result.current.clearBag();
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it("total sums all item prices", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
      result.current.addCard("blastoise-base1");
    });
    const expected =
      SHOP_CARDS.find((c) => c.id === "charizard-base1")!.price +
      SHOP_CARDS.find((c) => c.id === "blastoise-base1")!.price;
    expect(result.current.total).toBe(expected);
  });

  it("persists card ids to localStorage on add", () => {
    const { result } = renderHook(() => useBag(), { wrapper });
    act(() => {
      result.current.addCard("charizard-base1");
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toContain("charizard-base1");
  });

  it("loads persisted card ids from localStorage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["charizard-base1", "blastoise-base1"]),
    );
    const { result } = renderHook(() => useBag(), { wrapper });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it("ignores invalid card ids in localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["charizard-base1", "nonexistent-card"]),
    );
    const { result } = renderHook(() => useBag(), { wrapper });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("charizard-base1");
  });
});
