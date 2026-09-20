// Sign Sprint's pure game logic (plan.md Step 24, amendment E27, and
// Step 10 with amendment E23 (d)): the round's constants (a 900 ms reveal
// after a wrong answer, a 250 ms screen tick), lengthMs() -- the four
// chosen round lengths (Q10): 30 000, 60 000 and 300 000 ms, and Infinity
// for "No limit", which never runs out on the clock -- eligibleSigns()
// (the signs a round may ask about: short captions only, from the chosen
// families, and only from a family with at least 4 short-caption signs; an
// empty family list means every family), buildSprintDeck() -- every
// eligible sign exactly once in a shuffled order, each with 3 distractors
// drawn from the WHOLE catalogue (Step 6's look-alike tiers) and its 4
// options shuffled -- and sprintReducer(), the round's state machine
// (ready -> playing <-> reveal -> finished, and back to ready on reset).
// The clock is a deadline lengthMs(length) after `start`, compared against
// the `now` each action carries (the screen reads an injected clock),
// never against a clock read here; for "No limit" that deadline is
// Infinity, so no tick and no late answer ever finishes the round -- only
// the top bar's Finish button does (P12). A right answer scores 1 and 10
// XP and moves on at once; a wrong answer enters `reveal` (the right name
// is shown) and the ANSWER, not the tapped sign, joins `missed` once;
// either way `answered` counts up, which is what a No limit round's score
// band is measured against (Q9). acceptsAnswer(), currentQuestion(),
// timeLeft() and formatClock() are the shared read helpers the screen
// renders from; timeLeft is Infinity for a No limit round, which is why
// formatClock is never called for one. Every random choice is driven by
// the caller's Rng.
// Depends on: ../../../content/schemas (Sign),
// ../../../engine/progress (SprintLengthId), ../shared/random (Rng,
// shuffle), ../shared/distractors (isShortCaption, pickDistractors).
// Depended on by: ./SignSprint.tsx, ./SprintStart.tsx (eligibleSigns, for
// the start page's count), tests/unit/sign-sprint.test.tsx,
// tests/unit/sprint-start.test.tsx.

import type { Sign } from '../../../content/schemas';
import type { SprintLengthId } from '../../../engine/progress';
import type { Rng } from '../shared/random';
import { shuffle } from '../shared/random';
import { isShortCaption, pickDistractors } from '../shared/distractors';

/** How long a wrong answer's reveal (the right name shown) lasts. */
export const REVEAL_MS = 900;
/** How often the screen dispatches `tick` while a round runs. */
export const TICK_MS = 250;

/** The length a round takes before the learner has chosen another (Q10). */
const DEFAULT_LENGTH: SprintLengthId = '1m';

const XP_PER_RIGHT_ANSWER = 10;
const DISTRACTORS_PER_QUESTION = 3;
/** A family needs at least this many short-caption signs for its signs to be answers. */
const MIN_SHORT_CAPTIONS_PER_FAMILY = 4;

/** How long a round of each chosen length runs; `none` ("No limit") never runs out (Q10, Q11). */
export function lengthMs(length: SprintLengthId): number {
  switch (length) {
    case '30s':
      return 30_000;
    case '1m':
      return 60_000;
    case '5m':
      return 300_000;
    case 'none':
      return Infinity;
  }
}

export interface SprintQuestion {
  answer: Sign;
  options: Sign[];
}

export type SprintPhase = 'ready' | 'playing' | 'reveal' | 'finished';

export interface SprintState {
  phase: SprintPhase;
  /** The length this round is being played at (Q10). */
  length: SprintLengthId;
  deck: SprintQuestion[];
  index: number;
  score: number;
  xp: number;
  /** Answers accepted this round, right or wrong. */
  answered: number;
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
  | { type: 'start'; deck: SprintQuestion[]; length: SprintLengthId; now: number }
  | { type: 'answer'; signId: string; now: number }
  | { type: 'reveal-over' }
  | { type: 'tick'; now: number }
  | { type: 'finish' }
  | { type: 'reset' };

/**
 * The signs a round may ask about: short captions only, from `families`
 * (an empty list means every family), and only from a family with at least
 * 4 short-caption signs in the whole catalogue. The start page counts these
 * and buildSprintDeck asks about them, so the count on screen and the deck
 * played can never disagree (amendment E23 (c)).
 */
export function eligibleSigns(signs: readonly Sign[], families: readonly string[] = []): Sign[] {
  const shortPerFamily = new Map<string, number>();
  for (const sign of signs) {
    if (isShortCaption(sign.name)) {
      shortPerFamily.set(sign.family, (shortPerFamily.get(sign.family) ?? 0) + 1);
    }
  }
  return signs.filter(
    (sign) =>
      isShortCaption(sign.name) &&
      (shortPerFamily.get(sign.family) ?? 0) >= MIN_SHORT_CAPTIONS_PER_FAMILY &&
      (families.length === 0 || families.includes(sign.family)),
  );
}

/**
 * Builds a Sprint deck: every sign eligibleSigns() allows exactly once, in
 * a shuffled order. Each question is the answer plus 3 short-caption
 * distractors picked from the whole catalogue (the look-alike tiers), the
 * 4 options shuffled.
 */
export function buildSprintDeck(
  signs: readonly Sign[],
  rng: Rng,
  families: readonly string[] = [],
): SprintQuestion[] {
  return shuffle(eligibleSigns(signs, families), rng).map((answer) => {
    const distractors = pickDistractors(signs, answer, DISTRACTORS_PER_QUESTION, rng, {
      shortOnly: true,
    });
    return { answer, options: shuffle([answer, ...distractors], rng) };
  });
}

/** The state before a round starts: phase `ready`, at the default length. */
export function initialSprintState(): SprintState {
  return {
    phase: 'ready',
    length: DEFAULT_LENGTH,
    deck: [],
    index: 0,
    score: 0,
    xp: 0,
    answered: 0,
    deadline: lengthMs(DEFAULT_LENGTH),
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

/** Milliseconds left, as of the latest `now` the state carried, clamped to 0..lengthMs(length); Infinity for No limit. */
export function timeLeft(state: SprintState): number {
  return Math.min(lengthMs(state.length), Math.max(0, state.deadline - state.clock));
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

/** Sign Sprint's round state machine; see the module header, plan.md E27 item 1 and E23 (d). */
export function sprintReducer(state: SprintState, action: SprintAction): SprintState {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        length: action.length,
        deck: action.deck,
        index: 0,
        score: 0,
        xp: 0,
        answered: 0,
        deadline: action.now + lengthMs(action.length),
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
          answered: state.answered + 1,
          index: state.index + 1,
          clock: action.now,
          lastAnswerRight: true,
        };
      }

      const alreadyMissed = state.missed.some((sign) => sign.id === answer.id);
      return {
        ...state,
        phase: 'reveal',
        answered: state.answered + 1,
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

    // Done on the end screen, and Finish before a single answer: back to
    // the start page with nothing left over (amendment E23 (d), (f)).
    case 'reset':
      return initialSprintState();

    default:
      return state;
  }
}
