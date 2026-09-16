/**
 * @vitest-environment jsdom
 *
 * Render test (via @testing-library/react + jsdom) for ProgressHeader, the
 * Practice tab's day-streak/XP header card. No @testing-library/jest-dom
 * matchers are available (only @testing-library/react and jsdom were added
 * -- see tests/unit/interactives-render.test.tsx's header), so assertions
 * read the DOM directly. Per amendment E20, this also proves the streak
 * number and the XP number cannot be silently swapped: each label's closest
 * .practice-header__stat wrapper is asserted to hold only its own number.
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * src/features/practice/ProgressHeader.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProgressHeader from '../../src/features/practice/ProgressHeader';

afterEach(() => {
  cleanup();
});

describe('ProgressHeader', () => {
  it('renders the streak number and label, and the XP number and label', () => {
    render(<ProgressHeader streak={5} xp={340} />);

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('day streak')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(screen.getByText('XP earned')).toBeTruthy();
  });

  it('keeps the streak number inside the day-streak stat, and the XP number inside the XP stat (amendment E20: a swapped prop must fail this)', () => {
    render(<ProgressHeader streak={5} xp={340} />);

    const streakStat = screen.getByText('day streak').closest('.practice-header__stat');
    const xpStat = screen.getByText('XP earned').closest('.practice-header__stat');

    expect(streakStat).not.toBeNull();
    expect(xpStat).not.toBeNull();
    expect(streakStat!.textContent).toContain('5');
    expect(streakStat!.textContent).not.toContain('340');
    expect(xpStat!.textContent).toContain('340');
    expect(xpStat!.textContent).not.toContain('5');
  });
});
