import { Hero } from "../components/hero/Hero";
import { PokedexSection } from "../components/pokedex/PokedexSection";
import { BinderSection } from "../components/binder/BinderSection";
import { AboutSection } from "../components/about/AboutSection";
import { SiteFooter } from "../components/footer/SiteFooter";
import { ScrollGradientZone } from "../components/ScrollGradientZone";
import { RevealFooterLayout } from "../components/RevealFooterLayout";

/**
 * Home page flow:
 *
 *   1. Hero (brand yellow) — headline, subtext, Shop Now, and the featured
 *      card fan stack that fills the bottom of the hero. Rounded bottom
 *      corners reveal the gradient below on scroll.
 *   2. Pokédex Grid — Gen-3 sprite browser.
 *   3. The Binder — flip-through-binder display.
 *
 * The hero has a solid yellow bg. Its rounded bottom corners (scroll-linked)
 * reveal the gradient underneath, which is:
 *   white (#FFFFFF) at the top (visible right below the hero)
 *   → blue (#3194EE) at the pokedex / binder boundary
 *   → theme (#7b39ed) at the very bottom.
 */
const HERO_TO_POKEDEX_GRADIENT =
  "linear-gradient(to bottom, #FFFFFF 0%, #3194EE 100%)";

const BINDER_TO_FOOTER_GRADIENT =
  "linear-gradient(to bottom, #3194EE 0%, rgba(49, 148, 238, 0) 100%)";

export default function Home() {
  return (
    <main className="pokeball-cursor relative bg-[#7b39ed] overflow-x-hidden">
      <RevealFooterLayout footer={<SiteFooter />}>
        {/* Hero + About + Pokédex share one continuous white → blue gradient. */}
        <div style={{ background: HERO_TO_POKEDEX_GRADIENT }}>
          {/* Hero — yellow bg, scroll-linked card-lift, + featured card fan. */}
          <Hero />

          <ScrollGradientZone
            zoneId="collection"
            gradient="transparent"
          >
            <AboutSection />
            <PokedexSection />
          </ScrollGradientZone>
        </div>

        {/* Binder sits on a separate blue → theme gradient zone. */}
        <div style={{ background: BINDER_TO_FOOTER_GRADIENT }} className="pb-8 md:pb-12">
          <BinderSection />
        </div>
      </RevealFooterLayout>
    </main>
  );
}
