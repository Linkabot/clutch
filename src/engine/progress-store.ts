// The progress engine over Dexie: reads and writes the "progress" and
// "signProgress" tables added by src/storage/db.ts's version 2, using the
// pure day/streak/XP/collection maths in ./progress. Takes an injectable
// clock so callers (and tests) control "now" instead of the module reaching
// for `new Date()` itself.
// Depends on: ./progress, src/storage/db.ts (ClutchDB type only).
// Depended on by: src/engine/progress-state.ts, tests/unit/progress-store.test.ts.

import type { ClutchDB } from '../storage/db';
import {
  addCorrect,
  addXp,
  bestScore,
  currentStreak,
  finishRound,
  isCollected,
  type Streak,
} from './progress';

export interface ProgressSummary {
  xp: number;
  streak: number;
  sprintBest: number;
  collected: number;
}

export interface ProgressStore {
  getSummary(): Promise<ProgressSummary>;
  recordAnswer(signId: string, correct: boolean): Promise<void>;
  recordRoundFinished(options?: { sprintScore?: number }): Promise<void>;
  getSignProgress(): Promise<Map<string, number>>;
}

const DEFAULT_STREAK: Streak = { count: 0, lastDay: null };

function isStreak(value: unknown): value is Streak {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Streak).count === 'number' &&
    (typeof (value as Streak).lastDay === 'string' || (value as Streak).lastDay === null)
  );
}

/** Builds a progress store bound to a Dexie database and a clock (`now`), for D19–D21's rules. */
export function createProgressStore({ db, now }: { db: ClutchDB; now: () => Date }): ProgressStore {
  async function getXp(): Promise<number> {
    const row = await db.progress.get('xp');
    return typeof row?.value === 'number' ? row.value : 0;
  }

  async function getStreak(): Promise<Streak> {
    const row = await db.progress.get('streak');
    return isStreak(row?.value) ? row.value : DEFAULT_STREAK;
  }

  async function getSprintBest(): Promise<number> {
    const row = await db.progress.get('sprintBest');
    return typeof row?.value === 'number' ? row.value : 0;
  }

  return {
    async getSummary() {
      const [xp, streak, sprintBest, signRows] = await db.transaction(
        'r',
        db.progress,
        db.signProgress,
        async () => Promise.all([getXp(), getStreak(), getSprintBest(), db.signProgress.toArray()]),
      );
      const collected = signRows.filter((row) => isCollected(row.correct)).length;
      return { xp, streak: currentStreak(streak, now()), sprintBest, collected };
    },

    async recordAnswer(signId, correct) {
      if (!correct) return;
      await db.transaction('rw', db.progress, db.signProgress, async () => {
        const xp = await getXp();
        await db.progress.put({ key: 'xp', value: addXp(xp, true) });
        const signRow = await db.signProgress.get(signId);
        const nextCorrect = addCorrect(signRow?.correct ?? 0);
        await db.signProgress.put({ signId, correct: nextCorrect });
      });
    },

    async recordRoundFinished(options = {}) {
      await db.transaction('rw', db.progress, async () => {
        const streak = await getStreak();
        await db.progress.put({ key: 'streak', value: finishRound(streak, now()) });
        if (options.sprintScore !== undefined) {
          const best = await getSprintBest();
          await db.progress.put({
            key: 'sprintBest',
            value: bestScore(best, options.sprintScore),
          });
        }
      });
    },

    async getSignProgress() {
      const rows = await db.signProgress.toArray();
      return new Map(rows.map((row) => [row.signId, row.correct]));
    },
  };
}
