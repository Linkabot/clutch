// End-to-end shell tests: run against the production build (`vite preview`)
// with Playwright's WebKit engine and an iPhone 14 device profile, matching
// real iOS Safari behaviour (manifest, Add to Home Screen panel, service
// worker registration/offline readiness, tab navigation with icons and
// aria-current, offline reload, and (Step 12, A-S3) that the header's Back
// button falls back to the owning tab on a cold deep link instead of
// leaving the app), and (amendment E44, licence lane S1) that the Me tab's
// fixed OGL sentence links "Open Government Licence v3.0" to the licence
// text.
// The offline-reload test (amendment A2) spawns a second `vite preview`
// server on port 4174 and kills it with a real OS signal, because
// `context.setOffline(true)` is a hard network kill WebKit's service worker
// cannot answer through (verified during Step 10, attempt 1). The spawn/kill
// mechanism and the "Add to Home Screen" dismissal now live in ./helpers
// (Step 18), shared with tests/e2e/highway-code.spec.ts.
// Depends on: @playwright/test, ../../src/app/tabs (tab id/path/label/icon
// list), ./helpers (openApp, openAppAt, startPreview, stopPreview), the
// production build served by playwright.config.ts's webServer (port 4173)
// and by the ad-hoc server this file spawns (4174).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { TABS } from '../../src/app/tabs';
import { openApp, openAppAt, startPreview, stopPreview } from './helpers';

test('manifest served', async ({ page }) => {
  const response = await page.request.get('/clutch/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toBe('Clutch');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/clutch/');

  await page.goto('/clutch/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test('add to home screen screen shows in Safari and dismisses', async ({ page }) => {
  await page.goto('/clutch/');
  const heading = page.getByRole('heading', { name: 'Add to Home Screen' });
  await expect(heading).toBeVisible();

  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(heading).toBeHidden();
  await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
});

test('service worker registers and Me shows Offline ready', async ({ page }) => {
  await openApp(page);

  const hasActiveWorker = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((registration) => !!registration.active),
  );
  expect(hasActiveWorker).toBe(true);

  await page.getByRole('link', { name: 'Me' }).click();
  await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
  await expect(page.getByTestId('not-official')).toHaveText(
    'Not an official DVSA or government app.',
  );
  await expect(page.getByText('Overpass')).toBeVisible();

  // Amendment E44, licence lane S1: the OGL sentence's own words link to
  // the licence text.
  await expect(page.getByRole('link', { name: 'Open Government Licence v3.0' })).toHaveAttribute(
    'href',
    'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  );
});

test('tabs navigate', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('nav[aria-label="Main"] svg')).toHaveCount(5);

  for (const tab of TABS) {
    await page.getByRole('link', { name: tab.label }).click();
    const expectedSuffix = tab.path === '/' ? '/clutch/' : `/clutch${tab.path}`;
    await expect(page).toHaveURL((url) => url.pathname.endsWith(expectedSuffix));
    await expect(page.locator('h1')).toHaveText(tab.label);
  }

  await page.getByRole('link', { name: 'Learn' }).click();
  await expect(page.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
});

test('Back on a cold deep link stays in the app', async ({ page }) => {
  // A-S3: a fresh page landing directly on a nested route (no prior in-app
  // history) must fall back to the owning tab rather than navigating the
  // browser out of the app.
  await openAppAt(page, '/clutch/code/rule/126');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/clutch/learn'));
});

// Port for the second preview server this file's offline test spawns.
// tests/e2e/highway-code.spec.ts uses 4175 for its own offline test — see
// ./helpers for why the two files need different ports (amendment E8).
const OFFLINE_PORT = 4174;
let offlineServer: ChildProcess | undefined;

// Guards against an orphaned server holding the port if the test below
// fails before it reaches its own stopPreview call.
test.afterAll(async () => {
  if (offlineServer) {
    const proc = offlineServer;
    offlineServer = undefined;
    await stopPreview(proc, OFFLINE_PORT);
  }
});

test('offline reload still renders', async ({ page }) => {
  offlineServer = await startPreview(OFFLINE_PORT);
  await openAppAt(page, `http://localhost:${OFFLINE_PORT}/clutch/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const proc = offlineServer;
  offlineServer = undefined;
  await stopPreview(proc, OFFLINE_PORT);

  await page.reload();
  await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Journey');
});
