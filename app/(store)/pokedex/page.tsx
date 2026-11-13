import { PokedexPageClient } from "../../../components/pokedex/PokedexPageClient";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Pokédex",
  description:
    "Browse the Pokédex and jump straight to the vintage cards we have for each Pokémon.",
  path: "/pokedex",
});

export default function PokedexPage() {
  return <PokedexPageClient />;
}
