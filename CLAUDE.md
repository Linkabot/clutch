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
├─ public/
│  ├─ icons/                    (exists) PWA + apple-touch icons
│  ├─ signs/*.svg                (later phase)
│  └─ ATTRIBUTION.md            (exists)
├─ scripts/
│  ├─ lib/                      (exists) scripts/lib/: govuk.ts, highway-code-parse.ts, national-standard-parse.ts
│  └─ make-icons.mjs            (exists)
├─ src/
│  ├─ app/                      (exists) App.tsx, routes.tsx, tabs.ts, TabBar.tsx,
│  │                            theme.css, store.ts, platform.ts, pwa.ts, AddToHomeScreen.tsx
│  ├─ ui/                       (exists) src/ui/: SignPanel, SignPlate, Roundel, Button, Chip, primitives.css
│  ├─ features/
│  │  ├─ journey  learn  practice  my-car  me   (exists) placeholder screens
│  │  ├─ me/OfflineReady.tsx    (exists)
│  │  ├─ code/                  (exists) src/features/code/: Highway Code sections, rule page, search
│  │  └─ interactives/          (later phase)
│  ├─ engine/                   (later phase)
│  ├─ content/                  (exists) src/content/: schemas/, loaders.ts, text.ts
│  └─ storage/
│     └─ db.ts                  (exists) Dexie, settings table only
├─ tests/
│  ├─ unit/                     (exists)
│  ├─ e2e/                      (exists)
│  ├─ content/                  (exists) tests/content/: schema, facts and Highway Code content tests
│  └─ fixtures/                 (exists) tests/fixtures/: highway-code-section.html, national-standard-role.html
├─ handoffs/                    (exists) audit trail per task — git-ignored
└─ .github/workflows/ci.yml     (exists)
```

## Dev Commands

Live: https://linkabot.github.io/clutch/

| Command                | Does                                            |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | dev server at `http://localhost:5173/clutch/`   |
| `npm run lint`         | ESLint                                          |
| `npm run typecheck`    | `tsc -b`                                        |
| `npm test`             | Vitest unit tests                               |
| `npm run build`        | production build to `dist/`                     |
| `npm run preview`      | serve the production build locally              |
| `npm run e2e`          | build + Playwright e2e (WebKit, iPhone profile) |
| `npm run icons`        | regenerate placeholder PWA/apple-touch icons    |
| `npm run format`       | Prettier, write                                 |
| `npm run format:check` | Prettier, check only                            |

Tool shells in this session don't have node/npm/gh on `PATH`; every command needs
`export PATH="$PATH:/c/Program Files/nodejs:/c/Program Files/GitHub CLI"` first.

## Conventions

Every file under `src/`, `tests/`, `scripts/` starts with a header comment: what the module does, what it depends on, what depends on it. Commits are Conventional Commits style, ending with a `Co-Authored-By` trailer. Base path `/clutch/` is explicit everywhere (Vite `base`, router `basename`, manifest `scope`/`start_url`, Workbox `navigateFallback`) — see `docs/ARCHITECTURE.md`. Never `100vh` (use `100dvh`); form inputs stay at 16px+ font-size so iOS Safari doesn't zoom on focus.

## Content rules

See `docs/CONTENT-GUIDE.md` for schemas, authoring rules, licensing and attribution (Phase 1+; not yet populated).

## Decisions

See `docs/DECISIONS.md` for the locked decisions and their reasoning (Phase 0 Step 12).

## Current phase

Phase 0 — in progress; resume point is `docs/ROADMAP.md`.

## Handoffs

Every task's audit trail lives at `handoffs/<task-slug>/` (scout.md, plan.md, step-NN.md, review.md) and is git-ignored.
