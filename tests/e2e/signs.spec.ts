// End-to-end tests for the Learn tab's Traffic signs card, the Signs
// browser and (Step 20) the sign page (plan.md Step 19; amendment P7's 195
// signs; amendment E18's sequence and exact:true locators; amendment E19's
// Learn-card picture proof, kept-collected-param-on-All-chip proof, unknown
// ?family= proof and the seeded-IndexedDB collection-progress test; Step
// 20's "Sign page" test proves the picture card, family pill, heading, the
// Shape & colour and Memory hook rows (present/absent per sign), the Play
// button's route (no /practice/tap route until Step 23, so the assertion
// is URL-only, per P12/the Step 20 execution notes) and the Highway Code
// link; amendment E21 extends that same test with a SIGN_PAGE_CASES table
// covering every shape/colour glyph, both heading sizes, a hook shown
// without a rule row (orders-national-speed-limit, C9), both C7 route
// colours, and seeded IndexedDB progress on the sign page itself (partial
// dots and a full COLLECTED badge) — kept in one spec file since Step 21
// adds one more test here). Runs against the production build (`vite
// preview`) with Playwright's WebKit engine and an iPhone 14 device
// profile, matching real iOS Safari behaviour.
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

/**
 * One case per shape/colour glyph, both heading sizes, a hook shown
 * without a rule row (`orders-national-speed-limit`, C9), and the C7 route
 * colours (green, white) -- amendment E21. Every `shapeColour`/`hook`
 * sentence is copied verbatim from content/uk/signs/shape-rules.json and
 * content/uk/signs/hooks.json, never retyped. `file` is the sign's own SVG
 * file stem, used only to disambiguate two consecutive cases that share a
 * pill label (the three `orders` signs) -- proof that the new page, not
 * the previous one, is what the pill assertion actually matched.
 */
const SIGN_PAGE_CASES: {
  id: string;
  file: string;
  pill: string;
  glyphClass: string | null;
  long: boolean;
  shapeColour: string | null;
  hook: string | null;
}[] = [
  {
    id: 'warning-slippery-road',
    file: 'slippery-road',
    pill: 'Warning signs',
    glyphClass: 'sign-page__glyph--triangle',
    long: false,
    shapeColour: 'Triangles warn. All triangular signs are red.',
    hook: null,
  },
  {
    id: 'orders-40-mph',
    file: '40-mph',
    pill: 'Signs giving orders',
    glyphClass: 'sign-page__glyph--circle-red',
    long: true,
    shapeColour:
      'Circles give orders. Red rings or circles tell you what you must not do, e.g. you must not exceed 30 mph, no vehicles over the height shown may proceed.',
    hook: 'Red ring number: the most. Blue circle number: the least.',
  },
  {
    id: 'orders-mini-roundabout',
    file: 'mini-roundabout',
    pill: 'Signs giving orders',
    glyphClass: 'sign-page__glyph--circle-blue',
    long: true,
    shapeColour:
      'Circles give orders. Blue circles generally give a mandatory instruction, such as ‘turn left’, or indicate a route available only to particular classes of traffic, e.g. buses and cycles only.',
    hook: 'Mini-roundabout: give way to the right.',
  },
  {
    id: 'orders-national-speed-limit',
    file: 'national-speed-limit',
    pill: 'Signs giving orders',
    glyphClass: null,
    long: true,
    shapeColour: null,
    hook: 'National speed limit: it depends on the road and the vehicle.',
  },
  {
    id: 'direction-london-a2',
    file: 'london-a2',
    pill: 'Direction signs',
    glyphClass: 'sign-page__glyph--rectangle-green',
    long: false,
    shapeColour:
      'Rectangles inform. Green rectangles are used for direction signs on primary routes.',
    hook: null,
  },
  {
    id: 'information-road-ahead-non-primary-route',
    file: 'road-ahead-non-primary-route',
    pill: 'Information signs',
    glyphClass: 'sign-page__glyph--rectangle-white',
    long: false,
    shapeColour:
      'Rectangles inform. White rectangles are used for direction signs on non-primary routes, or for plates used in combination with warning and regulatory signs.',
    hook: null,
  },
  {
    id: 'motorway-a52-motorway-junction',
    file: 'a52-motorway-junction',
    pill: 'Motorway signs',
    glyphClass: 'sign-page__glyph--rectangle-blue',
    long: true,
    shapeColour:
      'Rectangles inform. Blue rectangles are used for information signs except on motorways, where blue is used for direction signs.',
    hook: null,
  },
  {
    id: 'road-works-roadworks',
    file: 'roadworks',
    pill: 'Road works signs',
    glyphClass: null,
    long: true,
    shapeColour: null,
    hook: null,
  },
];

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

test('Sign page', async ({ page }) => {
  await openAppAt(page, '/clutch/learn/signs/warning-slippery-road');

  const heading = page.locator('h1');
  await expect(heading).toHaveText('Slippery road.');

  // Only assert absence/presence once the caption above proves the sign's
  // own data has actually loaded (Step 20 execution notes).
  await expect(page.getByText('Triangles warn. All triangular signs are red.')).toBeVisible();
  await expect(page.getByText('0 of 3 correct to collect')).toBeVisible();
  await expect(page.getByText('Memory hook', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(
      'Sign image and wording: Know Your Traffic Signs, © Crown copyright 2023, Open Government Licence v3.0.',
    ),
  ).toBeVisible();
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('main img');
    return !!img && img.complete && img.naturalWidth > 0;
  });

  await page.getByRole('button', { name: 'Play with this sign' }).click();
  await expect(page).toHaveURL(/\/clutch\/practice\/tap\?sign=warning-slippery-road$/);
  await page.goBack();
  await expect(heading).toHaveText('Slippery road.');

  await page.getByRole('link', { name: 'Traffic signs in The Highway Code' }).click();
  await expect(page).toHaveURL(/\/clutch\/learn\/code\/traffic-signs$/);

  await page.goto('/clutch/learn/signs/orders-mini-roundabout');
  await expect(heading).toHaveText(
    'Mini-roundabout (give way to traffic from the immediate right).',
  );
  await expect(page.getByText('Memory hook', { exact: true })).toBeVisible();
  await expect(page.getByText('Mini-roundabout: give way to the right.')).toBeVisible();

  await page.goto('/clutch/learn/signs/road-works-roadworks');
  await expect(heading).toHaveText(
    'This sign, indicating road works or an obstruction in the carriageway ahead, may be used for any type of works, ranging from large construction schemes to minor maintenance.',
  );
  await expect(page.getByText('Shape & colour', { exact: true })).toHaveCount(0);

  await page.goto('/clutch/learn/signs/nope');
  await expect(heading).toHaveText('Sign not found.');

  // Amendment E21: every glyph, both heading sizes, a hook shown without a
  // rule row, and both C7 route colours.
  const pill = page.locator('.sign-page__pill');
  let previousPill: string | null = null;
  for (const testCase of SIGN_PAGE_CASES) {
    await page.goto(`/clutch/learn/signs/${testCase.id}`);
    await expect(pill).toHaveText(testCase.pill);
    if (testCase.pill === previousPill) {
      // Same pill label as the page before -- the assertion above cannot
      // by itself prove this is the NEW sign's page, so also wait for its
      // own picture.
      await expect(page.locator('main img')).toHaveAttribute(
        'src',
        new RegExp(`${testCase.file}\\.svg$`),
      );
    }
    previousPill = testCase.pill;

    if (testCase.long) {
      await expect(heading).toHaveClass(/sign-page__title--long/);
    } else {
      await expect(heading).not.toHaveClass(/sign-page__title--long/);
    }

    if (testCase.glyphClass) {
      await expect(pill.locator(`.${testCase.glyphClass}`)).toHaveCount(1);
    } else {
      await expect(pill.locator('svg')).toHaveCount(0);
    }

    if (testCase.shapeColour) {
      await expect(page.getByText(testCase.shapeColour)).toBeVisible();
    } else {
      await expect(page.getByText('Shape & colour', { exact: true })).toHaveCount(0);
    }

    if (testCase.hook) {
      await expect(page.getByText(testCase.hook)).toBeVisible();
    } else {
      await expect(page.getByText('Memory hook', { exact: true })).toHaveCount(0);
    }
  }

  // Amendment E21: progress seeded straight into IndexedDB shows on the
  // sign page too -- partial progress (dots) and full collection
  // (COLLECTED, no dots or "of 3 correct to collect" text).
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).some((d) => d.name === 'ClutchDB' && d.version === 20),
      ),
    )
    .toBe(true);

  await seedSignProgress(page, [
    { signId: 'warning-slippery-road', correct: 2 },
    { signId: 'warning-crossroads', correct: 3 },
  ]);

  await page.goto('/clutch/learn/signs/warning-slippery-road');
  await expect(page.getByText('2 of 3 correct to collect')).toBeVisible();
  await expect(page.locator('.sign-page__picture-card .signs-tile__dot')).toHaveCount(3);
  await expect(page.locator('.sign-page__picture-card .signs-tile__dot--empty')).toHaveCount(1);

  await page.goto('/clutch/learn/signs/warning-crossroads');
  await expect(heading).toHaveText('Crossroads.');
  await expect(page.getByText('COLLECTED')).toBeVisible();
  await expect(page.getByText('of 3 correct to collect')).toHaveCount(0);
});
