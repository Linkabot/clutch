// Unit tests for the progress store (src/engine/progress-store.ts) and the
// Dexie version-1 to version-2 upgrade (src/storage/db.ts), run against
// fake-indexeddb so no browser is needed. Each test opens its own database
// name on a fresh IDBFactory, so tests never share state. The injected clock
// uses local-noon dates, which give the same day key in any time zone.
// Covers the wrong-in-a-row collection-loss rule (Q12, including a row
// shaped as it was written before Phase 2b, with no wrongInARow field),
// per-length Sign Sprint bests and the last Sprint round (Q10, Q18),
// lastPlayed per game (Q17) and the Sprint choices settings row (Q10).
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

  it('a collected row written before Phase 2b (no wrongInARow field) is lost after three wrong answers', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });
    await db.signProgress.put({ signId: 'warning-bend', correct: 3 });
    expect((await store.getSummary()).collected).toBe(1);

    await store.recordAnswer('warning-bend', false);
    await store.recordAnswer('warning-bend', false);
    const third = await store.recordAnswer('warning-bend', false);

    expect((await store.getSummary()).collected).toBe(0);
    expect(third.lostNow).toBe(true);
    db.close();
  });

  it('collect a sign, answer wrong three times: collected drops by one and the third call returns lostNow: true', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    expect((await store.getSummary()).collected).toBe(1);

    await store.recordAnswer('warning-bend', false);
    await store.recordAnswer('warning-bend', false);
    const third = await store.recordAnswer('warning-bend', false);

    const summary = await store.getSummary();
    expect(summary.collected).toBe(0);
    expect(summary.xp).toBe(30);
    expect(third.lostNow).toBe(true);
    db.close();
  });

  it('after a loss, three right answers collect it again', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', false);
    await store.recordAnswer('warning-bend', false);
    await store.recordAnswer('warning-bend', false);
    expect((await store.getSummary()).collected).toBe(0);

    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    const result = await store.recordAnswer('warning-bend', true);

    expect(result.collectedNow).toBe(true);
    expect((await store.getSummary()).collected).toBe(1);
    db.close();
  });

  it('wrong answers on a sign not yet collected never lose it', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    const w1 = await store.recordAnswer('warning-bend', false);
    const w2 = await store.recordAnswer('warning-bend', false);
    const w3 = await store.recordAnswer('warning-bend', false);
    expect([w1, w2, w3]).toEqual([
      { collectedNow: false, lostNow: false },
      { collectedNow: false, lostNow: false },
      { collectedNow: false, lostNow: false },
    ]);
    expect((await store.getSignProgress()).get('warning-bend')).toBeUndefined();

    await store.recordAnswer('warning-bend', true);
    await store.recordAnswer('warning-bend', true);
    const r1 = await store.recordAnswer('warning-bend', false);
    const r2 = await store.recordAnswer('warning-bend', false);
    const r3 = await store.recordAnswer('warning-bend', false);

    expect((await store.getSignProgress()).get('warning-bend')).toBe(2);
    expect([r1.lostNow, r2.lostNow, r3.lostNow]).toEqual([false, false, false]);
    db.close();
  });

  it('per-length bests are kept apart and sprintBest equals the 1-minute best', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordRoundFinished({ sprintScore: 3, sprintLength: '30s' });
    await store.recordRoundFinished({ sprintScore: 12, sprintLength: '1m' });
    await store.recordRoundFinished({ sprintScore: 40, sprintLength: '5m' });
    await store.recordRoundFinished({ sprintScore: 2, sprintLength: 'none' });

    const summary = await store.getSummary();
    expect(summary.sprintBests).toEqual({ '30s': 3, '1m': 12, '5m': 40, none: 2 });
    expect(summary.sprintBest).toBe(summary.sprintBests['1m']);
    db.close();
  });

  it('a 1-minute best saved before Phase 2b is still the 1 min best', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });
    await db.progress.put({ key: 'sprintBest', value: 17 });

    const summary = await store.getSummary();
    expect(summary.sprintBests['1m']).toBe(17);
    expect(summary.sprintBest).toBe(17);

    await store.recordRoundFinished({ game: 'sprint', sprintScore: 20, sprintLength: '1m' });
    expect((await db.progress.get('sprintBest'))?.value).toBe(20);
    db.close();
  });

  it('lastPlayed records only the game that finished', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    let current = new Date(2026, 5, 10, 12);
    const store = createProgressStore({ db, now: () => current });

    await store.recordRoundFinished({ game: 'tap' });
    const t1 = current.getTime();
    expect((await store.getSummary()).lastPlayed).toEqual({ tap: t1, sprint: null, pairs: null });

    current = new Date(2026, 5, 11, 12);
    await store.recordRoundFinished({ game: 'sprint' });
    const t2 = current.getTime();

    const lastPlayed = (await store.getSummary()).lastPlayed;
    expect(lastPlayed.tap).toBe(t1);
    expect(lastPlayed.sprint).toBe(t2);
    db.close();
  });

  it('the last Sprint round is remembered with its length and answered count', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    expect((await store.getSummary()).sprintLast).toBeNull();

    await store.recordRoundFinished({
      game: 'sprint',
      sprintScore: 7,
      sprintLength: '30s',
      sprintAnswered: 9,
    });
    expect((await store.getSummary()).sprintLast).toEqual({ score: 7, length: '30s', answered: 9 });

    await store.recordRoundFinished({ game: 'tap' });
    expect((await store.getSummary()).sprintLast).toEqual({ score: 7, length: '30s', answered: 9 });
    db.close();
  });

  it('sprint choices round-trip', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    expect(await store.getSprintChoices()).toEqual({ length: '1m', families: [] });

    await store.setSprintChoices({ length: '5m', families: ['warning', 'orders'] });
    expect(await store.getSprintChoices()).toEqual({
      length: '5m',
      families: ['warning', 'orders'],
    });
    db.close();
  });

  it('an invalid stored length returns the default', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await db.settings.put({ key: 'sprint.choices', value: { length: 'bogus', families: [] } });

    expect(await store.getSprintChoices()).toEqual({ length: '1m', families: [] });
    db.close();
  });

  it('an invalid families array returns the default', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await db.settings.put({ key: 'sprint.choices', value: { length: '1m', families: [1] } });

    expect(await store.getSprintChoices()).toEqual({ length: '1m', families: [] });
    db.close();
  });

  it('the default Sprint choices are a fresh copy each time', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    const first = await store.getSprintChoices();
    first.families.push('warning');

    expect(await store.getSprintChoices()).toEqual({ length: '1m', families: [] });
    db.close();
  });

  it('a Sprint round that scores 0 is still recorded', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });

    await store.recordRoundFinished({
      game: 'sprint',
      sprintScore: 0,
      sprintLength: '30s',
      sprintAnswered: 4,
    });

    expect((await store.getSummary()).sprintLast).toEqual({ score: 0, length: '30s', answered: 4 });
    db.close();
  });

  it('an invalid stored last round reads as null', async () => {
    const db = new ClutchDB(nextDbName(), freshOptions());
    const store = createProgressStore({ db, now: () => new Date(2026, 5, 10, 12) });
    const invalid = [
      { score: '7', length: '1m', answered: 9 },
      { score: 7, length: 'bogus', answered: 9 },
      { score: 7, length: '1m' },
      'not a round',
    ];

    for (const value of invalid) {
      await db.settings.put({ key: 'sprint.lastRound', value });
      expect((await store.getSummary()).sprintLast).toBeNull();
    }
    db.close();
  });
});
