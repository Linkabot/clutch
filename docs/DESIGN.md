# Design

The single reference for Clutch's visual language (Decision 13 — Signage
base, `docs/DECISIONS.md`): the design tokens in `src/app/theme.css`, the
type scale, and the five UI primitives in `src/ui/`. New screens should
compose these rather than hand-rolling colours, spacing or fonts.

## Tokens

Every colour is a literal 6-digit hex custom property defined once in
`:root` (light mode) in `src/app/theme.css`, with a subset overridden
inside `@media (prefers-color-scheme: dark)`. Sign, plate, roundel and
marking colours are deliberately **not** redefined in dark mode — real
road signs are reflective, not backlit (Decision 13) — so the table below
shows "same" for those rows under Dark.

| Token                           | Light     | Dark                | Used for                                                                                        |
| ------------------------------- | --------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `--color-page`                  | `#F4F3EE` | `#101216`           | app background                                                                                  |
| `--color-surface`               | `#FFFFFF` | `#1B1E24`           | cards, sheets, `Chip`, `Button` secondary                                                       |
| `--color-hairline`              | `#DDDBD3` | `#2C3038`           | 1px borders/dividers, `Button` secondary border, `Chip` neutral ring                            |
| `--color-ink`                   | `#15171C` | `#F1F0EA`           | body text, `Button` secondary text, `Chip` text                                                 |
| `--color-muted`                 | `#5E6168` | `#A3A6AD`           | secondary text                                                                                  |
| `--color-tab-bar`               | `#FFFFFF` | `#16181D`           | tab bar background                                                                              |
| `--color-tab-active`            | `#0A5DB0` | `#5AA8F2`           | active tab; focus-visible outline on `Button`/`Roundel`                                         |
| `--color-tab-inactive`          | `#6B6E75` | `#8D9098`           | inactive tab                                                                                    |
| `--color-sign-blue`             | `#0A5DB0` | same                | `SignPanel` blue fill, `SignPlate` current tone, `Chip` advice ring                             |
| `--color-sign-blue-shadow`      | `#073F78` | same                | reserved for future blue-panel shading                                                          |
| `--color-sign-green`            | `#00703C` | same                | `SignPanel` green fill                                                                          |
| `--color-sign-green-shadow`     | `#004F2A` | same                | reserved for future green-panel shading                                                         |
| `--color-sign-red`              | `#D4202C` | same                | `Roundel` ring, `Chip` law ring                                                                 |
| `--color-sign-ink`              | `#15171C` | same (amendment P1) | `Button` primary text, `SignPlate` text/border, `Roundel` number — stays dark even in dark mode |
| `--color-marking-yellow`        | `#FFCC00` | same                | `Button` primary fill, `Roundel` selected halo                                                  |
| `--color-marking-yellow-shadow` | `#C49B00` | same                | `Button` primary press-down shadow                                                              |
| `--color-map-grass`             | `#8ACB6A` | `#1C352E`           | reserved for the Journey map (Phase 2+)                                                         |
| `--color-map-trees-1`           | `#5FA544` | same                | reserved for the Journey map (Phase 2+)                                                         |
| `--color-map-trees-2`           | `#79BF5A` | same                | reserved for the Journey map (Phase 2+)                                                         |
| `--color-road`                  | `#3A3F4B` | `#2A2F3E`           | reserved for the Journey map (Phase 2+)                                                         |
| `--color-road-strip`            | `#2B2E35` | same                | reserved for the Journey map (Phase 2+)                                                         |
| `--color-on-sign`               | `#FFFFFF` | same                | text on a coloured sign; `SignPanel` inner border; `SignPlate`/`Roundel` white background       |

Radii and one dimension token, also from `src/app/theme.css` (no light/dark
split — signage shapes do not change with colour scheme):

| Token                  | Value  | Used for                                |
| ---------------------- | ------ | --------------------------------------- |
| `--tab-bar-height`     | `56px` | tab bar height                          |
| `--radius-panel`       | `14px` | `SignPanel` outer corners (normal size) |
| `--radius-panel-inner` | `10px` | `SignPanel` inner white border corners  |
| `--radius-button`      | `10px` | `Button` corners                        |
| `--radius-card`        | `12px` | reserved for card-style surfaces        |
| `--radius-plate`       | `4px`  | `SignPlate` corners                     |

## Type scale

- Body text: Atkinson Hyperlegible, 17px, line-height 1.5 — set on `body`,
  not `html`, so Tailwind's rem-based spacing keeps its 16px root
  (amendment P2).
- Headings (`h1`–`h4`, `.font-display`): Overpass, weight 800, line-height
  1.2.
- `.lead`: 19px, for a screen's lead paragraph.
- `.sign-label`: Overpass, weight 800, 13px, 1.5px letter-spacing,
  uppercase — the header wordmark and similar all-caps sign text.
- Form fields (`input`, `select`, `textarea`, `button`): 16px minimum, so
  iOS Safari never zooms in on focus.

## Primitives (`src/ui/`)

All five are re-exported from `src/ui/index.ts` and styled from a single
stylesheet, `src/ui/primitives.css` (imported once, from `src/main.tsx`,
after `theme.css`) — tokens only, no hard-coded colours.

### SignPanel

`src/ui/SignPanel.tsx` — props `colour: 'blue' | 'green'`,
`size?: 'normal' | 'small'` (default `'normal'`), `children`. A coloured
outer frame (`--radius-panel`, 5px padding; small: 8px radius, 3px
padding) holding a 2.5px `--color-on-sign` inner border
(`--radius-panel-inner`); content colour is `--color-on-sign`. Used for
the header wordmark (Step 5) and other short blue/green sign-style
callouts.

### SignPlate

`src/ui/SignPlate.tsx` — props `tone?: 'default' | 'current'` (default
`'default'`), `children`. A white plate (`--color-on-sign` background)
with a 1.5px `--color-sign-ink` border and Overpass 700 14px text;
`tone="current"` fills the plate with `--color-sign-blue` and switches the
text to `--color-on-sign`. Border and text use `--color-sign-ink`, not
`--color-ink` (amendment P1), so the plate reads the same in light and
dark mode.

### Roundel

`src/ui/Roundel.tsx` — props `value: string | number`,
`selected?: boolean` (default `false`), `onClick?: () => void`. A 44px
circle, white with a 4px `--color-sign-red` ring and an Overpass 900
number in `--color-sign-ink` (amendment P1); `selected` thickens the ring
to 6px and adds a `--color-marking-yellow` halo via `box-shadow`. Renders
a `<button>` when `onClick` is given, otherwise a non-interactive
`<span>`.

### Button

`src/ui/Button.tsx` — props `variant: 'primary' | 'secondary'` plus every
native `<button>` attribute. Primary: `--color-marking-yellow` background,
`--color-sign-ink` text (amendment P1), `--radius-button` corners, 50px
height, `0 4px 0 var(--color-marking-yellow-shadow)` shadow that collapses
on `:active` (`transform: translateY(4px)`, no shadow,
`transition: transform 80ms`). Secondary: `--color-surface` background,
2px `--color-hairline` border. Minimum 44×44px tap target either way.

### Chip

`src/ui/Chip.tsx` — props `tone: 'law' | 'advice' | 'neutral'`,
`children`. A small pill: `--color-surface` background, `--color-ink` text
(amendment P1 — background and text stay neutral); only the ring changes:
`--color-sign-red` (law), `--color-sign-blue` (advice), `--color-hairline`
(neutral). Intended for the rule page (Step 16) to mark a Highway Code
rule MUST/MUST NOT (law) or advisory.

## Motion policy

- The only motion in Phase 1 is the primary `Button`'s press-down shadow
  (`transition: transform 80ms`).
- `prefers-reduced-motion: reduce` (set in `src/app/theme.css`, Step 2)
  collapses every animation and transition app-wide to near-zero duration,
  including that press-down.
- The Journey map, quiz sheet, confetti, XP counter and animated
  stopping-distance road shown in the Decision 13 mockups are references
  for Phases 2–4 only; none of them are built in Phase 1
  (`docs/DECISIONS.md`).

## Brand safety

- No GDS Transport typeface — Clutch self-hosts Overpass and Atkinson
  Hyperlegible instead (Step 3).
- No crown or Royal Arms, no gov.uk page styling.
- A visible line — "Not an official DVSA or government app." — is shown
  in-app on the Me tab (Step 6).

## Contrast check

`npm run check:contrast` (`scripts/check-contrast.mjs`) reads the literal
hex tokens in `src/app/theme.css`, merges the dark overrides over the
light values, and asserts every required foreground/background pair
reaches WCAG AA (4.5:1) in **both** colour schemes: `ink/page`,
`ink/surface`, `muted/page`, `muted/surface`, `tab-inactive/tab-bar`,
`tab-active/tab-bar`, `on-sign/sign-blue`, `on-sign/sign-green`,
`on-sign/sign-red`, `sign-ink/marking-yellow`, `sign-ink/on-sign`. It
stops the build the moment any Decision 13 colour pairing becomes
illegible in light or dark mode, without ever changing Lincoln's chosen
palette itself — a failing pair is reported and the colours stay his
decision.

## Built in Phase 1 vs. Deferred

**Built in Phase 1:**

- The tokens above (light and dark), the type scale, and the
  reduced-motion rule.
- Self-hosted, precached fonts — Overpass and Atkinson Hyperlegible — with
  no Google Fonts reference anywhere.
- The shell restyle: the sign-panel header (with back button) and the icon
  tab bar, including the Learn tab's `alsoActiveFor: ['/code']`
  highlighting for the Rule deep link.
- The five primitives above: `SignPanel`, `SignPlate`, `Roundel`, `Button`,
  `Chip`.
- The Highway Code section list and section screen, the rule page
  (`/code/rule/:id`) with its law/advice `Chip`, and the static,
  colour-coded Rule 126 stopping-distance table.
- Offline search over the whole Highway Code.

**Deferred** to Phases 2–4 (Decision 13 mockup references, not built here):

- The Journey map.
- The quiz sheet and its correct-answer animation.
- Confetti, XP and streaks.
- The animated stopping-distance road — Rule 126 gets the static table
  above instead, because the official chart is an image with empty alt
  text and Phase 1 ships no images (see `docs/CONTENT-GUIDE.md`, Known
  limitations).
- The `Roundel` primitive exists (built above) but nothing uses it yet;
  its first consumer is one of the Deferred features.
