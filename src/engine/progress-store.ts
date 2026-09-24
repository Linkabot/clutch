// The progress engine over Dexie: reads and writes the "progress" and
// "signProgress" tables added by src/storage/db.ts's version 2, and the
// "settings" table's `sprint.choices` and `sprint.lastRound` rows, using the
// pure day/streak/XP/collection/wrong-in-a-row maths in ./progress (Q9,
// Q10, Q12, Q17, Q18). Takes an injectable clock so callers (and tests)
// control "now" instead of the module reaching for `new Date()` itself.
// Depends on: ./progress, src/storage/db.ts (ClutchDB type only).
// Depended on by: src/engine/progress-state.ts, src/engine/start-here.ts,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/sign-sprint/SprintStart.tsx,
// tests/unit/progress-store.test.ts, tests/unit/progress-state.test.ts (types),
// tests/unit/journey-screen.test.tsx, tests/unit/me-screen.test.tsx,
// tests/unit/sign-sprint.test.tsx, tests/unit/sprint-start.test.tsx,
// tests/unit/start-here.test.ts.

import type { ClutchDB, ProgressRow } from '../storage/db';
import {
  addXp,
  applyAnswer,
  bestScore,
  currentStreak,
  finishRound,
  GAME_IDS,
  isCollected,
  SPRINT_LENGTHS,
  type GameId,
  type SprintLengthId,
  type Streak,
} from './progress';

export interface ProgressSummary {
  xp: number;
  streak: number;
  /** The 1-minute Sign Sprint best, kept for callers that only ever cared about that length; equals `sprintBests['1m']`. */
  sprintBest: number;
  sprintBests: Record<SprintLengthId, number>;
  collected: number;
  lastPlayed: Record<GameId, number | null>;
  sprintLast: { score: number; length: SprintLengthId; answered: number } | null;
}

export interface AnswerResult {
  collectedNow: boolean;
  lostNow: boolean;
}

export interface RoundFinishedOptions {
  game?: GameId;
  sprintScore?: number;
  sprintLength?: SprintLengthId;
  sprintAnswered?: number;
}

export interface SprintChoices {
  length: SprintLengthId;
  /** Family ids the learner last chose to play with; `[]` means All. */
  families: string[];
}

export interface ProgressStore {
  getSummary(): Promise<ProgressSummary>;
  recordAnswer(signId: string, correct: boolean): Promise<AnswerResult>;
  recordRoundFinished(options?: RoundFinishedOptions): Promise<void>;
  getSignProgress(): Promise<Map<string, number>>;
  getSprintChoices(): Promise<SprintChoices>;
  setSprintChoices(choices: SprintChoices): Promise<void>;
}

const DEFAULT_STREAK: Streak = { count: 0, lastDay: null };
const DEFAULT_SPRINT_CHOICES: SprintChoices = { length: '1m', families: [] };

function isStreak(value: unknown): value is Streak {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Streak).count === 'number' &&
    (typeof (value as Streak).lastDay === 'string' || (value as Streak).lastDay === null)
  );
}

function isSprintLength(value: unknown): value is SprintLengthId {
  return (SPRINT_LENGTHS as readonly unknown[]).includes(value);
}

function isSprintChoices(value: unknown): value is SprintChoices {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as SprintChoices;
  return (
    isSprintLength(candidate.length) &&
    Array.isArray(candidate.families) &&
    candidate.families.every((family) => typeof family === 'string')
  );
}

function isSprintLast(value: unknown): value is ProgressSummary['sprintLast'] {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { score: unknown; length: unknown; answered: unknown };
  return (
    typeof candidate.score === 'number' &&
    typeof candidate.answered === 'number' &&
    isSprintLength(candidate.length)
  );
}

/** The `progress` table key holding the Sign Sprint best for `length` (the 1-minute best keeps the pre-Phase-2b key `sprintBest`, so no migration is needed). */
function sprintBestKey(length: SprintLengthId): ProgressRow['key'] {
  switch (length) {
    case '1m':
      return 'sprintBest';
    case '30s':
      return 'sprintBest:30s';
    case '5m':
      return 'sprintBest:5m';
    case 'none':
      return 'sprintBest:none';
  }
}

/** The `progress` table key holding `game`'s last-played timestamp. */
function lastPlayedKey(game: GameId): ProgressRow['key'] {
  return `lastPlayed:${game}`;
}

/** Builds a progress store bound to a Dexie database and a clock (`now`), for D19–D21's and Q9/Q10/Q12/Q17/Q18's rules. */
export function createProgressStore({ db, now }: { db: ClutchDB; now: () => Date }): ProgressStore {
  async function getXp(): Promise<number> {
    const row = await db.progress.get('xp');
    return typeof row?.value === 'number' ? row.value : 0;
  }

  async function getStreak(): Promise<Streak> {
    const row = await db.progress.get('streak');
    return isStreak(row?.value) ? row.value : DEFAULT_STREAK;
  }

  async function getSprintBest(length: SprintLengthId): Promise<number> {
    const row = await db.progress.get(sprintBestKey(length));
    return typeof row?.value === 'number' ? row.value : 0;
  }

  async function getLastPlayed(game: GameId): Promise<number | null> {
    const row = await db.progress.get(lastPlayedKey(game));
    return typeof row?.value === 'number' ? row.value : null;
  }

  return {
    async getSummary() {
      return db.transaction('r', db.progress, db.signProgress, db.settings, async () => {
        const [xp, streak, sprintBestEntries, lastPlayedEntries, sprintLastRow, signRows] =
          await Promise.all([
            getXp(),
            getStreak(),
            Promise.all(
              SPRINT_LENGTHS.map(async (length) => [length, await getSprintBest(length)] as const),
            ),
            Promise.all(GAME_IDS.map(async (game) => [game, await getLastPlayed(game)] as const)),
            db.settings.get('sprint.lastRound'),
            db.signProgress.toArray(),
          ]);
        const sprintBests = Object.fromEntries(sprintBestEntries) as Record<SprintLengthId, number>;
        const lastPlayed = Object.fromEntries(lastPlayedEntries) as Record<GameId, number | null>;
        const collected = signRows.filter((row) => isCollected(row.correct)).length;
        const sprintLast = isSprintLast(sprintLastRow?.value) ? sprintLastRow.value : null;
        return {
          xp,
          streak: currentStreak(streak, now()),
          sprintBest: sprintBests['1m'],
          sprintBests,
          collected,
          lastPlayed,
          sprintLast,
        };
      });
    },

    async recordAnswer(signId, correct) {
      return db.transaction('rw', db.progress, db.signProgress, async () => {
        const signRow = await db.signProgress.get(signId);
        const before = { correct: signRow?.correct ?? 0, wrongInARow: signRow?.wrongInARow ?? 0 };
        const result = applyAnswer(before, correct);
        if (correct) {
          const xp = await getXp();
          await db.progress.put({ key: 'xp', value: addXp(xp, true) });
          await db.signProgress.put({
            signId,
            correct: result.correct,
            wrongInARow: result.wrongInARow,
          });
        } else if (signRow && isCollected(signRow.correct)) {
          await db.signProgress.put({
            signId,
            correct: result.correct,
            wrongInARow: result.wrongInARow,
          });
        }
        return { collectedNow: result.collectedNow, lostNow: result.lostNow };
      });
    },

    async recordRoundFinished(options = {}) {
      await db.transaction('rw', db.progress, db.settings, async () => {
        const streak = await getStreak();
        await db.progress.put({ key: 'streak', value: finishRound(streak, now()) });
        if (options.sprintScore !== undefined) {
          const length = options.sprintLength ?? '1m';
          const best = await getSprintBest(length);
          await db.progress.put({
            key: sprintBestKey(length),
            value: bestScore(best, options.sprintScore),
          });
          await db.settings.put({
            key: 'sprint.lastRound',
            value: {
              score: options.sprintScore,
              length,
              answered: options.sprintAnswered ?? 0,
            },
          });
        }
        if (options.game !== undefined) {
          await db.progress.put({ key: lastPlayedKey(options.game), value: now().getTime() });
        }
      });
    },

    async getSignProgress() {
      const rows = await db.signProgress.toArray();
      return new Map(rows.map((row) => [row.signId, row.correct]));
    },

    async getSprintChoices() {
      const row = await db.settings.get('sprint.choices');
      // A fresh default each time, so a caller that edits what it gets back cannot change the next default.
      return isSprintChoices(row?.value) ? row.value : { ...DEFAULT_SPRINT_CHOICES, families: [] };
    },

    async setSprintChoices(choices) {
      await db.settings.put({ key: 'sprint.choices', value: choices });
    },
  };
}
