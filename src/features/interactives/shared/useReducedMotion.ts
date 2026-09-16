// useReducedMotion(): true when the OS/browser asks for reduced motion
// (prefers-reduced-motion: reduce), kept live via useSyncExternalStore so a
// change while the app is open (or a test flipping the stubbed
// MediaQueryList) re-renders. Returns false wherever window or
// window.matchMedia is unavailable (SSR, or a jsdom test that has not
// stubbed matchMedia), so components built on this hook still render there.
// Depends on: react (useSyncExternalStore).
// Depended on by: tests/unit/interactives-render.test.tsx (later: every
// animated interactive -- quiz-sheet, sign-sprint, match-pairs, decoder --
// Steps 22, 24-26).

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener('change', onChange);
  return () => mediaQueryList.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when the OS/browser asks for reduced motion; false where matchMedia is unavailable. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
