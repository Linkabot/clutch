// Dexie (IndexedDB) database skeleton: a single "settings" key/value table.
// Depends on: dexie.
// Depended on by: nothing yet (wired into features in a later phase).

import Dexie, { type EntityTable } from 'dexie';

export interface SettingsRow {
  key: string;
  value: unknown;
}

export class ClutchDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor() {
    super('ClutchDB');
    this.version(1).stores({
      settings: 'key',
    });
  }
}

export const db = new ClutchDB();
