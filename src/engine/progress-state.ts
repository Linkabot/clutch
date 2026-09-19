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
// trigger a redundant re-read. recordAnswer resolves to the progress
// store's own result (collectedNow/lostNow) once that refresh has
// completed. getSprintChoices/setSprintChoices (Q10) pass straight through
// to the progress store; screens reach them only through this store, since
// Dexie is never touched directly by a screen. The first call to load()
// registers, once and only when document exists, a visibilitychange
// listener that calls load() whenever the app becomes visible (e.g. an
// iPhone resuming a suspended home-screen app) -- the listener itself does
// no day check; load() does that, so a same-day resume reads nothing.
// Consumed by the Signs browser and sign page (collected count, per-sign
// correct map), the Practice header (streak, XP), and Sign Sprint /
// tap-the-sign / Match Pairs (recordAnswer, recordRoundFinished).
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
import {
  createProgressStore,
  type AnswerResult,
  type ProgressSummary,
  type RoundFinishedOptions,
  type SprintChoices,
} from './progress-store';

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProgressState {
  summary: ProgressSummary;
  signProgress: Map<string, number>;
  status: ProgressStatus;
  /** Loads the summary and per-sign progress. Idempotent within a local day: concurrent calls share the in-flight load, a rejection is forgotten so a retry can succeed, and a call once a new local day has begun reads again. */
  load: () => Promise<void>;
  recordAnswer: (signId: string, correct: boolean) => Promise<AnswerResult>;
  recordRoundFinished: (options?: RoundFinishedOptions) => Promise<void>;
  getSprintChoices: () => Promise<SprintChoices>;
  setSprintChoices: (choices: SprintChoices) => Promise<void>;
}

const ZERO_SUMMARY: ProgressSummary = {
  xp: 0,
  streak: 0,
  sprintBest: 0,
  sprintBests: { '30s': 0, '1m': 0, '5m': 0, none: 0 },
  collected: 0,
  lastPlayed: { tap: null, sprint: null, pairs: null },
  sprintLast: null,
};

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
    const result = await progressStore.recordAnswer(signId, correct);
    await refresh();
    inFlightDay = localDayKey(now());
    return result;
  },

  async recordRoundFinished(options) {
    await progressStore.recordRoundFinished(options);
    await refresh();
    inFlightDay = localDayKey(now());
  },

  async getSprintChoices() {
    return progressStore.getSprintChoices();
  },

  async setSprintChoices(choices) {
    await progressStore.setSprintChoices(choices);
  },
}));
