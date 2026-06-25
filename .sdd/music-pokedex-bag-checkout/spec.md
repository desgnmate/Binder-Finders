# Requirements Delta

## ADDED

### REQ: reliable-bgm-toggle

The music toggle must start, stop, and report background music playback from an explicit user click without causing browser download prompts. The toggle must use the existing music-on and muted artwork and must expose a deterministic loading, playing, muted, and missing-audio state that can be tested with mocked browser audio APIs.

Acceptance criteria:
- Clicking the toggle loads the existing `public/audio/littleroot-town.mp3`, starts looping playback, and switches the visible icon to the muted artwork while playing.
- Clicking the toggle again stops playback and switches the visible icon back to the music-on artwork.
- The implementation avoids direct user-facing `<audio src="/audio/littleroot-town.mp3">` download behavior; WebAudio or blob-backed playback is acceptable.
- Loading and missing-audio states are visible through accessible labels, titles, or data attributes.
- Unit tests mock browser audio/fetch behavior and prove `resume`, `decodeAudioData`, loop-source creation, `start`, and stop/toggle behavior.

### REQ: complete-about-redesign

The About section must be materially redesigned, not merely copy-edited. It must use Binder Finders' retro card-shop design language with strong black borders, yellow/blue accents, compact information cards, and clear collector-focused hierarchy.

Acceptance criteria:
- The About section keeps `data-about-section` and includes a primary heading, a collector promise or equivalent statement, process steps, and three proof/benefit cards.
- The layout is visually distinct from the current split block: it must include at least one prominent dark or device-like panel, decorative retro/card accents, and a reorganized content hierarchy.
- The section remains responsive, with compact spacing and no oversized panels on small screens.
- Tests assert key headings/content and structural markers for the redesigned layout.

### REQ: compact-homepage-pokedex-preview

The homepage Pokédex section must become a compact preview inspired by the dedicated Pokédex page, limited to two rows of Pokémon tiles, with a clear button to view the full Pokédex page.

Acceptance criteria:
- The homepage Pokédex renders no more than two rows worth of tiles using a stable responsive cap appropriate for the existing grid breakpoints.
- The section includes a visible CTA linking to `/pokedex` for the full Pokédex experience.
- The homepage section borrows device/header/search/filter visual language from the dedicated Pokédex page without becoming too large on small screens.
- Search/filter behavior within the preview remains usable and does not exceed the two-row preview cap.
- Tests update old expectations that all `POKEDEX_TILES` render on the homepage.

### REQ: no-homepage-pokedex-results-route

Clicking a Pokémon in the homepage Pokédex must no longer send users to the shop search/results flow.

Acceptance criteria:
- Homepage Pokédex tile hrefs or click handlers no longer navigate to `/shop?q=<pokemon>`.
- Clicking/selecting a homepage Pokémon either selects/previews it locally or routes to `/pokedex`; it must not open a shop results page.
- Tests assert that homepage tile links do not contain `/shop?q=`.
- Existing dedicated Pokédex behavior may keep its own interaction only if it does not conflict with the homepage requirement.

### REQ: local-bag-state

The storefront must have a local bag/cart state that can be used from card detail pages and checkout.

Acceptance criteria:
- A bag provider is mounted globally in `app/layout.tsx` or an equivalent persistent layout location.
- Bag contents persist across client-side navigation and reloads using `localStorage`.
- The bag supports adding a card by id, avoiding duplicate item rows, removing an item, clearing after request/confirmation, computing item count, and computing total price from `SHOP_CARDS`.
- Unit tests cover add, duplicate handling, remove, totals, persistence load, and persistence save.

### REQ: add-to-bag-card-detail

The card detail/add-to-bag page reached from binder cards must be redesigned and must add selected cards to the local bag instead of only linking directly to checkout.

Acceptance criteria:
- Binder cards may continue navigating to `/shop?card=<id>` after the existing flip interaction.
- The matching card detail view renders a compact redesigned add-to-bag panel with card image, condition, price, and a true Add to Bag button.
- Clicking Add to Bag writes the selected card to the bag, shows a confirmation/count state, and offers navigation to checkout.
- Invalid card ids still render the not-found state.
- Tests cover add-to-bag behavior and confirmation UI.

### REQ: functional-responsive-checkout

Checkout must be functional, bag-driven, compact on small screens, and constrained to a responsive `100vh` experience.

Acceptance criteria:
- Checkout reads the local bag and renders bag items, quantities/count, total price, and an empty-bag state.
- Checkout supports removing items and clearing the bag after a successful Request Hold/checkout action.
- The Request Hold action has form fields for buyer contact details, validates required fields, and renders a confirmation state without requiring backend services.
- The layout uses a `100vh`/`h-screen` or equivalent viewport-contained structure with internal scrolling for item/content panes, so it does not become oversized on small screens.
- Tests cover empty bag, populated bag from URL or localStorage, total calculation, remove item, validation, and successful hold confirmation.

## MODIFIED

## REMOVED
