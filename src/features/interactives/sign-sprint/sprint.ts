// Sign Sprint's pure game logic (plan.md Step 24 and amendment E27): the
// round's constants (a 60-second clock, a 900 ms reveal after a wrong
// answer, a 250 ms screen tick), buildSprintDeck() -- every eligible sign
// exactly once in a shuffled order, each with 3 same-family short-caption
// distractors and its 4 options shuffled (a sign is eligible when its
// caption is short and its family has at least 4 short-caption signs) --
// and sprintReducer(), the round's state machine (ready -> playing <->
// reveal -> finished). The clock is a deadline 60,000 ms after `start`,
// compared against the `now` each action carries (the screen reads an
// injected clock), never against a clock read here. A right answer scores
// 1 and 10 XP and moves on at once; a wrong answer enters `reveal` (the
// right name is shown) and the ANSWER, not the tapped sign, joins `missed`
// once. acceptsAnswer(), currentQuestion(), timeLeft() and formatClock()
// are the shared read helpers the screen renders from. Every random choice
// is driven by the caller's Rng.
// Depends on: ../../../content/schemas (Sign), ../shared/random (Rng,
// shuffle), ../shared/distractors (isShortCaption, pickDistractors).
// Depended on by: ./SignSprint.tsx, tests/unit/sign-sprint.test.tsx.

import type { Sign } from '../../../content/schemas';
import type { Rng } from '../shared/random';
import { shuffle } from '../shared/random';
import { isShortCaption, pickDistractors } from '../shared/distractors';

/** The round's length: the deadline is this long after `start`. */
export const SPRINT_MS = 60_000;
/** How long a wrong answer's reveal (the right name shown) lasts. */
export const REVEAL_MS = 900;
/** How often the screen dispatches `tick` while a round runs. */
export const TICK_MS = 250;

const XP_PER_RIGHT_ANSWER = 10;
const DISTRACTORS_PER_QUESTION = 3;
/** A family needs at least this many short-caption signs for its signs to be answers. */
const MIN_SHORT_CAPTIONS_PER_FAMILY = 4;

export interface SprintQuestion {
  answer: Sign;
  options: Sign[];
}

export type SprintPhase = 'ready' | 'playing' | 'reveal' | 'finished';

export interface SprintState {
  phase: SprintPhase;
  deck: SprintQuestion[];
  index: number;
  score: number;
  xp: number;
  deadline: number;
  /** The latest `now` a start, accepted answer or tick carried. */
  clock: number;
  revealEndsAt: number | null;
  chosenId: string | null;
  lastAnswerRight: boolean;
  /** Unique wrong-answered signs (the answers, not the taps), in order. */
  missed: Sign[];
}

export type SprintAction =
  | { type: 'start'; deck: SprintQuestion[]; now: number }
  | { type: 'answer'; signId: string; now: number }
  | { type: 'reveal-over' }
  | { type: 'tick'; now: number }
  | { type: 'finish' };

/**
 * Builds a Sprint deck: every eligible sign exactly once, in a shuffled
 * order. A sign is eligible when its caption is short and its family has
 * at least 4 short-caption signs. Each question is the answer plus 3
 * same-family short-caption distractors, the 4 options shuffled.
 */
export function buildSprintDeck(signs: readonly Sign[], rng: Rng): SprintQuestion[] {
  const shortPerFamily = new Map<string, number>();
  for (const sign of signs) {
    if (isShortCaption(sign.name)) {
      shortPerFamily.set(sign.family, (shortPerFamily.get(sign.family) ?? 0) + 1);
    }
  }
  const eligible = signs.filter(
    (sign) =>
      isShortCaption(sign.name) &&
      (shortPerFamily.get(sign.family) ?? 0) >= MIN_SHORT_CAPTIONS_PER_FAMILY,
  );

  return shuffle(eligible, rng).map((answer) => {
    const distractors = pickDistractors(signs, answer, DISTRACTORS_PER_QUESTION, rng, {
      shortOnly: true,
    });
    return { answer, options: shuffle([answer, ...distractors], rng) };
  });
}

/** The state before a round starts: phase `ready`, the full minute still on the clock. */
export function initialSprintState(): SprintState {
  return {
    phase: 'ready',
    deck: [],
    index: 0,
    score: 0,
    xp: 0,
    deadline: SPRINT_MS,
    clock: 0,
    revealEndsAt: null,
    chosenId: null,
    lastAnswerRight: false,
    missed: [],
  };
}

/** True only while playing (not revealing) and before the deadline. */
export function acceptsAnswer(state: SprintState, now: number): boolean {
  return state.phase === 'playing' && now < state.deadline;
}

/** The question on screen; wraps round the deck so a very fast player never runs out. */
export function currentQuestion(state: SprintState): SprintQuestion | undefined {
  if (state.deck.length === 0) return undefined;
  return state.deck[state.index % state.deck.length];
}

/** Milliseconds left on the clock, as of the latest `now` the state carried, clamped to 0..SPRINT_MS. */
export function timeLeft(state: SprintState): number {
  return Math.min(SPRINT_MS, Math.max(0, state.deadline - state.clock));
}

/** Whole seconds, rounded up, as m:ss: 60000 -> 1:00, 59999 -> 1:00, 1 -> 0:01, 0 -> 0:00. */
export function formatClock(ms: number): string {
  if (ms <= 0) return '0:00';
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function isRunning(state: SprintState): boolean {
  return state.phase === 'playing' || state.phase === 'reveal';
}

function endReveal(state: SprintState): SprintState {
  return {
    ...state,
    phase: 'playing',
    index: state.index + 1,
    chosenId: null,
    revealEndsAt: null,
  };
}

/** Sign Sprint's round state machine; see the module header and plan.md E27 item 1. */
export function sprintReducer(state: SprintState, action: SprintAction): SprintState {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        deck: action.deck,
        index: 0,
        score: 0,
        xp: 0,
        deadline: action.now + SPRINT_MS,
        clock: action.now,
        revealEndsAt: null,
        chosenId: null,
        lastAnswerRight: false,
        missed: [],
      };

    case 'answer': {
      if (isRunning(state) && action.now >= state.deadline) {
        return { ...state, phase: 'finished' };
      }
      if (!acceptsAnswer(state, action.now)) return state;
      const question = currentQuestion(state);
      if (!question) return state;
      const { answer } = question;

      if (action.signId === answer.id) {
        return {
          ...state,
          score: state.score + 1,
          xp: state.xp + XP_PER_RIGHT_ANSWER,
          index: state.index + 1,
          clock: action.now,
          lastAnswerRight: true,
        };
      }

      const alreadyMissed = state.missed.some((sign) => sign.id === answer.id);
      return {
        ...state,
        phase: 'reveal',
        chosenId: action.signId,
        revealEndsAt: action.now + REVEAL_MS,
        clock: action.now,
        lastAnswerRight: false,
        missed: alreadyMissed ? state.missed : [...state.missed, answer],
      };
    }

    case 'reveal-over':
      return state.phase === 'reveal' ? endReveal(state) : state;

    case 'tick': {
      if (!isRunning(state)) return state;
      if (action.now >= state.deadline) {
        return { ...state, phase: 'finished', clock: action.now };
      }
      if (
        state.phase === 'reveal' &&
        state.revealEndsAt !== null &&
        action.now >= state.revealEndsAt
      ) {
        return { ...endReveal(state), clock: action.now };
      }
      return { ...state, clock: action.now };
    }

    case 'finish':
      return isRunning(state) ? { ...state, phase: 'finished' } : state;

    default:
      return state;
  }
}
