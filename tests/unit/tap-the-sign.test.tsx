/**
 * @vitest-environment jsdom
 *
 * Render tests for Tap the sign (U9, Decision 24). The round's last write
 * (recordRoundFinished) can settle after the player has pressed close (the
 * GameTopBar's X); on the parent screen its continuation still ran, calling
 * rememberRound and navigate from a closure whose component had already
 * unmounted, which dragged the player back to the closed game's ending. A
 * mountedRef guard, copied from Sign Sprint's (Decision 24), stops it.
 * Test 1 plays a full round, closes the game while the round-finished write
 * is still pending, resolves it afterwards, and asserts synchronously that
 * nothing moved: it MUST FAIL against the screen before the guard existed.
 * Test 2 is a declared guard: it checks the same round finishing normally,
 * on screen, still remembers it and replaces the route with its roundId --
 * rendered inside React's own strict mode wrapper so a guard that forgets
 * to reset mountedRef.current back to true on every mount (surviving that
 * wrapper's mount, unmount, mount) fails it too.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/features/practice/tap/TapTheSignScreen.tsx
 * (imported and rendered for real, with the real sign catalogue -- no mock
 * of src/content/signs is needed), a mock of
 * src/engine/progress-state (mocked) that stands in for useProgressStore,
 * and a wrap of
 * src/engine/round-memory (wrapped) with importOriginal, keeping every real
 * export but spying on rememberRound.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StrictMode } from 'react';
import TapTheSignScreen from '../../src/features/practice/tap/TapTheSignScreen';
import { rememberRound } from '../../src/engine/round-memory';

interface AnswerResult {
  collectedNow: boolean;
  lostNow: boolean;
}

const mocks = vi.hoisted(() => ({
  recordAnswer: vi.fn<(signId: string, correct: boolean) => Promise<AnswerResult>>(),
  recordRoundFinished: vi.fn<(options?: { game?: string }) => Promise<void>>(),
  summary: { xp: 990, streak: 5, sprintBest: 7, collected: 0 },
}));

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({
      summary: mocks.summary,
      recordAnswer: mocks.recordAnswer,
      recordRoundFinished: mocks.recordRoundFinished,
    }),
}));

// Wrapped, not replaced (E16 (i)'s pattern): every real export keeps
// working (forgetRound, recallRound), but rememberRound is also a spy the
// tests can read through the normal import above.
vi.mock('../../src/engine/round-memory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/round-memory')>();
  return { ...actual, rememberRound: vi.fn(actual.rememberRound) };
});

// --- Helpers -----------------------------------------------------------------

/** Writes the current history entry's pathname and state where a test can read them (M25's round id lives there). */
function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="location-pathname">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state)}</output>
    </>
  );
}

function locationPathname(): string {
  return screen.getByTestId('location-pathname').textContent ?? '';
}

function locationState(): string | null {
  return screen.getByTestId('location-state').textContent;
}

function renderTap({ strict = false }: { strict?: boolean } = {}): HTMLElement {
  const tree = (
    <MemoryRouter initialEntries={['/practice/tap']}>
      <LocationProbe />
      <Routes>
        <Route path="/practice/tap" element={<TapTheSignScreen />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>
  );
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return view.container;
}

/**
 * Answers all 10 questions of a round with whichever tile is shown first
 * (a STOP/GIVE WAY question shows 2 tiles, Decision 18; every other one
 * shows 4), then waits for the round's last write to be queued and still
 * pending.
 */
async function playRound(container: HTMLElement): Promise<void> {
  for (let question = 0; question < 10; question++) {
    await waitFor(() =>
      expect(container.querySelectorAll('button.tap__tile').length).toBeGreaterThan(1),
    );
    const tiles = Array.from(container.querySelectorAll<HTMLButtonElement>('button.tap__tile'));
    fireEvent.click(tiles[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  }
  await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let resolveRoundFinished: (() => void) | null = null;

beforeEach(() => {
  // Clears call history only (never resetAllMocks: that would strip the
  // rememberRound wrap's call-through to the real function).
  vi.clearAllMocks();
  resolveRoundFinished = null;
  mocks.recordAnswer.mockResolvedValue({ collectedNow: false, lostNow: false });
  mocks.recordRoundFinished.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveRoundFinished = resolve;
      }),
  );
});

afterEach(() => {
  cleanup();
  // jsdom keeps one history across a file: without this a later case would
  // see the previous one's entries.
  window.history.replaceState(null, '');
});

// --- Screen -----------------------------------------------------------------

describe('TapTheSignScreen', () => {
  it('pressing close while the round-finished write is pending leaves for good', async () => {
    const container = renderTap();
    await playRound(container);

    // The quiz sheet is still open on the last question, so close (the
    // GameTopBar's X) is reachable; the round-finished write has not
    // settled yet.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByText('Practice tab');

    const callsAtClose = vi.mocked(rememberRound).mock.calls.length;

    // Now the write settles, and its continuation gets every chance to run.
    await act(async () => {
      resolveRoundFinished?.();
      await sleep(200);
    });

    // Synchronous: waitFor would pass on the instant before a drag-back.
    expect(screen.getByText('Practice tab')).toBeTruthy();
    expect(locationPathname()).toBe('/practice');
    expect(locationState()).toBe('null');
    expect(vi.mocked(rememberRound).mock.calls.length).toBe(callsAtClose);
    expect(vi.mocked(rememberRound)).not.toHaveBeenCalledWith(
      'tap',
      expect.objectContaining({ finished: true }),
    );
  }, 20000);

  it('finishing a round on screen still remembers it and replaces the route with its roundId', async () => {
    const container = renderTap({ strict: true });
    await playRound(container);

    expect(vi.mocked(rememberRound)).not.toHaveBeenCalledWith(
      'tap',
      expect.objectContaining({ finished: true }),
    );

    await act(async () => {
      resolveRoundFinished?.();
    });

    await waitFor(() => {
      expect(vi.mocked(rememberRound)).toHaveBeenCalledWith(
        'tap',
        expect.objectContaining({ finished: true }),
      );
      expect(locationPathname()).toBe('/practice/tap');
      expect(locationState()).toContain('roundId');
    });
  }, 20000);
});
