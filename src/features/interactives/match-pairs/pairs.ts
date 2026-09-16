// Match Pairs' pure game logic (plan.md Step 25 and amendment E31): the
// round's constants (5 pairs, a 600 ms wrong-name flash, an 800 ms hold
// before the end card), buildPairsRound() -- one family chosen by the
// caller's Rng from those with at least 5 short-caption signs, 5 of its
// short-caption signs taken from a shuffle (the sign column, in pick
// order) and the same 5 shuffled again (the name column) -- and
// pairsReducer(), the round's state machine. Tapping a sign selects it
// (tapping it again deselects it); tapping the selected sign's own name
// locks the pair, and the pair earns 10 XP only when that sign had no wrong
// attempt this round (D17, D19, D21); tapping any other name marks the
// SELECTED sign as missed once, clears the selection and starts a counted
// wrong flash on the tapped name, which `flash-over` clears only when its
// count still matches. The round finishes when 5 pairs are locked. Branches
// that change nothing return the same state object, so React skips the
// re-render; every change returns a new one.
// Depends on: ../../../content/schemas (Sign, SignFamily types),
// ../shared/random (Rng, shuffle), ../shared/distractors (isShortCaption).
// Depended on by: ./MatchPairs.tsx, tests/unit/match-pairs.test.tsx.

import type { Sign, SignFamily } from '../../../content/schemas';
import type { Rng } from '../shared/random';
import { shuffle } from '../shared/random';
import { isShortCaption } from '../shared/distractors';

/** How many sign-and-name pairs a round has. */
export const PAIRS_PER_ROUND = 5;
/** How long a wrongly tapped name keeps its red flash. */
export const FLASH_MS = 600;
/** The end card waits at least this long after the fifth lock. */
export const END_HOLD_MS = 800;

const XP_PER_FIRST_TRY_PAIR = 10;

export interface PairsRound {
  family: SignFamily;
  /** The sign column, in pick order. */
  signs: Sign[];
  /** The name column: the same signs, shuffled again. */
  names: Sign[];
}

export interface PairsWrong {
  /** The wrongly tapped name tile's sign id. */
  nameId: string;
  /** Counts wrong attempts, so a stale `flash-over` never clears a newer flash. */
  count: number;
}

export interface PairsState {
  round: PairsRound;
  selectedId: string | null;
  /** Locked sign ids, in lock order. */
  lockedIds: string[];
  /** Signs with a wrong attempt this round. */
  missedIds: string[];
  /** Signs locked on the first try. */
  earnedIds: string[];
  xp: number;
  finished: boolean;
  wrong: PairsWrong | null;
}

export type PairsAction =
  | { type: 'tap-sign'; signId: string }
  | { type: 'tap-name'; signId: string }
  | { type: 'flash-over'; count: number };

/**
 * Builds a round: a family chosen uniformly by `rng` from those with at
 * least 5 short-caption signs, then 5 of that family's short-caption signs
 * taken from a shuffle (the sign column, in pick order), and the same 5
 * shuffled again (the name column).
 */
export function buildPairsRound(signs: readonly Sign[], rng: Rng): PairsRound {
  const shortByFamily = new Map<SignFamily, Sign[]>();
  for (const sign of signs) {
    if (!isShortCaption(sign.name)) continue;
    const family = shortByFamily.get(sign.family);
    if (family) family.push(sign);
    else shortByFamily.set(sign.family, [sign]);
  }
  const families = [...shortByFamily.entries()].filter(
    ([, familySigns]) => familySigns.length >= PAIRS_PER_ROUND,
  );
  if (families.length === 0) {
    throw new Error(`no sign family has ${PAIRS_PER_ROUND} short captions`);
  }

  const [family, familySigns] = families[Math.floor(rng() * families.length)];
  const picked = shuffle(familySigns, rng).slice(0, PAIRS_PER_ROUND);
  return { family, signs: picked, names: shuffle(picked, rng) };
}

/** A fresh round: nothing selected, locked, missed or earned. */
export function initialPairsState(round: PairsRound): PairsState {
  return {
    round,
    selectedId: null,
    lockedIds: [],
    missedIds: [],
    earnedIds: [],
    xp: 0,
    finished: false,
    wrong: null,
  };
}

/** Match Pairs' round state machine; see the module header and plan.md E31 item 1. */
export function pairsReducer(state: PairsState, action: PairsAction): PairsState {
  switch (action.type) {
    case 'tap-sign': {
      if (state.finished || state.lockedIds.includes(action.signId)) return state;
      if (state.selectedId === action.signId) return { ...state, selectedId: null };
      return { ...state, selectedId: action.signId };
    }

    case 'tap-name': {
      const selectedId = state.selectedId;
      if (selectedId === null || state.finished || state.lockedIds.includes(action.signId)) {
        return state;
      }

      if (action.signId === selectedId) {
        const lockedIds = [...state.lockedIds, selectedId];
        const firstTry = !state.missedIds.includes(selectedId);
        return {
          ...state,
          selectedId: null,
          lockedIds,
          earnedIds: firstTry ? [...state.earnedIds, selectedId] : state.earnedIds,
          xp: firstTry ? state.xp + XP_PER_FIRST_TRY_PAIR : state.xp,
          finished: lockedIds.length >= PAIRS_PER_ROUND,
          wrong: null,
        };
      }

      return {
        ...state,
        selectedId: null,
        missedIds: state.missedIds.includes(selectedId)
          ? state.missedIds
          : [...state.missedIds, selectedId],
        wrong: { nameId: action.signId, count: (state.wrong?.count ?? 0) + 1 },
      };
    }

    case 'flash-over':
      return state.wrong !== null && state.wrong.count === action.count
        ? { ...state, wrong: null }
        : state;

    default:
      return state;
  }
}
