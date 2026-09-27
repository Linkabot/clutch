// End-to-end tests for Phase 3 block 3a's Group 1 fix-ups
// (handoffs/phase-3-theory-core/plan.md). Step 1 (U12, M42) proves the
// Traffic signs card's three sign pictures render at 44x44 with 8px gaps
// on both Learn and Today, that both halves of the signs browser's
// All/Collected toggle are at least 44px tall, and two guards: the How
// signs work card's three hand-drawn shapes stay 32x32 with 6px gaps and
// its "Shape & Colour Decoder" subtitle stays one line, and neither Learn
// nor Today scrolls sideways. Step 3 (M40, amendment A1) proves the app
// header band and the tab bar go inert while Tap the sign, Sign Sprint or
// Match Pairs shows as a full-screen layer over them: a GUARD per game
// proves a point at the header's own centre actually lands inside that
// game's root, not the header (the layer really is a covering z-index
// layer, foundations.spec.ts's Add to Home Screen pattern extended to name
// the element hit), and a NEW test per game proves the header and the nav
// both carry the inert attribute once the layer's root is visible, and
// neither does once its close button has returned to Practice (amendment
// A17). Step 4 appends its own tests to this same file later (plan.md
// "Rules for every step"), so it keeps a flat list of top-level tests,
// each titled NEW or GUARD per its plan tag (amendment A7 (b)).
// Depends on: @playwright/test, ./helpers (openAppAt).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect, type Locator, type Page } from '@playwright/test';
import { openAppAt } from './helpers';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every bounding box of `locator`'s matches, in document order. */
async function boxesOf(locator: Locator): Promise<Box[]> {
  const count = await locator.count();
  const result: Box[] = [];
  for (let i = 0; i < count; i++) {
    const box = await locator.nth(i).boundingBox();
    if (box === null) throw new Error('expected a visible element with a bounding box');
    result.push(box);
  }
  return result;
}

function expectClose(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

/** Each box is `size` square, within `tolerance` px. */
function expectSquares(boxes: Box[], size: number, tolerance: number) {
  for (const box of boxes) {
    expectClose(box.width, size, tolerance);
    expectClose(box.height, size, tolerance);
  }
}

/** The horizontal gap between each pair of neighbours is `gap`, within `tolerance` px. */
function expectRowGaps(boxes: Box[], gap: number, tolerance: number) {
  for (let i = 1; i < boxes.length; i++) {
    const actual = boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width);
    expectClose(actual, gap, tolerance);
  }
}

test('NEW U12: the Traffic signs pictures on Learn are 44px with 8px gaps', async ({ page }) => {
  await openAppAt(page, '/clutch/learn');
  const pictures = page.locator('a[href="/clutch/learn/signs"] img');
  await expect(pictures).toHaveCount(3);

  const boxes = await boxesOf(pictures);
  expectSquares(boxes, 44, 0.5);
  expectRowGaps(boxes, 8, 0.5);
});

test('NEW U12: the Traffic signs pictures on Today are 44px with 8px gaps', async ({ page }) => {
  await openAppAt(page, '/clutch/');
  await page.locator('.today:not(.today--pending)').waitFor();
  const pictures = page.locator('a[href="/clutch/learn/signs"] img');
  await expect(pictures).toHaveCount(3);

  const boxes = await boxesOf(pictures);
  expectSquares(boxes, 44, 0.5);
  expectRowGaps(boxes, 8, 0.5);
});

test('NEW M42: both halves of the signs browser toggle are at least 44px tall', async ({
  page,
}) => {
  await openAppAt(page, '/clutch/learn/signs');
  const halves = page.locator('.signs-toggle__half');
  await expect(halves).toHaveCount(2);

  const boxes = await boxesOf(halves);
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(44 - 0.5);
  }
});

test('GUARD U12: How signs work keeps 32px shapes with 6px gaps and a one-line Decoder subtitle', async ({
  page,
}) => {
  await openAppAt(page, '/clutch/learn');
  const shapes = page.locator('a.learn-decoder-card svg');
  await expect(shapes).toHaveCount(3);

  const shapeBoxes = await boxesOf(shapes);
  expectSquares(shapeBoxes, 32, 0.5);
  expectRowGaps(shapeBoxes, 6, 0.5);

  await page.evaluate(() => document.fonts.ready);
  const subtitle = page.locator('.learn-card__subtitle');
  const subtitleBox = await subtitle.boundingBox();
  if (subtitleBox === null) throw new Error('expected a visible subtitle');
  const lineHeight = await subtitle.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(subtitleBox.height).toBeLessThan(lineHeight * 1.5);
});

test('GUARD U12: Learn and Today have no sideways scroll', async ({ page }) => {
  await openAppAt(page, '/clutch/learn');
  await expect(page.locator('a[href="/clutch/learn/signs"] img')).toHaveCount(3);
  const learnScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(learnScrollWidth).toBe(390);

  await openAppAt(page, '/clutch/');
  await page.locator('.today:not(.today--pending)').waitFor();
  const todayScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(todayScrollWidth).toBe(390);
});

/** The document coordinates at the centre of `locator`'s bounding box. */
async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('expected a visible element with a bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * True when the point at the centre of the header band actually hits
 * `rootSelector`'s full-screen layer, not the header underneath it (M40's
 * covering guard -- foundations.spec.ts's Add to Home Screen pattern,
 * extended to name the element the hit lands inside rather than just
 * excluding the header).
 */
async function headerPointHitsLayer(page: Page, rootSelector: string): Promise<boolean> {
  const point = await centreOf(page.locator('header.app-header'));
  return page.evaluate(
    ({ x, y, rootSelector }) => {
      const el = document.elementFromPoint(x, y) as Element | null;
      return (
        el !== null && el.closest('header.app-header') === null && el.closest(rootSelector) !== null
      );
    },
    { x: point.x, y: point.y, rootSelector },
  );
}

test('GUARD M40: the Tap the sign layer covers the header', async ({ page }) => {
  await openAppAt(page, '/clutch/practice/tap?family=warning');
  await expect(page.locator('.tap')).toBeVisible();
  expect(await headerPointHitsLayer(page, '.tap')).toBe(true);
});

test('GUARD M40: the Sign Sprint layer covers the header', async ({ page }) => {
  await openAppAt(page, '/clutch/practice/sprint');
  await expect(page.locator('.sprint')).toBeVisible();
  expect(await headerPointHitsLayer(page, '.sprint')).toBe(true);
});

test('GUARD M40: the Match Pairs layer covers the header', async ({ page }) => {
  await openAppAt(page, '/clutch/practice/pairs');
  await expect(page.locator('.pairs')).toBeVisible();
  expect(await headerPointHitsLayer(page, '.pairs')).toBe(true);
});

test('NEW M40: the header and tab bar are inert under Tap the sign, and not after its close button', async ({
  page,
}) => {
  await openAppAt(page, '/clutch/practice/tap?family=warning');
  await expect(page.locator('.tap')).toBeVisible();

  const header = page.locator('header.app-header');
  const nav = page.locator('nav[aria-label="Main"]');
  await expect(header).toHaveAttribute('inert', '');
  await expect(nav).toHaveAttribute('inert', '');

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/clutch\/practice$/);

  await expect(header).not.toHaveAttribute('inert');
  await expect(nav).not.toHaveAttribute('inert');
});

test('NEW M40: the header and tab bar are inert under Sign Sprint, and not after its close button', async ({
  page,
}) => {
  await openAppAt(page, '/clutch/practice/sprint');
  await expect(page.locator('.sprint')).toBeVisible();

  const header = page.locator('header.app-header');
  const nav = page.locator('nav[aria-label="Main"]');
  await expect(header).toHaveAttribute('inert', '');
  await expect(nav).toHaveAttribute('inert', '');

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/clutch\/practice$/);

  await expect(header).not.toHaveAttribute('inert');
  await expect(nav).not.toHaveAttribute('inert');
});

test('NEW M40: the header and tab bar are inert under Match Pairs, and not after its close button', async ({
  page,
}) => {
  await openAppAt(page, '/clutch/practice/pairs');
  await expect(page.locator('.pairs')).toBeVisible();

  const header = page.locator('header.app-header');
  const nav = page.locator('nav[aria-label="Main"]');
  await expect(header).toHaveAttribute('inert', '');
  await expect(nav).toHaveAttribute('inert', '');

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/clutch\/practice$/);

  await expect(header).not.toHaveAttribute('inert');
  await expect(nav).not.toHaveAttribute('inert');
});
