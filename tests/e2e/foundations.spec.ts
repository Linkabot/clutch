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
// any unknown route both redirect home; plus Step 7 (M34, PS13, amendment
// E12(a)/(b)): the signs browser's pictures measurably fill their tiles,
// the sign page's OGL words are a real link, and the Decoder's two hints
// sit fully on screen, clear of the heading, the plate label and the
// colour chip, showing again on a fresh visit.
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

interface TileMeasurement {
  paintedWidth: number;
  overflow: number;
  tileWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  lineClamp: string;
}

test.describe('Signs browser and sign page at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sign tiles show pictures large', async ({ page }) => {
    await openAppAt(page, '/clutch/learn/signs');
    await expect(page.locator('.signs-tile').first()).toBeVisible();

    // A synchronous img.complete && img.naturalWidth > 0 predicate (plan.md
    // § Rules "Playwright") for the first 6 tiles' pictures.
    await page.waitForFunction(() => {
      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>('.signs-tile__picture img'),
      ).slice(0, 6);
      return imgs.length === 6 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    });

    const measurements: TileMeasurement[] = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll<HTMLElement>('.signs-tile')).slice(0, 6);
      return tiles.map((tile) => {
        const img = tile.querySelector('img') as HTMLImageElement;
        const tileRect = tile.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const paintedWidth = Math.min(
          imgRect.width,
          (imgRect.height * img.naturalWidth) / img.naturalHeight,
        );
        const tileStyle = getComputedStyle(tile);
        const caption = tile.querySelector('.signs-tile__caption') as HTMLElement;
        const boxRect = (
          tile.querySelector('.signs-tile__picture') as HTMLElement
        ).getBoundingClientRect();
        return {
          paintedWidth,
          overflow: imgRect.bottom - boxRect.bottom,
          tileWidth: tileRect.width,
          paddingTop: parseFloat(tileStyle.paddingTop),
          paddingRight: parseFloat(tileStyle.paddingRight),
          paddingBottom: parseFloat(tileStyle.paddingBottom),
          paddingLeft: parseFloat(tileStyle.paddingLeft),
          lineClamp: getComputedStyle(caption).webkitLineClamp,
        };
      });
    });

    expect(measurements).toHaveLength(6);
    for (const m of measurements) {
      expect(m.paintedWidth).toBeGreaterThanOrEqual(m.tileWidth * 0.85);
      // Amendment E13: the picture box contains its picture -- growing the
      // img without its box would spill the picture over the caption.
      expect(m.overflow).toBeLessThanOrEqual(0.5);
      expect(m.paddingTop).toBeLessThanOrEqual(6);
      expect(m.paddingRight).toBeLessThanOrEqual(6);
      expect(m.paddingBottom).toBeLessThanOrEqual(6);
      expect(m.paddingLeft).toBeLessThanOrEqual(6);
      expect(m.lineClamp).toBe('3');
    }

    const chips = page.locator('.signs-chip');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);
    for (let i = 0; i < chipCount; i++) {
      const box = await chips.nth(i).boundingBox();
      if (!box) throw new Error('chip has no box');
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('sign page links the OGL', async ({ page }) => {
    await openAppAt(page, '/clutch/learn/signs/warning-slippery-road');
    const link = page.getByRole('link', { name: 'Open Government Licence v3.0' });
    await expect(link).toHaveAttribute(
      'href',
      'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    );
  });
});

interface HintRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function within(inner: HintRect, outer: HintRect): boolean {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}

function intersects(a: HintRect, b: HintRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe('Decoder hints at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('decoder hints sit clear', async ({ page }) => {
    await openAppAt(page, '/clutch/learn/signs/decoder');

    const shapeHint = page.locator('.decoder__hint--shape');
    const colourHint = page.locator('.decoder__hint--colour');
    await expect(shapeHint).toBeVisible();
    await expect(colourHint).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    const shapeBox = await shapeHint.boundingBox();
    const colourBox = await colourHint.boundingBox();
    if (!shapeBox || !colourBox) throw new Error('a hint has no box');
    for (const box of [shapeBox, colourBox]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }

    const stageBox = await page.locator('.decoder__stage').boundingBox();
    const headingBox = await page.locator('h1').boundingBox();
    const labelBox = await page.locator('.decoder__label').boundingBox();
    const colourChipBox = await page.locator('.decoder__colour').boundingBox();
    if (!stageBox || !headingBox || !labelBox || !colourChipBox) {
      throw new Error('a reference element has no box');
    }

    expect(within(shapeBox, stageBox)).toBe(true);
    expect(intersects(shapeBox, headingBox)).toBe(false);
    expect(intersects(shapeBox, labelBox)).toBe(false);

    expect(intersects(colourBox, colourChipBox)).toBe(false);
    // The colour hint's vertical span overlaps the chip's.
    expect(colourBox.y).toBeLessThan(colourChipBox.y + colourChipBox.height);
    expect(colourBox.y + colourBox.height).toBeGreaterThan(colourChipBox.y);

    await page.getByRole('button', { name: 'Change shape' }).click();
    await expect(shapeHint).toHaveCount(0);
    await expect(colourHint).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.decoder__hint--shape')).toBeVisible();
    await expect(page.locator('.decoder__hint--colour')).toBeVisible();
  });
});
