// End-to-end proof that Know Your Traffic Signs pictures are truly
// available offline once the service worker has finished precaching them,
// and that no real sign picture is ever inlined as SVG markup rather than
// rendered through a plain <img src> (plan.md D7, Step 27; amendment E36's
// ${origin}-qualified navigations, the single waitForSignPictures helper,
// the Shape & Colour Decoder in the inlining sweep, and exact locators).
// "offline: sign pictures load with the server stopped" spawns its own
// preview server on port 4176 (4174 is tests/e2e/shell.spec.ts's own
// offline test, 4175 is tests/e2e/highway-code.spec.ts's -- amendment E8),
// opens ONLY /clutch/ so no sign picture reaches WebKit's memory cache
// first, waits for the service worker to reach 'activated' (Workbox
// finishes precaching every globPatterns entry, including every sign
// picture, before activation), really stops the server (stopPreview polls
// until a fetch to it actually throws -- a hard network kill would not
// prove the service worker itself can answer), then opens a NEW page in
// the same browser context and proves the Signs browser (all 195
// pictures), the two sign pages whose picture embeds a
// raster (road-works-roadworks, information-no-through-road) and Sign
// Sprint's picture each load -- every navigation on that new page is built
// from the 4176 server's own origin, never a bare /clutch/... path, which
// would instead resolve against playwright.config.ts's baseURL (4173, the
// main preview server, which never stops) and prove nothing against a
// dead server. "real sign pictures are never inlined" runs online (the
// default 4173 server) and asserts 0 <foreignObject> and 0 <svg image>
// elements, and every /clutch/signs/ <img> ending .svg, on every one of
// the 8 screens that render a SignImage (amendment E37): the Learn card,
// the Signs browser, the sign page, the Practice header's Tap card, Tap
// the sign, Sign Sprint, Match Pairs and the Shape & Colour Decoder -- the
// only screen among these that draws its own SVG art (.decoder__art),
// never <image> or foreignObject.
// Depends on: @playwright/test, node:child_process (type only), ./helpers
// (openAppAt, startPreview, stopPreview, waitForServiceWorkerActivated).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.

import { test, expect, type Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { openAppAt, startPreview, stopPreview, waitForServiceWorkerActivated } from './helpers';

// Port for the preview server this file's offline test spawns. 4174
// belongs to tests/e2e/shell.spec.ts's own offline test and 4175 to
// tests/e2e/highway-code.spec.ts's -- see ./helpers for why each offline
// test needs its own port (amendment E8).
const OFFLINE_PORT = 4176;
let offlineServer: ChildProcess | undefined;

// Guards against an orphaned server holding the port if the test below
// fails before it reaches its own stopPreview call (mirrors
// tests/e2e/shell.spec.ts's own afterAll guard).
test.afterAll(async () => {
  if (offlineServer) {
    const proc = offlineServer;
    offlineServer = undefined;
    await stopPreview(proc, OFFLINE_PORT);
  }
});

/**
 * Waits until at least `min` sign pictures (an <img> whose src contains
 * /clutch/signs/) are on the page AND every one of them has finished
 * loading. A single synchronous predicate carries both conditions
 * (amendment E36): a page with fewer than `min` such pictures, or one
 * whose pictures have not finished loading yet, must not satisfy this
 * wait, so neither a too-early poll nor a not-yet-rendered "Sign not
 * found." page can pass it vacuously.
 */
async function waitForSignPictures(page: Page, min: number): Promise<void> {
  await page.waitForFunction(
    (minCount) => {
      const imgs = [...document.querySelectorAll('img')].filter((img) =>
        (img.getAttribute('src') ?? '').includes('/clutch/signs/'),
      );
      return imgs.length >= minCount && imgs.every((img) => img.complete && img.naturalWidth > 0);
    },
    min,
    { timeout: 60_000 },
  );
}

test('offline: sign pictures load with the server stopped', async ({ page }) => {
  test.setTimeout(180_000);

  const origin = `http://localhost:${OFFLINE_PORT}`;
  offlineServer = await startPreview(OFFLINE_PORT);

  // The first page opens ONLY /clutch/ (Journey shows no sign picture), so
  // no sign picture is in WebKit's memory cache before the server stops.
  await openAppAt(page, `${origin}/clutch/`);
  await waitForServiceWorkerActivated(page);

  const proc = offlineServer;
  offlineServer = undefined;
  await stopPreview(proc, OFFLINE_PORT);

  const offline = await page.context().newPage();

  await offline.goto(`${origin}/clutch/learn/signs`);
  await waitForSignPictures(offline, 195);
  await expect(offline.locator('h1')).toHaveText('Traffic signs');

  await offline.goto(`${origin}/clutch/learn/signs/road-works-roadworks`);
  await waitForSignPictures(offline, 1);
  await expect(offline.locator('img[src$="/clutch/signs/road-works/roadworks.svg"]')).toHaveCount(
    1,
  );
  await expect(offline.getByText('Sign not found.')).toHaveCount(0);

  await offline.goto(`${origin}/clutch/learn/signs/information-no-through-road`);
  await waitForSignPictures(offline, 1);
  await expect(
    offline.locator('img[src$="/clutch/signs/information/no-through-road.svg"]'),
  ).toHaveCount(1);
  await expect(offline.getByText('Sign not found.')).toHaveCount(0);

  await offline.goto(`${origin}/clutch/practice/sprint`);
  await waitForSignPictures(offline, 1);
  await expect(offline.locator('.sprint__picture img')).toBeVisible();

  expect(offline.url().startsWith(`${origin}/`)).toBe(true);
  expect(await offline.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

const INLINING_CASES: { path: string; floor: number; decoder?: true }[] = [
  { path: '/clutch/learn', floor: 3 },
  { path: '/clutch/learn/signs', floor: 195 },
  { path: '/clutch/learn/signs/orders-no-entry', floor: 1 },
  { path: '/clutch/practice', floor: 4 },
  { path: '/clutch/practice/tap', floor: 4 },
  { path: '/clutch/practice/sprint', floor: 1 },
  { path: '/clutch/practice/pairs', floor: 5 },
  { path: '/clutch/learn/signs/decoder', floor: 3, decoder: true },
];

test('real sign pictures are never inlined', async ({ page }) => {
  await openAppAt(page, '/clutch/');

  for (const { path, floor, decoder } of INLINING_CASES) {
    await page.goto(path);
    await waitForSignPictures(page, floor);

    const counts = await page.evaluate(() => {
      const signImages = [...document.querySelectorAll('img')].filter((img) =>
        (img.getAttribute('src') ?? '').includes('/clutch/signs/'),
      );
      return {
        foreignObjects: document.querySelectorAll('foreignObject').length,
        svgImages: document.querySelectorAll('svg image').length,
        signImageCount: signImages.length,
        svgSuffixCount: signImages.filter((img) => (img.getAttribute('src') ?? '').endsWith('.svg'))
          .length,
      };
    });

    expect(counts.foreignObjects).toBe(0);
    expect(counts.svgImages).toBe(0);
    expect(counts.signImageCount).toBeGreaterThanOrEqual(floor);
    expect(counts.svgSuffixCount).toBe(counts.signImageCount);

    if (decoder) {
      await expect(page.locator('.decoder__art')).toHaveCount(1);
    }
  }
});
