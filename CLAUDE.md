Clutch is an offline-first, gamified UK learner-driver PWA for iPhone; read this file first for how to run it, its conventions and where things stand.

## Stack

Vite 8 + React 18 + TypeScript 5.9 (pinned) · Tailwind CSS 4 (`@tailwindcss/vite`) · React Router (`createBrowserRouter`, basename from `import.meta.env.BASE_URL`) · Zustand + Dexie (IndexedDB) · `vite-plugin-pwa` · Vitest · Playwright (WebKit, iPhone 14 profile) · ESLint 9 flat config + Prettier.

## Structure

```
clutch/
├─ CLAUDE.md                    (exists)
├─ README.md                    (exists)
├─ docs/
│  ├─ ROADMAP.md                (exists) phases + status lines = the resume point
│  ├─ ARCHITECTURE.md           (exists)
│  ├─ CONTENT-GUIDE.md          (exists)
│  ├─ DECISIONS.md              (exists)
│  ├─ IPHONE-SETUP.md           (exists)
│  └─ DESIGN.md                 (exists) docs/DESIGN.md: tokens, primitives, motion policy
├─ content/uk/                  (exists) pack.json, facts.json, syllabus.json, highway-code/
├─ content/uk/signs/            (exists) attribution.json, hooks.json, selection.json, shape-rules.json, signs.json
├─ public/
│  ├─ icons/                    (exists) PWA + apple-touch icons
│  ├─ signs/                    (exists) public/signs/: <family>/*.svg (direction, information, motorway,
│  │                            orders, road-works, warning — 195 files), attribution.json
│  └─ ATTRIBUTION.md            (exists)
├─ scripts/
│  ├─ lib/                      (exists) scripts/lib/: govuk.ts, highway-code-build.ts, highway-code-parse.ts,
│  │                            href-audit.ts, json-diff.ts, kyts-licence.ts, kyts-parse.ts, kyts-select.ts,
│  │                            national-standard-parse.ts
│  ├─ make-icons.mjs            (exists)
│  └─ check-contrast.mjs, check-interactive-size.mjs, check-precache.mjs, compare-highway-code.ts,
│                               ingest-highway-code.ts, ingest-national-standard.ts, ingest-signs.ts,
│                               verify-signs.ts   (exists)
├─ src/
│  ├─ app/                      (exists) src/app/: App.tsx, routes.tsx, tabs.ts, TabBar.tsx, back.ts,
│  │                            theme.css, store.ts, platform.ts, pwa.ts, persist.ts, AddToHomeScreen.tsx
│  ├─ ui/                       (exists) src/ui/: SignPanel, SignPlate, Roundel, Button, Chip (barrel-exported
│  │                            through index.ts), plus ListRow, SegmentedControl, LoadFailed (imported
│  │                            straight from their own files), primitives.css
│  ├─ features/
│  │  ├─ journey/               (exists) src/features/journey/: JourneyScreen.tsx (the Today screen),
│  │  │                         journey.css
│  │  ├─ learn/                 (exists) src/features/learn/: Highway Code browser, Signs browser entry,
│  │  │                         lessons row
│  │  ├─ practice/              (exists) src/features/practice/: PracticeScreen.tsx, ProgressHeader.tsx,
│  │  │                         practice.css, src/features/practice/tap/: TapTheSignScreen.tsx, round.ts, tap.css
│  │  ├─ me/                    (exists) src/features/me/: MeScreen.tsx, Attribution.tsx, OfflineReady.tsx,
│  │  │                         markdown.tsx, me.css
│  │  ├─ code/                  (exists) src/features/code/: the Highway Code hub (search + Rules/Signs &
│  │  │                         signals/Annexes tabs), sections, rule page, search
│  │  ├─ signs/                 (exists) src/features/signs/: SignScreen.tsx, SignsScreen.tsx, families.ts,
│  │  │                         filter.ts, signs.css
│  │  └─ interactives/          (exists) src/features/interactives/: registry.ts, quiz-sheet/, sign-sprint/
│  │                            (incl. SprintStart.tsx), match-pairs/, shape-colour-decoder/, shared/ (the
│  │                            shared QuestionScreen and EndScreen, GameTopBar, VisualGameNote, exit.ts,
│  │                            SignImage, distractors.ts, random.ts, useReducedMotion.ts)
│  ├─ engine/                   (exists) src/engine/: progress.ts, progress-store.ts, progress-state.ts,
│  │                            score-band.ts, round-memory.ts, start-here.ts
│  ├─ content/                  (exists) src/content/: schemas/, loaders.ts, memo.ts, signs.ts, text.ts
│  └─ storage/
│     └─ db.ts                  (exists) Dexie version 2: settings, progress, signProgress tables
├─ tests/
│  ├─ unit/                     (exists)
│  ├─ e2e/                      (exists)
│  ├─ content/                  (exists) tests/content/: facts, helpers, highway-code, pack, signs-rules,
│  │                            signs and syllabus tests
│  └─ fixtures/                 (exists) tests/fixtures/: 5 Highway Code HTML fixtures, 3 KYTS HTML fixtures
│                               (kyts-chapter.html, kyts-page-exception.html, kyts-page-standard.html),
│                               national-standard-role.html
├─ handoffs/                    (exists) audit trail per task — git-ignored
└─ .github/workflows/ci.yml     (exists)
```

## Dev Commands

Live: https://linkabot.github.io/clutch/

| Command                            | Does                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                      | dev server at `http://localhost:5173/clutch/`                                                                                        |
| `npm run lint`                     | ESLint                                                                                                                               |
| `npm run typecheck`                | `tsc -b`                                                                                                                             |
| `npm test`                         | Vitest, `tests/unit` and `tests/content` together (`vitest run`)                                                                     |
| `npm run validate:content`         | Vitest content-only suite (`tests/content`): schema, facts, syllabus, Highway Code and sign content                                  |
| `npm run build`                    | production build to `dist/`, then a `postbuild` step copies `dist/index.html` to `dist/404.html` (GitHub Pages SPA fallback)         |
| `npm run preview`                  | serve the production build locally                                                                                                   |
| `npm run e2e`                      | build + Playwright e2e (WebKit, iPhone profile)                                                                                      |
| `npm run icons`                    | regenerate placeholder PWA/apple-touch icons                                                                                         |
| `npm run check:contrast`           | WCAG contrast check on `src/app/theme.css` colour tokens, light and dark mode                                                        |
| `npm run check:precache`           | checks the production build's Workbox precache manifest against the 8192 KiB budget (150 KiB per sign SVG)                           |
| `npm run check:interactives`       | checks each interactives registry entry's built size against its `sizeBudgetKiB`                                                     |
| `npm run ingest:highway-code`      | fetches the Highway Code from the gov.uk Content API, writes `content/uk/highway-code/` (run manually, once)                         |
| `npm run ingest:national-standard` | fetches the National Standard for Driving Cars and Light Vans, writes `content/uk/syllabus.json` (run manually, once)                |
| `npm run ingest:signs`             | fetches every KYTS chapter, selects and classifies the sign set, writes `content/uk/signs/` and `public/signs/` (run manually, once) |
| `npm run verify:signs`             | offline proof (`CLUTCH_OFFLINE=1`) that the committed sign outputs match a fresh re-derivation from `content/.cache/kyts/`           |
| `npm run compare:highway-code`     | offline comparator: rebuilds the Highway Code in memory and diffs it against the committed JSON                                      |
| `npm run format`                   | Prettier, write                                                                                                                      |
| `npm run format:check`             | Prettier, check only                                                                                                                 |

Tool shells in this session don't have node/npm/gh on `PATH`; every command needs
`export PATH="$PATH:/c/Program Files/nodejs:/c/Program Files/GitHub CLI"` first.

## Conventions

Every file under `src/`, `tests/`, `scripts/` starts with a header comment: what the module does, what it depends on, what depends on it. Commits are Conventional Commits style, ending with a `Co-Authored-By` trailer. Base path `/clutch/` is explicit everywhere (Vite `base`, router `basename`, manifest `scope`/`start_url`, Workbox `navigateFallback`) — see `docs/ARCHITECTURE.md`. Never `100vh` (use `100dvh`); form inputs stay at 16px+ font-size so iOS Safari doesn't zoom on focus.

## Content rules

See `docs/CONTENT-GUIDE.md` for schemas, authoring rules, licensing and attribution.

## Decisions

See `docs/DECISIONS.md` for the locked decisions and their reasoning.

## Current phase

Phase 2b (UX foundations) built; phone test pending. The resume point is `docs/ROADMAP.md`.

## Handoffs

Every task's audit trail lives at `handoffs/<task-slug>/` (scout.md, plan.md, step-NN.md, review.md) and is git-ignored.
