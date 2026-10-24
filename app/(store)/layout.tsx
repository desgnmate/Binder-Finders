import { CatalogProvider } from "../../components/CatalogProvider";
import { BagProvider } from "../../components/bag/BagContext";
import { MusicProvider } from "../../components/MusicContext";
import { MusicToggle } from "../../components/MusicToggle";
import { RetroButtonSfx } from "../../components/RetroButtonSfx";
import { getCatalog } from "../../lib/cms/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const catalog = await getCatalog();
  return <CatalogProvider catalog={catalog}>
    <MusicProvider><BagProvider>
      {children}
      <MusicToggle />
      <RetroButtonSfx />
    </BagProvider></MusicProvider>
  </CatalogProvider>;
}
