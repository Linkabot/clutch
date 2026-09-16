/**
 * @vitest-environment jsdom
 *
 * Unit and render tests for Sign Sprint (plan.md Step 24 and amendment
 * E27). The deck: buildSprintDeck over the real signs catalogue gives every
 * eligible sign exactly once (131 short-caption answers), each with 4
 * distinct short same-family captions, the answer's slot and the answer
 * order shuffled and seed-dependent; a synthetic catalogue pins the
 * 4-short-captions-per-family threshold. The reducer: start, right and
 * wrong answers, the 900 ms reveal, the 60,000 ms deadline (ticks and late
 * answers), missed signs kept once and in order, acceptsAnswer,
 * currentQuestion's wrap, tick always returning a new state, start
 * replacing the whole state, and the formatClock table. The screen (jsdom,
 * real timers and an injected clock `t` -- never fake timers, whose timers
 * @testing-library's waitFor does not see): the play screen's picture,
 * lettered options, clock and bar; a right answer's score, +10 XP and
 * recordAnswer; the reveal's frames and disabled options; the end screen
 * waiting for a pending recordRoundFinished (a late tap in that window
 * scores and records nothing), then showing the round's score, XP,
 * "sign named"/"signs named", the store's best and streak, and the missed
 * sign's link (no list card when nothing was missed); Play again; Close;
 * and reduced motion (a stubbed matchMedia) switching
 * every animated class off. The progress store is mocked by its path
 * relative to this file.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns), src/content/schemas
 * (Sign type), src/features/interactives/shared/random (mulberry32),
 * src/features/interactives/shared/distractors (isShortCaption),
 * src/features/interactives/sign-sprint/sprint,
 * src/features/interactives/sign-sprint/SignSprint, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadSigns } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';
import { mulberry32 } from '../../src/features/interactives/shared/random';
import { isShortCaption } from '../../src/features/interactives/shared/distractors';
import {
  SPRINT_MS,
  REVEAL_MS,
  acceptsAnswer,
  buildSprintDeck,
  currentQuestion,
  formatClock,
  initialSprintState,
  sprintReducer,
  timeLeft,
  type SprintQuestion,
  type SprintState,
} from '../../src/features/interactives/sign-sprint/sprint';
import SignSprint from '../../src/features/interactives/sign-sprint/SignSprint';

const mocks = vi.hoisted(() => ({
  recordAnswer: vi.fn<(signId: string, correct: boolean) => Promise<void>>(),
  recordRoundFinished: vi.fn<(options?: { sprintScore?: number }) => Promise<void>>(),
  summary: { xp: 0, streak: 5, sprintBest: 7, collected: 0 },
}));

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

/** A round started at now = 1000 (deadline 61000) over DECK. */
function started(deck: SprintQuestion[] = DECK): SprintState {
  return sprintReducer(initialSprintState(), { type: 'start', deck, now: 1000 });
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

  it('gives every question 4 options with distinct short captions from the answer family, one of them the answer', () => {
    const deck = buildSprintDeck(signs, mulberry32(1));
    for (const q of deck) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((option) => option.name)).size).toBe(4);
      for (const option of q.options) {
        expect(isShortCaption(option.name)).toBe(true);
        expect(option.family).toBe(q.answer.family);
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
    expect(timeLeft(state)).toBe(SPRINT_MS);
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

    state = sprintReducer(state, { type: 'start', deck: DECK, now: 70000 });
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

function renderSprint() {
  const view = render(
    <MemoryRouter initialEntries={['/practice/sprint']}>
      <Routes>
        <Route path="/practice/sprint" element={<SignSprint now={now} />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
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
  mocks.recordAnswer.mockReset();
  mocks.recordAnswer.mockResolvedValue(undefined);
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
    expect(container.querySelector('.sprint-end__panel')).toBeNull();

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
    expect(textOf(container, '.sprint-end__score')).toBe('1');
    expect(mocks.recordAnswer).toHaveBeenCalledTimes(2);
    expect(screen.getByText('sign named')).toBeTruthy();
    expect(screen.queryByText('signs named')).toBeNull();
    expect(container.querySelector('.sprint-end__missed-list')).not.toBeNull();
    expect(screen.getByText('in 60 seconds')).toBeTruthy();
    expect(textOf(container, '.sprint-end__xp')).toBe('+10 XP');
    expect(textOf(container, '.sprint-end__best')).toBe('Best 7');
    expect(screen.getByText('5-day streak')).toBeTruthy();
    expect(screen.getByText('Missed signs')).toBeTruthy();
    expect(textOf(container, '.sprint-end__missed-count')).toBe('1');
    const rows = container.querySelectorAll('a.sprint-end__missed-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('href')).toBe(`/learn/signs/${secondId}`);
    expect(rows[0].querySelector('img')?.getAttribute('alt')).toBe('');

    expect(mocks.recordRoundFinished).toHaveBeenCalledTimes(1);
    expect(mocks.recordRoundFinished).toHaveBeenCalledWith({ sprintScore: 1 });
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
    expect(mocks.recordRoundFinished).toHaveBeenLastCalledWith({ sprintScore: 0 });
    await act(async () => {
      pendingRoundFinished[1]();
    });
    await waitFor(() => expect(screen.getByText('Time’s up')).toBeTruthy());
    expect(textOf(container, '.sprint-end__missed-count')).toBe('0');
    expect(container.querySelectorAll('a.sprint-end__missed-row')).toHaveLength(0);
    expect(container.querySelector('.sprint-end__missed-list')).toBeNull();
    expect(textOf(container, '.sprint-end__score')).toBe('0');
    expect(textOf(container, '.sprint-end__xp')).toBe('+0 XP');
    expect(screen.getByText('signs named')).toBeTruthy();
    expect(screen.queryByText('sign named')).toBeNull();

    // Close on the end screen.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
  });

  it('✕ on the play screen lands on /practice', async () => {
    const container = renderSprint();
    await waitForSign(container);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByText('Practice tab')).toBeTruthy());
    expect(mocks.recordRoundFinished).not.toHaveBeenCalled();
  });

  it('under reduced motion the root is sprint--static, nothing is --animated, and +10 XP still shows', async () => {
    stubMatchMedia(true);
    const container = renderSprint();
    const answerId = await waitForSign(container);

    const root = container.querySelector('.sprint');
    expect(root?.classList.contains('sprint--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);

    fireEvent.click(option(container, answerId));
    await waitFor(() => expect(textOf(container, '.sprint__xp')).toBe('+10 XP'));
    expect(root?.classList.contains('sprint--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
  });
});
