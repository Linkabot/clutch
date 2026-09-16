// End-to-end tests for Clutch's games (plan.md Step 23 and amendment E25;
// later joined by Sign Sprint and Match Pairs, Steps 24-25). "tap the sign:
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
// animationName 'none', then Sign page and Close's routes. Runs against the
// production build (`vite preview`) with Playwright's WebKit engine and an
// iPhone 14 device profile.
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

    // Question 1: right.
    let currentId = await currentAnswerId(page);
    await page.locator(`[data-sign-id="${currentId}"]`).click();

    await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
    await expect(page.getByText('+10 XP')).toBeVisible();
    await expect(page.locator('[data-confetti]')).toHaveCount(9);
    await expect(page.locator('.quiz-sheet')).toHaveClass(/quiz-sheet--animated/);
    const continueButton = page.getByRole('button', { name: 'Continue' });
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

    await page.getByRole('button', { name: 'Continue' }).click();
    currentId = await waitForNextAnswerId(page, currentId);
    await expect(page.locator('.game-top-bar__label')).toHaveText('3/10');

    // Questions 3-9: right, using the prompt's own data-answer-id.
    for (let q = 3; q <= 9; q++) {
      await page.locator(`[data-sign-id="${currentId}"]`).click();
      await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
      if (q === 4) {
        await expect(page.getByText('2 in a row')).toBeVisible();
      }
      await page.getByRole('button', { name: 'Continue' }).click();
      currentId = await waitForNextAnswerId(page, currentId);
      await expect(page.locator('.game-top-bar__label')).toHaveText(`${q + 1}/10`);
    }

    // Question 10: right, 8 in a row, then the summary.
    await expect(page.locator('.game-top-bar__label')).toHaveText('10/10');
    await page.locator(`[data-sign-id="${currentId}"]`).click();
    await expect(page.getByRole('dialog', { name: 'Correct' })).toBeVisible();
    await expect(page.getByText('8 in a row')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

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
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/clutch\/practice$/);
  });
});
