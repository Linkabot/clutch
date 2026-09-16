// End-to-end tests for the offline Highway Code experience: finding Rule
// 126 through search, opening it as a cold deep link under /clutch/,
// proving both the rule page and search still render once the ONLY server
// able to answer fresh requests has been stopped (plan.md Step 18), and
// (Step 8, S3 on screen) that a section's kept interludes render on both
// the section screen and the rule screen — including amendment E4's
// whitespace/typography fixes: no visible blank lines inside a band, and
// an interlude's prose paragraph reading in the same font/weight as the
// rest of the rule body — and that traffic-signs' diagram links keep their
// captioned "(diagram, online)" text — and (Step 10, S5/C-S2) that
// HcHtml's internal content links are rewritten to carry the /clutch/
// base and still navigate in-app when tapped, proved with a
// __clutchNoReload window marker (amendment E6) that only survives a
// client-side navigation, since vite preview's navigateFallback would
// otherwise let a full page reload pass the same URL assertion. Runs
// against the production build (`vite preview`) with Playwright's WebKit
// engine and an iPhone 14 device profile, matching real iOS Safari
// behaviour.
// Depends on: @playwright/test, node:fs, node:path, node:url, ./helpers
// (openAppAt, startPreview, stopPreview, waitForServiceWorkerActivated),
// content/uk/highway-code/sections/*.json (read directly, not imported).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAppAt, startPreview, stopPreview, waitForServiceWorkerActivated } from './helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Reads a committed Highway Code section JSON file directly, the same way
 * tests/content/helpers.ts's readJson does, so this test proves what is
 * really on disk rather than trusting a hard-coded expectation. */
function readSection(slug: string): {
  interludes: { beforeRuleId: string | null; html: string }[];
} {
  const path = join(
    __dirname,
    '..',
    '..',
    'content',
    'uk',
    'highway-code',
    'sections',
    `${slug}.json`,
  );
  return JSON.parse(readFileSync(path, 'utf8')) as {
    interludes: { beforeRuleId: string | null; html: string }[];
  };
}

/** Strips tags, collapses whitespace and trims — the same normalisation
 * htmlToText applies — so the derived snippet matches what the interlude's
 * sanitised html actually renders as visible text. */
function firstVisibleChars(html: string, count: number): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, count);
}

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

test('interludes and captioned diagram links render', async ({ page }) => {
  const generalRulesSlug =
    'general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158';
  const section = readSection(generalRulesSlug);
  const interlude = section.interludes.find((entry) => entry.beforeRuleId !== null);
  if (!interlude || interlude.beforeRuleId === null) {
    throw new Error(`expected an interlude with a non-null beforeRuleId in ${generalRulesSlug}`);
  }
  const snippet = firstVisibleChars(interlude.html, 30);

  await openAppAt(page, `/clutch/learn/code/${generalRulesSlug}`);
  await expect(page.locator('.hc-interlude').getByText(snippet)).toBeVisible();

  await page.goto(`/clutch/code/rule/${interlude.beforeRuleId}`);
  await expect(page.locator('.hc-interlude').getByText(snippet)).toBeVisible();

  await page.goto('/clutch/learn/code/traffic-signs');
  const diagramLinks = page.locator('a.hc-image');
  await expect(diagramLinks).toHaveCount(169);
  await expect(diagramLinks.first()).toHaveText(/^↗ .+ \(diagram, online\)$/);

  // Amendment E4: interludeHtml collapses the blank line(s) a bare heading
  // run leaves before its next line, so .hc-interlude's pre-line whitespace
  // no longer renders as visible empty lines (Rule 117's heading/sub-heading
  // band).
  await page.goto('/clutch/code/rule/117');
  const controlOfVehicleInterlude = await page.locator('.hc-interlude').first().innerText();
  expect(controlOfVehicleInterlude).toBe('Control of the vehicle (rules 117 to 126)\nBraking');

  // Amendment E4: an interlude's prose (its <p>) reads as body text — same
  // reading font and weight as the rest of .hc-html, wrapping normally —
  // rather than inheriting .hc-interlude's Overpass 800 display type and
  // pre-line whitespace, which is kept only for the bare heading line.
  await page.goto('/clutch/code/rule/127');
  // page.evaluate does not auto-wait like locator methods do, so the
  // interlude's <p> must be waited for explicitly before reading its
  // computed style — otherwise this can run while the section chunk (an
  // async import) is still loading and the page still reads "Loading…".
  await expect(page.locator('.hc-interlude p').first()).toBeVisible();
  const computedStyles = await page.evaluate(() => {
    const interludeParagraph = document.querySelector<HTMLElement>('.hc-interlude p');
    const bodyParagraph = Array.from(document.querySelectorAll<HTMLElement>('.hc-html p')).find(
      (paragraph) => !paragraph.closest('.hc-interlude'),
    );
    if (!interludeParagraph || !bodyParagraph) return null;
    const interludeStyle = getComputedStyle(interludeParagraph);
    const bodyStyle = getComputedStyle(bodyParagraph);
    return {
      whiteSpace: interludeStyle.whiteSpace,
      interludeFontFamily: interludeStyle.fontFamily,
      interludeFontWeight: interludeStyle.fontWeight,
      bodyFontFamily: bodyStyle.fontFamily,
      bodyFontWeight: bodyStyle.fontWeight,
    };
  });
  expect(computedStyles).not.toBeNull();
  expect(computedStyles!.whiteSpace).toBe('normal');
  expect(computedStyles!.interludeFontFamily).toBe(computedStyles!.bodyFontFamily);
  expect(computedStyles!.interludeFontWeight).toBe(computedStyles!.bodyFontWeight);
});

test('internal content links carry the /clutch/ base', async ({ page }) => {
  await openAppAt(page, '/clutch/learn/code/index');

  await expect(page.locator('a[href^="/code/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/learn/"]')).toHaveCount(0);

  const ruleLinks = page.locator('a[href^="/clutch/code/rule/"]');
  await expect(ruleLinks.first()).toBeVisible();
  expect(await ruleLinks.count()).toBeGreaterThanOrEqual(1);

  // Amendment E6: vite preview (and the service worker's navigateFallback)
  // serve the app for any /clutch/code/rule/<id> path, so asserting the
  // post-tap URL alone would still pass after a full page reload — this
  // marker only survives an in-app (client-side) navigation, so it proves
  // HcHtml's click handling actually ran instead of the browser reloading.
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__clutchNoReload = true;
  });

  await ruleLinks.first().click();
  await expect(page).toHaveURL(/\/clutch\/code\/rule\/(\d{1,3}|H[1-3])$/);
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__clutchNoReload),
  ).toBe(true);
});
