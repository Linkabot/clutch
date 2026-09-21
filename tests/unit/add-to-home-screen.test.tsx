/**
 * @vitest-environment jsdom
 *
 * Render tests for the rebuilt Add to Home Screen panel (plan.md Step 11,
 * amendment E25 (g), M01): "Not now" writes platform.DISMISSED_KEY by
 * default (App.tsx's first-visit use), but leaves storage alone when the
 * caller passes persistDismissal={false} (MeScreen's own row, which must
 * never touch the stored dismissal) -- either way onDismiss is called; and
 * the three steps render in order with their own words unchanged.
 * jsdom's localStorage outlives a test case, so every case here starts
 * from a cleared store.
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * src/app/platform (DISMISSED_KEY), src/app/AddToHomeScreen.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DISMISSED_KEY } from '../../src/app/platform';
import AddToHomeScreen from '../../src/app/AddToHomeScreen';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('AddToHomeScreen', () => {
  it('Not now stores the dismissal by default', () => {
    const onDismiss = vi.fn();
    render(<AddToHomeScreen onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Not now leaves storage alone when persistDismissal is false', () => {
    const onDismiss = vi.fn();
    render(<AddToHomeScreen onDismiss={onDismiss} persistDismissal={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('lists the three steps in order', () => {
    render(<AddToHomeScreen onDismiss={() => {}} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual([
      'Tap the Share button',
      'Tap "Add to Home Screen"',
      'Tap Add',
    ]);
  });

  it('Not now is a secondary button', () => {
    render(<AddToHomeScreen onDismiss={() => {}} />);

    const notNow = screen.getByRole('button', { name: 'Not now' });
    expect(notNow.className.split(' ')).toContain('button--secondary');
    expect(notNow.className.split(' ')).not.toContain('button--primary');
  });
});
