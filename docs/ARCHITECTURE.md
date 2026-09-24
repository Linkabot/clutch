# Architecture

Clutch is a client-only, offline-first PWA: no backend, no accounts, all state on-device.

## Stack

- Vite 8 + React 18 + TypeScript 5.9 (pinned — see `docs/DECISIONS.md`)
- Tailwind CSS 4 via `@tailwindcss/vite`
- `react-router-dom` (`createBrowserRouter` + `RouterProvider`, `basename: import.meta.env.BASE_URL`)
- Zustand (in-memory UI state) + Dexie/IndexedDB (persistence)
- `vite-plugin-pwa` (`generateSW` strategy, `registerType: 'autoUpdate'`) for the manifest and service worker
- Vitest, `node` environment by default, with a per-file `jsdom` opt-in for
  render tests (see Test strategy, below), and Playwright (WebKit, iPhone 14
  device profile) for e2e
- ESLint 9 flat config + Prettier

## Structure

```
clutch/
├─ src/
│  ├─ app/          routes, tab bar, theme, store, platform detection, pwa registration,
│  │                persist.ts (requestPersistentStorage), back.ts (Back-target rule)
│  ├─ ui/           SignPanel, SignPlate, Roundel, Button, Chip, ListRow,
│  │                SegmentedControl, LoadFailed, primitives.css
│  ├─ features/     journey (Today), learn, practice (incl. practice/tap/), me,
│  │                code/, signs/, interactives/ (registry.ts, shared/,
│  │                quiz-sheet/, sign-sprint/, match-pairs/, shape-colour-decoder/)
│  ├─ engine/       progress.ts, progress-store.ts, progress-state.ts — the progress engine;
│  │                score-band.ts, round-memory.ts, start-here.ts
│  ├─ content/      loaders.ts, memo.ts, signs.ts, text.ts, schemas/
│  └─ storage/      Dexie db (version 2: settings, progress, signProgress tables)
├─ scripts/         ingestion, verification and check scripts, plus lib/
├─ tests/
│  ├─ unit/         Vitest, tests/unit/**/*.test.ts(x)
│  ├─ content/      Vitest, tests/content/**/*.test.ts
│  └─ e2e/          Playwright, WebKit + iPhone 14 profile
├─ public/icons/    PWA + apple-touch icons
├─ public/signs/    195 real Know Your Traffic Signs pictures, shipped byte-for-byte
├─ docs/            this file and its siblings
└─ handoffs/        audit trail per task, git-ignored
```

My Car is not built: `src/features/my-car/` does not exist, and `/my-car`
redirects to `/` (see the Routes table, below) — the tab returns in
Phase 5.

## Base path handling

The app is served from `/clutch/` on GitHub Pages, so every layer is told the same base path explicitly rather than inferring it:

- `vite.config.ts` — `base: '/clutch/'`
- Router — `basename: import.meta.env.BASE_URL` on `createBrowserRouter`
- Manifest — `scope: '/clutch/'` and `start_url: '/clutch/'`
- Workbox — `navigateFallback: '/clutch/index.html'`
- `dist/404.html` — the `postbuild` script (`package.json`) copies
  `dist/index.html` to `dist/404.html` after every build, so GitHub Pages
  serves the app shell for deep-link 404s instead of its own 404 page

## State

Zustand (`src/app/store.ts`) holds transient UI state that does not need to survive a reload — currently `swStatus` and `isStandalone`. Dexie (`src/storage/db.ts`) is the persistence layer, at schema version 2 (unchanged in Phase 2b): a `settings` table (key — now also holding `sprint.choices` and `sprint.lastRound` rows, § Progress engine below), a `progress` table (key `'xp' | 'streak' | 'sprintBest' | 'sprintBest:30s' | 'sprintBest:5m' | 'sprintBest:none' | 'lastPlayed:tap' | 'lastPlayed:sprint' | 'lastPlayed:pairs'`, holding the XP total, the day-streak object, a per-length Sign Sprint best and a per-game last-played timestamp) and a `signProgress` table (keyed `signId`, one row per sign holding its 0–3 correct-answer count and an optional `wrongInARow` counter, missing on a pre-Phase-2b row and read as 0). `useProgressStore` (`src/engine/progress-state.ts`) is the Zustand store screens read/write through — see § Progress engine, below — rather than touching Dexie directly. Anything the user should keep across sessions goes through Dexie, not Zustand.

## PWA update model

`vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`: the service worker checks for a new version on every load and activates it without prompting the user, so the next launch (not the current session) picks up the update. `src/app/pwa.ts` calls `registerSW` from `virtual:pwa-register` with `immediate: true` and drives `swStatus` in the store (`unsupported` / `registering` / `ready` / `error`), which `src/features/me/OfflineReady.tsx` renders as a single-line indicator.

## Routes

All routes are registered in `src/app/routes.tsx`, as children of the single
layout route (`App`), under `createBrowserRouter` with
`basename: import.meta.env.BASE_URL`, in this order:

| Path                   | Screen                      | Notes                                                                                       |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `/` (index)            | `JourneyScreen`             | Journey tab; renders "Today" — streak/XP pills, a Start here card, the Traffic signs card   |
| `/learn`               | `LearnScreen`               | Learn tab hub; links into the Highway Code and the Signs browser (no Search card)           |
| `/learn/code`          | `HighwayCodeSectionsScreen` | Highway Code hub: a search box plus `?tab=rules\|signs\|annexes` (Q15)                      |
| `/learn/code/search`   | `SearchScreen`              | offline MiniSearch over every rule and section except the Index; `?q=<text>`                |
| `/learn/signs`         | `SignsScreen`               | the Signs browser; filter state lives in the URL (`?family=<id>&collected=1`)               |
| `/learn/signs/:id`     | `SignScreen`                | one sign's own page                                                                         |
| `/learn/code/:slug`    | `SectionScreen`             | one Highway Code section — preamble + rule rows, or the full body for other sections        |
| `/code/rule/:id`       | `RuleScreen`                | single-rule deep link, e.g. `/code/rule/126` — deliberately NOT nested under `/learn`       |
| `/practice`            | `PracticeScreen`            | Practice tab                                                                                |
| `/practice/tap`        | `TapTheSignScreen`          | Tap the sign; a full-screen layer over the shell; `?family=<id>` starts that family's round |
| `/practice/sprint`     | `SignSprint` (lazy)         | Sign Sprint's start page, then its play screen; a full-screen layer; from the registry      |
| `/practice/pairs`      | `MatchPairs` (lazy)         | Match Pairs; a full-screen layer over the shell; from the interactives registry             |
| `/learn/signs/decoder` | `Decoder` (lazy)            | Shape & Colour Decoder; mounted inside the shell; from the interactives registry            |
| `/my-car`              | redirects to `/`            | My Car is hidden (Q16); the tab and its screen do not exist                                 |
| `/me`                  | `MeScreen`                  | Me tab                                                                                      |
| `*` (catch-all)        | redirects to `/`            | any unrecognised path (M37)                                                                 |

`/code/rule/:id` lives outside `/learn` so a bare rule link (e.g.
`https://linkabot.github.io/clutch/code/rule/126`) works as a deep link, but
it must still read as part of Learn in the tab bar. `src/app/tabs.ts` gives
the Learn tab `alsoActiveFor: ['/code']`, and `TabBar.tsx`'s `isTabActive`
treats a pathname as active for a tab when it equals the tab's own `path`,
starts with `path + '/'`, **or** matches one of `alsoActiveFor`'s prefixes
the same way — so visiting `/code/rule/126` highlights Learn
(`aria-current="page"`) even though the route itself is not under `/learn`.

`/learn/signs/decoder` is registered after `/learn/signs/:id` in source
order (it comes from the interactives registry, appended after
`practice/tap`), but still outranks it at runtime: React Router scores a
route's static path segments higher than a dynamic (`:id`) segment
regardless of registration order, so a request for `/learn/signs/decoder`
never falls through to `SignScreen` with `id: 'decoder'`.

`/practice/tap`, `/practice/sprint` and `/practice/pairs` each render as a
fixed full-screen layer OVER the app shell's own header and tab bar (their
stylesheets set `position: fixed` and `z-index: 20` on the game root), as
does `src/app/AddToHomeScreen.tsx`'s own `.a2hs` panel at the same
`z-index: 20`. `QuizSheet` sits above those at `z-index: 30`; it is no
longer Tap the sign's alone — the shared `QuestionScreen.tsx` (see
§ Shared game helpers, below) renders it whenever a caller supplies a
`sheet` prop, which today is only Tap the sign (Sign Sprint shows its
feedback inline on its own tiles instead). The Decoder is different: it is
a registry entry mounted INSIDE the app shell's `<main>` (no
`position: fixed` in its stylesheet), so the header Back button and tab
bar stay visible.

`?family=<id>` on `/practice/tap` starts a round drawn from that one
family (`SignScreen`'s "Practise signs like this" button navigates to
`/practice/tap?family=<sign.family>`; there is no per-sign seeding any
more — the old `?sign=<id>` param is gone). `?family=<id>` and
`?collected=1` on `/learn/signs` filter the Signs browser. `?tab=` on
`/learn/code` and `?q=` on `/learn/code/search` are described above.
A filter tap replaces the current history entry rather than adding one,
so Back from a sign page returns to the filtered browser and Back from
the browser leaves it in one tap.

On a case-insensitive file system (Windows/macOS default),
`src/features/interactives/shape-colour-decoder/index.tsx` imports
`Decoder.tsx` WITH its extension (`import Decoder from './Decoder.tsx'`) so
an extensionless `./Decoder` cannot resolve to the pure module `decoder.ts`
sitting beside it — legal because `tsconfig.app.json` sets
`"moduleResolution": "bundler"` and `"allowImportingTsExtensions": true`.

## Interactives registry

`src/features/interactives/registry.ts` exports `INTERACTIVES: InteractiveEntry[]`,
where `InteractiveEntry` is `{ id, title, phase: 2, lessonRefs: string[],
route, load: () => Promise<{ default: ComponentType }>, sizeBudgetKiB }`.
It has exactly 3 entries, each with `lessonRefs: ['code:traffic-signs']`:

| id                     | route                  | sizeBudgetKiB |
| ---------------------- | ---------------------- | ------------- |
| `sign-sprint`          | `/practice/sprint`     | 40            |
| `match-pairs`          | `/practice/pairs`      | 40            |
| `shape-colour-decoder` | `/learn/signs/decoder` | 40            |

`src/app/routes.tsx` consumes it once, at module scope:
`INTERACTIVES.map((entry) => ({ path: entry.route.replace(/^\//, ''), Screen: lazy(entry.load) }))`,
then spreads the result into the router's children right after `/practice/tap`.

`npm run check:interactives` (`scripts/check-interactive-size.mjs`) reads
`registry.ts` as plain TEXT — it never imports the module, so this works
even before an entry's own screen exists — extracting each quoted `id: '…'`
and numeric `sizeBudgetKiB: N` by regex. It reads `dist/.vite/manifest.json`
(written because `vite.config.ts` sets `build.manifest: true`) and, for each
entry, charges its own file and CSS plus every file reachable through its
imports that is reachable from NO OTHER root — so a chunk shared with the
shell, a Highway Code section, or another game is never double-charged. It
fails any entry over its `sizeBudgetKiB` and prints
`check:interactives: <n> interactives, largest <x> KiB`. CI
(`.github/workflows/ci.yml`) runs it directly after `check:precache`, so a game
over its budget fails the build.

## Shared game helpers

`src/features/interactives/shared/` holds the pieces every game shares:

- `GameTopBar.tsx` — the header row for timed/counted games: a 44×44 Close
  button, a dashed-yellow-line progress bar, and either a right-hand label
  toned `ink` or `muted`, or (an `action?: { label, onClick }` prop) a
  small outlined pill button in its place — used for Sign Sprint's Finish
  on a No limit round, whose bar is already full and whose clock has
  nothing to say.
- `QuestionScreen.tsx` (M29) — the generic "pick one of four" layer Tap the
  sign and Sign Sprint both render through: `GameTopBar`, then a
  `LoadFailed` notice on a rejected content load or the options region
  (going `inert` while a sheet is open), then `QuizSheet` last if a `sheet`
  prop is given.
- `EndScreen.tsx` — the ending every game shows (Tap the sign, Match Pairs
  and Sign Sprint alike): the score-band panel, XP/Best/streak chips, a
  Collected! line, one lost-sign notice per collection loss, an optional
  gentle zero line, and a list of signs to look at again.
- `VisualGameNote.tsx` (Q8) — the one-time, VoiceOver-only announcement
  that a picture game is visual, and where the names and meanings live.
- `exit.ts` — `useExitGame()`/`exitTarget()` (Q19): where a game's Close
  and its end screen's Done navigate to, built on `src/app/back.ts`'s own
  rule.
- `SignImage.tsx` — the only component that renders a real sign picture,
  always through a plain `<img src={signImageUrl(sign)}>`, never inlined,
  animated, recoloured or transformed.
- `distractors.ts` — `pickDistractors`/`isShortCaption` for multiple-choice
  distractor selection: candidates are drawn from the whole catalogue
  (not limited to the answer's family), then filled same-family
  look-alikes first, other-family look-alikes second, the rest of the
  family last (Q14) — a shape of `other` keeps the plain family-only pick.
- `random.ts` — a seeded `mulberry32` PRNG plus a Fisher-Yates `shuffle`,
  an `Rng` type, so a seeded run is exactly repeatable in tests.
- `useReducedMotion.ts` — a `useSyncExternalStore` hook over
  `(prefers-reduced-motion: reduce)`, returning `false` when `matchMedia`
  is unavailable.
- `games.css`, `question.css`, `end-screen.css` — the shared stylesheets,
  `theme.css` tokens only.

`src/features/interactives/quiz-sheet/QuizSheet.tsx` is the bottom-anchored
post-answer feedback sheet (correct: sign-green, a tick, a `+N XP` badge,
streak chevrons, confetti; wrong: sign-red, a cross, "Right answer:"), with
generic props (`outcome`, `xpGained`, `inARow`, `answerLabel`,
`explanation`, `tip`, `more?`, `onContinue`) rather than a Tap-the-sign-only
shape. It renders wherever `QuestionScreen` is given a `sheet` prop, which
today is Tap the sign only — Sign Sprint shows its own feedback inline on
its tiles (`data-feedback` on `.sprint__option`) instead, and Match Pairs
implements its own separate feedback UI; neither imports `QuizSheet`.

## Progress engine

`src/engine/progress.ts` is pure maths, with no Dexie import: `localDayKey(date)`
(`YYYY-MM-DD`, local time), `previousDayKey(key)` (built at LOCAL NOON, never
midnight-minus-24h, so DST transitions are safe), `finishRound(streak, now)`
(unchanged if `lastDay` is today, `+1` if it was yesterday, else resets to
`{ count: 1, lastDay: today }`), `currentStreak(streak, now)` (the saved
count if `lastDay` is today or yesterday, else 0 — the display resets on a
missed day even before the next round writes that reset), `addXp(xp, correct)`
(`+10` if correct, else unchanged — XP never goes down), `addCorrect(correct)`
(`min(3, correct + 1)`), `isCollected(correct)` (`correct >= 3`),
`applyAnswer(row, right)` (Q12, the collection-loss rule: a right answer
advances `correct` and resets `wrongInARow` to 0, reporting `collectedNow`
on the answer that reaches 3; a wrong answer on a sign that is not
collected changes nothing; a wrong answer on a collected sign advances
`wrongInARow`, and at `LOSE_AFTER_WRONG` (3) the sign is lost — `correct`
and `wrongInARow` both reset to 0, `lostNow: true`) and `bestScore(best, score)`
(`Math.max`).

`src/engine/progress-store.ts`'s `createProgressStore({ db, now })` takes an
INJECTABLE clock — it never calls `new Date()` itself — and returns a
`ProgressStore`: `getSummary()` (`{ xp, streak, sprintBest, sprintBests,
collected, lastPlayed, sprintLast }` — `sprintBests` is a per-length best
keyed `'30s' | '1m' | '5m' | 'none'`, `lastPlayed` a per-game last-played
timestamp keyed `'tap' | 'sprint' | 'pairs'`, and `sprintLast` the last
finished Sprint round's `{ score, length, answered }`, or null),
`recordAnswer(signId, correct)` (runs `applyAnswer` above in one `'rw'`
transaction against the sign's `signProgress` row — a row written before
Phase 2b has no `wrongInARow` field and is read as 0 — bumps `xp` on a
right answer, and resolves to `{ collectedNow, lostNow }`),
`recordRoundFinished(options?)` (advances the streak, updates the round's
length's `sprintBests` entry and `lastPlayed` for the game that finished,
and records `sprintLast` for a Sign Sprint round), `getSignProgress()`,
and `getSprintChoices()`/`setSprintChoices(choices)` (Q10: the `settings`
table's `sprint.choices` row, `{ length, families }`, defaulting to
`{ length: '1m', families: [] }` — Sign Sprint's start page always reopens
on the learner's last-used choices).

`src/engine/progress-state.ts`'s Zustand `useProgressStore` wraps that store
over the default Dexie `db`, binding the one real `now: () => new Date()`
clock at this single call site. `load()` shares one in-flight promise across
concurrent callers and never touches IndexedDB at import time. `load()`
reads again when the local day has changed since the last read, keeping the
old numbers on screen until the new ones arrive, so a streak that lapsed
overnight is not shown; and the first `load()` adds a `visibilitychange`
listener that calls `load()` whenever the app becomes visible, which is what
an iPhone does when it resumes a suspended home-screen app.

**Write-failure policy:** every screen that records answers
(`TapTheSignScreen.tsx`, `SignSprint.tsx`, `MatchPairs.tsx`) queues its Dexie
writes on a per-component promise chain (`queueWrite`) whose `.catch` logs
the error with `console.error` and lets the chain continue — a failed write
never stops or interrupts play.

**Round memory (M25, M27, Q18):** `src/engine/round-memory.ts` keeps each
game's last finished round in memory only — no table, no persistence — so
that Back into a game a player just left can recall the round it was
showing rather than starting a new one. It is one slot per game
(`rememberRound`/`recallRound`/`forgetRound`, keyed by `GameId`), and the
id a game hands back is found through the browser history entry's own
`state` (the id set when the round finished), never a fresh render: an id
saved before a page reload cannot match a round remembered after it, since
the module's own state does not survive a reload.

## Content loading and offline

Highway Code, facts and syllabus content lives under `content/uk/` at the repo root, ingested by the scripts in `scripts/` and never hand-edited (see `docs/CONTENT-GUIDE.md`). Inside the app, `src/content/loaders.ts` reads the Highway Code and `facts.json`, and `src/content/signs.ts` reads `content/uk/signs/` — each module owns its own subtree, so between the two of them every result is parsed with the Zod schemas in `src/content/schemas/` before use, and no static `import x from '*.json'` appears anywhere else in `src/`. `getHighwayCodeIndex()` and `getFacts()` load the small index and facts files eagerly, bundled into the main chunk; `loadSection(slug)`, `loadAllSections()` and `loadRule(id)` load each Highway Code section lazily, one `import.meta.glob` chunk per section file. `src/content/signs.ts` follows the same eager/lazy split: `getShapeRules()` and `getHooks()` load eagerly, while `loadSigns()` is a lazy `import.meta.glob` for `content/uk/signs/signs.json`, rejecting with `SignsNotFound` if the glob matches nothing. `signImageUrl(sign)` builds a sign's `<img src>` from `import.meta.env.BASE_URL + sign.image` — pictures are never statically imported. `hookFor(sign, context)` implements § Memory hooks' display rule (see `docs/CONTENT-GUIDE.md`). Vite code-splits every lazy chunk out of the main bundle, and Workbox's existing `**/*.js` precache glob (see PWA update model, above) picks them up automatically, so every section and the sign catalogue are available offline without being fetched until a screen actually needs them.

`src/features/code/search.ts` builds an in-memory MiniSearch index covering every rule and every section except the Index section (`INDEX_SECTION_SLUG`), memoised behind a `PromiseCache` (`src/content/memo.ts`) that forgets a failed build so the next search retries, calling `loadAllSections()` the first time anything searches. There is no prebuilt search index file shipped with the app — it is built once, at runtime, from the same precached chunks.

## Precache

`vite.config.ts` sets VitePWA's `workbox` option to `globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2,md}']` and `navigateFallback: '/clutch/index.html'` only — there is no `globIgnores` and no `maximumFileSizeToCacheInBytes`, so Workbox's own 2 MiB per-file default applies. `build: { manifest: true }` is also set, feeding `check-interactive-size.mjs` (above).

**The whole app's precache budget is 8192 KiB.** `scripts/check-precache.mjs`'s `BUDGET_KIB` constant checks the TOTAL size of every precached file — JS, CSS, fonts, HTML and sign pictures alike — against that figure. Separately, `MAX_SIGN_SVG_BYTES` caps any individual precached `signs/…/*.svg` entry at 150 KiB, and a sign-count rule requires at least as many precached sign SVGs as `content/uk/signs/signs.json` has signs (195). The script also checks: at least 5 `.woff2` files precached; `ATTRIBUTION.md` precached; every built `dist/assets/*.js` chunk actually listed in the precache manifest; no `googleapis`/`gstatic` URL precached. Its summary line:
`check:precache: <n> entries, <x> KiB (budget 8192 KiB), sign pictures <n>`, followed by `check:precache: OK` on success.

## Test strategy

- **Unit (Vitest):** `tests/unit/**/*.test.ts(x)` and `tests/content/**/*.test.ts` run under a single top-level `environment: 'node'` (`vite.config.ts`'s `test.include`) — pure functions and store logic (`tabs.ts`, `platform.ts`, `store.ts`, the progress engine, content schemas) need no DOM. A file that renders components opts into jsdom per-file with a `/** @vitest-environment jsdom */` pragma inside the block comment at the top of the file (not `environmentMatchGlobs`, and not a `//` line comment). 20 files carry that pragma today, all using `@testing-library/react`: `add-to-home-screen.test.tsx`, `decoder.test.tsx`, `end-screen.test.tsx`, `exit.test.ts`, `interactives-render.test.tsx`, `journey-screen.test.tsx`, `list-row.test.tsx`, `markdown.test.tsx`, `match-pairs.test.tsx`, `me-screen.test.tsx`, `practice-header.test.tsx`, `progress-state.test.ts`, `question-screen.test.tsx`, `quiz-sheet.test.tsx`, `section-screen.test.tsx`, `segmented-control.test.tsx`, `sign-screen.test.tsx`, `sign-sprint.test.tsx`, `sprint-start.test.tsx`, `visual-game-note.test.tsx`.
- **`fake-indexeddb`** (devDependency) lets Dexie-backed tests (e.g. `progress-store.test.ts`) open an isolated `ClutchDB` via its optional `(name, options?: DexieOptions)` constructor against a fake IndexedDB factory, without a real browser.
- **Content (`tests/content/`):** 7 files validating the committed JSON directly — schema, facts, syllabus, Highway Code and sign content. Runs via `npm run validate:content` (`vitest run tests/content`), and also as part of `npm test` since it's covered by the same `test.include`.
- **E2E (Playwright, WebKit, iPhone 14 profile):** `playwright.config.ts` sets `testDir: 'tests/e2e'`, `use.baseURL: 'http://localhost:4173'`, one project (`iphone-webkit`, `devices['iPhone 14']`), and a `webServer` running `npx vite preview --port 4173 --strictPort` (`retries: 1` under CI, else 0) — matching real iOS Safari: manifest served, Add to Home Screen panel, service worker registration, tab navigation. `tests/e2e/helpers.ts` exports `openAppAt`/`openApp` (navigate, dismiss the Add to Home Screen panel), `startPreview(port)`/`stopPreview(proc, port)` (spawn/kill a dedicated preview server, polling until it answers/actually stops) and `waitForServiceWorkerActivated(page)` (a synchronous `waitForFunction` predicate). `tests/e2e/foundations.spec.ts` (Phase 2b) covers the phone-test defect fixes, the header band and hidden/unknown-route redirects, the signs browser and Decoder hints, and Today/Me — it has no offline test of its own either.
- **Offline reload:** these tests do not use Playwright's `context.setOffline(true)` — under WebKit that call is a hard network kill a service worker cannot answer through, so each spawns its OWN `vite preview` server on a dedicated port, waits for the service worker to control the page, genuinely kills that server process, polls until a `fetch` to it actually throws, then reloads and asserts the app still renders from the SW cache. Three specs need this and each uses its own port so they never collide: `shell.spec.ts` (4174), `highway-code.spec.ts` (4175), `signs-offline.spec.ts` (4176, sign pictures awaited with a synchronous `img.complete && img.naturalWidth > 0` predicate). `signs.spec.ts`, `games.spec.ts` and `foundations.spec.ts` have no offline test of their own.
