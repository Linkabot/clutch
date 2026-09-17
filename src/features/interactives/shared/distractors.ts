// Distractor selection for multiple-choice sign games: candidates share the
// answer's family, have a caption ("name") distinct from the answer's and
// from each other's, and are never the answer itself. `shortOnly` further
// restricts candidates to captions that fit a four-option grid
// (isShortCaption). Callers may pass minimal Sign-shaped objects (only
// `id`, `name` and `family` are read), so tests do not need a full Sign.
// Depends on: ./random.ts (Rng, shuffle).
// Depended on by: src/features/practice/tap/round.ts (buildTapRound),
// src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/sign-sprint/sprint.ts,
// src/features/interactives/match-pairs/pairs.ts,
// src/features/signs/SignScreen.tsx, tests/unit/interactives-shared.test.ts,
// tests/unit/match-pairs.test.tsx, tests/unit/sign-sprint.test.tsx.

import type { Rng } from './random';
import { shuffle } from './random';

/** The fields pickDistractors reads; a full Sign satisfies this. */
export interface CaptionSign {
  id: string;
  name: string;
  family: string;
}

export interface PickDistractorsOptions {
  /** Restrict candidates to isShortCaption(name) signs. Default false. */
  shortOnly?: boolean;
}

/** True when `caption` is short enough to sit in a four-option grid. */
export function isShortCaption(caption: string): boolean {
  return caption.length <= 60;
}

/**
 * Picks up to `count` distractors for `answer` from `signs`: same family as
 * `answer`, a caption distinct from `answer`'s and from every other
 * distractor's, never `answer` itself. `rng` drives the selection, so the
 * same seed always returns the same set in the same order.
 */
export function pickDistractors<T extends CaptionSign>(
  signs: readonly T[],
  answer: T,
  count: number,
  rng: Rng,
  options: PickDistractorsOptions = {},
): T[] {
  const { shortOnly = false } = options;
  const seenNames = new Set<string>([answer.name]);
  const candidates = signs.filter((sign) => {
    if (sign.id === answer.id) return false;
    if (sign.family !== answer.family) return false;
    if (shortOnly && !isShortCaption(sign.name)) return false;
    if (seenNames.has(sign.name)) return false;
    seenNames.add(sign.name);
    return true;
  });
  return shuffle(candidates, rng).slice(0, count);
}
