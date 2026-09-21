// Unit tests for src/engine/start-here.ts's startHere() (plan.md Step 11
// item 1, amendment E25 (b), (i)): no signs collected always suggests Tap
// the sign regardless of what was last played; a never-played game (null
// lastPlayed) counts as older than any timestamp; among games that have
// been played, the oldest lastPlayed wins; and ties (including two nulls)
// go in GAME_IDS order -- tap, sprint, pairs. Pure function, no mocks, no
// DOM: the default Vitest environment (node) is used.
// Depends on: vitest, src/engine/start-here (startHere),
// src/engine/progress-store (ProgressSummary, type only).
// Depended on by: `npm test` (Vitest run).

import { describe, expect, it } from 'vitest';
import { startHere } from '../../src/engine/start-here';
import type { ProgressSummary } from '../../src/engine/progress-store';

function summaryWith(overrides: Partial<ProgressSummary>): ProgressSummary {
  return {
    xp: 0,
    streak: 0,
    sprintBest: 0,
    sprintBests: { '30s': 0, '1m': 0, '5m': 0, none: 0 },
    collected: 0,
    lastPlayed: { tap: null, sprint: null, pairs: null },
    sprintLast: null,
    ...overrides,
  };
}

describe('startHere', () => {
  it('suggests tap when nothing is collected, even if tap was played last', () => {
    const summary = summaryWith({
      collected: 0,
      lastPlayed: { tap: 5000, sprint: 1000, pairs: 2000 },
    });
    expect(startHere(summary)).toBe('tap');
  });

  it('a never-played game (null lastPlayed) comes before any played game', () => {
    const summary = summaryWith({
      collected: 3,
      lastPlayed: { tap: 5000, sprint: null, pairs: 4000 },
    });
    expect(startHere(summary)).toBe('sprint');
  });

  it('the game with the oldest lastPlayed timestamp wins', () => {
    const summary = summaryWith({
      collected: 3,
      lastPlayed: { tap: 5000, sprint: 3000, pairs: 1000 },
    });
    expect(startHere(summary)).toBe('pairs');
  });

  it('ties follow GAME_IDS order: tap, sprint, pairs', () => {
    const sameTimestamp = summaryWith({
      collected: 3,
      lastPlayed: { tap: 1000, sprint: 1000, pairs: 1000 },
    });
    expect(startHere(sameTimestamp)).toBe('tap');

    const neverPlayed = summaryWith({
      collected: 3,
      lastPlayed: { tap: 9000, sprint: null, pairs: null },
    });
    expect(startHere(neverPlayed)).toBe('sprint');

    const bothNeverPlayed = summaryWith({
      collected: 3,
      lastPlayed: { tap: null, sprint: null, pairs: 9000 },
    });
    expect(startHere(bothNeverPlayed)).toBe('tap');
  });
});
