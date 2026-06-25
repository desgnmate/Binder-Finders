# BinderFinders — Hero

Next.js 14 (App Router) + TypeScript + Tailwind v3 implementation of the
BinderFinders hero section, designed 1:1 from
`Proposed designs and brief/HERO DRAFT SAMPLE.png`.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Jest + React Testing Library
npm run build    # production build
```

## Font swap (TAN st. Canard)

The brief calls for **TAN st. Canard** on the headline. That typeface is
commercial and not on Google Fonts, so this scaffold uses **DM Serif Display**
(also loaded via `next/font/google`) as the dev-time proxy. The swap is
one CSS variable away:

1. Drop `tan-st-canard.woff2` into `public/fonts/`.
2. Add an `@font-face` declaration in `app/globals.css` (template already
   provided as a comment).
3. Change `--font-headline` in `:root` from
   `var(--font-headline-proxy, "DM Serif Display")` to
   `"TAN st. Canard", var(--font-headline-proxy, "DM Serif Display")`.

No component code needs to change. Components consume
`font-headline` (Tailwind utility) which resolves to `var(--font-headline)`.

## Brand tokens

Defined in `tailwind.config.ts` and consumed as Tailwind utilities:

| Token           | Hex       | Usage                                    |
|-----------------|-----------|------------------------------------------|
| `brand-yellow`  | `#FEDD25` | Hero background                          |
| `brand-blue`    | `#3194EE` | Accent / links                           |
| `brand-pink`    | `#FFD6E0` | Pastel pink accent                       |
| `ink-black`     | `#1A1A1A` | Body text, CTA button fill               |
| `cream`         | `#FFF6E0` | Nav pill background                      |

## Project layout

```
app/                    Next.js App Router (layout, page, globals)
components/hero/        Hero, HeroNav, HeroContent
hooks/                  useScrollPosition
__tests__/hero/         Jest + RTL test files
public/fonts/           Place the real TAN st. Canard .woff2 here
```

## Reference

- Design: `Proposed designs and brief/HERO DRAFT SAMPLE.png`
- Brief: `Proposed designs and brief/Copy of BinderFinders Website.docx`
