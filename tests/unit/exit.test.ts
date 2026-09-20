/**
 * @vitest-environment jsdom
 *
 * Unit tests for where leaving a game goes (Q19, plan.md Step 9). The pure
 * side: exitTarget returns -1 when window.history has a prior in-app entry
 * (idx > 0) and otherwise the path of the tab that owns the route -- so
 * /practice/tap and /practice/pairs both fall back to /practice, whether
 * the index is 0 (a page.goto or a reload) or undefined (a cold deep link).
 * The hook side: useExitGame, rendered under a MemoryRouter whose stack
 * holds a sign page below the game, goes BACK to that sign page when
 * window.history.state.idx says there is one, and lands on /practice when
 * there is not -- the two outcomes a stub that always did one or the other
 * could not both pass (amendment E16 (continued) (s)). The router is built
 * with createElement rather than JSX so this file can stay a .ts test.
 * Depends on: vitest, @testing-library/react, react, react-router-dom,
 * jsdom (test environment),
 * src/features/interactives/shared/exit (exitTarget, useExitGame).
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { exitTarget, useExitGame } from '../../src/features/interactives/shared/exit';

const SIGN_PAGE = '/learn/signs/warning-slippery-road';

/** A button that calls useExitGame(), so a click exercises the whole hook. */
function ExitButton() {
  const exitGame = useExitGame();
  return createElement('button', { type: 'button', onClick: exitGame }, 'Leave');
}

/** Renders `ExitButton` at `gamePath`, with the sign page below it in the stack. */
function renderGame(gamePath: string): void {
  const routes: ReactNode[] = [
    createElement(Route, { key: 'game', path: gamePath, element: createElement(ExitButton) }),
    createElement(Route, {
      key: 'sign',
      path: SIGN_PAGE,
      element: createElement('p', null, 'Sign page'),
    }),
    createElement(Route, {
      key: 'practice',
      path: '/practice',
      element: createElement('p', null, 'Practice tab'),
    }),
  ];
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [SIGN_PAGE, gamePath], initialIndex: 1 },
      createElement(Routes, null, routes),
    ),
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

describe('exitTarget', () => {
  it('returns -1 when the game was opened from another in-app screen', () => {
    expect(exitTarget('/practice/tap', 1)).toBe(-1);
    expect(exitTarget('/practice/pairs', 4)).toBe(-1);
  });

  it('returns /practice for a game opened cold, at index 0 or with no index', () => {
    expect(exitTarget('/practice/tap', 0)).toBe('/practice');
    expect(exitTarget('/practice/tap', undefined)).toBe('/practice');
    expect(exitTarget('/practice/pairs', undefined)).toBe('/practice');
  });
});

describe('useExitGame', () => {
  it('goes back to the in-app screen the game was opened from', () => {
    window.history.replaceState({ idx: 1 }, '');
    renderGame('/practice/tap');
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Sign page')).toBeTruthy();
  });

  it('lands on Practice when there is no in-app entry to go back to', () => {
    renderGame('/practice/tap');
    expect(window.history.state).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Practice tab')).toBeTruthy();
  });
});
