// End-to-end tests for the Step 1 phone-test defect fixes (plan.md
// handoffs/ux-foundations/plan.md, Step 1): PS16 (a link inside reading
// text is visibly a link -- underlined, a different colour from its
// surrounding text), PS19 (a tap target does not offer iOS's
// press-and-hold text selection, while reading text still does, including
// the inline links inside rendered Highway Code text per amendment E1),
// and PS29/M14 (Match Pairs renders its five sign tiles and five name
// tiles as an aligned two-column grid that fits a real 390x844 iPhone
// screen, row N's sign and row N's name always sharing a top and a
// height, with no caption clipped inside its tile); plus Step 3b (Q1, M37):
// the header band shows the tab's title, centred, at 28px on every tab
// root and no title at all on an inner page (whose own big <h1> sits under
// the band with main's 24px top padding), and the hidden My Car route and
// any unknown route both redirect home.
// Depends on: @playwright/test, ./helpers (openAppAt), the production
// build served by playwright.config.ts's webServer (port 4173).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect } from '@playwright/test';
import { openAppAt } from './helpers';

test('links are visibly links', async ({ page }) => {
  await openAppAt(page, '/clutch/me');

  const link = page.getByRole('link', { name: 'Open Government Licence v3.0' });
  await expect(link).toBeVisible();

  const linkColor = await link.evaluate((el) => getComputedStyle(el).color);
  const parentColor = await link.evaluate(
    (el) => getComputedStyle(el.parentElement as Element).color,
  );
  expect(linkColor).not.toBe(parentColor);

  const textDecorationLine = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(textDecorationLine).toContain('underline');
});

test('tap targets do not select text', async ({ page }) => {
  await openAppAt(page, '/clutch/');
  const navLink = page.locator('nav[aria-label="Main"] a').first();
  await expect(navLink).toBeVisible();
  const navSelect = await navLink.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('-webkit-user-select'),
  );
  expect(navSelect).toBe('none');

  await openAppAt(page, '/clutch/practice/tap');
  const tile = page.locator('.tap__tile').first();
  await expect(tile).toBeVisible();
  const tileSelect = await tile.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('-webkit-user-select'),
  );
  expect(tileSelect).toBe('none');

  await openAppAt(page, '/clutch/me');
  const notOfficial = page.getByTestId('not-official');
  await expect(notOfficial).toBeVisible();
  const notOfficialSelect = await notOfficial.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('-webkit-user-select'),
  );
  expect(notOfficialSelect).not.toBe('none');
});

test('inline rule links stay selectable', async ({ page }) => {
  await openAppAt(page, '/clutch/code/rule/103');

  const inlineLink = page
    .locator('.hc-html')
    .getByRole('link', { name: 'Signals to other road users' });
  await expect(inlineLink).toBeVisible();
  const inlineLinkSelect = await inlineLink.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('-webkit-user-select'),
  );
  expect(inlineLinkSelect).not.toBe('none');

  const navLink = page.locator('nav[aria-label="Main"] a').first();
  const navSelect = await navLink.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('-webkit-user-select'),
  );
  expect(navSelect).toBe('none');
});

interface TileRect {
  top: number;
  height: number;
  bottom: number;
}

interface NameTileRect extends TileRect {
  scrollHeight: number;
  clientHeight: number;
}

test.describe('Match Pairs at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Match Pairs fits 390x844 in aligned rows', async ({ page }) => {
    test.setTimeout(60_000);

    for (let load = 0; load < 6; load++) {
      await openAppAt(page, '/clutch/practice/pairs');
      await expect(page.locator('[data-pair-sign]')).toHaveCount(5);
      await expect(page.locator('[data-pair-name]')).toHaveCount(5);

      const innerHeight = await page.evaluate(() => window.innerHeight);

      const signRects: TileRect[] = await page.locator('[data-pair-sign]').evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, height: rect.height, bottom: rect.bottom };
        }),
      );
      const nameRects: NameTileRect[] = await page
        .locator('[data-pair-name]')
        .evaluateAll((elements) =>
          elements.map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              top: rect.top,
              height: rect.height,
              bottom: rect.bottom,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            };
          }),
        );

      for (const rect of [...signRects, ...nameRects]) {
        expect(rect.bottom).toBeLessThanOrEqual(innerHeight);
      }

      const sortedSigns = [...signRects].sort((a, b) => a.top - b.top);
      const sortedNames = [...nameRects].sort((a, b) => a.top - b.top);
      for (let row = 0; row < 5; row++) {
        expect(Math.abs(sortedSigns[row].top - sortedNames[row].top)).toBeLessThanOrEqual(1);
        expect(Math.abs(sortedSigns[row].height - sortedNames[row].height)).toBeLessThanOrEqual(1);
      }

      for (const rect of nameRects) {
        expect(rect.scrollHeight).toBeLessThanOrEqual(rect.clientHeight + 1);
      }
    }
  });
});

test('header band titles', async ({ page }) => {
  const roots: Array<{ path: string; label: string }> = [
    { path: '/clutch/', label: 'Journey' },
    { path: '/clutch/learn', label: 'Learn' },
    { path: '/clutch/practice', label: 'Practice' },
    { path: '/clutch/me', label: 'Me' },
  ];

  for (const { path, label } of roots) {
    await openAppAt(page, path);
    const title = page.locator('header h1');
    await expect(title).toHaveText(label);
    const fontSize = await title.evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('28px');
  }

  await openAppAt(page, '/clutch/learn/signs');
  await expect(page.locator('header h1')).toHaveCount(0);
  const mainHeading = page.locator('main h1');
  const mainFontSize = await mainHeading.evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(mainFontSize)).toBeGreaterThanOrEqual(26);
  const mainPaddingTop = await page
    .locator('main')
    .evaluate((el) => getComputedStyle(el).paddingTop);
  expect(mainPaddingTop).toBe('24px');
});

test('hidden and unknown routes go home', async ({ page }) => {
  await openAppAt(page, '/clutch/my-car');
  await expect(page).toHaveURL(/\/clutch\/$/);

  await openAppAt(page, '/clutch/no-such-page');
  await expect(page).toHaveURL(/\/clutch\/$/);
});
