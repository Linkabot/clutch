// Dexie (IndexedDB) database: a "settings" key/value table (version 1),
// plus version-2 "progress" (XP, day streak, Sign Sprint best score) and
// "signProgress" (per-sign correct-answer counts) tables for the game
// layer's persistence (D19–D21). The optional constructor name/options let
// tests open their own isolated database against a fake IndexedDB factory.
// Depends on: dexie.
// Depended on by: src/engine/progress-store.ts (type), src/engine/progress-state.ts,
// tests/unit/progress-store.test.ts.

import Dexie, { type DexieOptions, type EntityTable } from 'dexie';

export interface SettingsRow {
  key: string;
  value: unknown;
}

export interface ProgressRow {
  key: 'xp' | 'streak' | 'sprintBest';
  value: unknown;
}

export interface SignProgressRow {
  signId: string;
  correct: number;
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
