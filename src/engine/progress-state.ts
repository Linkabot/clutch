// Zustand store wrapping the progress engine (./progress-store) over the
// default Dexie database, so screens read XP/streak/sprintBest/collection
// and record game results without touching Dexie directly. Never touches
// IndexedDB at import time: state loads lazily, the first time a screen
// calls load(). Consumed by the Signs browser and sign page (collected
// count, per-sign correct map), the Practice header (streak, XP), and
// Sign Sprint / tap-the-sign / Match Pairs (recordAnswer,
// recordRoundFinished) from Step 19 onward.
// Depends on: zustand, ./progress-store, ../storage/db.
// Depended on by: game and progress-display screens (Step 19 onward).

import { create } from 'zustand';
import { db } from '../storage/db';
import { createProgressStore, type ProgressSummary } from './progress-store';

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProgressState {
  summary: ProgressSummary;
  signProgress: Map<string, number>;
  status: ProgressStatus;
  /** Loads the summary and per-sign progress. Idempotent: concurrent calls share the in-flight load, and a rejection is forgotten so a retry can succeed. */
  load: () => Promise<void>;
  recordAnswer: (signId: string, correct: boolean) => Promise<void>;
  recordRoundFinished: (options?: { sprintScore?: number }) => Promise<void>;
}

const ZERO_SUMMARY: ProgressSummary = { xp: 0, streak: 0, sprintBest: 0, collected: 0 };

const progressStore = createProgressStore({ db, now: () => new Date() });

let inFlightLoad: Promise<void> | undefined;

async function refresh(): Promise<void> {
  const [summary, signProgress] = await Promise.all([
    progressStore.getSummary(),
    progressStore.getSignProgress(),
  ]);
  useProgressStore.setState({ summary, signProgress, status: 'ready' });
}

export const useProgressStore = create<ProgressState>((set) => ({
  summary: ZERO_SUMMARY,
  signProgress: new Map(),
  status: 'idle',

  load() {
    if (!inFlightLoad) {
      set({ status: 'loading' });
      inFlightLoad = refresh().catch((error: unknown) => {
        inFlightLoad = undefined;
        set({ status: 'error' });
        throw error;
      });
    }
    return inFlightLoad;
  },

  async recordAnswer(signId, correct) {
    await progressStore.recordAnswer(signId, correct);
    await refresh();
  },

  async recordRoundFinished(options) {
    await progressStore.recordRoundFinished(options);
    await refresh();
  },
}));
