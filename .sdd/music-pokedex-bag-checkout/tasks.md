# Tasks: Music, Pokédex, bag, checkout, and About refresh

## Task List

### T001 — Repair and test BGM toggle playback

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/MusicContext.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/MusicToggle.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/__tests__/MusicContext.test.tsx` (new)
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/__tests__/MusicToggle.test.tsx` (new)
- detail: Add mocked WebAudio/fetch tests first. Make toggle click resume/decode/start a looping BGM source, stop on second click, expose loading/missing/playing state, and swap music-on/mute icons. Keep using the existing audio and image assets; do not add dependencies.
- evidence: `npm test -- components/__tests__/MusicContext.test.tsx components/__tests__/MusicToggle.test.tsx --runInBand` passes, plus build notes include manual browser smoke steps for BGM click playback.
- review: ~210 changed lines

### T002 — Redesign About section with concrete test coverage

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/about/AboutSection.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/about/__tests__/AboutSection.test.tsx` (new)
- detail: Write tests for the new About structure before implementation: primary heading, collector promise/device panel, process steps, proof cards, and compact responsive class markers. Replace the existing section with a materially different retro card-shop layout using yellow/cream, black borders, blue accents, and compact cards.
- evidence: `npm test -- components/about/__tests__/AboutSection.test.tsx --runInBand` passes.
- review: ~180 changed lines

### T003 — Compact homepage Pokédex preview and remove results routing

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/pokedex/PokedexSection.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/pokedex/__tests__/PokedexSection.test.tsx`
- detail: Update tests first so homepage Pokédex no longer expects all tiles or `/shop?q=` links. Implement compact dedicated-Pokédex-inspired visual treatment, cap visible tiles to a two-row preview constant, preserve search within the cap, and add a `View full Pokédex` CTA to `/pokedex`. Homepage tile clicks should select/preview locally or route to `/pokedex`, never `/shop?q=`.
- evidence: `npm test -- components/pokedex/__tests__/PokedexSection.test.tsx --runInBand` passes.
- review: ~260 changed lines

### T004 — Add local bag provider with persistence

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/bag/BagContext.tsx` (new)
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/bag/__tests__/BagContext.test.tsx` (new)
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/layout.tsx`
- detail: Write provider tests first for empty state, add card, duplicate handling, remove, clear, total, count, localStorage load, and localStorage save. Implement `BagProvider` and mount it globally without disrupting `MusicProvider` or existing layout.
- evidence: `npm test -- components/bag/__tests__/BagContext.test.tsx --runInBand` passes.
- review: ~240 changed lines

### T005 — Redesign card detail add-to-bag page

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/shop/page.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/shop/__tests__/page.test.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/shop/CardDetailClient.tsx` (new)
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/shop/__tests__/CardDetailClient.test.tsx` (new)
- detail: Write tests first for card detail rendering, Add to Bag button behavior, confirmation/count state, checkout CTA, and invalid-card fallback. Extract an interactive client detail component if needed. Replace the direct checkout link with a real bag write. Do not change binder card flip/navigation behavior except as required to preserve `/shop?card=<id>` detail entry.
- evidence: `npm test -- app/shop/__tests__/page.test.tsx components/shop/__tests__/CardDetailClient.test.tsx --runInBand` passes.
- review: ~310 changed lines

### T006 — Make checkout bag-driven and responsive

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/checkout/page.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/checkout/CheckoutMartClient.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/checkout/__tests__/CheckoutMartClient.test.tsx` (new)
- detail: Write tests first for empty bag, seeded card from `?card=`, bag item rendering, total calculation, remove item, required contact validation, successful Request Hold confirmation, bag clearing, and `100vh`/compact responsive layout class markers. Replace hardcoded money/inBag with bag-derived state and keep all behavior local (no backend/payment integration).
- evidence: `npm test -- components/checkout/__tests__/CheckoutMartClient.test.tsx --runInBand` passes.
- review: ~360 changed lines

### T007 — Integration cleanup and regression sweep

- [x] files:
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/layout.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/app/page.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/components/pokedex/PokedexPageClient.tsx`
  - `E:/DEV_WORKS/BINDER FINDERS/binderfinders-hero/__tests__/tokens.test.ts`
- detail: Pure integration/regression task. Update only if earlier tasks require provider ordering, homepage wiring, or dedicated Pokédex interaction consistency. Add or adjust smoke assertions rather than broad rewrites. If no production changes are needed, record why in TDD evidence and run the full suite. This task may include a manual browser smoke checklist for BGM, add-to-bag, and checkout.
- evidence: `npx tsc --noEmit && npm test -- --runInBand` passes.
- review: ~90 changed lines

## TDD forwarding instructions for zero-build

Strict TDD is on because there is no `.sdd/config.json` opting out and the project has Jest. For every code task above, zero-build must:

1. Start by writing/updating the focused test listed in `files:`.
2. Run the focused command and capture the expected RED failure.
3. Implement the smallest GREEN production change.
4. Add at least one triangulating assertion/edge case where appropriate.
5. Refactor only while the focused tests remain green.
6. Emit a `TDD Cycle Evidence` table for each task touching code, with RED, GREEN, TRIANGULATE, REFACTOR notes and commands.

Do not mark a task complete only because the full test suite passes; the evidence must map back to that task's acceptance criteria.

## Review Workload

Budget per task: 400 changed lines.

| task | estimate | PR batch |
| --- | ---: | --- |
| T001 | ~210 | Batch 1: foundation/audio |
| T002 | ~180 | Batch 2: content/preview UX |
| T003 | ~260 | Batch 2: content/preview UX |
| T004 | ~240 | Batch 3: commerce state |
| T005 | ~310 | Batch 3: commerce state |
| T006 | ~360 | Batch 4: checkout |
| T007 | ~90 | Batch 5: integration sweep |

**Total: ~1650 changed lines**

Over-budget exceptions: none.

Suggested chained PR batches if the run is split later:

1. Foundation/audio: T001.
2. Homepage content and Pokédex preview: T002, T003.
3. Bag and card detail: T004, T005.
4. Checkout: T006.
5. Integration sweep: T007.

Ordering constraints: T005 and T006 depend on T004; T007 must run last. T002 and T003 are independent of commerce work and may run in parallel after T001 if build orchestration supports it.