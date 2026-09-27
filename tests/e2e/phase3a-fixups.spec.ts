// End-to-end tests for Phase 3 block 3a's Group 1 fix-ups
// (handoffs/phase-3-theory-core/plan.md). Step 1 (U12, M42) proves the
// Traffic signs card's three sign pictures render at 44x44 with 8px gaps
// on both Learn and Today, that both halves of the signs browser's
// All/Collected toggle are at least 44px tall, and two guards: the How
// signs work card's three hand-drawn shapes stay 32x32 with 6px gaps and
// its "Shape & Colour Decoder" subtitle stays one line, and neither Learn
// nor Today scrolls sideways. Steps 3 and 4 append their own tests to this
// same file later (plan.md "Rules for every step"), so it keeps a flat
// list of top-level tests, each titled NEW or GUARD per its plan tag
// (amendment A7 (b)).
// Depends on: @playwright/test, ./helpers (openAppAt).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect, type Locator } from '@playwright/test';
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
