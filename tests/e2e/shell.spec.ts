// End-to-end shell tests: run against the production build (`vite preview`)
// with Playwright's WebKit engine and an iPhone 14 device profile, matching
// real iOS Safari behaviour (manifest, Add to Home Screen panel, service
// worker registration/offline readiness, tab navigation, offline reload).
// The offline-reload test (amendment A2) spawns a second `vite preview`
// server on port 4174 and kills it with a real OS signal, because
// `context.setOffline(true)` is a hard network kill WebKit's service worker
// cannot answer through (verified during Step 10, attempt 1).
// Depends on: @playwright/test, ../../src/app/tabs (tab id/path/label list),
// node:child_process, the production build served by playwright.config.ts's
// webServer (port 4173) and by the ad-hoc server this file spawns (4174).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml (Step 13).
import { test, expect, type Page } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { TABS } from '../../src/app/tabs';

/**
 * Navigates to the app root and dismisses the "Add to Home Screen" panel if
 * it is showing (iPhone/WebKit profile is non-standalone, so it shows on
 * every fresh browser context).
 */
async function openApp(page: Page): Promise<void> {
  await page.goto('/clutch/');
  const heading = page.getByRole('heading', { name: 'Add to Home Screen' });
  const nav = page.locator('nav[aria-label="Main"]');
  // Wait for the initial render to settle on one of its two possible root
  // states before deciding whether "Not now" needs clicking; checking
  // isVisible() immediately after goto() can race the app's first render.
  await heading.or(nav).first().waitFor({ state: 'visible' });
  if (await heading.isVisible()) {
    await page.getByRole('button', { name: 'Not now' }).click();
  }
}

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
});

test('tabs navigate', async ({ page }) => {
  await openApp(page);

  for (const tab of TABS) {
    await page.getByRole('link', { name: tab.label }).click();
    const expectedSuffix = tab.path === '/' ? '/clutch/' : `/clutch${tab.path}`;
    await expect(page).toHaveURL((url) => url.pathname.endsWith(expectedSuffix));
    await expect(page.locator('h1')).toHaveText(tab.label);
  }
});

// Second preview server for the offline-reload test below. Spawned directly
// with node.exe against vite's bin script (not `npx`/`npx.cmd`, which Node
// 24 rejects with `spawn EINVAL`) and without `shell: true` (which would
// make the resulting PID unkillable on Windows).
let offlineServer: ChildProcess | undefined;

function killOfflineServer(): void {
  const pid = offlineServer?.pid;
  offlineServer = undefined;
  if (!pid) return;
  try {
    // `taskkill /T` also kills any children; on POSIX platforms `vite
    // preview` has no children of its own, so a plain SIGKILL suffices.
    // CI runs on ubuntu-latest, so this branch is what actually executes
    // there — the taskkill branch only ever runs on the developer's Windows
    // machine.
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // Already exited; nothing to clean up.
  }
}

// Guards against an orphaned server holding port 4174 if the test above
// fails before it reaches its own kill step.
test.afterAll(() => {
  killOfflineServer();
});

test('offline reload still renders', async ({ page }) => {
  const origin = 'http://localhost:4174';
  offlineServer = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--strictPort'],
    { stdio: 'ignore' },
  );

  // Poll until the second server answers before navigating to it.
  await expect(async () => {
    await fetch(`${origin}/clutch/`);
  }).toPass({ timeout: 30_000 });

  await page.goto(`${origin}/clutch/`);
  const heading = page.getByRole('heading', { name: 'Add to Home Screen' });
  const nav = page.locator('nav[aria-label="Main"]');
  await heading.or(nav).first().waitFor({ state: 'visible' });
  if (await heading.isVisible()) {
    await page.getByRole('button', { name: 'Not now' }).click();
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  killOfflineServer();

  // Offline is proven by genuinely stopping the server (amendment A2), not by
  // context.setOffline(true) — under WebKit that API is a hard network kill
  // the service worker cannot answer through. Poll until a fetch to the
  // origin actually throws, and assert that it did: without this assertion
  // the test can pass against a still-running server, which produced a false
  // PASS during the attempt 1 probe.
  await expect(async () => {
    let threw = false;
    try {
      await fetch(`${origin}/clutch/`);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  }).toPass({ timeout: 15_000 });

  await page.reload();
  await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Journey');
});
