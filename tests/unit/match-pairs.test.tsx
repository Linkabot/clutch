/**
 * @vitest-environment jsdom
 *
 * Unit and render tests for Match Pairs (plan.md Step 25 and amendments
 * E31-E32). The round: buildPairsRound over the real signs catalogue gives
 * 5 distinct short-caption signs from one family, with the same 5 in the
 * name column; over seeds 1-30 every pick is short and in the round's
 * family, the family varies, the names are shuffled away from the sign
 * order, and the picks are shuffled away from signs.json order. The reducer (a fixed round of signs a-e): a first-try lock earns
 * 10 XP; a wrong name marks the SELECTED sign missed once, clears the
 * selection and starts a counted flash, and that sign's later lock earns
 * nothing while other pairs still earn; no-op taps return the same state
 * object; selection switches and toggles; flash-over only clears a flash
 * whose count matches; 5 locks finish the round. The screen (jsdom, real
 * timers -- never fake timers, whose timers @testing-library's waitFor does
 * not see): 10 tiles and the loading state, selection, a first-try lock
 * (tick, +10 XP, label, bar, recordAnswer), a wrong name's flash clearing
 * on its own and the retried lock writing nothing, the shared end screen
 * waiting for a pending recordRoundFinished (taps in that window change
 * nothing), then the round's XP (not the store's) in the Q9 band its score
 * earns, Play again, the end screen's hold after the fifth lock, Close
 * (including one pressed while that first write is still pending, which
 * stays on Practice once the write settles, U9/Decision 24: Match Pairs'
 * rememberRound/navigate only run from an effect gated on showEnd, which
 * cannot run after unmount), and reduced motion (a stubbed matchMedia)
 * turning every animated class off.
 * Step 9 adds four: a failed load's notice and its Retry, the two
 * look-alike signs' name tiles reading as the Highway Code names them
 * (gameName, never signs.json's curly-quoted KYTS string), ✕ going BACK to
 * the screen the game was opened from when there is one (Q19), and the end
 * screen's "Took more than one try" list after a mismatch. The progress
 * store is mocked by its path relative to this file, and src/content/signs
 * by a factory that keeps the real catalogue and only lets one load reject.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns), src/content/schemas
 * (Sign type), src/features/interactives/shared/random (mulberry32),
 * src/features/interactives/shared/distractors (isShortCaption),
 * src/features/interactives/match-pairs/pairs,
 * src/features/interactives/match-pairs/MatchPairs, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { loadSigns, gameName, LOOK_ALIKE_PAIR } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';
import { mulberry32 } from '../../src/features/interactives/shared/random';
import { isShortCaption } from '../../src/features/interactives/shared/distractors';
import {
  END_HOLD_MS,
  FLASH_MS,
  PAIRS_PER_ROUND,
  buildPairsRound,
  initialPairsState,
  pairsReducer,
  type PairsAction,
  type PairsRound,
  type PairsState,
} from '../../src/features/interactives/match-pairs/pairs';
import MatchPairs from '../../src/features/interactives/match-pairs/MatchPairs';

interface AnswerResult {
  collectedNow: boolean;
  lostNow: boolean;
}

const mocks = vi.hoisted(() => ({
  recordAnswer: vi.fn<(signId: string, correct: boolean) => Promise<AnswerResult>>(),
  recordRoundFinished:
    vi.fn<(options?: { game?: string; sprintScore?: number }) => Promise<void>>(),
  summary: { xp: 990, streak: 5, sprintBest: 7, collected: 0 },
}));

// Keeps the real catalogue everywhere; only the failure case makes one call
// reject (amendment E16 (i), mirroring E14 (h)'s Sign Sprint mock).
vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: vi.fn(actual.loadSigns) };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({
      summary: mocks.summary,
      recordAnswer: mocks.recordAnswer,
      recordRoundFinished: mocks.recordRoundFinished,
    }),
}));

let signs: Sign[];

beforeAll(async () => {
  signs = await loadSigns();
});

// --- Helpers -----------------------------------------------------------------

function makeSign(id: string, name: string): Sign {
  return {
    id,
    name,
    meaning: name,
    family: 'warning',
    shape: 'triangle',
    colours: ['red'],
    rule: 'C2',
    hookId: null,
    image: `signs/warning/${id}.svg`,
    refs: [{ kind: 'section', slug: 'traffic-signs' }],
    licence: 'Open Government Licence v3.0',
    source: {
      chapterSlug: 'warning-signs',
      chapterUrl: 'https://www.gov.uk/government/publications/know-your-traffic-signs',
      imageUrl: 'https://assets.publishing.service.gov.uk/media/x/sign.svg',
      subHeading: 'Test',
    },
  };
}

const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((id) => makeSign(id, `Sign ${id}.`));

const ROUND: PairsRound = { family: 'warning', signs: [a, b, c, d, e], names: [c, e, a, d, b] };

function run(state: PairsState, ...actions: PairsAction[]): PairsState {
  return actions.reduce(pairsReducer, state);
}

function tapSign(signId: string): PairsAction {
  return { type: 'tap-sign', signId };
}

function tapName(signId: string): PairsAction {
  return { type: 'tap-name', signId };
}

function fresh(): PairsState {
  return initialPairsState(ROUND);
}

// --- Round -------------------------------------------------------------------

describe('buildPairsRound over signs.json', () => {
  it('gives 5 distinct short-caption signs from its family, and the same 5 as names', () => {
    const round = buildPairsRound(signs, mulberry32(1));
    expect(PAIRS_PER_ROUND).toBe(5);
    expect(round.signs).toHaveLength(5);
    expect(new Set(round.signs.map((sign) => sign.id)).size).toBe(5);
    for (const sign of round.signs) {
      expect(isShortCaption(sign.name)).toBe(true);
      expect(sign.family).toBe(round.family);
    }
    expect(round.names).toHaveLength(5);
    expect(round.names.map((sign) => sign.id).sort()).toEqual(
      round.signs.map((sign) => sign.id).sort(),
    );
    expect(new Set(round.names.map((sign) => sign.name)).size).toBe(5);
  });

  it('over seeds 1-30 varies the family, shuffles the names and shuffles the picks away from signs.json order', () => {
    const families = new Set<string>();
    let namesShuffled = 0;
    let picksShuffled = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const round = buildPairsRound(signs, mulberry32(seed));
      families.add(round.family);
      const signIds = round.signs.map((sign) => sign.id);
      const nameIds = round.names.map((sign) => sign.id);
      if (nameIds.join() !== signIds.join()) namesShuffled++;
      const firstFive = signs
        .filter((sign) => sign.family === round.family && isShortCaption(sign.name))
        .slice(0, 5)
        .map((sign) => sign.id);
      if (signIds.join() !== firstFive.join()) picksShuffled++;
    }
    expect(families.size).toBeGreaterThanOrEqual(3);
    expect(namesShuffled).toBeGreaterThanOrEqual(25);
    expect(picksShuffled).toBeGreaterThanOrEqual(25);
  });

  it('over seeds 1-30 every picked sign has a short caption and belongs to the round family', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const round = buildPairsRound(signs, mulberry32(seed));
      expect(round.signs).toHaveLength(5);
      for (const sign of round.signs) {
        expect(isShortCaption(sign.name), `seed ${seed}: ${sign.id}`).toBe(true);
        expect(sign.family, `seed ${seed}: ${sign.id}`).toBe(round.family);
      }
    }
  });
});

// --- Reducer ----------------------------------------------------------------

describe('pairsReducer', () => {
  it('pins the flash and hold lengths', () => {
    expect(FLASH_MS).toBe(600);
    expect(END_HOLD_MS).toBe(800);
  });

  it('a then name a → locked, XP 10, earnedIds [a], selection cleared', () => {
    const selected = run(fresh(), tapSign('a'));
    expect(selected.selectedId).toBe('a');
    const state = run(selected, tapName('a'));
    expect(state.lockedIds).toEqual(['a']);
    expect(state.xp).toBe(10);
    expect(state.earnedIds).toEqual(['a']);
    expect(state.missedIds).toEqual([]);
    expect(state.selectedId).toBeNull();
    expect(state.wrong).toBeNull();
    expect(state.finished).toBe(false);
  });

  it('a wrong name marks the selected sign missed; its later lock earns nothing, but another pair still earns', () => {
    let state = run(fresh(), tapSign('a'), tapName('b'));
    expect(state.missedIds).toEqual(['a']);
    expect(state.selectedId).toBeNull();
    expect(state.wrong).toEqual({ nameId: 'b', count: 1 });
    expect(state.lockedIds).toEqual([]);
    expect(state.xp).toBe(0);

    state = run(state, tapSign('a'), tapName('a'));
    expect(state.lockedIds).toEqual(['a']);
    expect(state.xp).toBe(0);
    expect(state.earnedIds).toEqual([]);
    expect(state.wrong).toBeNull();

    state = run(state, tapSign('b'), tapName('b'));
    expect(state.lockedIds).toEqual(['a', 'b']);
    expect(state.xp).toBe(10);
    expect(state.earnedIds).toEqual(['b']);
    expect(state.missedIds).toEqual(['a']);
  });

  it('a name tap with nothing selected, a tap on a locked sign and a tap on a locked name return the same object', () => {
    const start = fresh();
    expect(pairsReducer(start, tapName('a'))).toBe(start);

    const locked = run(start, tapSign('a'), tapName('a'));
    expect(pairsReducer(locked, tapSign('a'))).toBe(locked);

    const selectingB = run(locked, tapSign('b'));
    expect(pairsReducer(selectingB, tapName('a'))).toBe(selectingB);
    expect(selectingB.selectedId).toBe('b');
  });

  it('a then b → selectedId b; a then a → selectedId null', () => {
    expect(run(fresh(), tapSign('a'), tapSign('b')).selectedId).toBe('b');
    expect(run(fresh(), tapSign('a'), tapSign('a')).selectedId).toBeNull();
  });

  it('a second wrong attempt on a keeps missedIds [a] and makes count 2; flash-over clears only a matching count', () => {
    let state = run(fresh(), tapSign('a'), tapName('b'), tapSign('a'), tapName('c'));
    expect(state.missedIds).toEqual(['a']);
    expect(state.wrong).toEqual({ nameId: 'c', count: 2 });

    const stale = pairsReducer(state, { type: 'flash-over', count: 1 });
    expect(stale).toBe(state);
    expect(stale.wrong).toEqual({ nameId: 'c', count: 2 });

    state = pairsReducer(state, { type: 'flash-over', count: 2 });
    expect(state.wrong).toBeNull();
    expect(state.missedIds).toEqual(['a']);
    expect(pairsReducer(state, { type: 'flash-over', count: 2 })).toBe(state);
  });

  it('5 locks → finished, and any tap afterwards returns the same object', () => {
    let state = fresh();
    for (const id of ['a', 'b', 'c', 'd']) {
      state = run(state, tapSign(id), tapName(id));
      expect(state.finished).toBe(false);
    }
    state = run(state, tapSign('e'), tapName('e'));
    expect(state.finished).toBe(true);
    expect(state.lockedIds).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(state.xp).toBe(50);

    expect(pairsReducer(state, tapSign('a'))).toBe(state);
    expect(pairsReducer(state, tapSign('e'))).toBe(state);
    expect(pairsReducer(state, tapName('c'))).toBe(state);
  });
});

// --- Screen -----------------------------------------------------------------

function stubMatchMedia(matches: boolean) {
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));
}

function renderPairs() {
  const view = render(
    <MemoryRouter initialEntries={['/practice/pairs']}>
      <Routes>
        <Route path="/practice/pairs" element={<MatchPairs />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
}

/** Writes the current history entry's pathname and state where a test can read them (M25's round id lives there). */
function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location-state">{`${location.pathname} ${JSON.stringify(location.state)}`}</p>
  );
}

/**
 * Same shape as renderPairs(), plus a location read-out (U9's close-while-
 * pending guard test only, so no existing test's DOM changes).
 */
function renderPairsWithLocation() {
  const view = render(
    <MemoryRouter initialEntries={['/practice/pairs']}>
      <LocationProbe />
      <Routes>
        <Route path="/practice/pairs" element={<MatchPairs />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
}

function locationProbe(): string {
  return screen.getByTestId('location-state').textContent ?? '';
}

function textOf(container: HTMLElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function signTiles(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-pair-sign]'));
}

function nameTile(container: HTMLElement, signId: string): HTMLButtonElement {
  const tile = container.querySelector<HTMLButtonElement>(
    `button[data-pair-name][data-sign-id="${signId}"]`,
  );
  if (!tile) throw new Error(`no name tile for ${signId}`);
  return tile;
}

function idOf(tile: HTMLElement): string {
  const id = tile.getAttribute('data-sign-id');
  if (!id) throw new Error('tile has no data-sign-id');
  return id;
}

function progressValue(): string | null {
  return screen.getByRole('progressbar').getAttribute('aria-valuenow');
}

/** Waits for the board and returns the sign ids in pick order. */
async function waitForBoard(container: HTMLElement): Promise<string[]> {
  await waitFor(() => expect(container.querySelectorAll('button.pairs__tile')).toHaveLength(10));
  return signTiles(container).map(idOf);
}

/** Taps sign `signId`, then its own name, and waits for the pair to lock. */
async function matchFirstTry(container: HTMLElement, signId: string): Promise<void> {
  const sign = container.querySelector<HTMLButtonElement>(
    `button[data-pair-sign][data-sign-id="${signId}"]`,
  );
  if (!sign) throw new Error(`no sign tile for ${signId}`);
  fireEvent.click(sign);
  await waitFor(() => expect(sign.getAttribute('aria-pressed')).toBe('true'));
  fireEvent.click(nameTile(container, signId));
  await waitFor(() =>
    expect(nameTile(container, signId).getAttribute('data-state')).toBe('locked'),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let resolveFirstRoundFinished: (() => void) | null = null;

beforeEach(() => {
  resolveFirstRoundFinished = null;
  mocks.recordAnswer.mockReset();
  mocks.recordAnswer.mockResolvedValue({ collectedNow: false, lostNow: false });
  mocks.recordRoundFinished.mockReset();
  mocks.recordRoundFinished.mockResolvedValue(undefined);
  mocks.recordRoundFinished.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveFirstRoundFinished = resolve;
      }),
  );
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // jsdom keeps one history across a file: without this, the in-app ✕ case
  // would leave idx behind and the cold-exit cases would stop proving it.
  window.history.replaceState(null, '');
});

describe('MatchPairs screen', () => {
  it('shows only the top bar while signs load, then 10 tiles, 0/5 and the animated root', async () => {
    const container = renderPairs();
    expect(container.querySelectorAll('button.pairs__tile')).toHaveLength(0);
    expect(textOf(container, '.game-top-bar__label')).toBe('0/5');
    expect(progressValue()).toBe('0');

    await waitForBoard(container);
    const signButtons = signTiles(container);
    expect(signButtons.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Sign 1',
      'Sign 2',
      'Sign 3',
      'Sign 4',
      'Sign 5',
    ]);
    for (const tile of signButtons) {
      expect(tile.getAttribute('aria-pressed')).toBe('false');
      expect(tile.querySelector('img')?.getAttribute('alt')).toBe('');
    }
    expect(container.querySelectorAll('button[data-pair-name]')).toHaveLength(5);
    expect(screen.getByText('MATCH PAIRS')).toBeTruthy();
    expect(screen.getByText('Tap a sign, then its name.')).toBeTruthy();
    expect(textOf(container, '.game-top-bar__label')).toBe('0/5');
    expect(container.querySelector('.pairs')?.classList.contains('pairs--animated')).toBe(true);
  });

  it('plays two rounds: first-try locks, a wrong flash and a retry, the end card after the writes and the hold, Play again', async () => {
    const container = renderPairs();
    const ids = await waitForBoard(container);

    // Selecting sign 1.
    const sign1 = signTiles(container)[0];
    fireEvent.click(sign1);
    await waitFor(() => expect(sign1.getAttribute('aria-pressed')).toBe('true'));
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(sign1.getAttribute('data-state')).toBe('selected');

    // Its name locks the pair on the first try.
    fireEvent.click(nameTile(container, ids[0]));
    await waitFor(() => expect(sign1.getAttribute('data-state')).toBe('locked'));
    const name1 = nameTile(container, ids[0]);
    expect(name1.getAttribute('data-state')).toBe('locked');
    expect(sign1.disabled).toBe(true);
    expect(name1.disabled).toBe(true);
    expect(name1.querySelector('.pairs__xp')?.textContent).toBe('+10 XP');
    expect(name1.querySelector('.pairs__tick')).not.toBeNull();
    expect(sign1.querySelector('.pairs__tick')).not.toBeNull();
    expect(sign1.querySelector('.pairs__xp')).toBeNull();
    expect(textOf(container, '.game-top-bar__label')).toBe('1/5');
    expect(progressValue()).toBe('0.2');
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(1);
    expect(mocks.recordAnswer).toHaveBeenCalledWith(ids[0], true);

    // Sign 2, then sign 3's name: a wrong attempt.
    const sign2 = signTiles(container)[1];
    fireEvent.click(sign2);
    await waitFor(() => expect(sign2.getAttribute('aria-pressed')).toBe('true'));
    const wrongName = nameTile(container, ids[2]);
    fireEvent.click(wrongName);
    await waitFor(() => expect(wrongName.getAttribute('data-state')).toBe('wrong'));
    expect(container.querySelectorAll('[data-state="wrong"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(1);
    expect(textOf(container, '.game-top-bar__label')).toBe('1/5');
    await waitFor(() => expect(wrongName.getAttribute('data-state')).toBeNull(), {
      timeout: 1500,
    });
    expect(container.querySelectorAll('[data-state="wrong"]')).toHaveLength(0);

    // Sign 2 again, then its own name: locked, but no XP and no write.
    fireEvent.click(sign2);
    await waitFor(() => expect(sign2.getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(nameTile(container, ids[1]));
    await waitFor(() =>
      expect(nameTile(container, ids[1]).getAttribute('data-state')).toBe('locked'),
    );
    expect(nameTile(container, ids[1]).querySelector('.pairs__xp')).toBeNull();
    expect(nameTile(container, ids[1]).querySelector('.pairs__tick')).not.toBeNull();
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(1);
    expect(textOf(container, '.game-top-bar__label')).toBe('2/5');
    expect(progressValue()).toBe('0.4');

    // Signs 3 and 4 on the first try (sign 3's name took the wrong tap, but sign 3 never missed).
    await matchFirstTry(container, ids[2]);
    expect(nameTile(container, ids[2]).querySelector('.pairs__xp')?.textContent).toBe('+10 XP');
    await matchFirstTry(container, ids[3]);
    expect(textOf(container, '.game-top-bar__label')).toBe('4/5');
    expect(progressValue()).toBe('0.8');

    // Sign 5: the end card waits for the pending recordRoundFinished.
    await matchFirstTry(container, ids[4]);
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    expect(textOf(container, '.game-top-bar__label')).toBe('5/5');

    // Taps while the finished board is still up change nothing.
    fireEvent.click(signTiles(container)[0]);
    fireEvent.click(nameTile(container, ids[4]));
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(4);

    await act(async () => {
      await sleep(1000);
    });
    expect(screen.queryByText('All pairs matched')).toBeNull();
    expect(container.querySelector('.end-screen')).toBeNull();

    await act(async () => {
      resolveFirstRoundFinished?.();
    });
    await waitFor(() => expect(screen.getByText('All pairs matched')).toBeTruthy(), {
      timeout: 3000,
    });
    expect(textOf(container, '.end-screen__xp')).toBe('+40 XP');
    // 4 of 5 first try: scoreBand(4, 5) is 0.8, the middle Q9 band.
    expect(textOf(container, '.end-screen__score')).toBe('4');
    expect(textOf(container, '.end-screen__score-text')).toBe('right first time');
    expect(container.querySelector('.end-screen__panel')?.className).toMatch(
      /end-screen__panel--orange/,
    );
    expect(textOf(container, '.end-screen__streak')).toBe('5-day streak');
    expect(screen.queryByText('+990 XP')).toBeNull();
    expect(container.querySelectorAll('button.pairs__tile')).toHaveLength(0);
    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);
    expect(mocks.recordRoundFinished).toHaveBeenCalledWith({ game: 'pairs' });
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(4);
    expect(mocks.recordAnswer.mock.calls.map(([id, correct]) => [id, correct])).toEqual([
      [ids[0], true],
      [ids[2], true],
      [ids[3], true],
      [ids[4], true],
    ]);
    const lastAnswerOrder = Math.max(...mocks.recordAnswer.mock.invocationCallOrder);
    expect(mocks.recordRoundFinished.mock.invocationCallOrder[0]).toBeGreaterThan(lastAnswerOrder);
    expect(screen.getByRole('button', { name: 'Play again' }).className).toContain(
      'button--primary',
    );
    expect(screen.getByRole('button', { name: 'Done' }).className).toContain('button--secondary');

    // Play again: a fresh round, no second round-finished write.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    const round2 = await waitForBoard(container);
    expect(textOf(container, '.game-top-bar__label')).toBe('0/5');
    expect(progressValue()).toBe('0');
    expect(container.querySelectorAll('[data-state="locked"]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(screen.queryByText('All pairs matched')).toBeNull();
    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);

    // The hold: this round's recordRoundFinished resolves at once, and the
    // card still waits END_HOLD_MS after the fifth first-try lock.
    for (const id of round2.slice(0, 4)) {
      await matchFirstTry(container, id);
    }
    const lastSign = container.querySelector<HTMLButtonElement>(
      `button[data-pair-sign][data-sign-id="${round2[4]}"]`,
    );
    if (!lastSign) throw new Error('no fifth sign tile');
    fireEvent.click(lastSign);
    await waitFor(() => expect(lastSign.getAttribute('aria-pressed')).toBe('true'));
    const startedAt = performance.now();
    fireEvent.click(nameTile(container, round2[4]));
    await waitFor(
      () => {
        expect(screen.getByText('All pairs matched')).toBeTruthy();
        expect(textOf(container, '.end-screen__xp')).toBe('+50 XP');
      },
      { interval: 20, timeout: 3000 },
    );
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(750);
    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(2);
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(9);

    // Done leaves for /practice.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
  });

  it('✕ lands on /practice', async () => {
    const container = renderPairs();
    await waitForBoard(container);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();
  });

  // Declared guard (U9, Decision 24): Match Pairs never had Tap the sign's
  // bug. Its write continuation only sets state, and rememberRound/navigate
  // run from an effect gated on showEnd, which cannot run after unmount --
  // so this passes today, and pins that a future refactor does not reopen it.
  it('pressing close while the round-finished write is pending leaves for good', async () => {
    const container = renderPairsWithLocation();
    const ids = await waitForBoard(container);
    for (const id of ids) {
      await matchFirstTry(container, id);
    }
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));

    // Do not resolve yet: close while the write is still pending.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByText('Practice tab');

    // Now the write settles, past END_HOLD_MS, and its continuation gets
    // every chance to run.
    await act(async () => {
      resolveFirstRoundFinished?.();
      await sleep(1500);
    });

    expect(screen.getByText('Practice tab')).toBeTruthy();
    expect(locationProbe()).toBe('/practice null');
  }, 20000);

  it('a failed load shows the failure notice, and Retry builds a round', async () => {
    vi.mocked(loadSigns).mockRejectedValueOnce(new Error('the signs chunk did not load'));
    const container = renderPairs();

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain("This didn't load.");
    expect(container.querySelectorAll('[data-pair-sign]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitForBoard(container);
    expect(container.querySelectorAll('[data-pair-sign]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-pair-name]')).toHaveLength(5);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('STOP and GIVE WAY name tiles use the Highway Code short names', async () => {
    // The screen seeds itself from the Web Crypto RNG, so the seed is
    // stubbed to one whose round actually contains a look-alike sign.
    const [stop] = LOOK_ALIKE_PAIR;
    let chosenSeed = 0;
    for (let seed = 1; seed < 4000 && chosenSeed === 0; seed++) {
      if (buildPairsRound(signs, mulberry32(seed)).signs.some((sign) => sign.id === stop)) {
        chosenSeed = seed;
      }
    }
    if (chosenSeed === 0) throw new Error('no seed below 4000 dealt the STOP sign');
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
      array[0] = chosenSeed;
      return array;
    }) as typeof globalThis.crypto.getRandomValues);

    const container = renderPairs();
    const ids = await waitForBoard(container);
    expect(ids).toContain(stop);

    const stopSign = signs.find((sign) => sign.id === stop);
    if (!stopSign) throw new Error('the STOP sign is missing from signs.json');
    expect(nameTile(container, stop).textContent).toBe('Stop and give way');
    expect(nameTile(container, stop).textContent).toBe(gameName(stopSign));
    // signs.json's own name uses curly quotes, so it is checked as read.
    expect(container.textContent).not.toContain(stopSign.name);
  });

  it('✕ goes back to the screen the game was opened from', async () => {
    window.history.replaceState({ idx: 1 }, '');
    const container = render(
      <MemoryRouter
        initialEntries={['/learn/signs/warning-cattle', '/practice/pairs']}
        initialIndex={1}
      >
        <Routes>
          <Route path="/practice/pairs" element={<MatchPairs />} />
          <Route path="/practice" element={<p>Practice tab</p>} />
          <Route path="/learn/signs/warning-cattle" element={<p>Cattle sign page</p>} />
        </Routes>
      </MemoryRouter>,
    ).container;
    await waitForBoard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Cattle sign page')).toBeTruthy());
    expect(screen.queryByText('Practice tab')).toBeNull();
  });

  it('shows Took more than one try after a mismatch', async () => {
    const container = renderPairs();
    const ids = await waitForBoard(container);

    // Sign 1 first: a wrong name, then its own.
    fireEvent.click(signTiles(container)[0]);
    await waitFor(() => expect(signTiles(container)[0].getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(nameTile(container, ids[1]));
    await waitFor(() =>
      expect(nameTile(container, ids[1]).getAttribute('data-state')).toBe('wrong'),
    );
    await waitFor(() => expect(nameTile(container, ids[1]).getAttribute('data-state')).toBeNull(), {
      timeout: 1500,
    });
    await matchFirstTry(container, ids[0]);
    for (const id of ids.slice(1)) {
      await matchFirstTry(container, id);
    }

    await act(async () => {
      resolveFirstRoundFinished?.();
    });
    await waitFor(() => expect(screen.getByText('Took more than one try')).toBeTruthy(), {
      timeout: 3000,
    });
    const missedSign = signs.find((sign) => sign.id === ids[0]);
    if (!missedSign) throw new Error('the missed sign is missing from signs.json');
    // The count beside the heading is the picture Lincoln chose (Q18, ends.png B).
    expect(textOf(container, '.end-screen__list-count')).toBe('1');
    const rows = container.querySelectorAll('.end-screen__row a.list-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('href')).toBe(`/learn/signs/${ids[0]}`);
    expect(rows[0].querySelector('.list-row__title')?.textContent).toBe(gameName(missedSign));
    // 4 of 5 first try, so the XP chip and the list agree.
    expect(textOf(container, '.end-screen__xp')).toBe('+40 XP');
  });

  it('under reduced motion the root is pairs--static and nothing is --animated, and the wrong flash still shows', async () => {
    stubMatchMedia(true);
    const container = renderPairs();
    const ids = await waitForBoard(container);

    const root = container.querySelector('.pairs');
    expect(root?.classList.contains('pairs--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);

    await matchFirstTry(container, ids[0]);
    expect(nameTile(container, ids[0]).querySelector('.pairs__xp')?.textContent).toBe('+10 XP');

    fireEvent.click(signTiles(container)[1]);
    fireEvent.click(nameTile(container, ids[2]));
    await waitFor(() =>
      expect(nameTile(container, ids[2]).getAttribute('data-state')).toBe('wrong'),
    );
    expect(root?.classList.contains('pairs--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
  });
});
