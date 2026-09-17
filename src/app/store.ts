// Global app state (Zustand): service-worker status and standalone-display
// detection, both set by PWA/platform wiring added in a later step.
// Depends on: zustand.
// Depended on by: src/app/pwa.ts, src/features/me/OfflineReady.tsx,
// tests/unit/store.test.ts.

import { create } from 'zustand';

export type SwStatus = 'unsupported' | 'registering' | 'ready' | 'error';

export interface AppState {
  swStatus: SwStatus;
  isStandalone: boolean;
  setSwStatus: (swStatus: SwStatus) => void;
  setStandalone: (isStandalone: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  swStatus: 'registering',
  isStandalone: false,
  setSwStatus: (swStatus) => set({ swStatus }),
  setStandalone: (isStandalone) => set({ isStandalone }),
}));
