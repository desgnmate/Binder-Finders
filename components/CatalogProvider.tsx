"use client";
import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SHOP_CARDS, BINDER_TABS } from "../lib/data";
import { formatPrice } from "../lib/data";
import { defaultSettings, type Catalog } from "../lib/cms/types";
const CatalogContext = createContext<Catalog>({
  cards: SHOP_CARDS,
  collections: BINDER_TABS.map((t, i) => ({
    id: t.id,
    name: t.label,
    sortOrder: i,
    cardIds: t.cards.map((c) => c.id),
  })),
  settings: defaultSettings,
  source: "seed",
});
export const useCatalog = () => useContext(CatalogContext);
export function usePriceFormatter() {
  const { settings } = useCatalog();
  return (price: number) =>
    formatPrice(price, settings.currency ? `${settings.currency} ` : "");
}
export function CatalogProvider({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: React.ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    if (catalog.source === "seed") return;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !window.location.pathname.startsWith("/admin")
      )
        router.refresh();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [router, catalog.source]);
  return (
    <CatalogContext.Provider value={catalog}>
      {catalog.source === "unavailable" && (
        <div
          role="alert"
          className="bg-amber-100 p-3 text-center text-sm text-black"
        >
          The catalog is temporarily unavailable. Please try again shortly.
        </div>
      )}
      {children}
    </CatalogContext.Provider>
  );
}
