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
│  ├─ app/          routes, tab bar, theme, store, platform detection, pwa registration
│  ├─ features/     journey, learn, practice (incl. practice/tap/), my-car, me,
│  │                code/, signs/, interactives/ (registry.ts, shared/,
│  │                quiz-sheet/, sign-sprint/, match-pairs/, shape-colour-decoder/)
│  ├─ engine/       progress.ts, progress-store.ts, progress-state.ts — the progress engine
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

Zustand (`src/app/store.ts`) holds transient UI state that does not need to survive a reload — currently `swStatus` and `isStandalone`. Dexie (`src/storage/db.ts`) is the persistence layer, at schema version 2: a `settings` table (key), a `progress` table (key `'xp' | 'streak' | 'sprintBest'`, holding the XP total, the day-streak object and the Sign Sprint best score) and a `signProgress` table (keyed `signId`, one row per sign holding its 0–3 correct-answer count). `useProgressStore` (`src/engine/progress-state.ts`) is the Zustand store screens read/write through — see § Progress engine, below — rather than touching Dexie directly. Anything the user should keep across sessions goes through Dexie, not Zustand.

## PWA update model

`vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`: the service worker checks for a new version on every load and activates it without prompting the user, so the next launch (not the current session) picks up the update. `src/app/pwa.ts` calls `registerSW` from `virtual:pwa-register` with `immediate: true` and drives `swStatus` in the store (`unsupported` / `registering` / `ready` / `error`), which `src/features/me/OfflineReady.tsx` renders as a single-line indicator.

## Routes

All routes are registered in `src/app/routes.tsx`, as children of the single
layout route (`App`), under `createBrowserRouter` with
`basename: import.meta.env.BASE_URL`, in this order:

| Path                   | Screen                      | Notes                                                                                 |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `/` (index)            | `JourneyScreen`             | Journey tab                                                                           |
| `/learn`               | `LearnScreen`               | Learn tab hub; links into the Highway Code, the Signs browser and their search        |
| `/learn/code`          | `HighwayCodeSectionsScreen` | Highway Code sections grouped by kind, each row showing its rule range                |
| `/learn/code/search`   | `SearchScreen`              | offline MiniSearch over every rule and non-rule section                               |
| `/learn/signs`         | `SignsScreen`               | the Signs browser; filter state lives in the URL (`?family=<id>&collected=1`)         |
| `/learn/signs/:id`     | `SignScreen`                | one sign's own page                                                                   |
| `/learn/code/:slug`    | `SectionScreen`             | one Highway Code section — preamble + rule rows, or the full body for other sections  |
| `/code/rule/:id`       | `RuleScreen`                | single-rule deep link, e.g. `/code/rule/126` — deliberately NOT nested under `/learn` |
| `/practice`            | `PracticeScreen`            | Practice tab                                                                          |
| `/practice/tap`        | `TapTheSignScreen`          | Tap the sign; a full-screen layer over the shell                                      |
| `/practice/sprint`     | `SignSprint` (lazy)         | Sign Sprint; a full-screen layer over the shell; from the interactives registry       |
| `/practice/pairs`      | `MatchPairs` (lazy)         | Match Pairs; a full-screen layer over the shell; from the interactives registry       |
| `/learn/signs/decoder` | `Decoder` (lazy)            | Shape & Colour Decoder; mounted inside the shell; from the interactives registry      |
| `/my-car`              | `MyCarScreen`               | My Car tab                                                                            |
| `/me`                  | `MeScreen`                  | Me tab                                                                                |

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
stylesheets set `position: fixed` and `z-index: 20` on the game root);
`QuizSheet` — used by Tap the sign only, not Sign Sprint or Match Pairs,
which have their own feedback UI — sits above those at `z-index: 30`. The
Decoder is different: it is a registry entry mounted INSIDE the app shell's
`<main>` (no `position: fixed` in its stylesheet), so the header Back
button and tab bar stay visible.

`?sign=<id>` on `/practice/tap` seeds question 1 (`SignScreen`'s "Play with
this sign" button navigates to `/practice/tap?sign=<id>`; the param is
dropped from the URL on Play again). `?family=<id>` and `?collected=1` on
`/learn/signs` filter the Signs browser.

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
(`.github/workflows/ci.yml`) runs `check:contrast` and `check:precache`, but
not `check:interactives` — it is a local/manual gate.

## Shared game helpers

`src/features/interactives/shared/` holds the pieces every game shares:

- `GameTopBar.tsx` — the header row for timed/counted games: a 44×44 Close
  button, a dashed-yellow-line progress bar, and a right-hand label toned
  `ink` or `muted`.
- `SignImage.tsx` — the only component that renders a real sign picture,
  always through a plain `<img src={signImageUrl(sign)}>`, never inlined,
  animated, recoloured or transformed.
- `distractors.ts` — `pickDistractors`/`isShortCaption` for multiple-choice
  distractor selection: same family, distinct captions.
- `random.ts` — a seeded `mulberry32` PRNG plus a Fisher-Yates `shuffle`,
  an `Rng` type, so a seeded run is exactly repeatable in tests.
- `useReducedMotion.ts` — a `useSyncExternalStore` hook over
  `(prefers-reduced-motion: reduce)`, returning `false` when `matchMedia`
  is unavailable.
- `games.css` — the shared stylesheet (currently just `GameTopBar`'s
  rules), `theme.css` tokens only.

`src/features/interactives/quiz-sheet/QuizSheet.tsx` is the bottom-anchored
post-answer feedback sheet (correct: sign-green, a tick, a `+N XP` badge,
streak chevrons, confetti; wrong: sign-red, a cross, "Right answer:").
It is used by Tap the sign only — Sign Sprint and Match Pairs implement
their own separate feedback UI and never import `QuizSheet`; they only
reference `quiz-sheet.css`'s animation timing in a source comment.

## Progress engine

`src/engine/progress.ts` is pure maths, with no Dexie import: `localDayKey(date)`
(`YYYY-MM-DD`, local time), `previousDayKey(key)` (built at LOCAL NOON, never
midnight-minus-24h, so DST transitions are safe), `finishRound(streak, now)`
(unchanged if `lastDay` is today, `+1` if it was yesterday, else resets to
`{ count: 1, lastDay: today }`), `currentStreak(streak, now)` (the saved
count if `lastDay` is today or yesterday, else 0 — the display resets on a
missed day even before the next round writes that reset), `addXp(xp, correct)`
(`+10` if correct, else unchanged — XP never goes down), `addCorrect(correct)`
(`min(3, correct + 1)`), `isCollected(correct)` (`correct >= 3`) and
`bestScore(best, score)` (`Math.max`).

`src/engine/progress-store.ts`'s `createProgressStore({ db, now })` takes an
INJECTABLE clock — it never calls `new Date()` itself — and returns a
`ProgressStore`: `getSummary()` (`{ xp, streak, sprintBest, collected }`),
`recordAnswer(signId, correct)` (a no-op if `!correct`; else, in one `'rw'`
transaction, bumps `xp` and the sign's correct count), `recordRoundFinished(options?)`
(advances the streak, and updates `sprintBest` when a `sprintScore` is
given) and `getSignProgress()`.

`src/engine/progress-state.ts`'s Zustand `useProgressStore` wraps that store
over the default Dexie `db`, binding the one real `now: () => new Date()`
clock at this single call site. `load()` shares one in-flight promise across
concurrent callers and never touches IndexedDB at import time — only the
first time a screen calls `load()`.

**Write-failure policy:** every screen that records answers
(`TapTheSignScreen.tsx`, `SignSprint.tsx`, `MatchPairs.tsx`) queues its Dexie
writes on a per-component promise chain (`queueWrite`) whose `.catch` logs
the error with `console.error` and lets the chain continue — a failed write
never stops or interrupts play.

## Content loading and offline

Highway Code, facts and syllabus content lives under `content/uk/` at the repo root, ingested by the scripts in `scripts/` and never hand-edited (see `docs/CONTENT-GUIDE.md`). Inside the app, `src/content/loaders.ts` reads the Highway Code and `facts.json`, and `src/content/signs.ts` reads `content/uk/signs/` — each module owns its own subtree, so between the two of them every result is parsed with the Zod schemas in `src/content/schemas/` before use, and no static `import x from '*.json'` appears anywhere else in `src/`. `getHighwayCodeIndex()` and `getFacts()` load the small index and facts files eagerly, bundled into the main chunk; `loadSection(slug)`, `loadAllSections()` and `loadRule(id)` load each Highway Code section lazily, one `import.meta.glob` chunk per section file. `src/content/signs.ts` follows the same eager/lazy split: `getShapeRules()` and `getHooks()` load eagerly, while `loadSigns()` is a lazy `import.meta.glob` for `content/uk/signs/signs.json`, rejecting with `SignsNotFound` if the glob matches nothing. `signImageUrl(sign)` builds a sign's `<img src>` from `import.meta.env.BASE_URL + sign.image` — pictures are never statically imported. `hookFor(sign, context)` implements § Memory hooks' display rule (see `docs/CONTENT-GUIDE.md`). Vite code-splits every lazy chunk out of the main bundle, and Workbox's existing `**/*.js` precache glob (see PWA update model, above) picks them up automatically, so every section and the sign catalogue are available offline without being fetched until a screen actually needs them.

`src/features/code/search.ts` builds an in-memory MiniSearch index over every rule and non-rule section, memoised behind one promise that calls `loadAllSections()` the first time anything searches. There is no prebuilt search index file shipped with the app — it is built once, at runtime, from the same precached chunks.

## Precache

`vite.config.ts` sets VitePWA's `workbox` option to `globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2,md}']` and `navigateFallback: '/clutch/index.html'` only — there is no `globIgnores` and no `maximumFileSizeToCacheInBytes`, so Workbox's own 2 MiB per-file default applies. `build: { manifest: true }` is also set, feeding `check-interactive-size.mjs` (above).

**The whole app's precache budget is 8192 KiB.** `scripts/check-precache.mjs`'s `BUDGET_KIB` constant checks the TOTAL size of every precached file — JS, CSS, fonts, HTML and sign pictures alike — against that figure. Separately, `MAX_SIGN_SVG_BYTES` caps any individual precached `signs/…/*.svg` entry at 150 KiB, and a sign-count rule requires at least as many precached sign SVGs as `content/uk/signs/signs.json` has signs (195). The script also checks: at least 5 `.woff2` files precached; `ATTRIBUTION.md` precached; every built `dist/assets/*.js` chunk actually listed in the precache manifest; no `googleapis`/`gstatic` URL precached. Its summary line:
`check:precache: <n> entries, <x> KiB (budget 8192 KiB), sign pictures <n>`, followed by `check:precache: OK` on success.

## Test strategy

- **Unit (Vitest):** `tests/unit/**/*.test.ts(x)` and `tests/content/**/*.test.ts` run under a single top-level `environment: 'node'` (`vite.config.ts`'s `test.include`) — pure functions and store logic (`tabs.ts`, `platform.ts`, `store.ts`, the progress engine, content schemas) need no DOM. A file that renders components opts into jsdom per-file with a `/** @vitest-environment jsdom */` pragma inside the block comment at the top of the file (not `environmentMatchGlobs`, and not a `//` line comment). Exactly 6 files carry that pragma today, all using `@testing-library/react`: `interactives-render.test.tsx`, `decoder.test.tsx`, `practice-header.test.tsx`, `match-pairs.test.tsx`, `quiz-sheet.test.tsx`, `sign-sprint.test.tsx`.
- **`fake-indexeddb`** (devDependency) lets Dexie-backed tests (e.g. `progress-store.test.ts`) open an isolated `ClutchDB` via its optional `(name, options?: DexieOptions)` constructor against a fake IndexedDB factory, without a real browser.
- **Content (`tests/content/`):** 7 files validating the committed JSON directly — schema, facts, syllabus, Highway Code and sign content. Runs via `npm run validate:content` (`vitest run tests/content`), and also as part of `npm test` since it's covered by the same `test.include`.
- **E2E (Playwright, WebKit, iPhone 14 profile):** `playwright.config.ts` sets `testDir: 'tests/e2e'`, `use.baseURL: 'http://localhost:4173'`, one project (`iphone-webkit`, `devices['iPhone 14']`), and a `webServer` running `npx vite preview --port 4173 --strictPort` (`retries: 1` under CI, else 0) — matching real iOS Safari: manifest served, Add to Home Screen panel, service worker registration, tab navigation. `tests/e2e/helpers.ts` exports `openAppAt`/`openApp` (navigate, dismiss the Add to Home Screen panel), `startPreview(port)`/`stopPreview(proc, port)` (spawn/kill a dedicated preview server, polling until it answers/actually stops) and `waitForServiceWorkerActivated(page)` (a synchronous `waitForFunction` predicate).
- **Offline reload:** these tests do not use Playwright's `context.setOffline(true)` — under WebKit that call is a hard network kill a service worker cannot answer through, so each spawns its OWN `vite preview` server on a dedicated port, waits for the service worker to control the page, genuinely kills that server process, polls until a `fetch` to it actually throws, then reloads and asserts the app still renders from the SW cache. Three specs need this and each uses its own port so they never collide: `shell.spec.ts` (4174), `highway-code.spec.ts` (4175), `signs-offline.spec.ts` (4176, sign pictures awaited with a synchronous `img.complete && img.naturalWidth > 0` predicate). `signs.spec.ts` and `games.spec.ts` have no offline test of their own.
