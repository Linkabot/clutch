# Design

The single reference for Clutch's visual language (Decision 13 — Signage
base, `docs/DECISIONS.md`): the design tokens in `src/app/theme.css`, the
type scale, and the eight UI primitives in `src/ui/` (`SignPanel`,
`SignPlate`, `Roundel`, `Button`, `Chip`, `ListRow`, `SegmentedControl`,
`LoadFailed`). New screens should compose these rather than hand-rolling
colours, spacing or fonts.

## Tokens

Every colour is a literal 6-digit hex custom property defined once in
`:root` (light mode) in `src/app/theme.css`, with a subset overridden
inside `@media (prefers-color-scheme: dark)`. Sign, plate, roundel and
marking colours are deliberately **not** redefined in dark mode — real
road signs are reflective, not backlit (Decision 13) — so the table below
shows "same" for those rows under Dark.

| Token                           | Light     | Dark      | Used for                                                                                        |
| ------------------------------- | --------- | --------- | ----------------------------------------------------------------------------------------------- |
| `--color-page`                  | `#F4F3EE` | `#101216` | app background                                                                                  |
| `--color-surface`               | `#FFFFFF` | `#1B1E24` | cards, sheets, `Chip`, `Button` secondary                                                       |
| `--color-hairline`              | `#DDDBD3` | `#2C3038` | 1px borders/dividers, `Button` secondary border, `Chip` neutral ring                            |
| `--color-ink`                   | `#15171C` | `#F1F0EA` | body text, `Button` secondary text, `Chip` text                                                 |
| `--color-muted`                 | `#5E6168` | `#A3A6AD` | secondary text                                                                                  |
| `--color-tab-bar`               | `#FFFFFF` | `#16181D` | tab bar background                                                                              |
| `--color-tab-active`            | `#0A5DB0` | `#5AA8F2` | active tab; focus-visible outline on `Button`/`Roundel`                                         |
| `--color-tab-inactive`          | `#6B6E75` | `#8D9098` | inactive tab                                                                                    |
| `--color-link`                  | `#1D4ED8` | `#8AB4F8` | `a.text-link` (PS16): an inline link inside a paragraph of reading text                         |
| `--color-press`                 | `#E6E8EC` | `#2A2D33` | the shared press-state fill (background only, M02) and `.segmented`'s track background          |
| `--color-sign-blue`             | `#0A5DB0` | same      | `SignPanel` blue fill, `SignPlate` current tone, `Chip` advice ring                             |
| `--color-sign-blue-shadow`      | `#073F78` | same      | reserved for future blue-panel shading                                                          |
| `--color-sign-green`            | `#00703C` | same      | `SignPanel` green fill                                                                          |
| `--color-sign-green-shadow`     | `#004F2A` | same      | the correct/answer feedback border shadow in Tap the sign and Sign Sprint                       |
| `--color-sign-red`              | `#D4202C` | same      | `Roundel` ring, `Chip` law ring                                                                 |
| `--color-band-orange`           | `#B45309` | same      | the orange (middle) score-band panel fill under `--color-on-sign` text (Q9); light block only   |
| `--color-sign-ink`              | `#15171C` | same      | `Button` primary text, `SignPlate` text/border, `Roundel` number — stays dark even in dark mode |
| `--color-marking-yellow`        | `#FFCC00` | same      | `Button` primary fill, `Roundel` selected halo                                                  |
| `--color-marking-yellow-shadow` | `#C49B00` | same      | `Button` primary press-down shadow                                                              |
| `--color-map-grass`             | `#8ACB6A` | `#1C352E` | Sign Sprint's and the Decoder's ground scenery (`.sprint__ground`, `.decoder__ground`)          |
| `--color-map-trees-1`           | `#5FA544` | same      | Sign Sprint's and the Decoder's tree scenery                                                    |
| `--color-map-trees-2`           | `#79BF5A` | same      | Sign Sprint's and the Decoder's tree scenery                                                    |
| `--color-road`                  | `#3A3F4B` | `#2A2F3E` | reserved for the Journey map (Phase 4)                                                          |
| `--color-road-strip`            | `#2B2E35` | same      | `.game-top-bar__track`'s background, the progress bar at the top of a question screen           |
| `--color-on-sign`               | `#FFFFFF` | same      | text on a coloured sign; `SignPanel` inner border; `SignPlate`/`Roundel` white background       |

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

Type scale and page rhythm tokens (Step 3a, M03/M04), light `:root` only —
signage shapes and page rhythm do not change with colour scheme:

| Token              | Value  | Used for                                                                                  |
| ------------------ | ------ | ----------------------------------------------------------------------------------------- |
| `--font-size-h1`   | `28px` | tab-root and inner-page big headings (plain `h1`, `.app-header__title`), line-height 1.15 |
| `--font-size-h2`   | `22px` | section headings (`h2`)                                                                   |
| `--font-size-h3`   | `18px` | `h3`                                                                                      |
| `--font-size-h4`   | `16px` | `h4`                                                                                      |
| `--space-page-top` | `24px` | `.app-main`'s top padding under the header band                                           |
| `--space-section`  | `24px` | vertical rhythm between page sections, e.g. `.load-failed`'s padding                      |
| `--space-stack`    | `12px` | small vertical gaps, e.g. `.today`'s flex gap, `.segmented`'s margin                      |

## Type scale

- Body text: Atkinson Hyperlegible, 17px, line-height 1.5 — set on `body`,
  not `html`, so Tailwind's rem-based spacing keeps its 16px root.
- Headings (`h1`–`h4`, `.font-display`): Overpass, weight 800, line-height
  1.2.
- `.lead`: 19px, for a screen's lead paragraph.
- `.sign-label`: Overpass, weight 800, 13px, 1.5px letter-spacing,
  uppercase — the header wordmark and similar all-caps sign text.
- Form fields (`input`, `select`, `textarea`, `button`): 16px minimum, so
  iOS Safari never zooms in on focus.

## Primitives (`src/ui/`)

`src/ui/` holds eight primitive components. Five (`SignPanel`, `SignPlate`,
`Roundel`, `Button`, `Chip`) are re-exported from `src/ui/index.ts`; the
other three (`ListRow`, `SegmentedControl`, `LoadFailed`) are deliberately
outside that barrel and are imported straight from their own files (each
one's own header comment says so). All eight are styled from a single
stylesheet, `src/ui/primitives.css` (imported once, from `src/main.tsx`,
after `theme.css`) — tokens only, no hard-coded colours.

### SignPanel

`src/ui/SignPanel.tsx` — props `colour: 'blue' | 'green'`,
`size?: 'normal' | 'small'` (default `'normal'`), `block?: boolean`
(default `false`, M12), `children`. A coloured outer frame
(`--radius-panel`, 5px padding; small: 8px radius, 3px padding) holding a
2.5px `--color-on-sign` inner border (`--radius-panel-inner`); content
colour is `--color-on-sign`. Used for the header wordmark in
`src/app/App.tsx` and other short blue/green sign-style callouts.
`block` (`.sign-panel--block`: `display: block; width: 100%;
box-sizing: border-box;`) turns the panel into a full-width block instead
of an inline element, for the Learn tab's cards, Today's Traffic signs
card, and the rule-badge list rows in the Highway Code hub, search and
section screens.

### ListRow

`src/ui/ListRow.tsx` (M05) — a full-width tappable row that navigates via
`react-router-dom`'s `Link`: props `to: string`, `leading?: ReactNode`,
`title: ReactNode`, `subtitle?: ReactNode`, `trailing?: ReactNode`,
`state?: unknown`. At least 56px tall, a bottom hairline, a 16px title and
an optional 14px muted subtitle; `trailing` defaults to a chevron when not
given. Purely presentational, no state of its own; its press-state fill
is the shared rule below, not a rule of its own. Used by the Highway Code
hub, search and section screens, the shared `EndScreen`'s sign list, and
the Me screen's rows.

### SegmentedControl

`src/ui/SegmentedControl.tsx` (Q15) — a `role="tablist"` of equal-width
options in a light grey (`--color-press`) rounded track, the selected
option a raised white pill with ink text: props `label: string`,
`options: { id: string; label: string }[]`, `value: string`,
`onChange: (id: string) => void`. Purely presentational — the caller owns
`value` and reacts to `onChange`. Used by the Highway Code hub's
Rules / Signs & signals / Annexes tabs and by Sign Sprint's start page for
its Length picker.

### LoadFailed

`src/ui/LoadFailed.tsx` — a load-failure notice: prop `onRetry: () => void`.
Renders `role="alert"` with the text "This didn't load." and a primary
`Retry` button. Used directly by the sign page, and through the shared
`QuestionScreen` by Tap the sign and Sign Sprint, and by Sign Sprint's
start page.

### SignPlate

`src/ui/SignPlate.tsx` — props `tone?: 'default' | 'current'` (default
`'default'`), `children`. A white plate (`--color-on-sign` background)
with a 1.5px `--color-sign-ink` border and Overpass 700 14px text;
`tone="current"` fills the plate with `--color-sign-blue` and switches the
text to `--color-on-sign`. Border and text use `--color-sign-ink`, not
`--color-ink`, so the plate reads the same in light and
dark mode.

### Roundel

`src/ui/Roundel.tsx` — props `value: string | number`,
`selected?: boolean` (default `false`), `onClick?: () => void`. A 44px
circle, white with a 4px `--color-sign-red` ring and an Overpass 900
number in `--color-sign-ink`; `selected` thickens the ring
to 6px and adds a `--color-marking-yellow` halo via `box-shadow`. Renders
a `<button>` when `onClick` is given, otherwise a non-interactive
`<span>`.

### Button

`src/ui/Button.tsx` — props `variant: 'primary' | 'secondary'` plus every
native `<button>` attribute. Primary: `--color-marking-yellow` background,
`--color-sign-ink` text, `--radius-button` corners, 50px
height, `0 4px 0 var(--color-marking-yellow-shadow)` shadow that collapses
on `:active` (`transform: translateY(4px)`, no shadow,
`transition: transform 80ms`). Secondary: `--color-surface` background,
2px `--color-hairline` border. Minimum 44×44px tap target either way.

### Chip

`src/ui/Chip.tsx` — props `tone: 'law' | 'advice' | 'neutral'`,
`children`. A small pill: `--color-surface` background, `--color-ink` text
(background and text stay neutral); only the ring changes:
`--color-sign-red` (law), `--color-sign-blue` (advice), `--color-hairline`
(neutral). Used on the rule page (`src/features/code/RuleScreen.tsx`),
`SearchScreen.tsx` and `SectionScreen.tsx` to mark a Highway Code rule
MUST/MUST NOT (law) or advisory.

## Shell: the header band

`src/app/App.tsx` renders `.app-shell` > a sticky `.app-header` (a 3-column
grid, `1fr auto 1fr`, the third column always empty so the middle one
stays centred): column 1 (`.app-header__start`) holds the CLUTCH
`SignPanel` wordmark plus, on an inner (non-tab-root) page, a Back button;
column 2 holds the tab's own name as a centred `<h1 className="app-header__title">`
on a tab root, and nothing at all on an inner page. An inner page instead
renders its own big `<h1>` (`--font-size-h1`, 28px) under the band, with
`--space-page-top` above it — never a second title in the band itself. The
four tabs (`src/app/tabs.ts`) are Journey, Learn, Practice and Me; My Car
is hidden, and both `/my-car` and any unrecognised path redirect to `/`.

## Press states (M02)

One shared rule in `src/app/theme.css` fills every tap target that is not
the yellow primary button with `--color-press` on `:active` — background
only, never a transform or filter, so a real sign picture inside a pressed
tile is never altered:
`.button--secondary:active, .list-row:active, button.chip:active,
.tap__tile:not(:disabled):active, .sprint__option:not(:disabled):active,
.pairs__tile:not(:disabled):active, .signs-tile:active,
.practice-card:active, .today__start:active,
.attribution > summary:active { background-color: var(--color-press); }`.
It deliberately targets `.button--secondary`, not `.button`, so it never
outranks the primary button's own yellow fill by specificity.

## The shared question screen, quiz sheet and end screen

`src/features/interactives/shared/QuestionScreen.tsx` (M29) is the generic
"pick one of four" layer Tap the sign and Sign Sprint both render through:
a `GameTopBar`, then either a `LoadFailed` notice (on a rejected content
load) or the options region (going `inert` while a sheet is open), then a
`QuizSheet` last if one is given. `QuizSheet`'s props are now generic
(`outcome`, `xpGained`, `inARow`, `answerLabel`, `explanation`, `tip`,
`more?`, `onContinue`) rather than tied to one game; only Tap the sign
passes a `sheet`, since Sign Sprint shows its feedback inline on its own
tiles instead. `src/features/interactives/shared/EndScreen.tsx` is the
ending every game shows — Tap the sign, Match Pairs and Sign Sprint alike:
a 44px header (✕ and the game's title, no progress bar), the score band
panel (kicker, big score, XP/Best/streak chips), a Collected! line, one
lost-sign notice per a Q12 loss with its own Practise-signs-like-this
button, an optional gentle zero line, and a list of signs to look at
again, then Done and Play again.

## Score bands (Q9)

`src/engine/score-band.ts`'s `scoreBand(score, max)` returns `'red'`,
`'orange'` or `'green'`: green at 90% of `max` or more, orange at 60% or
more, else red (always red when `max` is zero or negative). Tap the sign
judges against 10, Match Pairs against 5 pairs matched right first time;
Sign Sprint's `sprintBandMax(length)` scales the maximum with the round's
length at 10 a minute (30 sec → 5, 1 min → 10, 5 min → 50), and a No limit
round is judged against what it actually answered instead of a fixed
maximum.

## The pending rule

Today (`JourneyScreen.tsx`) and Me (`MeScreen.tsx`) each render their
whole layout in full from the first paint, but hold it back with a
`--pending` modifier class and `aria-busy` until the progress store's
numbers and the sign catalogue have both settled — the class sets exactly
`visibility: hidden;` (never `display: none`, never `opacity`), so the
layout keeps its space and nothing flashes or moves once it appears.
Practice and Learn do not yet have this gate (Decision 24).

## Motion policy

The primary `Button`'s press-down shadow (`transition: transform 80ms`) is
the only motion outside the road-signs games. Those games add 11
`@keyframes` blocks across 5 stylesheets (9 distinct names — `pop` repeats
identically in three files):

- **`quiz-sheet.css`** (4): `sheetUp` (the bottom sheet's panel slides up,
  `translateY(100%)` → `0`), `pop` (the tick/cross badge and the `+N XP`
  badge scale in, `0.3` → `1.15` → `1`), `fall` (the nine confetti pieces
  fall and rotate in), `chev` (the four in-a-row streak chevrons pulse
  opacity, looping).
- **`tap.css`** (0): defines no keyframes of its own — it reuses
  `quiz-sheet.css`'s `pop` for the tick badge over the correct tile,
  because `TapTheSignScreen` always renders `QuizSheet`.
- **`sprint.css`** (2): `driveIn` (the sign's container slides in from the
  right, carrying the `<SignImage>` picture with it via `transform` — the
  picture itself is never touched), `pop` (its own byte-for-byte copy of
  `quiz-sheet.css`'s `pop`, used on the score's `+XP` badge and the
  end-screen score/XP).
- **`pairs.css`** (2): `pop` (another byte-for-byte copy, used on the `+XP`
  badge and a locked tile's tick), `shake` (a wrong tile wobbles side to
  side; the tile's red border itself is unscoped, so it still flashes red
  under reduced motion — only the wobble is gated).
- **`decoder.css`** (3): `signPop` (the newly drawn shape/colour SVG scales
  in), `ghostOut` (the previous shape/colour's fading outline; the ghost
  element itself is only rendered when motion is allowed, so under reduced
  motion it never mounts at all), `riseIn` (the text block and the
  3-example grid rise and fade in).

`pop`'s duplication across `quiz-sheet.css`, `sprint.css` and `pairs.css`
is intentional and safe: all three bodies are byte-for-byte identical, so
whichever stylesheet's rule wins the cascade produces the same animation —
it is not a shared keyframe because each game's stylesheet is otherwise
independent.

Every motion rule in these five stylesheets sits under the component
root's `--animated` modifier class (each file's own header comment states
this convention), so switching the root to its `--static` modifier turns
every animation off at once, in one place, per component.

## Reduced motion

`useReducedMotion()` (`src/features/interactives/shared/useReducedMotion.ts`)
reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
through `useSyncExternalStore`, subscribed to live changes, and returns
`false` when `window`/`matchMedia` is unavailable. Each of the five
interactives picks its root class from the hook's result:
`QuizSheet` → `quiz-sheet--static`/`quiz-sheet--animated`; Tap the sign →
`tap--static`/`tap--animated`; Sign Sprint →
`sprint--static`/`sprint--animated`; Match Pairs →
`pairs--static`/`pairs--animated`; the Decoder →
`decoder--static`/`decoder--animated`.

Under `--static`: `QuizSheet` never renders its confetti markup at all (not
just a disabled animation), and the Decoder never renders its `.decoder__ghost`
element — the same "don't render it" pattern in both cases. Tap the sign,
Sign Sprint and Match Pairs don't special-case reduced motion in their
markup beyond the root class: their feedback states (tile border colour,
tick badge, XP badge, score number, shake) are unconditional CSS rules that
only gain an `animation:` under `--animated`, so `--static` renders the
same markup with the final state applied instantly.

`src/app/theme.css`'s global `prefers-reduced-motion: reduce` rule
(unchanged since Phase 1) still collapses every animation and transition
app-wide to near-zero duration underneath all of the above, including the
primary `Button`'s press-down shadow (`transition: transform 80ms`,
unchanged).

## Real sign pictures are never altered

`SignImage` (`src/features/interactives/shared/SignImage.tsx`) is the only
component that renders a real Know Your Traffic Signs picture, and it
renders nothing but a plain `<img src decoding="async" draggable={false}>`
— never inlined, animated, recoloured, resized beyond its CSS box,
re-encoded or otherwise transformed. What DOES move is a
picture's _container_: Sign Sprint's `driveIn` animates `.sprint__sign`,
the `<div>` that wraps the `<span>` that wraps `<SignImage>`, so the
picture slides in carried by its ancestor's `transform` while the `<img>`
element itself is untouched throughout.

## The Decoder's art

The Decoder's own drawn signs (`DecoderArt`/`CircleArt`/`TriangleArt`/
`RectangleArt` in `Decoder.tsx`) are original, app-drawn inline SVG, never
a real sign picture. Their shape elements carry a CSS class only
(`decoder__shape decoder__face|decoder__edge|decoder__solid|decoder__outline`),
never an inline `fill="var(...)"`/`stroke="var(...)"` presentation
attribute, because WebKit does not reliably resolve `var()` inside an SVG
presentation attribute. `decoder.css` instead sets a component-scoped
custom property, `--decoder-paint`, on a colour modifier class
(`.decoder__paint--red|blue|green|white`), which `.decoder__edge`/
`.decoder__solid` read via `stroke`/`fill: var(--decoder-paint)`.
`--decoder-paint` is local to `decoder.css` — it is not a `theme.css` token
and does not belong in the Tokens table above; its modifier classes set it
to the existing `--color-sign-red`, `--color-sign-blue`,
`--color-sign-green` and `--color-on-sign` tokens (the white outline uses
`--color-sign-ink`). Phase 2 added no new `theme.css` tokens.

## Brand safety

- No GDS Transport typeface — Clutch self-hosts Overpass and Atkinson
  Hyperlegible instead.
- No crown or Royal Arms, no gov.uk page styling.
- A visible line — "Not an official DVSA or government app." — is shown
  in-app on the Me tab.

## Contrast check

`npm run check:contrast` (`scripts/check-contrast.mjs`) reads the literal
hex tokens in `src/app/theme.css`, merges the dark overrides over the
light values, and asserts every required foreground/background pair
reaches WCAG AA (4.5:1) in **both** colour schemes — 14 pairs: `ink/page`,
`ink/surface`, `muted/page`, `muted/surface`, `tab-inactive/tab-bar`,
`tab-active/tab-bar`, `on-sign/sign-blue`, `on-sign/sign-green`,
`on-sign/sign-red`, `on-sign/band-orange`, `sign-ink/marking-yellow`,
`sign-ink/on-sign`, `link/page`, `link/surface`. It stops the build the
moment any Decision 13 colour pairing becomes illegible in light or dark
mode, without ever changing Lincoln's chosen palette itself — a failing
pair is reported and the colours stay his decision.

## Built so far vs. Deferred

**Built in Phase 1:**

- The tokens above (light and dark), the type scale, and the
  reduced-motion rule.
- Self-hosted, precached fonts — Overpass and Atkinson Hyperlegible — with
  no Google Fonts reference anywhere.
- The shell restyle: the sign-panel header (with back button) and the icon
  tab bar, including the Learn tab's `alsoActiveFor: ['/code']`
  highlighting for the Rule deep link.
- Five of the eight primitives above: `SignPanel`, `SignPlate`, `Roundel`,
  `Button`, `Chip`.
- The Highway Code section list and section screen, the rule page
  (`/code/rule/:id`) with its law/advice `Chip`, and the static,
  colour-coded Rule 126 stopping-distance table.
- Offline search over the whole Highway Code.

**Built in Phase 2:**

- The quiz sheet (`QuizSheet`) and its correct/incorrect feedback
  animation, used by Tap the sign.
- Confetti, the `+N XP` badge, and the "N in a row" streak chevrons (all
  in `QuizSheet`), plus the saved day streak from the progress engine.
- Sign Sprint, Match Pairs and the Shape & Colour Decoder, each with their
  own reduced-motion-aware animation (see § Motion policy, above).
- `Roundel` now has a consumer: `src/features/practice/PracticeScreen.tsx`
  renders `<Roundel value={60} />`, non-interactive, in the Sign Sprint
  practice card, representing the 60-second clock.

**Built in Phase 2b (UX foundations):**

- The three new primitives above: `ListRow`, `SegmentedControl`,
  `LoadFailed`, plus `SignPanel`'s `block` prop.
- The header band shell (§ Shell, above), four tabs with My Car hidden,
  and Today/Me's pending rule.
- The shared `QuestionScreen`, the generalised `QuizSheet` and the shared
  `EndScreen`, with the score bands in `src/engine/score-band.ts`.
- The press-state rule (§ Press states, above), the link colour and the
  orange score band, all contrast-checked (14 pairs).
- `Roundel` gained a second consumer:
  `src/features/interactives/sign-sprint/SprintStart.tsx` also renders
  `<Roundel value={60} />`, beside the best-score card.

**Still deferred** to Phases 3–4 (Decision 13 mockup references, not built
yet):

- The Journey map.
- The animated stopping-distance road — Rule 126 gets the static table
  above instead, because the official chart is an image with empty alt
  text (see `docs/CONTENT-GUIDE.md`, Known limitations).

**Still deferred from Phase 2b** (Decision 24, `docs/DECISIONS.md`): M01's
Add to Home Screen plate chrome, M08's `htmlToText` join fix, M15's
attribution timestamp/file-path/test-date extras, M42's All/Collected
toggle halves, M32's sign-caption residue, and M34's 124px sign-page
picture box.
