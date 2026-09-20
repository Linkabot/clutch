/**
 * @vitest-environment jsdom
 *
 * Unit and render tests for Sign Sprint (plan.md Step 24, amendment E27,
 * and Step 10 with amendment E23). The deck: buildSprintDeck over the real
 * signs catalogue gives every eligible sign exactly once (131 short-caption
 * answers), each with 4 distinct short captions from the answer's family or
 * its look, the answer's slot and the answer order shuffled and
 * seed-dependent; a family filter narrows the answers without narrowing the
 * options; a synthetic catalogue pins the
 * 4-short-captions-per-family threshold. The reducer: start, right and
 * wrong answers, the 900 ms reveal, the 60,000 ms deadline (ticks and late
 * answers), missed signs kept once and in order, acceptsAnswer,
 * currentQuestion's wrap, tick always returning a new state, start
 * replacing the whole state, the length table (No limit's Infinity
 * deadline, which no tick ever reaches), and the formatClock table. The
 * screen (jsdom, real timers and an injected clock `t` -- never fake
 * timers, whose timers
 * @testing-library's waitFor does not see): every round now begins on the
 * start page's Start button (./sprint-start.test.tsx covers that page
 * itself), which is also where Done and a Finish before any answer come
 * back to; the play screen's picture, lettered options captioned with
 * gameName, clock and bar; a right answer's score, +10 XP and
 * recordAnswer; the reveal's frames and disabled options; a 30 sec round
 * ending on its own clock and a No limit round ending only on Finish; the
 * shared end screen waiting for a pending recordRoundFinished (a late tap
 * in that window scores and records nothing), then showing the round's
 * score, XP, "sign named"/"signs named", the store's best for that length
 * and the streak, the lost-sign notice's family round, the gentle zero
 * line (and no XP chip) when nothing was named, and the missed
 * sign's row (no list when nothing was missed); Play again; Close;
 * and reduced motion (a stubbed matchMedia) switching
 * every animated class off; and a rejected loadSigns() showing the shared
 * load-failure notice in place of the start page, whose Retry
 * brings the start page back (plan.md Step 8, amendment E14 (h), E23 (h)).
 * The progress store
 * is mocked by its path relative to this file. src/content/signs is mocked
 * partially (importOriginal), replacing only loadSigns with a vi.fn() that
 * resolves the real catalogue for every case but the failure one, which
 * rejects it once; the real catalogue is loaded through the unmocked module
 * in beforeAll, the way tests/unit/sign-screen.test.tsx does it.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns, gameName),
 * src/content/schemas
 * (Sign type), src/features/interactives/shared/random (mulberry32),
 * src/features/interactives/shared/distractors (isShortCaption),
 * src/features/interactives/sign-sprint/sprint,
 * src/features/interactives/sign-sprint/SignSprint, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import { gameName } from '../../src/content/signs';
import type {
  AnswerResult,
  RoundFinishedOptions,
  SprintChoices,
} from '../../src/engine/progress-store';
import { mulberry32 } from '../../src/features/interactives/shared/random';
import { isShortCaption } from '../../src/features/interactives/shared/distractors';
import {
  REVEAL_MS,
  acceptsAnswer,
  buildSprintDeck,
  currentQuestion,
  formatClock,
  initialSprintState,
  lengthMs,
  sprintReducer,
  timeLeft,
  type SprintQuestion,
  type SprintState,
} from '../../src/features/interactives/sign-sprint/sprint';
import SignSprint from '../../src/features/interactives/sign-sprint/SignSprint';

const mocks = vi.hoisted(() => ({
  loadSigns: vi.fn<() => Promise<Sign[]>>(),
  load: vi.fn<() => Promise<void>>(),
  recordAnswer: vi.fn<(signId: string, correct: boolean) => Promise<AnswerResult>>(),
  recordRoundFinished: vi.fn<(options?: RoundFinishedOptions) => Promise<void>>(),
  getSprintChoices: vi.fn<() => Promise<SprintChoices>>(),
  setSprintChoices: vi.fn<(choices: SprintChoices) => Promise<void>>(),
  summary: {
    xp: 0,
    streak: 5,
    sprintBest: 7,
    sprintBests: { '30s': 4, '1m': 7, '5m': 40, none: 23 },
    sprintLast: null,
    collected: 0,
  },
}));

vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: mocks.loadSigns };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({
      summary: mocks.summary,
      // The scores have always landed here; tests/unit/sprint-start.test.tsx
      // covers the start page holding back until they do (amendment E24 (a)).
      status: 'ready',
      load: mocks.load,
      recordAnswer: mocks.recordAnswer,
      recordRoundFinished: mocks.recordRoundFinished,
      getSprintChoices: mocks.getSprintChoices,
      setSprintChoices: mocks.setSprintChoices,
    }),
}));

let signs: Sign[];

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import('../../src/content/signs')>('../../src/content/signs');
  signs = await actual.loadSigns();
});

// --- Helpers -----------------------------------------------------------------

function makeSign(id: string, name: string, family: Sign['family'] = 'warning'): Sign {
  return {
    id,
    name,
    meaning: name,
    family,
    shape: 'triangle',
    colours: ['red'],
    rule: 'C2',
    hookId: null,
    image: `signs/${family}/${id}.svg`,
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

const signA = makeSign('warning-a', 'Sign A.');
const signB = makeSign('warning-b', 'Sign B.');
const signC = makeSign('warning-c', 'Sign C.');
const signD = makeSign('warning-d', 'Sign D.');

function question(answer: Sign): SprintQuestion {
  const others = [signA, signB, signC, signD].filter((sign) => sign.id !== answer.id);
  return { answer, options: [answer, ...others.slice(0, 3)] };
}

const DECK: SprintQuestion[] = [question(signA), question(signB), question(signC)];

/** A 1-minute round started at now = 1000 (deadline 61000) over DECK. */
function started(deck: SprintQuestion[] = DECK): SprintState {
  return sprintReducer(initialSprintState(), { type: 'start', deck, length: '1m', now: 1000 });
}

/** The same round after a wrong tap (signB on question 1, answer signA) at now = 2000. */
function revealing(): SprintState {
  return sprintReducer(started(), { type: 'answer', signId: signB.id, now: 2000 });
}

// --- Deck -------------------------------------------------------------------

describe('buildSprintDeck over signs.json', () => {
  it('gives 131 questions with distinct answer ids, every answer short', () => {
    const deck = buildSprintDeck(signs, mulberry32(1));
    expect(deck).toHaveLength(131);
    expect(new Set(deck.map((q) => q.answer.id)).size).toBe(131);
    for (const q of deck) {
      expect(isShortCaption(q.answer.name)).toBe(true);
    }
  });

  it("gives every question 4 options with distinct short captions, each from the answer's family or with the answer's look, one of them the answer", () => {
    function sameColours(a: readonly string[], b: readonly string[]): boolean {
      if (a.length !== b.length) return false;
      const as = [...a].sort();
      const bs = [...b].sort();
      return as.every((colour, index) => colour === bs[index]);
    }
    const deck = buildSprintDeck(signs, mulberry32(1));
    for (const q of deck) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((option) => option.name)).size).toBe(4);
      for (const option of q.options) {
        expect(isShortCaption(option.name)).toBe(true);
        const sameFamily = option.family === q.answer.family;
        const sameLook =
          q.answer.shape !== 'other' &&
          option.shape === q.answer.shape &&
          sameColours(option.colours, q.answer.colours);
        expect(sameFamily || sameLook).toBe(true);
      }
      expect(q.options.filter((option) => option.id === q.answer.id)).toHaveLength(1);
    }
  });

  it("moves the answer's option index over the first 10 questions", () => {
    const deck = buildSprintDeck(signs, mulberry32(1));
    const slots = new Set(
      deck.slice(0, 10).map((q) => q.options.findIndex((option) => option.id === q.answer.id)),
    );
    expect(slots.size).toBeGreaterThanOrEqual(2);
  });

  it('shuffles the answers away from signs.json order, and seed 2 gives a different order', () => {
    const shortPerFamily = new Map<string, number>();
    for (const sign of signs) {
      if (isShortCaption(sign.name)) {
        shortPerFamily.set(sign.family, (shortPerFamily.get(sign.family) ?? 0) + 1);
      }
    }
    const eligibleInOrder = signs
      .filter((sign) => isShortCaption(sign.name) && (shortPerFamily.get(sign.family) ?? 0) >= 4)
      .map((sign) => sign.id);

    const seed1 = buildSprintDeck(signs, mulberry32(1)).map((q) => q.answer.id);
    const seed2 = buildSprintDeck(signs, mulberry32(2)).map((q) => q.answer.id);
    expect(seed1.slice(0, 10)).not.toEqual(eligibleInOrder.slice(0, 10));
    expect(seed2).not.toEqual(seed1);
  });
});

describe('buildSprintDeck eligibility threshold', () => {
  it('takes a family with exactly 4 short captions, never one with 3 short and 1 long', () => {
    const long = 'A caption that is far too long to sit in a four-option list of names, surely.';
    expect(isShortCaption(long)).toBe(false);
    const catalogue = [
      makeSign('road-works-1', 'Works one.', 'road-works'),
      makeSign('road-works-2', 'Works two.', 'road-works'),
      makeSign('road-works-3', 'Works three.', 'road-works'),
      makeSign('road-works-4', 'Works four.', 'road-works'),
      makeSign('motorway-1', 'Motorway one.', 'motorway'),
      makeSign('motorway-2', 'Motorway two.', 'motorway'),
      makeSign('motorway-3', 'Motorway three.', 'motorway'),
      makeSign('motorway-4', long, 'motorway'),
    ];
    const deck = buildSprintDeck(catalogue, mulberry32(3));
    expect(deck.map((q) => q.answer.id).sort()).toEqual([
      'road-works-1',
      'road-works-2',
      'road-works-3',
      'road-works-4',
    ]);
    for (const q of deck) {
      expect(q.options).toHaveLength(4);
    }
  });

  it('a family deck asks only about that family and still draws options from the whole catalogue', () => {
    const deck = buildSprintDeck(signs, mulberry32(1), ['motorway']);
    expect(deck).toHaveLength(8);
    for (const q of deck) {
      expect(q.answer.family).toBe('motorway');
      expect(q.options).toHaveLength(4);
    }

    let fromOtherFamilies = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const q of buildSprintDeck(signs, mulberry32(seed), ['motorway'])) {
        fromOtherFamilies += q.options.filter((option) => option.family !== 'motorway').length;
      }
    }
    expect(fromOtherFamilies).toBeGreaterThan(0);

    // Two families together are both families' answers, and no others.
    const pair = buildSprintDeck(signs, mulberry32(1), ['warning', 'orders']);
    expect(pair).toHaveLength(85);
    expect(new Set(pair.map((q) => q.answer.family))).toEqual(new Set(['warning', 'orders']));
  });
});

// --- Reducer ----------------------------------------------------------------

describe('sprintReducer', () => {
  it('start → playing, deadline 61000', () => {
    const state = started();
    expect(state.phase).toBe('playing');
    expect(state.deadline).toBe(61000);
    expect(state.clock).toBe(1000);
    expect(state.index).toBe(0);
    expect(state.score).toBe(0);
    expect(state.xp).toBe(0);
    expect(state.answered).toBe(0);
    expect(state.length).toBe('1m');
    expect(timeLeft(state)).toBe(60_000);
  });

  it('a right answer → score 1, XP 10, index 1, missed empty', () => {
    const state = sprintReducer(started(), { type: 'answer', signId: signA.id, now: 2000 });
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(1);
    expect(state.xp).toBe(10);
    expect(state.index).toBe(1);
    expect(state.lastAnswerRight).toBe(true);
    expect(state.missed).toEqual([]);
  });

  it('a wrong answer → reveal, score and XP 0, index 0, chosenId the tapped id, missed exactly [answer]', () => {
    const state = revealing();
    expect(state.phase).toBe('reveal');
    expect(state.score).toBe(0);
    expect(state.xp).toBe(0);
    expect(state.index).toBe(0);
    expect(state.chosenId).toBe(signB.id);
    expect(state.revealEndsAt).toBe(2900);
    expect(state.lastAnswerRight).toBe(false);
    expect(state.missed.map((sign) => sign.id)).toEqual([signA.id]);
    expect(REVEAL_MS).toBe(900);
  });

  it('answer during reveal returns the same object', () => {
    const state = revealing();
    expect(sprintReducer(state, { type: 'answer', signId: signA.id, now: 2100 })).toBe(state);
  });

  it('tick at revealEndsAt − 1 stays in reveal at index 0; at revealEndsAt → playing at index 1', () => {
    const state = revealing();
    const before = sprintReducer(state, { type: 'tick', now: 2899 });
    expect(before.phase).toBe('reveal');
    expect(before.index).toBe(0);
    const after = sprintReducer(before, { type: 'tick', now: 2900 });
    expect(after.phase).toBe('playing');
    expect(after.index).toBe(1);
    expect(after.chosenId).toBeNull();
    expect(after.revealEndsAt).toBeNull();
  });

  it('reveal-over → playing at index 1; outside reveal it returns the same object', () => {
    const state = sprintReducer(revealing(), { type: 'reveal-over' });
    expect(state.phase).toBe('playing');
    expect(state.index).toBe(1);
    expect(state.chosenId).toBeNull();
    expect(state.revealEndsAt).toBeNull();
    expect(sprintReducer(state, { type: 'reveal-over' })).toBe(state);
  });

  it('a deck [a, b, a] missed three times → missed ids [a, b]', () => {
    let state = started([question(signA), question(signB), question(signA)]);
    state = sprintReducer(state, { type: 'answer', signId: signC.id, now: 2000 });
    state = sprintReducer(state, { type: 'reveal-over' });
    state = sprintReducer(state, { type: 'answer', signId: signC.id, now: 4000 });
    state = sprintReducer(state, { type: 'reveal-over' });
    state = sprintReducer(state, { type: 'answer', signId: signC.id, now: 6000 });
    expect(state.phase).toBe('reveal');
    expect(state.missed.map((sign) => sign.id)).toEqual([signA.id, signB.id]);
  });

  it('tick at 60999 stays playing, and at 61000 → finished', () => {
    const state = sprintReducer(started(), { type: 'tick', now: 60999 });
    expect(state.phase).toBe('playing');
    expect(sprintReducer(state, { type: 'tick', now: 61000 }).phase).toBe('finished');
  });

  it('a right answer at 61000 → finished with score unchanged', () => {
    const state = sprintReducer(started(), { type: 'answer', signId: signA.id, now: 61000 });
    expect(state.phase).toBe('finished');
    expect(state.score).toBe(0);
    expect(state.xp).toBe(0);
  });

  it('tick in reveal at the deadline → finished', () => {
    const state = sprintReducer(started(), { type: 'answer', signId: signB.id, now: 60500 });
    expect(state.phase).toBe('reveal');
    expect(sprintReducer(state, { type: 'tick', now: 61000 }).phase).toBe('finished');
  });

  it('after finished, answer and tick return the same object', () => {
    const state = sprintReducer(started(), { type: 'tick', now: 61000 });
    expect(state.phase).toBe('finished');
    expect(sprintReducer(state, { type: 'answer', signId: signA.id, now: 62000 })).toBe(state);
    expect(sprintReducer(state, { type: 'tick', now: 62000 })).toBe(state);
  });

  it('finish ends a running round; tick in ready returns the same object', () => {
    expect(sprintReducer(started(), { type: 'finish' }).phase).toBe('finished');
    expect(sprintReducer(revealing(), { type: 'finish' }).phase).toBe('finished');
    const ready = initialSprintState();
    expect(ready.phase).toBe('ready');
    expect(sprintReducer(ready, { type: 'tick', now: 5000 })).toBe(ready);
    expect(sprintReducer(ready, { type: 'finish' })).toBe(ready);
  });

  it('acceptsAnswer is false in ready, reveal and finished and at the deadline', () => {
    expect(acceptsAnswer(initialSprintState(), 2000)).toBe(false);
    expect(acceptsAnswer(started(), 2000)).toBe(true);
    expect(acceptsAnswer(started(), 60999)).toBe(true);
    expect(acceptsAnswer(started(), 61000)).toBe(false);
    expect(acceptsAnswer(revealing(), 2100)).toBe(false);
    expect(acceptsAnswer(sprintReducer(started(), { type: 'finish' }), 2000)).toBe(false);
  });

  it('currentQuestion wraps: a 2-question deck at index 2 gives question 1', () => {
    let state = started([question(signA), question(signB)]);
    state = sprintReducer(state, { type: 'answer', signId: signA.id, now: 2000 });
    state = sprintReducer(state, { type: 'answer', signId: signB.id, now: 3000 });
    expect(state.index).toBe(2);
    expect(currentQuestion(state)?.answer.id).toBe(signA.id);
  });

  it('tick in playing before the deadline returns a different object whose clock is the tick now, and timeLeft follows it', () => {
    const state = started();
    const ticked = sprintReducer(state, { type: 'tick', now: 19000 });
    expect(ticked).not.toBe(state);
    expect(ticked.phase).toBe('playing');
    expect(ticked.clock).toBe(19000);
    expect(timeLeft(ticked)).toBe(42000);
    const again = sprintReducer(ticked, { type: 'tick', now: 19000 });
    expect(again).not.toBe(ticked);
  });

  it('start replaces the whole state: a finished round with a reveal left over starts clean', () => {
    let state = revealing();
    state = sprintReducer(state, { type: 'tick', now: 61000 });
    expect(state.phase).toBe('finished');
    expect(state.chosenId).toBe(signB.id);
    expect(state.revealEndsAt).toBe(2900);
    expect(state.missed).toHaveLength(1);

    state = sprintReducer(state, { type: 'start', deck: DECK, length: '1m', now: 70000 });
    expect(state.phase).toBe('playing');
    expect(state.chosenId).toBeNull();
    expect(state.revealEndsAt).toBeNull();
    expect(state.lastAnswerRight).toBe(false);
    expect(state.missed).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.xp).toBe(0);
    expect(state.index).toBe(0);
    expect(state.deadline).toBe(130000);
  });

  it('an accepted answer counts up, right or wrong, and reset goes back to ready', () => {
    let state = sprintReducer(started(), { type: 'answer', signId: signA.id, now: 2000 });
    expect(state.answered).toBe(1);
    state = sprintReducer(state, { type: 'answer', signId: signA.id, now: 3000 });
    expect(state.answered).toBe(2);
    expect(state.phase).toBe('reveal');
    const ready = sprintReducer(state, { type: 'reset' });
    expect(ready).toEqual(initialSprintState());
  });

  it("lengthMs('none') is Infinity", () => {
    expect(lengthMs('30s')).toBe(30_000);
    expect(lengthMs('1m')).toBe(60_000);
    expect(lengthMs('5m')).toBe(300_000);
    expect(lengthMs('none')).toBe(Infinity);

    const none = sprintReducer(initialSprintState(), {
      type: 'start',
      deck: DECK,
      length: 'none',
      now: 1000,
    });
    expect(none.deadline).toBe(Infinity);
    expect(timeLeft(none)).toBe(Infinity);
    // No tick and no late answer ever ends it; only `finish` does.
    expect(sprintReducer(none, { type: 'tick', now: 9_000_000 }).phase).toBe('playing');
    expect(acceptsAnswer(none, 9_000_000)).toBe(true);
    expect(sprintReducer(none, { type: 'finish' }).phase).toBe('finished');
  });
});

describe('formatClock', () => {
  it.each([
    [60000, '1:00'],
    [59999, '1:00'],
    [59000, '0:59'],
    [42000, '0:42'],
    [1, '0:01'],
    [0, '0:00'],
    [-500, '0:00'],
  ])('%i ms → %s', (ms, label) => {
    expect(formatClock(ms)).toBe(label);
  });
});

// --- Screen -----------------------------------------------------------------

let t = 0;
const now = () => t;
let pendingRoundFinished: Array<() => void> = [];

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

/** Stands in for Tap the sign, showing the ?family= the lost-sign button sent it. */
function TapRoute() {
  const [params] = useSearchParams();
  return <p>{`Tap round: ${params.get('family') ?? ''}`}</p>;
}

/** Writes the current history entry's state where a test can read it (M25's round id lives there). */
function LocationStateProbe() {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify(location.state)}</output>;
}

function locationState(): string | null {
  return screen.getByTestId('location-state').textContent;
}

function renderSprint() {
  const view = render(
    <MemoryRouter initialEntries={['/practice/sprint']}>
      <LocationStateProbe />
      <Routes>
        <Route path="/practice/sprint" element={<SignSprint now={now} />} />
        <Route path="/practice/tap" element={<TapRoute />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
}

/**
 * Every visit opens on the start page (Q10), so every round here begins by
 * pressing Start -- optionally after choosing a length on the segmented
 * control, whose options are tabs.
 */
async function startRound(length?: string): Promise<void> {
  const startButton = await screen.findByRole('button', { name: 'Start' });
  if (length !== undefined) {
    fireEvent.click(screen.getByRole('tab', { name: length }));
  }
  fireEvent.click(startButton);
}

/** The first option button that is not the answer. */
function wrongOption(container: HTMLElement, answerId: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.sprint__option')).find(
    (candidate) => candidate.getAttribute('data-sign-id') !== answerId,
  );
  if (!button) throw new Error('no wrong option');
  return button;
}

function answerIdIn(container: HTMLElement): string | null {
  return container.querySelector('.sprint__sign')?.getAttribute('data-answer-id') ?? null;
}

/** Waits for a sign on screen whose data-answer-id differs from `previous`, and returns it. */
async function waitForSign(
  container: HTMLElement,
  previous: string | null = null,
): Promise<string> {
  await waitFor(() => {
    const shown = answerIdIn(container);
    expect(shown).not.toBeNull();
    expect(shown).not.toBe(previous);
  });
  const id = answerIdIn(container);
  if (!id) throw new Error('no sign on screen');
  return id;
}

function textOf(container: HTMLElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function option(container: HTMLElement, signId: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `.sprint__option[data-sign-id="${signId}"]`,
  );
  if (!button) throw new Error(`no option for ${signId}`);
  return button;
}

beforeEach(() => {
  t = 0;
  pendingRoundFinished = [];
  mocks.summary.sprintLast = null;
  mocks.loadSigns.mockReset();
  mocks.loadSigns.mockResolvedValue(signs);
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(undefined);
  mocks.getSprintChoices.mockReset();
  mocks.getSprintChoices.mockResolvedValue({ length: '1m', families: [] });
  mocks.setSprintChoices.mockReset();
  mocks.setSprintChoices.mockResolvedValue(undefined);
  mocks.recordAnswer.mockReset();
  mocks.recordAnswer.mockResolvedValue({ collectedNow: false, lostNow: false });
  mocks.recordRoundFinished.mockReset();
  mocks.recordRoundFinished.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        pendingRoundFinished.push(resolve);
      }),
  );
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SignSprint screen', () => {
  it('shows the picture, 4 lettered options, 1:00, a full bar and the animated root', async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);

    const picture = container.querySelector('[data-answer-id] img');
    expect(picture?.getAttribute('alt')).toBe('Sign to name');
    expect(container.querySelectorAll('button.sprint__option')).toHaveLength(4);
    expect(
      Array.from(container.querySelectorAll('.sprint__option .sprint__letter')).map(
        (letter) => letter.textContent,
      ),
    ).toEqual(['A', 'B', 'C', 'D']);
    expect(screen.getByText('Name this sign')).toBeTruthy();
    expect(screen.getByText('SIGN SPRINT')).toBeTruthy();
    expect(textOf(container, '.game-top-bar__label')).toBe('1:00');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(container.querySelector('.sprint')?.classList.contains('sprint--animated')).toBe(true);
  });

  it('plays a round: right, the clock, wrong and the reveal, the end screen after the writes, then Play again', async () => {
    const container = renderSprint();
    await startRound();
    const firstId = await waitForSign(container);

    // A right answer.
    fireEvent.click(option(container, firstId));
    await waitFor(() => expect(textOf(container, '.sprint__score')).toBe('1'));
    await waitFor(() => expect(textOf(container, '.sprint__xp')).toBe('+10 XP'));
    expect(mocks.recordAnswer).toHaveBeenCalledWith(firstId, true);
    const secondId = await waitForSign(container, firstId);

    // The clock: 18 s gone → 0:42 and a bar at 0.7.
    t = 18_000;
    await waitFor(() => expect(textOf(container, '.game-top-bar__label')).toBe('0:42'));
    await waitFor(() =>
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0.7'),
    );

    // A wrong answer.
    const wrong = Array.from(container.querySelectorAll<HTMLButtonElement>('.sprint__option')).find(
      (button) => button.getAttribute('data-sign-id') !== secondId,
    );
    if (!wrong) throw new Error('no wrong option');
    fireEvent.click(wrong);
    await waitFor(() => expect(wrong.getAttribute('data-feedback')).toBe('wrong'));
    expect(option(container, secondId).getAttribute('data-feedback')).toBe('answer');
    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('.sprint__option'));
    expect(options).toHaveLength(4);
    for (const button of options) expect(button.disabled).toBe(true);
    expect(container.querySelectorAll('[data-feedback]')).toHaveLength(2);
    expect(mocks.recordAnswer).toHaveBeenLastCalledWith(secondId, false);
    expect(textOf(container, '.sprint__score')).toBe('1');
    expect(container.querySelector('.sprint__xp')).toBeNull();

    // The reveal ends 900 ms later.
    t += 900;
    await waitForSign(container, secondId);
    await waitFor(() => expect(container.querySelectorAll('[data-feedback]')).toHaveLength(0));

    // Time's up: the end screen waits for recordRoundFinished.
    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Time’s up')).toBeNull();
    expect(container.querySelector('.end-screen__panel')).toBeNull();

    // A late tap while the writes are pending: the play screen is still up
    // and its options are enabled, but nothing is scored or recorded.
    const lateOptions = container.querySelectorAll<HTMLButtonElement>('.sprint__option');
    expect(lateOptions).toHaveLength(4);
    const lateAnswerId = answerIdIn(container);
    if (!lateAnswerId) throw new Error('no sign on screen after the deadline');
    fireEvent.click(option(container, lateAnswerId));
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(2);
    expect(textOf(container, '.sprint__score')).toBe('1');

    await act(async () => {
      pendingRoundFinished[0]();
    });
    await waitFor(() => expect(screen.getByText('Time’s up')).toBeTruthy());
    expect(textOf(container, '.end-screen__score')).toBe('1');
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(2);
    expect(screen.getByText('sign named')).toBeTruthy();
    expect(screen.queryByText('signs named')).toBeNull();
    expect(container.querySelector('.end-screen__list')).not.toBeNull();
    expect(screen.getByText('in 60 seconds')).toBeTruthy();
    expect(textOf(container, '.end-screen__xp')).toBe('+10 XP');
    expect(textOf(container, '.end-screen__best')).toBe('Best 7');
    expect(screen.getByText('5-day streak')).toBeTruthy();
    expect(screen.getByText('Missed signs')).toBeTruthy();
    expect(textOf(container, '.end-screen__list-count')).toBe('1');
    const rows = container.querySelectorAll('.end-screen__row a');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('href')).toBe(`/learn/signs/${secondId}`);
    expect(rows[0].querySelector('img')?.getAttribute('alt')).toBe('');

    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);
    expect(mocks.recordRoundFinished).toHaveBeenCalledWith({
      game: 'sprint',
      sprintScore: 1,
      sprintLength: '1m',
      sprintAnswered: 2,
    });
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(2);
    const lastAnswerOrder = Math.max(...mocks.recordAnswer.mock.invocationCallOrder);
    expect(mocks.recordRoundFinished.mock.invocationCallOrder[0]).toBeGreaterThan(lastAnswerOrder);
    expect(screen.getByRole('button', { name: 'Play again' }).className).toContain(
      'button--primary',
    );
    expect(screen.getByRole('button', { name: 'Done' }).className).toContain('button--secondary');

    // Play again: a fresh round and clock, no second round-finished write.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await waitFor(() => expect(textOf(container, '.game-top-bar__label')).toBe('1:00'));
    await waitForSign(container);
    expect(textOf(container, '.sprint__score')).toBe('0');
    expect(screen.queryByText('Time’s up')).toBeNull();
    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);

    // The second round ends with nothing missed.
    t = 120_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(2));
    expect(mocks.recordRoundFinished).toHaveBeenLastCalledWith({
      game: 'sprint',
      sprintScore: 0,
      sprintLength: '1m',
      sprintAnswered: 0,
    });
    await act(async () => {
      pendingRoundFinished[1]();
    });
    await waitFor(() => expect(screen.getByText('Time’s up')).toBeTruthy());
    expect(textOf(container, '.end-screen__list-count')).toBe('0');
    expect(container.querySelectorAll('.end-screen__row a')).toHaveLength(0);
    expect(container.querySelector('.end-screen__list')).toBeNull();
    expect(textOf(container, '.end-screen__score')).toBe('0');
    // Q9's gentle zero: no chip at all, rather than "+0 XP".
    expect(container.querySelector('.end-screen__xp')).toBeNull();
    expect(screen.getByText('signs named')).toBeTruthy();
    expect(screen.queryByText('sign named')).toBeNull();

    // Close on the end screen.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
  });

  it('✕ on the play screen lands on /practice', async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();
  });

  it('under reduced motion the root is sprint--static, nothing is --animated, and +10 XP still shows', async () => {
    stubMatchMedia(true);
    const container = renderSprint();
    await startRound();
    const answerId = await waitForSign(container);

    const root = container.querySelector('.sprint');
    expect(root?.classList.contains('sprint--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);

    fireEvent.click(option(container, answerId));
    await waitFor(() => expect(textOf(container, '.sprint__xp')).toBe('+10 XP'));
    expect(root?.classList.contains('sprint--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
  });

  it('a failed load shows the failure notice, and Retry shows the start page', async () => {
    // Only the first call rejects; beforeEach's mockResolvedValue answers the
    // Retry with the real catalogue. The notice belongs to the start page
    // now, because that is what is on screen while the catalogue loads
    // (amendment E23 (c)).
    mocks.loadSigns.mockRejectedValueOnce(new Error('offline'));
    const container = renderSprint();

    await screen.findByText("This didn't load.");
    expect(screen.getByRole('alert').textContent).toContain("This didn't load.");
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(container.querySelectorAll('.sprint__option')).toHaveLength(0);
    expect(mocks.loadSigns).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await startRound();
    expect(screen.queryByText("This didn't load.")).toBeNull();
    await waitForSign(container);
    expect(container.querySelectorAll('button.sprint__option')).toHaveLength(4);
    expect(textOf(container, '.game-top-bar__label')).toBe('1:00');
    expect(mocks.loadSigns).toHaveBeenCalledTimes(2);
  });

  // The shared question screen takes everything above the options as one
  // `prompt` node, so their order is the game's to get right (plan.md E14 (c)).
  // .sprint__play is a flex column, so DOM order is what the player sees.
  it('renders the status, the panel and the prompt heading in that order, above the options', async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);

    const play = container.querySelector('.sprint__play');
    if (!play) throw new Error('SignSprint did not render a .sprint__play region');
    expect(Array.from(play.children, (child) => child.className)).toEqual([
      'sprint__status',
      'sprint__panel',
      'sprint__prompt',
      'sprint__options',
    ]);
    expect(container.querySelector('.sprint__status .sprint__score')).toBeTruthy();
  });

  it('option captions show the game names', async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);

    const captions = Array.from(
      container.querySelectorAll('.sprint__caption'),
      (caption) => caption.textContent ?? '',
    );
    expect(captions).toHaveLength(4);
    const shown = new Set(signs.map((sign) => gameName(sign)));
    const raw = new Set(signs.map((sign) => sign.name));
    for (const caption of captions) {
      expect(shown.has(caption)).toBe(true);
      expect(caption.endsWith('.')).toBe(false);
    }
    // At least one of them is a signs.json name with its full stop trimmed.
    expect(captions.some((caption) => raw.has(`${caption}.`))).toBe(true);
  });

  it('a 30 sec round finishes at 30 s', async () => {
    const container = renderSprint();
    await startRound('30 sec');
    let shown = await waitForSign(container);
    expect(textOf(container, '.game-top-bar__label')).toBe('0:30');

    // Three right answers: 3 of a 30-second round's maximum of 5 is Q9's
    // orange band, where 3 of a 1-minute round's 10 would be red -- so the
    // band proves which length the round was judged at (amendment E24 (b)).
    for (let right = 1; right <= 3; right++) {
      fireEvent.click(option(container, shown));
      await waitFor(() => expect(textOf(container, '.sprint__score')).toBe(String(right)));
      shown = await waitForSign(container, shown);
    }

    t = 29_900;
    await waitFor(() => expect(textOf(container, '.game-top-bar__label')).toBe('0:01'));
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();

    t = 30_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    expect(mocks.recordRoundFinished).toHaveBeenCalledWith({
      game: 'sprint',
      sprintScore: 3,
      sprintLength: '30s',
      sprintAnswered: 3,
    });
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');
    expect(screen.getByText('in 30 seconds')).toBeTruthy();
    expect(textOf(container, '.end-screen__best')).toBe('Best 4');
    expect(container.querySelector('.end-screen__panel')?.className).toContain(
      'end-screen__panel--orange',
    );
  });

  it("a No limit round's top bar shows Finish and a full bar", async () => {
    const container = renderSprint();
    await startRound('No limit');
    await waitForSign(container);

    expect(container.querySelector('.game-top-bar__label')).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish' }).className).toContain(
      'game-top-bar__action',
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    // The words never reach the bar (scan S11): the button stands there.
    expect(screen.queryByText('No limit')).toBeNull();
  });

  it('a No limit round does not finish on the clock; Finish after an answer shows the end screen; ✕ leaves without one', async () => {
    const container = renderSprint();
    await startRound('No limit');
    const firstId = await waitForSign(container);

    // Ten minutes pass and several ticks fire: nothing ends.
    t = 600_000;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();
    expect(container.querySelector('.sprint__panel')).not.toBeNull();

    // Two right and one wrong: the score (2) and the answers (3) differ, so
    // the sub-line and the band each show which of them they were given.
    fireEvent.click(option(container, firstId));
    await waitFor(() => expect(textOf(container, '.sprint__score')).toBe('1'));
    const secondId = await waitForSign(container, firstId);
    fireEvent.click(option(container, secondId));
    await waitFor(() => expect(textOf(container, '.sprint__score')).toBe('2'));
    const thirdId = await waitForSign(container, secondId);
    const wrong = wrongOption(container, thirdId);
    fireEvent.click(wrong);
    await waitFor(() => expect(wrong.getAttribute('data-feedback')).toBe('wrong'));

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    expect(mocks.recordRoundFinished).toHaveBeenCalledWith({
      game: 'sprint',
      sprintScore: 2,
      sprintLength: 'none',
      sprintAnswered: 3,
    });
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Round complete');
    expect(screen.queryByText('Time’s up')).toBeNull();
    expect(screen.getByText('of 3 answered')).toBeTruthy();
    expect(textOf(container, '.end-screen__best')).toBe('Best 23');
    // 2 of the 3 answered is Q9's orange band; 2 of a fixed 10 would be red.
    expect(container.querySelector('.end-screen__panel')?.className).toContain(
      'end-screen__panel--orange',
    );

    // Play again is another round of the SAME choices: No limit, so Finish
    // is back in the bar. Left through ✕: no end screen, nothing recorded.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    const nextId = await waitForSign(container);
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(container.querySelector('.game-top-bar__label')).toBeNull();
    fireEvent.click(option(container, nextId));
    await waitFor(() => expect(textOf(container, '.sprint__score')).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
    expect(screen.queryByText('Round complete')).toBeNull();
    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);
  });

  it('Finish before any answer returns to the start page', async () => {
    const container = renderSprint();
    await startRound('No limit');
    await waitForSign(container);

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(container.querySelectorAll('.sprint__option')).toHaveLength(0);
    expect(screen.queryByText('Round complete')).toBeNull();
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();
  });

  it('a round with nothing right shows no XP chip and the gentle zero line', async () => {
    const container = renderSprint();
    await startRound();
    const firstId = await waitForSign(container);

    const wrong = wrongOption(container, firstId);
    fireEvent.click(wrong);
    await waitFor(() => expect(wrong.getAttribute('data-feedback')).toBe('wrong'));

    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');

    expect(textOf(container, '.end-screen__score')).toBe('0');
    expect(container.querySelector('.end-screen__xp')).toBeNull();
    expect(container.querySelector('.end-screen--animated')).toBeNull();
    expect(
      screen.getByText('No signs named this time — have a look at the ones below.'),
    ).toBeTruthy();

    // A round where nothing was answered has nothing below to look at.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await waitForSign(container);
    t = 120_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(2));
    await act(async () => {
      pendingRoundFinished[1]();
    });
    await waitFor(() => expect(screen.getByText('Time’s up')).toBeTruthy());
    expect(textOf(container, '.end-screen__score')).toBe('0');
    expect(
      screen.queryByText('No signs named this time — have a look at the ones below.'),
    ).toBeNull();
  });

  it('Done shows the start page', async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);

    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');
    // The ending is remembered on this history entry (M25): its state holds the round's id.
    await waitFor(() => expect(locationState()).toContain('roundId'));

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.queryByText('Time’s up')).toBeNull();
    expect(container.querySelectorAll('.sprint__option')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign Sprint');
    // Done clears the entry, so coming Back to it later shows the start page, not a finished round.
    await waitFor(() => expect(locationState()).toBe('null'));
  });

  // The round's last write takes a moment to settle, and the play screen --
  // with its ✕ -- is still up while it does. A continuation that ran after
  // the player had left replaced wherever they had gone with the Sprint
  // route and showed them the ending they had closed (Step 10 review,
  // blocking; amendment E24 (d)).
  it("✕ while the round's last write is still pending leaves for good", async () => {
    const container = renderSprint();
    await startRound();
    await waitForSign(container);

    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.sprint__panel')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());

    // Now the write settles, and its continuation gets every chance to run.
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('Practice tab')).toBeTruthy();
    expect(screen.queryByText('Time’s up')).toBeNull();
    expect(locationState()).toBe('null');
  });

  it('a sign collected this round is named on the end screen', async () => {
    mocks.recordAnswer.mockResolvedValue({ collectedNow: true, lostNow: false });
    const container = renderSprint();
    await startRound();
    const firstId = await waitForSign(container);
    const first = signs.find((sign) => sign.id === firstId);
    if (!first) throw new Error(`no sign ${firstId}`);

    fireEvent.click(option(container, firstId));
    await waitFor(() => expect(textOf(container, '.sprint__score')).toBe('1'));
    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');

    expect(textOf(container, '.end-screen__collected')).toBe(`Collected! ${gameName(first)}`);
  });

  it('the VoiceOver note is one element for the whole visit', async () => {
    const container = renderSprint();
    await screen.findByRole('button', { name: 'Start' });
    const note = container.querySelector('.sprint > .visually-hidden[role="status"]');
    expect(note).not.toBeNull();
    expect(container.querySelector('.sprint')?.firstElementChild).toBe(note);

    // The same node on the play screen and on the end screen: it is never
    // remounted, so it is announced once per visit (Q8, amendment E16 (o)).
    await startRound();
    await waitForSign(container);
    expect(container.querySelector('.sprint > .visually-hidden')).toBe(note);

    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');
    expect(container.querySelector('.sprint > .visually-hidden')).toBe(note);
    expect(container.querySelectorAll('.visually-hidden[role="status"]')).toHaveLength(1);
  });

  it("the lost notice's Practise button leaves Sprint for that sign's family round", async () => {
    mocks.recordAnswer.mockResolvedValue({ collectedNow: false, lostNow: true });
    const container = renderSprint();
    await startRound();
    const firstId = await waitForSign(container);
    const family = signs.find((sign) => sign.id === firstId)?.family;
    if (!family) throw new Error(`no family for ${firstId}`);

    fireEvent.click(wrongOption(container, firstId));
    t = 60_000;
    await waitFor(() => expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingRoundFinished[0]();
    });
    await screen.findByText('Time’s up');

    fireEvent.click(screen.getByRole('button', { name: 'Practise signs like this' }));
    await waitFor(() => expect(screen.getByText(`Tap round: ${family}`)).toBeTruthy());
  });
});
