// Zustand store wrapping the progress engine (./progress-store) over the
// default Dexie database, so screens read XP/streak/sprintBest/collection
// and record game results without touching Dexie directly. Never touches
// IndexedDB at import time: state loads lazily, the first time a screen
// calls load(). load() re-reads only when the local day (./progress's
// localDayKey) has changed since the read it is sharing started, so a
// same-day call is free; a new-day re-read keeps the old summary and
// status 'ready' on screen until the new one arrives, rather than
// flashing 'loading' (which would blank the Signs browser's and sign
// page's collection dots, both gated on status === 'ready'). recordAnswer
// and recordRoundFinished count their own write as that day's read once
// their refresh() resolves, so a write just after midnight does not also
// trigger a redundant re-read. The first call to load() registers, once
// and only when document exists, a visibilitychange listener that calls
// load() whenever the app becomes visible (e.g. an iPhone resuming a
// suspended home-screen app) -- the listener itself does no day check;
// load() does that, so a same-day resume reads nothing. Consumed by the
// Signs browser and sign page (collected count, per-sign correct map),
// the Practice header (streak, XP), and Sign Sprint / tap-the-sign /
// Match Pairs (recordAnswer, recordRoundFinished).
// Depends on: zustand, ./progress (localDayKey), ./progress-store,
// ../storage/db.
// Depended on by: tests/unit/progress-state.test.ts,
// src/features/learn/LearnScreen.tsx,
// src/features/practice/PracticeScreen.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/signs/SignScreen.tsx, src/features/signs/SignsScreen.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// tests/unit/match-pairs.test.tsx, tests/unit/sign-sprint.test.tsx.

import { create } from 'zustand';
import { db } from '../storage/db';
import { localDayKey } from './progress';
import { createProgressStore, type ProgressSummary } from './progress-store';

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProgressState {
  summary: ProgressSummary;
  signProgress: Map<string, number>;
  status: ProgressStatus;
  /** Loads the summary and per-sign progress. Idempotent within a local day: concurrent calls share the in-flight load, a rejection is forgotten so a retry can succeed, and a call once a new local day has begun reads again. */
  load: () => Promise<void>;
  recordAnswer: (signId: string, correct: boolean) => Promise<void>;
  recordRoundFinished: (options?: { sprintScore?: number }) => Promise<void>;
}

const ZERO_SUMMARY: ProgressSummary = { xp: 0, streak: 0, sprintBest: 0, collected: 0 };

const now = (): Date => new Date();

const progressStore = createProgressStore({ db, now });

let inFlightLoad: Promise<void> | undefined;
let inFlightDay: string | undefined;
let visibilityListenerRegistered = false;

async function refresh(): Promise<void> {
  const [summary, signProgress] = await Promise.all([
    progressStore.getSummary(),
    progressStore.getSignProgress(),
  ]);
  useProgressStore.setState({ summary, signProgress, status: 'ready' });
}

/**
 * Registers, once and only when `document` exists, a listener that calls
 * load() again on becoming visible. The listener does no day check itself
 * -- load() decides whether that call actually reads anything.
 */
function registerVisibilityListener(): void {
  if (visibilityListenerRegistered || typeof document === 'undefined') return;
  visibilityListenerRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useProgressStore
        .getState()
        .load()
        .catch(() => {});
    }
  });
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  summary: ZERO_SUMMARY,
  signProgress: new Map(),
  status: 'idle',

  load() {
    registerVisibilityListener();
    const today = localDayKey(now());
    if (inFlightLoad && inFlightDay !== today) {
      inFlightLoad = undefined;
    }
    if (!inFlightLoad) {
      inFlightDay = today;
      if (get().status !== 'ready') {
        set({ status: 'loading' });
      }
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
    inFlightDay = localDayKey(now());
  },

  async recordRoundFinished(options) {
    await progressStore.recordRoundFinished(options);
    await refresh();
    inFlightDay = localDayKey(now());
  },
}));
