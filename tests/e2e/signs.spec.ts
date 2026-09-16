// End-to-end tests for the Learn tab's Traffic signs card and the Signs
// browser (plan.md Step 19; amendment P7's 195 signs; amendment E18's
// sequence and exact:true locators; amendment E19's Learn-card picture
// proof, kept-collected-param-on-All-chip proof, unknown ?family= proof
// and the seeded-IndexedDB collection-progress test — kept in one spec
// file since Steps 20 and 21 each add one more test here). Runs against
// the production build (`vite preview`) with Playwright's WebKit engine
// and an iPhone 14 device profile, matching real iOS Safari behaviour.
// Depends on: @playwright/test, ./helpers (openAppAt).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect, type Page } from '@playwright/test';
import { openAppAt } from './helpers';

/**
 * Puts signProgress rows straight into IndexedDB (bypassing the app's own
 * progress-store writes), so a fresh e2e profile can be given seeded
 * collection progress without playing a game. Opens the database with no
 * version argument (the app must already have created it, amendment E19),
 * writes every row in one readwrite transaction and resolves on
 * `oncomplete`, closing the connection either way.
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

test('Signs browser filters', async ({ page }) => {
  await openAppAt(page, '/clutch/learn');

  const trafficSignsCard = page.getByRole('link', { name: 'Traffic signs' });
  await expect(trafficSignsCard).toBeVisible();
  await expect(trafficSignsCard).toContainText('0 of 195 collected');

  // E19 item 3a: the card's three thumbnails are the right signs, each
  // actually decoded (a typo in an id would silently show only two).
  const cardImages = page.locator('a[href="/clutch/learn/signs"] img');
  await expect(cardImages).toHaveCount(3);
  await expect(cardImages.nth(0)).toHaveAttribute('src', /signs\/warning\/roundabout\.svg$/);
  await expect(cardImages.nth(1)).toHaveAttribute('src', /signs\/orders\/no-entry\.svg$/);
  await expect(cardImages.nth(2)).toHaveAttribute('src', /signs\/orders\/turn-left\.svg$/);
  await page.waitForFunction(() => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>('a[href="/clutch/learn/signs"] img'),
    );
    return imgs.length === 3 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  });

  await trafficSignsCard.click();
  await expect(page).toHaveURL(/\/clutch\/learn\/signs$/);

  const grid = page.getByTestId('signs-grid');
  const tiles = grid.getByRole('link');
  await expect(tiles).toHaveCount(195);

  await page.getByRole('button', { name: 'Warning', exact: true }).click();
  await expect(tiles).toHaveCount(66);
  await expect(page.getByRole('button', { name: 'All warning signs', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Road works', exact: true }).click();
  await expect(tiles).toHaveCount(16);

  await page.getByRole('button', { name: 'Collected', exact: true }).click();
  const emptyMessage = page.getByText(
    'No signs collected yet. Get 3 answers right for a sign in any game to collect it.',
  );
  await expect(emptyMessage).toBeVisible();

  // E19 item 3b: changing the family chip keeps collected=1 (amendment
  // E18) — a fresh profile still shows the empty state after chip All,
  // and only the toggle's own All-signs half turns Collected off.
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(emptyMessage).toBeVisible();
  await expect(page).toHaveURL(/collected=1/);

  await page.getByRole('button', { name: 'All signs', exact: true }).click();
  await expect(tiles).toHaveCount(195);

  await grid.getByRole('link', { name: 'Crossroads.', exact: true }).click();
  await expect(page).toHaveURL(/\/clutch\/learn\/signs\/warning-crossroads$/);

  // E19 item 3c: an unknown ?family= falls back to 'all' rather than
  // crashing the screen (familyMeta throws for a value not in FAMILIES).
  await page.goto('/clutch/learn/signs?family=nope');
  await expect(tiles).toHaveCount(195);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Signs browser shows collection progress', async ({ page }) => {
  await openAppAt(page, '/clutch/learn/signs');

  const grid = page.getByTestId('signs-grid');
  const tiles = grid.getByRole('link');
  await expect(tiles).toHaveCount(195);

  // WebKit reports the app's database once it has actually opened it
  // (amendment E19's pre-verified fact); opening it any earlier would
  // create an empty version-1 database instead of seeding version 20's
  // signProgress store.
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).some((d) => d.name === 'ClutchDB' && d.version === 20),
      ),
    )
    .toBe(true);

  await seedSignProgress(page, [
    { signId: 'warning-crossroads', correct: 3 },
    { signId: 'warning-roundabout', correct: 2 },
    { signId: 'orders-no-entry', correct: 3 },
    { signId: 'road-works-roadworks', correct: 1 },
  ]);
  await page.reload();

  await expect(page.getByText('2 of 195 collected')).toBeVisible();
  await expect(page.locator('.signs-toggle__badge')).toHaveText('2');

  const crossroadsTile = grid.locator('a[href="/clutch/learn/signs/warning-crossroads"]');
  await expect(crossroadsTile).toContainText('COLLECTED');
  await expect(crossroadsTile.locator('.signs-tile__dot')).toHaveCount(0);

  const roundaboutTile = grid.locator('a[href="/clutch/learn/signs/warning-roundabout"]');
  await expect(roundaboutTile.locator('.signs-tile__dot')).toHaveCount(3);
  await expect(roundaboutTile.locator('.signs-tile__dot--empty')).toHaveCount(1);

  await page.getByRole('button', { name: 'Warning', exact: true }).click();
  await expect(page.locator('.signs-toggle__badge')).toHaveText('1');

  await page.getByRole('button', { name: 'Collected', exact: true }).click();
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toHaveAttribute('href', '/clutch/learn/signs/warning-crossroads');

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(tiles).toHaveCount(2);
  await expect(tiles.nth(0)).toHaveAttribute('href', '/clutch/learn/signs/warning-crossroads');
  await expect(tiles.nth(1)).toHaveAttribute('href', '/clutch/learn/signs/orders-no-entry');

  await page.goto('/clutch/learn');
  await expect(page.getByRole('link', { name: 'Traffic signs' })).toContainText(
    '2 of 195 collected',
  );
});
