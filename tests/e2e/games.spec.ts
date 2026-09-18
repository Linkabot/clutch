// End-to-end tests for Clutch's games (plan.md Steps 23-26 and amendments
// E25, E27, E31 and E33). "tap the sign:
// right, wrong, reduced motion, finish" plays a full Tap the sign round
// seeded via ?sign=: question 1's right answer (the sheet's XP, confetti,
// streak-free body, disabled/dimmed tiles and sheetUp animation), question
// 2's wrong answer (the answer tile framed, the sheet's "Right answer:"
// body), eight more right answers proving the "N in a row" streak and the
// 10/10 label, then the round-complete summary, Play again resetting to
// 1/10, and the recorded XP/streak/collection progress on the Practice tab
// and the sign page afterwards. A second test emulates reduced motion
// before the app loads (P11): the sheet's static class, 0 confetti pieces,
// every element inside the sheet and the tapped tile computed with
// animationName 'none', then Sign page and Close's routes. "Sign Sprint
// run" installs Playwright's clock before the app loads (never pausing it)
// and plays two rounds: round 1 answers 3 signs right (the score, the +10 XP
// pop and the sign's driveIn animation) and 1 wrong, then fast-forwards
// past the 60-second deadline to the end screen (score, +30 XP and their
// pop animations, Best 3, the day streak and the one missed sign's link
// and caption); round 2, under emulated reduced motion, proves Play again
// resets the round, nothing animates, a score of 1 reads "sign named", and
// a lower score never lowers the best. Afterwards the
// Practice tab shows both rounds' XP and the streak, the first answer's
// sign page shows its collection progress, and Close leaves a fresh
// Sprint. Every read of the sign's data-answer-id after an answer first
// waits for it to change. "Match Pairs round" plays two rounds: round 1
// matches signs 1-3 on the first try (the selection, both tiles locked, and
// the +10 XP badge's and tick's pop animations), taps a wrong name for sign
// 4 (the red flash's shake animation and the cleared selection) before its
// retried, XP-free match, then sign 5, and reaches the end card with +40 XP;
// round 2, under emulated reduced motion, proves Play again resets the
// board, nothing animates, and five first-try matches give +50 XP.
// Afterwards the Practice tab shows both rounds' XP and the streak, and the
// sign pages of round 1's first-try sign 1 and retried sign 4 show their
// collection progress (counting round 2's first-try matches of the same
// signs), and Close leaves a fresh board. "Shape & Colour Decoder" opens
// the Decoder from the Learn tab's "How signs work" card (the Learn tab
// stays current, and the sign page's "Sign not found." never shows), checks
// the Circle · Red start with its loaded example pictures and the sign's
// and text's animations, taps Change shape twice to the invalid
// Rectangle · Red (the app line, no examples, the ghost's animation), taps
// Change colour to Rectangle · Blue (its rule sentence, hook and loaded
// examples), opens an example's sign page and comes Back, then under
// emulated reduced motion proves the static root, no ghost and nothing
// animating, and finally opens the Decoder from its Practice card. Runs
// against the production build (`vite preview`) with Playwright's WebKit
// engine and an iPhone 14 device profile.
// Depends on: @playwright/test, ./helpers (openAppAt).
// Depended on by: `npm run e2e`, .github/workflows/ci.yml.
import { test, expect, type Page } from '@playwright/test';
import { openAppAt } from './helpers';

/** The prompt h1's data-answer-id, throwing if it is missing. */
async function currentAnswerId(page: Page): Promise<string> {
  const id = await page.locator('h1').getAttribute('data-answer-id');
  if (!id) throw new Error('prompt h1 has no data-answer-id');
  return id;
}

/**
 * Waits until the prompt h1's data-answer-id differs from `previousId`
 * (the answer for the question just left), then returns it -- guards
 * against reading the outgoing question's id in the instant after
 * Continue is clicked, before React has re-rendered the next question.
 */
async function waitForNextAnswerId(page: Page, previousId: string): Promise<string> {
  await expect.poll(() => page.locator('h1').getAttribute('data-answer-id')).not.toBe(previousId);
  return currentAnswerId(page);
}

test.describe('tap the sign: right, wrong, reduced motion, finish', () => {
  test('plays a full round: right and wrong answers, streaks, then the summary', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAppAt(page, '/clutch/practice/tap?sign=warning-slippery-road');

    const heading = page.locator('h1');
    await expect(heading).toHaveText('Slippery road.');
    await expect(heading).toHaveAttribute('data-answer-id', 'warning-slippery-road');
    await expect(page.locator('.game-top-bar__label')).toHaveText('1/10');

    // The four tiles' aria-labels, in DOM order (E26 (b)).
    await expect
      .poll(() =>
        page
          .locator('.tap__tile')
          .evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label'))),
      )
      .toEqual(['Option A', 'Option B', 'Option C', 'Option D']);

    // Every question's answer id, checked for distinctness before the
    // summary (review F2; restores E25 item 7).
    const answerIds: string[] = [];

    // Question 1: right.
    let currentId = await currentAnswerId(page);
    answerIds.push(currentId);
    await page.locator(`[data-sign-id="${currentId}"]`).click();

    await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
    await expect(page.getByText('+10 XP')).toBeVisible();
    await expect(page.locator('[data-confetti]')).toHaveCount(9);
    await expect(page.locator('.quiz-sheet')).toHaveClass(/quiz-sheet--animated/);
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueButton).toHaveClass(/button--primary/);
    await expect(page.getByText('Slippery road. Triangles warn.')).toBeVisible();
    await expect(page.getByText('Three sides, one message: watch out ahead.')).toBeVisible();
    await expect(page.locator('.quiz-sheet__streak')).toHaveCount(0);
    await expect(page.locator(`[data-sign-id="${currentId}"]`)).toHaveAttribute(
      'data-feedback',
      'right',
    );
    await expect(page.locator('[data-feedback="dim"]')).toHaveCount(3);
    const tiles = page.locator('.tap__tile');
    await expect(tiles).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(tiles.nth(i)).toBeDisabled();
    }
    await expect
      .poll(() =>
        page.locator('.quiz-sheet__panel').evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe('sheetUp');

    await continueButton.click();
    currentId = await waitForNextAnswerId(page, currentId);
    answerIds.push(currentId);
    await expect(page.locator('.game-top-bar__label')).toHaveText('2/10');

    // Question 2: wrong -- tap a tile that is not the answer.
    const wrongTile = page.locator(`.tap__tile:not([data-sign-id="${currentId}"])`).first();
    const wrongId = await wrongTile.getAttribute('data-sign-id');
    if (!wrongId) throw new Error('wrong tile has no data-sign-id');
    const promptText = await heading.textContent();

    await wrongTile.click();

    await expect(page.getByRole('dialog', { name: 'Incorrect' })).toBeVisible();
    await expect(page.getByText('Right answer:')).toBeVisible();
    await expect(page.locator(`[data-sign-id="${wrongId}"]`)).toHaveAttribute(
      'data-feedback',
      'wrong',
    );
    await expect(page.locator(`[data-sign-id="${currentId}"]`)).toHaveAttribute(
      'data-feedback',
      'answer',
    );
    await expect(page.locator('[data-feedback="dim"]')).toHaveCount(2);
    await expect(page.locator('.quiz-sheet__xp')).toHaveCount(0);
    await expect(page.locator('.quiz-sheet__body strong')).toHaveText(promptText ?? '');

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    currentId = await waitForNextAnswerId(page, currentId);
    answerIds.push(currentId);
    await expect(page.locator('.game-top-bar__label')).toHaveText('3/10');

    // Questions 3-9: right, using the prompt's own data-answer-id.
    for (let q = 3; q <= 9; q++) {
      await page.locator(`[data-sign-id="${currentId}"]`).click();
      await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
      if (q === 4) {
        await expect(page.getByText('2 in a row')).toBeVisible();
      }
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      currentId = await waitForNextAnswerId(page, currentId);
      answerIds.push(currentId);
      await expect(page.locator('.game-top-bar__label')).toHaveText(`${q + 1}/10`);
    }

    // Question 10: right, 8 in a row, then the summary.
    await expect(page.locator('.game-top-bar__label')).toHaveText('10/10');
    await page.locator(`[data-sign-id="${currentId}"]`).click();
    await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
    await expect(page.getByText('8 in a row')).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    expect(answerIds).toHaveLength(10);
    expect(new Set(answerIds).size).toBe(10);

    await expect(page.getByText('Round complete')).toBeVisible();
    await expect(page.getByText('9 of 10 right')).toBeVisible();
    await expect(page.getByText('+90 XP')).toBeVisible();
    const playAgain = page.getByRole('button', { name: 'Play again' });
    await expect(playAgain).toHaveClass(/button--primary/);

    await playAgain.click();
    await expect(page.locator('.game-top-bar__label')).toHaveText('1/10');
    await expect(page.getByText('Round complete')).toHaveCount(0);

    await page.goto('/clutch/practice');
    const xpStat = page.locator('.practice-header__stat', { hasText: 'XP earned' });
    const streakStat = page.locator('.practice-header__stat', { hasText: 'day streak' });
    await expect(xpStat.locator('.practice-header__number')).toHaveText('90');
    await expect(streakStat.locator('.practice-header__number')).toHaveText('1');

    await page.goto('/clutch/learn/signs/warning-slippery-road');
    await expect(page.getByText('1 of 3 correct to collect')).toBeVisible();
  });

  test('reduced motion: static sheet, no confetti, no animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAppAt(page, '/clutch/practice/tap?sign=warning-slippery-road');

    const heading = page.locator('h1');
    await expect(heading).toHaveText('Slippery road.');
    await page.locator('[data-sign-id="warning-slippery-road"]').click();

    await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
    await expect(page.locator('.quiz-sheet')).toHaveClass(/quiz-sheet--static/);
    await expect(page.locator('[data-confetti]')).toHaveCount(0);

    const sheetAnimationNames = await page
      .locator('.quiz-sheet *')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
    for (const name of sheetAnimationNames) {
      expect(name).toBe('none');
    }

    const tileAnimationNames = await page
      .locator('[data-sign-id="warning-slippery-road"], [data-sign-id="warning-slippery-road"] *')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
    for (const name of tileAnimationNames) {
      expect(name).toBe('none');
    }

    await page.getByRole('button', { name: 'Sign page' }).click();
    await expect(page).toHaveURL(/\/clutch\/learn\/signs\/warning-slippery-road$/);

    await page.goto('/clutch/practice/tap');
    await expect(page.locator('.game-top-bar__label')).toHaveText('1/10');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
  });
});

/** The Sprint sign's data-answer-id, throwing if it is missing. */
async function sprintAnswerId(page: Page): Promise<string> {
  const id = await page.locator('.sprint__sign').getAttribute('data-answer-id');
  if (!id) throw new Error('.sprint__sign has no data-answer-id');
  return id;
}

/**
 * Waits until the Sprint sign's data-answer-id differs from `previousId`
 * (the sign just answered), then returns it -- guards against reading the
 * outgoing sign's id before React has rendered the next one.
 */
async function waitForNextSprintSign(page: Page, previousId: string): Promise<string> {
  await expect
    .poll(() => page.locator('.sprint__sign').getAttribute('data-answer-id'))
    .not.toBe(previousId);
  return sprintAnswerId(page);
}

/** Every computed animationName inside the Sprint layer. */
function sprintAnimationNames(page: Page): Promise<string[]> {
  return page
    .locator('.sprint *')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
}

test.describe('Sign Sprint run', () => {
  test('two rounds: right and wrong answers, time up, best score, reduced motion, progress', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.clock.install();
    await openAppAt(page, '/clutch/practice/sprint');

    // Start.
    await expect(page.locator('.sprint__sign[data-answer-id]')).toBeVisible();
    await expect(page.getByText('SIGN SPRINT')).toBeVisible();
    await expect(page.getByText('Name this sign')).toBeVisible();
    await expect(page.locator('.sprint__option')).toHaveCount(4);
    await expect(page.getByRole('img', { name: 'Sign to name' })).toBeVisible();

    // Round 1: three right answers.
    const firstId = await sprintAnswerId(page);
    await page.locator(`.sprint__option[data-sign-id="${firstId}"]`).click();
    await expect(page.locator('.sprint__score')).toHaveText('1');
    await expect(page.locator('.sprint__xp')).toHaveText('+10 XP');
    await expect
      .poll(() => page.locator('.sprint__xp').evaluate((el) => getComputedStyle(el).animationName))
      .toBe('pop');
    let currentId = await waitForNextSprintSign(page, firstId);
    await expect
      .poll(() =>
        page.locator('.sprint__sign').evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe('driveIn');

    for (let right = 2; right <= 3; right++) {
      await page.locator(`.sprint__option[data-sign-id="${currentId}"]`).click();
      await expect(page.locator('.sprint__score')).toHaveText(String(right));
      currentId = await waitForNextSprintSign(page, currentId);
    }

    // Then one wrong answer.
    const missedId = currentId;
    const missedCaption = await page
      .locator(`.sprint__option[data-sign-id="${missedId}"] .sprint__caption`)
      .textContent();
    if (!missedCaption) throw new Error('the answer option has no caption');
    await page.locator(`.sprint__option:not([data-sign-id="${missedId}"])`).first().click();
    await expect(page.locator('.sprint__score')).toHaveText('3');
    // The reveal passes in real time, then the next sign drives in.
    await waitForNextSprintSign(page, missedId);

    // Time's up.
    await page.clock.fastForward(61_000);
    await expect(page.getByText('Time’s up')).toBeVisible();
    await expect(page.locator('.sprint-end__score')).toHaveText('3');
    await expect(page.getByText('signs named', { exact: true })).toBeVisible();
    await expect(page.locator('.sprint-end__xp')).toHaveText('+30 XP');
    for (const part of ['.sprint-end__score', '.sprint-end__xp']) {
      await expect
        .poll(() => page.locator(part).evaluate((el) => getComputedStyle(el).animationName))
        .toBe('pop');
    }
    await expect(page.locator('.sprint-end__best')).toHaveText('Best 3');
    await expect(page.getByText('1-day streak')).toBeVisible();
    await expect(page.locator('.sprint-end__missed-count')).toHaveText('1');
    const missedRows = page.locator('.sprint-end__missed-row');
    await expect(missedRows).toHaveCount(1);
    await expect(missedRows).toHaveAttribute('href', `/clutch/learn/signs/${missedId}`);
    await expect(missedRows).toHaveText(missedCaption);
    const playAgain = page.getByRole('button', { name: 'Play again' });
    await expect(playAgain).toHaveClass(/button--primary/);

    // Round 2, under reduced motion.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await playAgain.click();
    await expect(page.locator('.sprint')).toHaveClass(/sprint--static/);
    await expect(page.locator('.sprint__score')).toHaveText('0');
    await expect(page.locator('.sprint__sign[data-answer-id]')).toBeVisible();
    const roundTwoId = await sprintAnswerId(page);
    await page.locator(`.sprint__option[data-sign-id="${roundTwoId}"]`).click();
    await expect(page.locator('.sprint__xp')).toHaveText('+10 XP');
    for (const name of await sprintAnimationNames(page)) {
      expect(name).toBe('none');
    }

    await page.clock.fastForward(61_000);
    await expect(page.getByText('Time’s up')).toBeVisible();
    await expect(page.locator('.sprint-end__score')).toHaveText('1');
    await expect(page.getByText('sign named', { exact: true })).toBeVisible();
    await expect(page.locator('.sprint-end__xp')).toHaveText('+10 XP');
    await expect(page.locator('.sprint-end__best')).toHaveText('Best 3');
    await expect(page.locator('.sprint-end__missed-count')).toHaveText('0');
    await expect(page.locator('.sprint-end__missed-row')).toHaveCount(0);
    for (const name of await sprintAnimationNames(page)) {
      expect(name).toBe('none');
    }

    // Afterwards: both rounds' XP and the streak on Practice.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
    const xpStat = page.locator('.practice-header__stat', { hasText: 'XP earned' });
    const streakStat = page.locator('.practice-header__stat', { hasText: 'day streak' });
    await expect(xpStat.locator('.practice-header__number')).toHaveText('40');
    await expect(streakStat.locator('.practice-header__number')).toHaveText('1');

    // The first answer's collection progress (round 2's one right answer is
    // a random sign, so in the rare run where it is the same sign it counts twice).
    const firstCorrect = roundTwoId === firstId ? 2 : 1;
    await page.goto(`/clutch/learn/signs/${firstId}`);
    await expect(page.getByText(`${firstCorrect} of 3 correct to collect`)).toBeVisible();

    // Close leaves a fresh Sprint.
    await page.goto('/clutch/practice/sprint');
    await expect(page.locator('.sprint__sign[data-answer-id]')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
  });
});

/** The Match Pairs sign tiles' data-sign-ids, in pick order (Sign 1-5). */
function pairsSignIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-pair-sign]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-sign-id') ?? ''));
}

function pairsSignTile(page: Page, signId: string) {
  return page.locator(`[data-pair-sign][data-sign-id="${signId}"]`);
}

function pairsNameTile(page: Page, signId: string) {
  return page.locator(`[data-pair-name][data-sign-id="${signId}"]`);
}

/** Taps a sign tile (expecting it pressed), then the name tile with `nameId`. */
async function tapPair(page: Page, signId: string, nameId: string): Promise<void> {
  await pairsSignTile(page, signId).click();
  await expect(pairsSignTile(page, signId)).toHaveAttribute('aria-pressed', 'true');
  await pairsNameTile(page, nameId).click();
}

/** Every computed animationName inside the Match Pairs layer. */
function pairsAnimationNames(page: Page): Promise<string[]> {
  return page
    .locator('.pairs *')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
}

/**
 * Navigates inside the running app (a history entry plus popstate, which
 * the router follows) so the already loaded progress store is on screen at
 * once -- a fresh page load shows "0 of 3" until the store has loaded.
 */
async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test.describe('Match Pairs round', () => {
  test('two rounds: first-try matches, a wrong name and its retry, reduced motion, progress', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openAppAt(page, '/clutch/practice/pairs');

    // Round 1.
    const label = page.locator('.game-top-bar__label');
    await expect(page.locator('.pairs__tile')).toHaveCount(10);
    await expect(page.getByText('MATCH PAIRS')).toBeVisible();
    await expect(page.getByText('Tap a sign, then its name.')).toBeVisible();
    await expect(label).toHaveText('0/5');
    const round1 = await pairsSignIds(page);
    expect(round1).toHaveLength(5);

    // Signs 1-3 on the first try.
    for (let i = 0; i < 3; i++) {
      const id = round1[i];
      await tapPair(page, id, id);
      await expect(pairsSignTile(page, id)).toHaveAttribute('data-state', 'locked');
      await expect(pairsNameTile(page, id)).toHaveAttribute('data-state', 'locked');
      await expect(pairsNameTile(page, id).locator('.pairs__xp')).toHaveText('+10 XP');
      if (i === 0) {
        await expect
          .poll(() =>
            pairsNameTile(page, id)
              .locator('.pairs__xp')
              .evaluate((el) => getComputedStyle(el).animationName),
          )
          .toBe('pop');
        await expect
          .poll(() =>
            pairsNameTile(page, id)
              .locator('.pairs__tick')
              .evaluate((el) => getComputedStyle(el).animationName),
          )
          .toBe('pop');
        await expect(label).toHaveText('1/5');
      }
    }
    await expect(label).toHaveText('3/5');

    // Sign 4, wrong first: sign 5's name flashes red and shakes.
    const wrongName = pairsNameTile(page, round1[4]);
    await tapPair(page, round1[3], round1[4]);
    await expect(wrongName).toHaveAttribute('data-state', 'wrong');
    await expect
      .poll(() => wrongName.evaluate((el) => getComputedStyle(el).animationName))
      .toBe('shake');
    await expect(page.locator('.pairs [aria-pressed="true"]')).toHaveCount(0);
    await expect(label).toHaveText('3/5');

    // Then sign 4 and its own name: locked, with no XP badge.
    await tapPair(page, round1[3], round1[3]);
    await expect(pairsNameTile(page, round1[3])).toHaveAttribute('data-state', 'locked');
    await expect(pairsNameTile(page, round1[3]).locator('.pairs__tick')).toHaveCount(1);
    await expect(pairsNameTile(page, round1[3]).locator('.pairs__xp')).toHaveCount(0);
    await expect(label).toHaveText('4/5');

    // Sign 5.
    await tapPair(page, round1[4], round1[4]);
    await expect(label).toHaveText('5/5');

    await expect(page.getByText('All pairs matched')).toBeVisible();
    await expect(page.locator('.pairs__end-xp')).toHaveText('+40 XP');
    const playAgain = page.getByRole('button', { name: 'Play again' });
    await expect(playAgain).toHaveClass(/button--primary/);

    // Round 2, under reduced motion.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await playAgain.click();
    await expect(page.locator('.pairs')).toHaveClass(/pairs--static/);
    await expect(label).toHaveText('0/5');
    await expect(page.locator('.pairs__tile')).toHaveCount(10);
    await expect(page.locator('.pairs [data-state="locked"]')).toHaveCount(0);
    const round2 = await pairsSignIds(page);
    expect(round2).toHaveLength(5);

    for (let i = 0; i < 5; i++) {
      const id = round2[i];
      await tapPair(page, id, id);
      await expect(pairsNameTile(page, id)).toHaveAttribute('data-state', 'locked');
      if (i === 0) {
        await expect(pairsNameTile(page, id).locator('.pairs__xp')).toHaveText('+10 XP');
        for (const name of await pairsAnimationNames(page)) {
          expect(name).toBe('none');
        }
      }
    }

    await expect(page.getByText('All pairs matched')).toBeVisible();
    await expect(page.locator('.pairs__end-xp')).toHaveText('+50 XP');

    // Afterwards: both rounds' XP and the streak on Practice.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
    const xpStat = page.locator('.practice-header__stat', { hasText: 'XP earned' });
    const streakStat = page.locator('.practice-header__stat', { hasText: 'day streak' });
    await expect(xpStat.locator('.practice-header__number')).toHaveText('90');
    await expect(streakStat.locator('.practice-header__number')).toHaveText('1');

    // Collection progress. Round 2 draws a random family and may reuse a
    // round-1 sign; every round-2 match was first try, so it adds one.
    const retriedExpected = round2.includes(round1[3])
      ? '1 of 3 correct to collect'
      : '0 of 3 correct to collect';
    await navigateInApp(page, `/clutch/learn/signs/${round1[3]}`);
    await expect(page).toHaveURL(new RegExp(`/clutch/learn/signs/${round1[3]}$`));
    await expect(page.getByText(retriedExpected)).toBeVisible();

    const firstTryExpected = round2.includes(round1[0])
      ? '2 of 3 correct to collect'
      : '1 of 3 correct to collect';
    await page.goto(`/clutch/learn/signs/${round1[0]}`);
    await expect(page.getByText(firstTryExpected)).toBeVisible();

    // Close leaves a fresh board.
    await page.goto('/clutch/practice/pairs');
    await expect(label).toHaveText('0/5');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
  });
});

/** Every computed animationName inside the Decoder. */
function decoderAnimationNames(page: Page): Promise<string[]> {
  return page
    .locator('.decoder *')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
}

/** Waits for the Decoder's 3 example pictures to load (a synchronous predicate). */
async function waitForDecoderExamples(page: Page): Promise<void> {
  await expect(page.locator('.decoder__examples img')).toHaveCount(3);
  await page.waitForFunction(() => {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>('.decoder__examples img'),
    );
    return images.length === 3 && images.every((img) => img.complete && img.naturalWidth > 0);
  });
}

test.describe('Shape & Colour Decoder', () => {
  test('Decoder: build a sign', async ({ page }) => {
    test.setTimeout(90_000);
    const heading = page.getByRole('heading', { level: 1 });
    const label = page.locator('.decoder__label');

    // From Learn.
    await openAppAt(page, '/clutch/learn');
    await page.getByRole('link', { name: /^How signs work/ }).click();
    await expect(page).toHaveURL(/\/clutch\/learn\/signs\/decoder$/);
    await expect(heading).toHaveText('Shape & Colour Decoder');
    await expect(page.getByText('Sign not found.')).toHaveCount(0);
    await expect(
      page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Learn', exact: true }),
    ).toHaveAttribute('aria-current', 'page');

    // Start: Circle · Red, its examples loaded, the sign popping and the text rising.
    await expect(label).toHaveText('Circle · Red');
    await expect(page.getByRole('link', { name: 'No right turn.', exact: true })).toBeVisible();
    await waitForDecoderExamples(page);
    for (const [selector, name] of [
      ['.decoder__pop', 'signPop'],
      ['.decoder__text', 'riseIn'],
      ['.decoder__examples', 'riseIn'],
    ] as const) {
      await expect
        .poll(() => page.locator(selector).evaluate((el) => getComputedStyle(el).animationName))
        .toBe(name);
    }

    // Shape twice: Rectangle · Red, which the rules don't use.
    const shapeButton = page.getByRole('button', { name: 'Change shape' });
    await shapeButton.click();
    await expect(label).toHaveText('Triangle · Red');
    await shapeButton.click();
    await expect(label).toHaveText('Rectangle · Red');
    await expect(page.locator('.decoder__title')).toHaveText('Rectangles inform.');
    await expect(page.locator('.decoder__body')).toHaveText(
      "The signing-system rules don't use this pair. Try another colour.",
    );
    await expect(page.locator('.decoder__example')).toHaveCount(0);
    await expect
      .poll(() =>
        page.locator('.decoder__ghost').evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe('ghostOut');

    // Colour: Rectangle · Blue.
    await page.getByRole('button', { name: 'Change colour' }).click();
    await expect(label).toHaveText('Rectangle · Blue');
    await expect(
      page.getByText(
        'Blue rectangles are used for information signs except on motorways, where blue is used for direction signs.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Blue box: information, or directions on a motorway.', { exact: true }),
    ).toBeVisible();
    await waitForDecoderExamples(page);

    // Into an example's sign page and Back.
    await page.getByRole('link', { name: 'Start of motorway regulations.', exact: true }).click();
    await expect(page).toHaveURL(/\/clutch\/learn\/signs\/motorway-start-of-motorway-regulations$/);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/clutch\/learn\/signs\/decoder$/);
    await expect(heading).toHaveText('Shape & Colour Decoder');

    // Reduced motion: the static root, no ghost, nothing animating.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/clutch/learn/signs/decoder');
    await expect(page.locator('.decoder')).toHaveClass(/decoder--static/);
    await shapeButton.click();
    await expect(label).toHaveText('Triangle · Red');
    await expect(page.locator('.decoder__examples img')).toHaveCount(3);
    await expect(page.locator('.decoder__ghost')).toHaveCount(0);
    for (const name of await decoderAnimationNames(page)) {
      expect(name).toBe('none');
    }

    // From Practice.
    await page.goto('/clutch/practice');
    await page
      .locator('.practice-card', {
        has: page.locator('.practice-card__title', { hasText: 'Shape & Colour Decoder' }),
      })
      .click();
    await expect(page).toHaveURL(/\/clutch\/learn\/signs\/decoder$/);
    await expect(heading).toHaveText('Shape & Colour Decoder');
    await expect(label).toHaveText('Circle · Red');
  });
});
