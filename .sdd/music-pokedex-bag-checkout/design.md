# Design: Music, Pokédex preview, bag, checkout, and About refresh

## Code roots

- `E:\DEV_WORKS\BINDER FINDERS\binderfinders-hero`

## Technical context

This is a Next.js 14 app with React 18, Tailwind CSS v4 beta utilities, Jest, Testing Library, and TypeScript. No `.sdd/config.json` exists, so strict TDD is enabled by default. Current tests cover Hero, Binder, Pokédex, shop, and data tokens, but not Music, Checkout, Bag, or About.

## Architecture

### BGM/music toggle

Keep music state in `components/MusicContext.tsx`, already mounted by `app/layout.tsx`, but make playback explicitly testable and robust:

- Use WebAudio (`AudioContext`) from the user click path to satisfy autoplay rules.
- Fetch `public/audio/littleroot-town.mp3` as an `ArrayBuffer`, decode with `decodeAudioData`, create a looping `AudioBufferSourceNode`, and connect through a gain node.
- Store playback state in provider state: `loading`, `enabled`, `missingAudio`.
- `MusicToggle.tsx` renders existing icons:
  - `/images/music-on.png` when stopped.
  - `/images/music-mute.png` when playing.
- Add tests with mocked `fetch`, `AudioContext`, `createBufferSource`, `decodeAudioData`, `resume`, `start`, and `stop`.
- Browser audio gesture behavior cannot be fully proven in Jest; add manual smoke evidence in build notes.

### About redesign

Replace `components/about/AboutSection.tsx` with a more distinct retro collector desk/card-shop block:

- A prominent black “collector promise” or device-like card.
- Yellow/cream base, blue accent bars, thick ink borders, hard offset shadows.
- Four process chips and three compact proof cards.
- Keep small-screen layout compact: stacked panels, no fixed oversized art, no huge image panels.
- Add tests for `data-about-section`, primary heading, promise panel, process steps, and proof cards.

### Homepage Pokédex preview

Refactor `components/pokedex/PokedexSection.tsx` into a compact preview inspired by `components/pokedex/PokedexPageClient.tsx`:

- Use a compact device/header treatment, search field, and smaller tile cards.
- Render a stable capped set of tiles representing two rows. Because CSS grid row count is not directly measurable in tests, implement an explicit preview cap constant that maps to the largest intended two-row desktop layout (for example 14 if using 7 desktop columns) while remaining no larger than two rows at the design maximum. On smaller screens, the visible count may form more physical rows, so use smaller card heights and spacing to avoid oversized mobile presentation.
- Add a `View full Pokédex` CTA linking to `/pokedex`.
- Remove `/shop?q=` hrefs from homepage tile anchors. Prefer local selection/preview or `/pokedex` links; plan recommends local selection/preview so clicking a tile remains useful without launching results.
- Update tests that currently expect all tiles and `/shop?q=` links.

### Dedicated Pokédex

Leave `app/pokedex/page.tsx` and `PokedexPageClient.tsx` mostly intact unless needed for shared small components. If shared tile components are extracted, ensure dedicated page tests or smoke tests still pass. The explicit no-results requirement applies to homepage Pokédex clicks; do not widen scope into a full dedicated Pokémon detail system.

### Bag/cart state

Add a local bag provider:

- Suggested file: `components/bag/BagContext.tsx`.
- Mount in `app/layout.tsx` inside or alongside `MusicProvider`.
- Store card ids in `localStorage` under a stable key such as `binderfinders:bag:v1`.
- Derive item details from `SHOP_CARDS` in `lib/data.ts`; do not duplicate card data in storage.
- API:
  - `items` or `cardIds`
  - `addCard(cardId)`
  - `removeCard(cardId)`
  - `clearBag()`
  - `count`
  - `total`
  - duplicate handling: adding the same card twice should not create duplicate rows; it may update an already-added state/confirmation.
- Add provider tests for persistence and totals.

### Card detail/add-to-bag page

Refactor `app/shop/page.tsx` or extract a client detail component:

- Keep server branching for invalid cards where useful, but move interactive Add to Bag into a client component such as `components/shop/CardDetailClient.tsx`.
- For `?card=<id>`, render a redesigned compact panel with card image, condition, price, and Add to Bag button.
- Add button should call bag context and render confirmation plus checkout CTA.
- Keep binder behavior (`components/binder/BinderSection.tsx`) stable: first click flips, second click routes to `/shop?card=<id>`.
- Remove or de-emphasize `?q` results flow if no longer needed by homepage; ensure direct `/shop` still works if tests require a full shop page.

### Checkout

Refactor `components/checkout/CheckoutMartClient.tsx`:

- Read bag context, not hardcoded `money`/`inBag`.
- `app/checkout/page.tsx` may still accept `searchParams.card`; if a card id is provided and the bag is empty, checkout may seed/add that card once for backward compatibility.
- UI should be compact and viewport-contained:
  - use `h-screen` or `min-h-[100svh]` plus internal scrolling regions.
  - avoid oversized cards/images on mobile.
  - show item list, total, contact fields, request hold button, and confirmation/empty states.
- No backend/API required; request hold is local confirmation only.

## Test strategy

Strict TDD is required for every code task:

1. Write/modify focused tests first and confirm they fail for the expected reason (RED).
2. Implement the smallest production change to pass (GREEN).
3. Add at least one triangulating assertion or edge case where useful (TRIANGULATE).
4. Refactor only after tests are green (REFACTOR).
5. Build must emit a TDD Cycle Evidence table for each task that touches code.

Focused test commands should use Jest paths, for example:

- `npm test -- components/__tests__/MusicContext.test.tsx --runInBand`
- `npm test -- components/about/__tests__/AboutSection.test.tsx --runInBand`
- `npm test -- components/pokedex/__tests__/PokedexSection.test.tsx --runInBand`
- `npm test -- components/bag/__tests__/BagContext.test.tsx --runInBand`
- `npm test -- app/shop/__tests__/page.test.tsx --runInBand`
- `npm test -- components/checkout/__tests__/CheckoutMartClient.test.tsx --runInBand`

Run `npm test -- --runInBand` and `npx tsc --noEmit` after the focused tasks.

## Steering / constitution check

| rule | status | waiver |
| --- | --- | --- |
| Steering/constitution present | n/a | No local steering file found |
| Scope matches product/tech constraints | pass | — |
| No forbidden dependency or workflow change | pass | — |

## Risks

- BGM playback depends on browser gesture/autoplay policy; Jest mocks prove code paths but a manual browser smoke check remains necessary.
- Checkout “functional as it should be” is broad; this plan limits functionality to local bag + local request-hold confirmation, not payments.
- The About redesign is subjective; tasks require concrete visual/content assertions but final visual acceptance may still need human review.
- Removing `/shop?q=` from homepage could affect existing tests and any implicit user flow; build should update tests intentionally rather than preserve stale results behavior.
- Code root is not a Git repository in this environment, so no staged-file verification can be performed here.