/**
 * @vitest-environment jsdom
 *
 * Unit and render tests for the sign page (src/features/signs/SignScreen.tsx,
 * plan.md Step 7/amendment E12(g)): a rejected loadSigns() shows
 * <LoadFailed>, whose Retry (an attempt counter set from the click handler,
 * never from the effect body) loads again; the collecting line (Q3) counts
 * down for `correct` 0, 1 and 2. src/content/signs is mocked partially
 * (importOriginal), replacing only loadSigns with a vi.fn() the tests
 * control, while displayName, hookFor, getShapeRules and getHooks stay
 * real; the real sign catalogue is loaded once, through the unmocked
 * module, in beforeAll. src/engine/progress-state is mocked the way
 * tests/unit/sign-sprint.test.tsx mocks it: a useProgressStore selector
 * over a fixed, mutable state.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom (test
 * environment), src/content/signs (loadSigns, real for everything else),
 * src/content/schemas (Sign type), src/features/signs/SignScreen.tsx, a
 * mock of src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import SignScreen from '../../src/features/signs/SignScreen';

const mocks = vi.hoisted(() => ({
  loadSigns: vi.fn<() => Promise<Sign[]>>(),
  signProgress: new Map<string, number>(),
}));

vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: mocks.loadSigns };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({
      signProgress: mocks.signProgress,
      status: 'ready',
      load: () => Promise.resolve(),
    }),
}));

let signs: Sign[];

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import('../../src/content/signs')>('../../src/content/signs');
  signs = await actual.loadSigns();
});

function renderSignScreen(): void {
  render(
    <MemoryRouter initialEntries={['/learn/signs/warning-slippery-road']}>
      <Routes>
        <Route path="/learn/signs/:id" element={<SignScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.loadSigns.mockReset();
  mocks.signProgress.clear();
});

afterEach(() => {
  cleanup();
});

describe('SignScreen', () => {
  it('Retry loads the sign again', async () => {
    mocks.loadSigns.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(signs);
    renderSignScreen();

    await screen.findByText("This didn't load.");
    // Amendment E13: the notice is an alert, so VoiceOver reads it as soon
    // as it replaces the page's content.
    expect(screen.getByRole('alert').textContent).toContain("This didn't load.");
    expect(mocks.loadSigns).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByRole('heading', { name: 'Slippery road' });
    expect(mocks.loadSigns).toHaveBeenCalledTimes(2);
  });

  it.each([
    [0, 'Get it right 3 times to collect it'],
    [1, 'Get it right 2 more times to collect it'],
    [2, 'Get it right 1 more time to collect it'],
  ])('the collecting line counts down: correct %i', async (correct, line) => {
    mocks.loadSigns.mockResolvedValue(signs);
    mocks.signProgress.set('warning-slippery-road', correct);
    renderSignScreen();

    await screen.findByText(line);
  });
});
