// Pure progress-engine maths: local day keys, day-streak arithmetic, XP,
// per-sign collection and best-score rules (D19–D21). No Dexie import, so it
// is unit-testable without IndexedDB and safe to call from any clock/zone.
// Depends on: nothing.
// Depended on by: src/engine/progress-store.ts, tests/unit/progress.test.ts.

/** A saved day streak: how many consecutive days, and the local day key it last advanced on. */
export interface Streak {
  count: number;
  lastDay: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` for this Date in the phone's local time zone. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * The local day key before `key`. Builds the previous day at local noon
 * (never local midnight minus 24 hours), so the result is correct either
 * side of a UK clock change, when a day is 23 or 25 hours long.
 */
export function previousDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day - 1, 12));
}

/**
 * Advances a day streak by one finished round, `now` (D20): unchanged if a
 * round already finished today; +1 if the last round was yesterday;
 * otherwise (including a fresh `{ count: 0, lastDay: null }`) resets to 1.
 */
export function finishRound(streak: Streak, now: Date): Streak {
  const today = localDayKey(now);
  if (streak.lastDay === today) return streak;
  if (streak.lastDay === previousDayKey(today)) {
    return { count: streak.count + 1, lastDay: today };
  }
  return { count: 1, lastDay: today };
}

/** The streak to display now: `count` if a round finished today or yesterday, else 0 (a missed day resets the display). */
export function currentStreak(streak: Streak, now: Date): number {
  const today = localDayKey(now);
  if (streak.lastDay === today || streak.lastDay === previousDayKey(today)) {
    return streak.count;
  }
  return 0;
}

/** +10 XP for a correct answer; unchanged otherwise. XP never goes down (D19). */
export function addXp(xp: number, correct: boolean): number {
  return correct ? xp + 10 : xp;
}

/** One more correct identification of a sign, capped at 3 (D21). */
export function addCorrect(correct: number): number {
  return Math.min(3, correct + 1);
}

/** A sign counts as collected once it has 3 or more correct identifications (D21). */
export function isCollected(correct: number): boolean {
  return correct >= 3;
}

/** The larger of a saved best score and a new one. */
export function bestScore(best: number, score: number): number {
  return Math.max(best, score);
}
