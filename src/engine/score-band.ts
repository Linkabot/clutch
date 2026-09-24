// Score bands for end screens (Q9): a round's score against its maximum
// maps to a red/orange/green band, and Sign Sprint's maximum score scales
// with the round length it was played at.
// Depends on: ./progress (SprintLengthId).
// Depended on by: src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/shared/EndScreen.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/sign-sprint/SprintStart.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// tests/unit/score-band.test.ts.

import type { SprintLengthId } from './progress';

export type ScoreBand = 'red' | 'orange' | 'green';

/**
 * A score of 90% or more of `max` is green, 60% or more is orange, else red
 * (Q9). A non-positive `max` is always red.
 */
export function scoreBand(score: number, max: number): ScoreBand {
  if (max <= 0) return 'red';
  const ratio = score / max;
  if (ratio >= 0.9) return 'green';
  if (ratio >= 0.6) return 'orange';
  return 'red';
}

/**
 * Sign Sprint's maximum score for a timed round length, at 10 per minute
 * (Q9's "9+ green per 60 seconds"; the same ratio applies to the other
 * timed lengths): 5 for 30 seconds, 10 for 1 minute, 50 for 5 minutes.
 */
export function sprintBandMax(length: Exclude<SprintLengthId, 'none'>): number {
  switch (length) {
    case '30s':
      return 5;
    case '1m':
      return 10;
    case '5m':
      return 50;
  }
}
