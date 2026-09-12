# Architecture

Clutch is a client-only, offline-first PWA: no backend, no accounts, all state on-device.

## Stack

- Vite 8 + React 18 + TypeScript 5.9 (pinned — see `docs/DECISIONS.md`)
- Tailwind CSS 4 via `@tailwindcss/vite`
- `react-router-dom` (`createBrowserRouter` + `RouterProvider`, `basename: import.meta.env.BASE_URL`)
- Zustand (in-memory UI state) + Dexie/IndexedDB (persistence)
- `vite-plugin-pwa` (`generateSW` strategy, `registerType: 'autoUpdate'`) for the manifest and service worker
- Vitest (unit tests, node environment) and Playwright (WebKit, iPhone 14 device profile) for e2e
- ESLint 9 flat config + Prettier

## Structure

```
clutch/
├─ src/
│  ├─ app/          routes, tab bar, theme, store, platform detection, pwa registration
│  ├─ features/     journey  learn  practice  my-car  me (one placeholder screen per tab)
│  └─ storage/      Dexie db (settings table)
├─ scripts/         make-icons.mjs
├─ tests/
│  ├─ unit/         Vitest, tests/unit/**/*.test.ts
│  └─ e2e/          Playwright, WebKit + iPhone 14 profile
├─ public/icons/    PWA + apple-touch icons
├─ docs/            this file and its siblings
└─ handoffs/        audit trail per task, git-ignored
```

Later phases add `content/uk/`, `src/engine/`, `src/content/`, `src/features/interactives/` and `public/signs/` — none of that exists yet.

## Base path handling

The app is served from `/clutch/` on GitHub Pages, so every layer is told the same base path explicitly rather than inferring it:

- `vite.config.ts` — `base: '/clutch/'`
- Router — `basename: import.meta.env.BASE_URL` on `createBrowserRouter`
- Manifest — `scope: '/clutch/'` and `start_url: '/clutch/'`
- Workbox — `navigateFallback: '/clutch/index.html'`
- `dist/404.html` (added in Step 13) — a copy of `dist/index.html`, so GitHub Pages serves the app shell for deep-link 404s instead of its own 404 page

## State

Zustand (`src/app/store.ts`) holds transient UI state that does not need to survive a reload — currently `swStatus` and `isStandalone`. Dexie (`src/storage/db.ts`) is the persistence layer; Phase 0 ships only a `settings` table. Anything the user should keep across sessions goes through Dexie, not Zustand.

## PWA update model

`vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`: the service worker checks for a new version on every load and activates it without prompting the user, so the next launch (not the current session) picks up the update. `src/app/pwa.ts` calls `registerSW` from `virtual:pwa-register` with `immediate: true` and drives `swStatus` in the store (`unsupported` / `registering` / `ready` / `error`), which `src/features/me/OfflineReady.tsx` renders as a single-line indicator.

## Test strategy

- **Unit (Vitest, node environment):** pure functions and store logic — `tabs.ts`, `platform.ts`, `store.ts` — no DOM, no browser APIs.
- **E2E (Playwright, WebKit, iPhone 14 profile):** runs against a production build served by `vite preview`, matching real iOS Safari — manifest served, Add to Home Screen panel, service worker registration, tab navigation.
- **Offline reload:** this test does not use Playwright's `context.setOffline(true)`. Under WebKit that call is a hard network kill that a service worker cannot answer through — verified during Step 10 (amendment A2): even an in-page `fetch` of a precached URL threw `Load failed`, so the API cannot exercise SW offline behaviour on WebKit at all. Instead the test spawns a second `vite preview` server on port 4174, waits for the service worker to control the page, genuinely kills that server process, polls until a `fetch` to it actually throws, then reloads and asserts the shell still renders from the SW cache.
