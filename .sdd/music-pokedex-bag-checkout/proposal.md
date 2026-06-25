# Proposal: Music, Pokédex, bag, checkout, and About refresh

This run addresses the requested Binder Finders storefront improvements as one cohesive UX and commerce pass. It focuses on making background music reliably start from the existing toggle, replacing the homepage About block with a clearly new design, tightening the homepage Pokédex into a compact preview that does not open shop results pages, adding a real local add-to-bag flow from card detail pages, and making checkout functional and responsive.

## Scope

- Repair the BGM toggle so user clicks start actual looping background music and the on/mute icons reflect playback state.
- Redesign the About section with a materially different retro card-shop layout, stronger hierarchy, and concrete visual elements.
- Redesign the homepage Pokédex preview to borrow from the dedicated Pokédex page language while staying compact, capped to two rows, and linking users to the full Pokédex page.
- Remove the homepage Pokémon-click-to-shop-results flow; Pokémon tiles should not route to `/shop?q=...`.
- Add local bag state, persistence, add-to-bag behavior, and a compact cart/checkout experience.
- Redesign the card detail/add-to-bag view reached from binder cards.
- Make checkout usable within a responsive `100vh` layout with totals, item management, contact/hold request flow, and sensible empty-bag behavior.

## Out of scope

- Real payment processing, taxes, shipping quotes, inventory reservation APIs, email delivery, or backend order storage.
- New product data sources beyond `lib/data.ts`.
- A full dedicated card-detail route per Pokémon species.
- Replacing the existing dedicated Pokédex route; this run only aligns and complements it.

## Rationale

The current site has strong visual direction but several interactions are still presentational. The requested changes turn key storefront affordances into testable behavior while preserving the retro Pokémon-card design language. Because the project has Jest and touches code, downstream build must use strict TDD.