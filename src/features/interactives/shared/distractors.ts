// Distractor selection for multiple-choice sign games: candidates are drawn
// from every sign in the catalogue (not limited to the answer's family),
// with a caption ("name") distinct from the answer's and from each other's,
// and never the answer itself. `shortOnly` further restricts candidates to
// captions that fit a four-option grid (isShortCaption). When the answer's
// shape is not 'other', candidates are filled in three tiers -- same family
// with the same shape and colour set (§ look-alikes, Q14), other families
// with the same shape and colour set, then the remaining same-family
// candidates -- each tier shuffled by `rng`; a colour set matches
// regardless of order. An answer whose shape is 'other' keeps the old
// same-family-only pick. Callers may pass minimal Sign-shaped objects (id,
// name, family, shape and colours are read), so tests do not need a full
// Sign.
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
  shape: string;
  colours: readonly string[];
}

/** True when two colour sets hold the same colours, regardless of order. */
function sameColourSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((colour, index) => colour === sortedB[index]);
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
 * Picks up to `count` distractors for `answer` from `signs`: a caption
 * distinct from `answer`'s and from every other distractor's, never
 * `answer` itself. When `answer.shape` is not 'other', candidates are
 * filled in tiers -- (1) same family with the same shape and colour set,
 * (2) other families with the same shape and colour set, (3) the remaining
 * same-family candidates -- each tier shuffled by `rng` before it is drawn
 * from, so no sign is used twice. An 'other'-shape answer keeps the old
 * same-family-only pick. `rng` drives every shuffle, so the same seed
 * always returns the same set in the same order.
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
    if (shortOnly && !isShortCaption(sign.name)) return false;
    if (seenNames.has(sign.name)) return false;
    seenNames.add(sign.name);
    return true;
  });

  if (answer.shape === 'other') {
    const sameFamily = candidates.filter((sign) => sign.family === answer.family);
    return shuffle(sameFamily, rng).slice(0, count);
  }

  const looksLikeAnswer = (sign: T) =>
    sign.shape === answer.shape && sameColourSet(sign.colours, answer.colours);

  // The three tiers partition `candidates` (family match/mismatch × looks
  // like/not), so no sign appears in more than one tier.
  const tiers = [
    candidates.filter((sign) => sign.family === answer.family && looksLikeAnswer(sign)),
    candidates.filter((sign) => sign.family !== answer.family && looksLikeAnswer(sign)),
    candidates.filter((sign) => sign.family === answer.family && !looksLikeAnswer(sign)),
  ];

  const picked: T[] = [];
  for (const tier of tiers) {
    if (picked.length >= count) break;
    picked.push(...shuffle(tier, rng).slice(0, count - picked.length));
  }
  return picked;
}
