// End-to-end tests for the offline Highway Code experience: finding Rule
// 126 through search, opening it as a cold deep link under /clutch/, and
// proving both the rule page and search still render once the ONLY server
// able to answer fresh requests has been stopped (plan.md Step 18). Runs
// against the production build (`vite preview`) with Playwright's WebKit
// engine and an iPhone 14 device profile, matching real iOS Safari
// behaviour.
// Depends on: @playwright/test, ./helpers (openAppAt, startPreview,
// stopPreview, waitForServiceWorkerActivated).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect } from '@playwright/test';
import { openAppAt, startPreview, stopPreview, waitForServiceWorkerActivated } from './helpers';

test('search finds Rule 126', async ({ page }) => {
  await openAppAt(page, '/clutch/learn/code/search');

  const input = page.getByTestId('hc-search');
  await expect(input).toHaveAttribute('placeholder', 'Search rules and annexes');
  await input.fill('stopping distance');

  const resultLink = page.locator('[data-testid="search-results"] a[href$="/code/rule/126"]');
  await expect(resultLink).toBeVisible({ timeout: 20_000 });
  await resultLink.click();

  await expect(page.getByTestId('rule-badge')).toHaveText('Rule 126');
  await expect(page.locator('[data-testid="stopping-distances"] tbody tr')).toHaveCount(6);
});

test('cold deep link renders Rule 126 under /clutch/', async ({ page }) => {
  await openAppAt(page, '/clutch/code/rule/126');

  expect(page.url()).toContain('/clutch/code/rule/126');
  await expect(page.getByTestId('rule-badge')).toHaveText('Rule 126');
  await expect(page.getByTestId('rule-body')).toContainText('two-second gap');
  await expect(page.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');

  // Rule 126 is advice (not law) today, but this asserts on the pair
  // generically — whichever the rule's law flag yields is what must render.
  const lawChip = page.getByText('Law · says MUST');
  const adviceChip = page.getByText("Advice · says 'should'");
  await expect(lawChip.or(adviceChip)).toBeVisible();

  // Amendment M3 regression guard: Tailwind's preflight strips list markers
  // app-wide, so Highway Code rule text written as a bullet list needed its
  // markers explicitly restored (src/features/code/hc-html.css). Rule 126's
  // own "You should ..." list is the proof that fix stays in place.
  const firstList = page.locator('[data-testid="rule-body"] ul').first();
  await expect(firstList).toHaveCSS('list-style-type', 'disc');
});

test('offline: rule page and search render with the server stopped', async ({ page }) => {
  test.setTimeout(180_000);

  // Amendment E8: a different port from shell.spec.ts's offline test
  // (4174) — Playwright runs spec files in parallel worker processes by
  // default, and two --strictPort servers on the same port would race.
  const port = 4175;
  const origin = `http://localhost:${port}`;
  const proc = await startPreview(port);

  await openAppAt(page, `${origin}/clutch/`);
  await waitForServiceWorkerActivated(page);

  // Diagnostic for handoffs/phase-1-highway-code/step-21.md: if a further
  // CI run still fails at the offline page.goto below, this line shows
  // whether the worker really was controlling the page (and which
  // scope/URL) right before the server was stopped.
  const swReady = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      controllerScriptURL: navigator.serviceWorker.controller?.scriptURL ?? null,
      scope: registration?.scope ?? null,
      activeState: registration?.active?.state ?? null,
    };
  });
  console.log('SW ready:', JSON.stringify(swReady));

  await stopPreview(proc, port);

  await page.goto(`${origin}/clutch/code/rule/126`);
  await expect(page.getByTestId('rule-badge')).toHaveText('Rule 126');
  await expect(page.getByTestId('rule-body')).toContainText('two-second gap');

  // Amendment P9: the proof that the self-hosted fonts are actually served
  // offline is document.fonts.load() resolving FontFace objects whose own
  // .status is 'loaded' for the exact family/weight/size pairs the app
  // uses, not merely that some matching font is available. page.evaluate
  // cannot return FontFace objects across the Playwright bridge, so they
  // are mapped to booleans inside the page function.
  const fontsLoaded = await page.evaluate(async () => {
    const overpass = await document.fonts.load('700 16px Overpass');
    const atkinson = await document.fonts.load('400 17px "Atkinson Hyperlegible"');
    return {
      overpass: overpass.some((face) => face.status === 'loaded'),
      atkinson: atkinson.some((face) => face.status === 'loaded'),
    };
  });
  expect(fontsLoaded.overpass).toBe(true);
  expect(fontsLoaded.atkinson).toBe(true);

  await page.goto(`${origin}/clutch/learn/code/search`);
  await page.getByTestId('hc-search').fill('stopping distance');
  await expect(
    page.locator('[data-testid="search-results"] a[href$="/code/rule/126"]'),
  ).toBeVisible({ timeout: 20_000 });
});

test('Introduction section shows its preamble and H1–H3 rule rows', async ({ page }) => {
  // Regression guard for review-c.md finding C1: the Introduction section
  // holds rules H1–H3 (kind: 'introduction'), and both screens used to key
  // rendering on `kind === 'rules'`, which hid the preamble and every rule
  // row on this one section (plan.md Step 15b).
  await openAppAt(page, '/clutch/learn/code/introduction');

  await expect(page.locator('a[href$="/code/rule/H1"]')).toBeVisible();
  await expect(page.locator('a[href$="/code/rule/H2"]')).toBeVisible();
  await expect(page.locator('a[href$="/code/rule/H3"]')).toBeVisible();
  await expect(
    page.getByText('This Highway Code applies to England, Scotland and Wales'),
  ).toBeVisible();

  await openAppAt(page, '/clutch/learn/code');
  await expect(page.getByText('H1–H3')).toBeVisible();
});
