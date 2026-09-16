// Unit tests for the pure progress-engine functions (src/engine/progress.ts):
// day-key arithmetic across time zones and clock changes (P9, E15), streak
// advance, XP, collection and best-score rules (D19–D21).
// Depends on: vitest, src/engine/progress.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  previousDayKey,
  finishRound,
  currentStreak,
  addXp,
  addCorrect,
  isCollected,
  bestScore,
} from '../../src/engine/progress';

// Built only inside `it`/`beforeAll` bodies (never at describe/module scope,
// which runs before beforeAll sets the zone): a Date in whatever zone the
// current process.env.TZ names.
function at(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

const ZONE_OFFSET_MINUTES: Record<string, number> = {
  'Europe/London': 0,
  'Pacific/Auckland': -780,
};

describe.each(['Europe/London', 'Pacific/Auckland'] as const)('streak days in %s', (zone) => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = zone;
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it(`has the expected UTC offset in ${zone}`, () => {
    expect(new Date(Date.UTC(2026, 0, 1)).getTimezoneOffset()).toBe(ZONE_OFFSET_MINUTES[zone]);
  });

  it('a round at 23:59 then one at 00:01 the next local day gives a streak of 2', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 6, 10, 23, 59));
    const second = finishRound(first, at(2026, 6, 11, 0, 1));
    expect(second.count).toBe(2);
  });

  it('a skipped day resets the streak to 1', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 6, 10, 12, 0));
    const second = finishRound(first, at(2026, 6, 12, 12, 0));
    expect(second.count).toBe(1);
  });

  it('two rounds the same day leave the streak unchanged', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 6, 10, 9, 0));
    const second = finishRound(first, at(2026, 6, 10, 21, 0));
    expect(second).toEqual(first);
  });

  it('currentStreak is 0 after two idle days', () => {
    const streak = finishRound({ count: 0, lastDay: null }, at(2026, 6, 10, 12, 0));
    expect(currentStreak(streak, at(2026, 6, 12, 12, 0))).toBe(0);
  });

  it('currentStreak still shows the count the morning after the last round, before a round today (E16)', () => {
    const streak = finishRound({ count: 0, lastDay: null }, at(2026, 7, 10, 12, 0));
    expect(currentStreak(streak, at(2026, 7, 11, 9, 0))).toBe(1);
  });

  it('rounds on 28 and 29 March 2026 (UK clock change) give a streak of 2', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 3, 28, 12, 0));
    const second = finishRound(first, at(2026, 3, 29, 12, 0));
    expect(second.count).toBe(2);
  });

  it('previousDayKey is correct the day after a 23-hour day (E15)', () => {
    expect(previousDayKey('2026-03-30')).toBe('2026-03-29');
    expect(previousDayKey('2026-09-28')).toBe('2026-09-27');
  });

  it('a round on 29 March 2026 then one at 00:30 on 30 March 2026 gives a streak of 2 (E15)', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 3, 29, 12, 0));
    const second = finishRound(first, at(2026, 3, 30, 0, 30));
    expect(second.count).toBe(2);
  });

  it('a round on 27 September 2026 then one at 00:30 on 28 September 2026 gives a streak of 2 (E15)', () => {
    const first = finishRound({ count: 0, lastDay: null }, at(2026, 9, 27, 12, 0));
    const second = finishRound(first, at(2026, 9, 28, 0, 30));
    expect(second.count).toBe(2);
  });
});

describe('XP, collection and best score', () => {
  it('addXp adds 10 only when the answer was correct', () => {
    expect(addXp(0, true)).toBe(10);
    expect(addXp(10, false)).toBe(10);
  });

  it('a sign is collected on the third correct answer and correct never rises above 3', () => {
    let correct = 0;
    correct = addCorrect(correct);
    expect(isCollected(correct)).toBe(false);
    correct = addCorrect(correct);
    expect(isCollected(correct)).toBe(false);
    correct = addCorrect(correct);
    expect(isCollected(correct)).toBe(true);
    correct = addCorrect(correct);
    expect(correct).toBe(3);
  });

  it('bestScore keeps the larger of two scores', () => {
    expect(bestScore(12, 17)).toBe(17);
    expect(bestScore(17, 9)).toBe(17);
  });
});
