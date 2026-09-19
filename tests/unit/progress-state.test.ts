/**
 * @vitest-environment jsdom
 *
 * Unit tests for the progress Zustand store's local-day read cache
 * (plan.md amendment E44, Step 29b, review finding F5): a same-day load()
 * call performs no read; a call once the local day has changed re-reads
 * (and shares one promise across concurrent same-day callers); a pending
 * new-day read keeps the previous summary and a 'ready' status on screen
 * rather than flashing 'loading'; a rejected read is forgotten so a retry
 * can succeed; and the visibilitychange listener the first load() call
 * registers calls load() again on becoming visible, relying on load()'s own
 * day check to decide whether that call actually reads anything.
 * ../../src/storage/db and ../../src/engine/progress-store are mocked; the
 * fake progress-store counts its own getSummary calls and can hold a read
 * open behind a manually released gate. Only Date is faked, at local-noon
 * system times, so the real microtask queue still drives the store's own
 * promises. Each test calls `vi.resetModules()` and dynamically imports the
 * module under test, for a fresh set of its module-level variables; jsdom's
 * `document` (and any visibilitychange listener an earlier test's module
 * instance added to it) outlives `vi.resetModules()`, but each module
 * instance captures its own fake store at import time, so a leftover
 * listener from an earlier test only ever reads that earlier test's store,
 * never the current test's -- hence every test asserts only its own store's
 * read count. Two further tests (Step 5, E8) check that recordAnswer's
 * result and the Sprint choices helpers pass straight through to the
 * fake store, untouched.
 * Depends on: vitest, jsdom (test environment), a mock of
 * src/storage/db and src/engine/progress-store, src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AnswerResult,
  ProgressStore,
  ProgressSummary,
  SprintChoices,
} from '../../src/engine/progress-store';

interface FakeStore extends ProgressStore {
  reads: number;
  summary: ProgressSummary;
  gate: Promise<void> | null;
  failNext: boolean;
  answerResult: AnswerResult;
  sprintChoices: SprintChoices;
  setSprintChoicesCalls: SprintChoices[];
}

/** Fills every ProgressSummary field with a zero default, overridden by `overrides`. */
function summaryFixture(overrides: Partial<ProgressSummary> = {}): ProgressSummary {
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

function makeFakeStore(summary: ProgressSummary): FakeStore {
  const store: FakeStore = {
    reads: 0,
    summary,
    gate: null,
    failNext: false,
    answerResult: { collectedNow: false, lostNow: false },
    sprintChoices: { length: '1m', families: [] },
    setSprintChoicesCalls: [],
    async getSummary() {
      store.reads += 1;
      if (store.gate) await store.gate;
      if (store.failNext) {
        store.failNext = false;
        throw new Error('read failed');
      }
      return store.summary;
    },
    async getSignProgress() {
      if (store.gate) await store.gate;
      return new Map();
    },
    async recordAnswer() {
      return store.answerResult;
    },
    async recordRoundFinished() {},
    async getSprintChoices() {
      return store.sprintChoices;
    },
    async setSprintChoices(choices) {
      store.setSprintChoicesCalls.push(choices);
    },
  };
  return store;
}

/** Holds the store's current and next reads open until the returned function releases them. */
function holdRead(store: FakeStore): () => void {
  let release: () => void = () => {};
  store.gate = new Promise((resolve) => {
    release = resolve;
  });
  return () => {
    release();
    store.gate = null;
  };
}

/** Lets the real microtask queue drain -- only Date is faked, so this is a real timer. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const state = vi.hoisted(() => ({ store: undefined as FakeStore | undefined }));

vi.mock('../../src/storage/db', () => ({ db: {} }));

vi.mock('../../src/engine/progress-store', () => ({
  createProgressStore: () => {
    if (!state.store) throw new Error('no fake store set for this test');
    return state.store;
  },
}));

const DAY_ONE = new Date(2026, 8, 18, 12);
const DAY_TWO = new Date(2026, 8, 19, 12);

async function freshStore(summary: ProgressSummary) {
  const store = makeFakeStore(summary);
  state.store = store;
  vi.resetModules();
  const mod = await import('../../src/engine/progress-state');
  return { store, useProgressStore: mod.useProgressStore };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  state.store = undefined;
});

describe('progress-state local-day read cache', () => {
  it('reads once per day', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture({ xp: 10, streak: 1 }));

    await useProgressStore.getState().load();
    await useProgressStore.getState().load();

    expect(store.reads).toBe(1);
  });

  it('re-reads after the local day changes', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture({ xp: 10, streak: 1 }));
    await useProgressStore.getState().load();
    expect(store.reads).toBe(1);

    vi.setSystemTime(DAY_TWO);
    store.summary = summaryFixture({ xp: 20, streak: 2, collected: 1 });
    await Promise.all([useProgressStore.getState().load(), useProgressStore.getState().load()]);

    expect(store.reads).toBe(2);
    expect(useProgressStore.getState().summary).toEqual(store.summary);
  });

  it('keeps the old summary on screen', async () => {
    vi.setSystemTime(DAY_ONE);
    const oldSummary: ProgressSummary = summaryFixture({ xp: 10, streak: 1 });
    const { store, useProgressStore } = await freshStore(oldSummary);
    await useProgressStore.getState().load();
    expect(useProgressStore.getState().status).toBe('ready');

    vi.setSystemTime(DAY_TWO);
    const release = holdRead(store);
    store.summary = summaryFixture({ xp: 20, streak: 2, collected: 1 });
    const pending = useProgressStore.getState().load();

    expect(useProgressStore.getState().status).toBe('ready');
    expect(useProgressStore.getState().summary).toEqual(oldSummary);

    release();
    await pending;
    expect(useProgressStore.getState().summary).toEqual(store.summary);
  });

  it('becoming visible on a new day re-reads', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture({ xp: 10, streak: 1 }));
    await useProgressStore.getState().load();
    expect(store.reads).toBe(1);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    // Same day: becoming visible reads nothing.
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsync();
    expect(store.reads).toBe(1);

    // A new day: becoming visible re-reads.
    vi.setSystemTime(DAY_TWO);
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsync();
    expect(store.reads).toBe(2);
  });

  it('a failed load is forgotten', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture({ xp: 10, streak: 1 }));
    store.failNext = true;

    await expect(useProgressStore.getState().load()).rejects.toThrow('read failed');
    expect(useProgressStore.getState().status).toBe('error');

    await useProgressStore.getState().load();

    expect(useProgressStore.getState().status).toBe('ready');
    expect(store.reads).toBe(2);
  });

  it('recordAnswer passes the store result through', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture());
    store.answerResult = { collectedNow: true, lostNow: false };

    const result = await useProgressStore.getState().recordAnswer('x', true);

    expect(result).toEqual({ collectedNow: true, lostNow: false });
  });

  it('sprint choices pass through to the store', async () => {
    vi.setSystemTime(DAY_ONE);
    const { store, useProgressStore } = await freshStore(summaryFixture());
    store.sprintChoices = { length: '5m', families: ['warning'] };

    const choices = await useProgressStore.getState().getSprintChoices();
    expect(choices).toEqual({ length: '5m', families: ['warning'] });

    const next: SprintChoices = { length: '30s', families: [] };
    await useProgressStore.getState().setSprintChoices(next);
    expect(store.setSprintChoicesCalls).toEqual([next]);
  });
});
