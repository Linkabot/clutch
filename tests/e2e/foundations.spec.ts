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
// colour chip, showing again on a fresh visit; plus Step 11 (Q17, M15,
// PS11, M01, amendment E25): Today's Start here card suggests a game and
// links to it, the Traffic signs card and the muted note; Today and Me
// both hold their numbers back until the progress store and the sign
// catalogue have settled, proved by a MutationObserver that fails on any
// flash of a zero; Me's three sections and its Attribution disclosure,
// opened, no longer scroll the page sideways; and Me's own Add to Home
// Screen row opens the panel without ever storing a dismissal -- fold-in
// E26 (c) extends that last case: the open panel is a fixed layer that
// truly covers the header band and the tab bar (checked by
// document.elementFromPoint at both), and its Not now button meets the
// 44px minimum tap target at a comfortable width.
// Depends on: @playwright/test, ./helpers (openAppAt), src/app/platform
// (DISMISSED_KEY, a plain constant read directly rather than through the
// built app), the production build served by playwright.config.ts's
// webServer (port 4173).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect, type Page } from '@playwright/test';
import { openAppAt } from './helpers';
import { DISMISSED_KEY } from '../../src/app/platform';

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

/**
 * Puts rows straight into the app's `progress` object store (keyPath
 * `key`), bypassing the progress-store's own Dexie writes. Opens the
 * database with no version argument, so the app must already have created
 * it (openAppAt, called before this) -- same pattern as
 * tests/e2e/signs.spec.ts's own seedProgressRows, copied locally since
 * tests/e2e/helpers.ts is not Step 11's to edit.
 */
async function seedProgressRows(
  page: Page,
  rows: { key: string; value: unknown }[],
): Promise<void> {
  await page.evaluate((seedRows) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ClutchDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.close();
          reject(new Error('progress object store missing'));
          return;
        }
        const tx = db.transaction('progress', 'readwrite');
        const store = tx.objectStore('progress');
        for (const row of seedRows) {
          store.put(row);
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, rows);
}

/**
 * Puts rows straight into the app's `signProgress` object store (keyPath
 * `signId`) -- same pattern and caveats as seedProgressRows above, copied
 * locally from tests/e2e/signs.spec.ts.
 */
async function seedSignProgress(
  page: Page,
  rows: { signId: string; correct: number }[],
): Promise<void> {
  await page.evaluate((seedRows) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ClutchDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('signProgress')) {
          db.close();
          reject(new Error('signProgress object store missing'));
          return;
        }
        const tx = db.transaction('signProgress', 'readwrite');
        const store = tx.objectStore('signProgress');
        for (const row of seedRows) {
          store.put(row);
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, rows);
}

test.describe('Today and Me at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Today suggests a game', async ({ page }) => {
    await openAppAt(page, '/clutch/');

    const start = page.getByRole('link', { name: /Start here/ });
    await expect(start).toHaveAttribute('href', '/clutch/practice/tap');
    await expect(start).toContainText('Play Tap the sign – 10 questions');
    await expect(page.getByText('0 of 195 collected')).toBeVisible();
    await expect(page.getByText('Your journey map arrives in Phase 4')).toBeVisible();

    const trafficSigns = page.getByRole('link', { name: 'Traffic signs' });
    await expect(trafficSigns).toHaveAttribute('href', '/clutch/learn/signs');

    await expect(page.locator('main h1')).toHaveCount(0);
    await expect(page.locator('main h2')).toHaveCount(0);

    await start.click();
    await expect(page).toHaveURL(/\/clutch\/practice\/tap$/);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/clutch\/$/);
  });

  test('Today and Me follow what was played, with no flash of zeros', async ({ page }) => {
    // Open once so the app creates its IndexedDB database before it is seeded.
    await openAppAt(page, '/clutch/');

    await seedProgressRows(page, [
      { key: 'xp', value: 240 },
      { key: 'lastPlayed:tap', value: Date.now() },
    ]);
    await seedSignProgress(page, [{ signId: 'warning-roundabout', correct: 3 }]);

    // Primary's own detector (step11-facts.md § F2), verbatim: it records
    // ["xp 0", "xp 240"] on the parent's Practice tab, proving it catches a
    // flash. Installed after seeding, before the cold page.goto below, so it
    // is present from the very first paint of each reload.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __seenOnScreen: string[] }).__seenOnScreen = seen;
      const shown = (el: Element) =>
        getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
      const note = (text: string) => {
        if (!seen.includes(text)) seen.push(text);
      };
      new MutationObserver(() => {
        const numbers = document.querySelectorAll('main .practice-header__number');
        if (numbers.length === 2 && shown(numbers[1])) note(`xp ${numbers[1].textContent}`);
        for (const el of document.querySelectorAll('main a')) {
          const match = /\d+ of \d+ collected/.exec(el.textContent ?? '');
          if (match && shown(el)) note(match[0]);
        }
      }).observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    });

    await page.goto('/clutch/');
    await expect(page.getByText('1 of 195 collected')).toBeVisible();
    const todaySeen = await page.evaluate(
      () => (window as unknown as { __seenOnScreen: string[] }).__seenOnScreen,
    );
    expect([...todaySeen].sort()).toEqual(['1 of 195 collected', 'xp 240']);
    await expect(page.getByRole('link', { name: /Start here/ })).toHaveAttribute(
      'href',
      '/clutch/practice/sprint',
    );

    await page.goto('/clutch/me');
    await expect(page.getByText('1 of 195 collected')).toBeVisible();
    const meSeen = await page.evaluate(
      () => (window as unknown as { __seenOnScreen: string[] }).__seenOnScreen,
    );
    expect([...meSeen].sort()).toEqual(['1 of 195 collected', 'xp 240']);
  });

  test('Me has three sections', async ({ page }) => {
    await openAppAt(page, '/clutch/me');

    await expect(page.locator('main h2')).toHaveText(['Progress', 'Settings', 'About']);

    await page.locator('details.attribution > summary').click();
    await expect(page.getByRole('heading', { name: 'Overpass', exact: true })).toBeVisible();

    const startsWithHash = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.attribution__body *'))
        .filter((el) => el.children.length === 0)
        .map((el) => (el.textContent ?? '').trim())
        .filter((text) => text.startsWith('#')),
    );
    expect(startsWithHash).toEqual([]);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('Add to Home Screen opens from Me and leaves the dismissal alone', async ({ page }) => {
    await openAppAt(page, '/clutch/me');
    await page.evaluate((key) => window.localStorage.removeItem(key), DISMISSED_KEY);

    const heading = page.getByRole('heading', { name: 'Add to Home Screen' });
    await page.getByRole('button', { name: 'Add to Home Screen' }).click();
    await expect(heading).toBeVisible();

    // M01 fold-in (E26 (c)): the panel is a fixed full-screen layer, so a
    // point over the header band and a point over the tab bar both land
    // inside it, not on the shell underneath.
    const coversBandAndTabBar = await page.evaluate(() => {
      const inLayer = (x: number, y: number) =>
        Boolean((document.elementFromPoint(x, y) as Element | null)?.closest('.a2hs'));
      return (
        inLayer(window.innerWidth / 2, 30) &&
        inLayer(window.innerWidth / 2, window.innerHeight - 20)
      );
    });
    expect(coversBandAndTabBar).toBe(true);

    const MIN_TAP_TARGET = 44;
    const notNowBox = await page.getByRole('button', { name: 'Not now' }).boundingBox();
    if (!notNowBox) throw new Error('Not now has no box');
    expect(notNowBox.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    expect(notNowBox.width).toBeGreaterThanOrEqual(300);

    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(heading).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();

    const dismissed = await page.evaluate((key) => window.localStorage.getItem(key), DISMISSED_KEY);
    expect(dismissed).toBeNull();
  });
});
