// A small deterministic PRNG (mulberry32) and a Fisher-Yates shuffle built
// on it: every interactive that needs "random" ordering (distractor
// options, sign order) takes an Rng instead of calling Math.random()
// directly, so a seeded run is exactly repeatable in a test while play
// itself can still seed from Date.now() or similar.
// Depends on: nothing.
// Depended on by: src/features/interactives/shared/distractors.ts,
// src/features/practice/tap/round.ts, src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/sign-sprint/sprint.ts,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/match-pairs/pairs.ts,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// tests/unit/interactives-shared.test.ts, tests/unit/match-pairs.test.tsx,
// tests/unit/sign-sprint.test.tsx, tests/unit/tap-round.test.ts.

/** Returns a float in [0, 1), like Math.random(). */
export type Rng = () => number;

/**
 * A seeded pseudo-random number generator (mulberry32): the same seed
 * always produces the same sequence of floats in [0, 1).
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function rng(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A new array holding every item of `items` in a random order (Fisher-
 * Yates), driven by `rng`. Never mutates `items`; the same rng sequence
 * (e.g. from one mulberry32 seed) always produces the same result.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
