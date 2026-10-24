# Client notes, part 2 — implementation handoff

Source: `WEBSITE NOTES PT2..pdf` (three pages). Baseline: `3c5f5dd`.
Work is local on `revision/client-notes-pt2`; nothing has been deployed.

## Implemented

- Preserved the existing visual identity, hero animation, binder focus/flip effects, era tabs, and dedicated Pokédex page.
- Simplified the homepage Pokédex preview to a larger sprite, number, name, generation, and types. Reduced its TV overlay and replaced prices with catalog availability counts. Empty searches no longer retain a stale preview.
- Linked hero carousel cards to their shop inspection views. Duplicate carousel copies remain out of keyboard navigation.
- Pointed “Shop Cards” to the homepage binder; retained “Shop Now” as the shop entry.
- Enlarged yellow price stickers and added optional desktop 4/6/8-column density controls, retaining four columns by default and responsive mobile layouts.
- Added binder search/type filtering and per-card quick add in both grids. Existing shop search/type/set filters remain intact.
- Changed shop inspection to an explicitly opened, closable dialog instead of automatically expanding the first result. Preserved filters and scroll during normal open/close navigation.
- Removed generic descriptions from inspection UI, retained card numbers without the redundant “Card #” prefix, and added stable enlarged front/back image views.
- Follow-up: enlarged images now use bounded mouse/touch dragging instead of image scrollbars, with +/− zoom (100–400%), reset, and keyboard arrow panning in both shop and binder. Changing sides or resizing resets the view to fit.
- Added accessible close/Escape handling, focus restoration, and background scroll locking for inspection views.
- Added cart thumbnails and links back to listings. Preserved the existing saved-bag format and corrected a hydration race that could overwrite a saved bag with a checkout URL card.
- Guarded quick add against unknown/unavailable cards and duplicate additions.

## Deliberately unchanged or awaiting a decision

- Replacing About with reviews was tentative: About remains. No fabricated testimonials.
- Recently sold listings need actual sold records and an agreed presentation.
- Exact Canva brand fonts need names/files and appropriate licensing.
- Hold duration, reservation rules, emails, payment, and order processing need business decisions and backend implementation. The current hold flow remains a local demo, not an actual stock reservation.
- There is no existing CMS integration: catalog content remains in `lib/data.ts`. No CMS, database migration, or external service was introduced.
- Availability counts count matching available catalog listings, not verified physical stock. Legacy entries without an availability field count as available; explicitly sold/unavailable entries do not.
- Existing CDN card imagery remains unchanged. The back image is explicitly identified as a generic reference unless a listing supplies its own back image. Real listing scans and image-to-listing accuracy still require client-provided assets/review.

## Safety and verification

### Responsive follow-up

- Fluid, height-aware hero typography/spacing and a smaller navigation bar keep the full card row visible on short laptop screens.
- Tablet navigation switches to the existing menu; icon-only bag links now have accessible names.
- Responsive refinements cover About, homepage/dedicated Pokédex, binder controls and cards, shop filters, inspection dialogs, cart, and contact/footer. Branding and animation transforms are retained.
- Mobile/short-screen footers use normal document flow when a fixed reveal would make content unreachable; desktop reveal remains when it fits. A resize regression test covers both modes and spacer cleanup.
- Browser viewport matrix: 320×568, 390×844, 768×1024, 1024×600, 1280×720, and 1440×900. Check all four routes, not only the homepage. Mobile form text remains 16px to avoid focus zoom.
- Responsive overrides are isolated in `app/responsive.css`, imported after the existing stylesheet.
- Desktop correction: all compact overrides now stop at 1535px. At 1536px and wider, original component styles apply, including 32px outer padding for About and both Pokédex sections. Removed the later guessed 1600px About and 1456px navigation overrides. Verified at 1920px: About/Pokédex panels are 1856px wide with 32px gutters; original footer content remains 1280px centered. Laptop 1280×720 and mobile 390×844 retain compact sizing.

- Existing routes, listing IDs/prices, bag storage key, dedicated Pokédex details, and hold submission behavior were retained.
- No dependency upgrades, remote writes, deployment, production data changes, or destructive migration.
- Regression suite: `npm test -- --runInBand`.
- Isolated production check: `BINDERFINDERS_DIST_DIR=.next-review npm run build`, then `BINDERFINDERS_DIST_DIR=.next-review npm exec next -- start -p 3101`.
- `.next-review` is ignored by Git. This prevents QA builds from overwriting the active development server's `.next` output.
- Browser checks cover desktop/mobile layouts, filtered inspection, Escape/focus restoration, nested binder enlargement, density/scroll retention, and saved-bag thumbnails after reload.
- Before production release, review these local changes, supply final brand/content/assets, and separately define/test any real inventory or checkout integration.
