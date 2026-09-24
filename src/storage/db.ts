// Dexie (IndexedDB) database: a "settings" key/value table (version 1),
// plus version-2 "progress" (XP, day streak, a Sign Sprint best score per
// round length under `sprintBest`/`sprintBest:<length>`, and a
// `lastPlayed:<game>` timestamp per game) and "signProgress" (per-sign
// correct-answer counts, plus an optional `wrongInARow` counter for the
// collection-loss rule, Q12 -- missing on rows written before Phase 2b,
// which reads as 0) tables for the game layer's persistence (D19–D21, Q9,
// Q10, Q12, Q17, Q18). No version bump in Phase 2b: every new value is
// either a new non-indexed field on an existing row shape or a new row key
// in an existing key/value table, so version 2's `stores()` strings, and
// old data written under them, stay valid unchanged. The optional
// constructor name/options let tests open their own isolated database
// against a fake IndexedDB factory.
// Depends on: dexie.
// Depended on by: src/engine/progress-store.ts (type), src/engine/progress-state.ts,
// tests/unit/progress-store.test.ts, tests/unit/progress-state.test.ts (mocks it).

import Dexie, { type DexieOptions, type EntityTable } from 'dexie';

export interface SettingsRow {
  key: string;
  value: unknown;
}

export interface ProgressRow {
  key:
    | 'xp'
    | 'streak'
    | 'sprintBest'
    | 'sprintBest:30s'
    | 'sprintBest:5m'
    | 'sprintBest:none'
    | 'lastPlayed:tap'
    | 'lastPlayed:sprint'
    | 'lastPlayed:pairs';
  value: unknown;
}

export interface SignProgressRow {
  signId: string;
  correct: number;
  /** Consecutive wrong answers on this sign since it was last collected (Q12). Missing on rows written before Phase 2b, which reads as 0. */
  wrongInARow?: number;
}

export class ClutchDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>;
  progress!: EntityTable<ProgressRow, 'key'>;
  signProgress!: EntityTable<SignProgressRow, 'signId'>;

  constructor(name = 'ClutchDB', options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      settings: 'key',
    });
    this.version(2).stores({
      settings: 'key',
      progress: 'key',
      signProgress: 'signId',
    });
  }
}

export const db = new ClutchDB();
