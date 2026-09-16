// Unit tests for the progress store (src/engine/progress-store.ts) and the
// Dexie version-1 to version-2 upgrade (src/storage/db.ts), run against
// fake-indexeddb so no browser is needed. Each test opens its own database
// name on a fresh IDBFactory, so tests never share state. The injected clock
// uses local-noon dates, which give the same day key in any time zone.
// Depends on: vitest, fake-indexeddb, dexie, src/storage/db.ts,
// src/engine/progress-store.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import Dexie, { type DexieOptions } from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { ClutchDB } from '../../src/storage/db';
import { createProgressStore } from '../../src/engine/progress-store';

let dbCounter = 0;

function freshOptions(): DexieOptions {
  return { indexedDB: new IDBFactory(), IDBKeyRange };
}

function nextDbName(): string {
  dbCounter += 1;
  return `ClutchDBTest${dbCounter}`;
}

describe('ClutchDB version 1 to version 2 upgrade', () => {
  it('keeps a settings row written under version 1 after upgrading to version 2', async () => {
    const name = nextDbName();
    const options = freshOptions();

    const v1 = new Dexie(name, options);
    v1.version(1).stores({ settings: 'key' });
    await v1.table('settings').put({ key: 'theme', value: 'dark' });
    v1.close();

    const v2 = new ClutchDB(name, options);
    await v2.open();
    expect(v2.verno).toBe(2);
    const row = await v2.settings.get('theme');
    expect(row).toEqual({ key: 'theme', value: 'dark' });
    v2.close();
  });
});

describe('createProgressStore', () => {
  it('three correct answers for one sign collect it and add 30 XP', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);

    const summary = await store.getSummary();
    expect(summary.collected).toBe(1);
    expect(summary.xp).toBe(30);
    db.close();
  });

  it('a sign is not collected until the third correct answer (E16)', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    expect((await store.getSummary()).collected).toBe(0);

    await store.recordAnswer('warning-bend', true);
    expect((await store.getSummary()).collected).toBe(1);
    db.close();
  });

  it('getSignProgress reports each sign under its own id with its own count (E16)', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('orders-no-entry', true);

    const signProgress = await store.getSignProgress();
    expect(signProgress).toEqual(
      new Map([
        ['warning-bend', 2],
        ['orders-no-entry', 1],
      ]),
    );
    db.close();
  });

  it('wrong answers add nothing', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordAnswer('warning-bend', false);
    await store.recordAnswer('warning-bend', false);

    const summary = await store.getSummary();
    expect(summary.xp).toBe(0);
    expect(summary.collected).toBe(0);
    const signProgress = await store.getSignProgress();
    expect(signProgress.get('warning-bend')).toBeUndefined();
    db.close();
  });

  it('rounds finished on consecutive injected days give a streak of 2', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    let current = new Date(2026, 5, 10, 12);
    const store = createProgressStore({ db, now: () => current });

    await store.recordRoundFinished({});
    current = new Date(2026, 5, 11, 12);
    await store.recordRoundFinished({});

    const summary = await store.getSummary();
    expect(summary.streak).toBe(2);
    db.close();
  });

  it('the summary shows the streak the day after the last round, and 0 two days after (E16)', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    let current = new Date(2026, 5, 10, 12);
    const store = createProgressStore({ db, now: () => current });

    await store.recordRoundFinished({});

    current = new Date(2026, 5, 11, 9);
    expect((await store.getSummary()).streak).toBe(1);

    current = new Date(2026, 5, 12, 9);
    expect((await store.getSummary()).streak).toBe(0);
    db.close();
  });

  it('sprintBest keeps the maximum of 12, 17 and 9', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordRoundFinished({ sprintScore: 12 });
    await store.recordRoundFinished({ sprintScore: 17 });
    await store.recordRoundFinished({ sprintScore: 9 });

    const summary = await store.getSummary();
    expect(summary.sprintBest).toBe(17);
    db.close();
  });
});
