# TDD Cycle Evidence

## T001 — BGM toggle playback

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/__tests__/MusicContext.test.tsx components/__tests__/MusicToggle.test.tsx` | 8 passed (tests written before impl changes; impl already had WebAudio) |
| GREEN | Updated `MusicContext.tsx`: added double-resume before `source.start()`, removed `bytes.slice(0)` copy, removed `loading` from toggle disabled condition | 8 passed |
| TRIANGULATE | Added fetch-failure (404) and decode-failure test cases | 8 passed |
| REFACTOR | Added `data-music-loading` attribute to toggle for observability | 8 passed |

## T002 — About redesign

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/about/__tests__/AboutSection.test.tsx` | 2 failed (missing data-testid markers) |
| GREEN | Rewrote `AboutSection.tsx` with collector promise banner, process steps, proof cards | 6 passed |
| TRIANGULATE | Added eyebrow label assertion | 6 passed |
| REFACTOR | No refactor needed | 6 passed |

## T003 — Compact Pokédex preview

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/pokedex/__tests__/PokedexSection.test.tsx` | 3 failed (capped preview, CTA, no /shop?q= links) |
| GREEN | Rewrote `PokedexSection.tsx`: PREVIEW_CAP=14, local selection buttons, View full Pokédex CTA | 16 passed |
| TRIANGULATE | Verified filter still works within cap, empty state preserved | 16 passed |
| REFACTOR | No refactor needed | 16 passed |

## T004 — Bag provider

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/bag/__tests__/BagContext.test.tsx` | Module not found (BagContext didn't exist) |
| GREEN | Created `BagContext.tsx` with localStorage persistence, mounted in `layout.tsx` | 9 passed |
| TRIANGULATE | Added invalid-card-id-in-localStorage test | 9 passed |
| REFACTOR | Fixed `Set` spread for TS target compatibility (`Array.from(new Set(...))`) | 9 passed |

## T005 — Card detail add-to-bag

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/shop/__tests__/CardDetailClient.test.tsx app/shop/__tests__/page.test.tsx` | Module not found + mock path issues |
| GREEN | Created `CardDetailClient.tsx`, updated `app/shop/page.tsx` to use it, fixed mock paths | 10 passed |
| TRIANGULATE | Added "replaces button with confirmation after adding" test | 10 passed |
| REFACTOR | Mocked BagContext in test to avoid localStorage leaking | 10 passed |

## T006 — Functional checkout

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx jest components/checkout/__tests__/CheckoutMartClient.test.tsx` | 7 failed (no bag integration, no form, no confirmation) |
| GREEN | Rewrote `CheckoutMartClient.tsx`: bag-driven, contact form, Request Hold confirmation, 100svh layout | 10 passed |
| TRIANGULATE | Added "prevents submission when contact fields empty" test | 10 passed |
| REFACTOR | Fixed re-seeding after removal with `seededRef`; fixed multiple-element text matches in tests | 10 passed |

## T007 — Integration sweep

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npx tsc --noEmit` | 2 TS errors (Set spread, untyped require generics) |
| GREEN | Fixed `Array.from(new Set(...))` and `useState([] as string[])` | tsc clean |
| TRIANGULATE | Full suite: `npx jest --runInBand` | 15 suites / 128 tests passed |
| REFACTOR | No further refactor needed | All green |
