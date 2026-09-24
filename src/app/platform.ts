// Pure, injectable platform-detection helpers (standalone display mode, iOS
// user agent sniffing, and the "show Add to Home Screen panel" decision),
// plus a readPlatform() wrapper that reads the real window/localStorage.
// Kept pure so tests/unit/platform.test.ts can exercise the logic with
// plain data, never a real window (the vitest environment is 'node').
// Depends on: nothing beyond the DOM lib types.
// Depended on by: src/app/App.tsx, src/app/AddToHomeScreen.tsx,
// src/features/me/MeScreen.tsx, tests/unit/platform.test.ts,
// tests/unit/add-to-home-screen.test.tsx, tests/unit/me-screen.test.tsx,
// tests/e2e/foundations.spec.ts.

/** localStorage key used to remember that the user dismissed the panel. */
export const DISMISSED_KEY = 'clutch.a2hs.dismissed';

export interface IsStandaloneInput {
  matchMedia: (query: string) => { matches: boolean };
  navigatorStandalone?: boolean;
}

/** True when the app is already running installed/full-screen. */
export function isStandalone({ matchMedia, navigatorStandalone }: IsStandaloneInput): boolean {
  return matchMedia('(display-mode: standalone)').matches || navigatorStandalone === true;
}

/** True for iPhone/iPad/iPod user agents. */
export function isIos(userAgent: string): boolean {
  return /iPhone|iPad|iPod/.test(userAgent);
}

export interface ShouldShowAddToHomeScreenInput {
  ios: boolean;
  standalone: boolean;
  dismissed: boolean;
}

/** True only when on iOS, not already installed, and not previously dismissed. */
export function shouldShowAddToHomeScreen({
  ios,
  standalone,
  dismissed,
}: ShouldShowAddToHomeScreenInput): boolean {
  return ios && !standalone && !dismissed;
}

export interface Platform {
  ios: boolean;
  standalone: boolean;
  dismissed: boolean;
}

/** Reads the real browser environment; never used from unit tests. */
export function readPlatform(): Platform {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ios = isIos(nav.userAgent);
  const standalone = isStandalone({
    matchMedia: (query) => window.matchMedia(query),
    navigatorStandalone: nav.standalone,
  });
  const dismissed = window.localStorage.getItem(DISMISSED_KEY) === '1';
  return { ios, standalone, dismissed };
}
