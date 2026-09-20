/**
 * @vitest-environment jsdom
 *
 * Unit tests for the picture games' VoiceOver note (Q8, plan.md Step 9):
 * the live region is a .visually-hidden paragraph that is EMPTY at mount --
 * the delay is what makes aria-live announce it rather than have it read as
 * part of the page -- and holds Q8's sentence verbatim 500 ms later; a
 * component unmounted inside that window never fills it, because the timer
 * is cleared.
 *
 * Fake timers, deliberately: this file is the one exception to the rule
 * tests/unit/match-pairs.test.tsx's header records ("jsdom, real timers --
 * never fake timers, whose timers @testing-library's waitFor does not
 * see"), because a real 500 ms wait per case is pure dead time. The rule is
 * respected by never combining the two: the clock is advanced inside
 * act(() => vi.advanceTimersByTime(...)) and every assertion afterwards is
 * synchronous, with no waitFor anywhere (amendment E16 (continued) (z)).
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * src/features/interactives/shared/VisualGameNote (the component, its
 * ANNOUNCE_DELAY_MS and its VISUAL_GAME_NOTE sentence).
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import VisualGameNote, {
  ANNOUNCE_DELAY_MS,
  VISUAL_GAME_NOTE,
} from '../../src/features/interactives/shared/VisualGameNote';

function note(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('p.visually-hidden');
  if (!element) throw new Error('no .visually-hidden note');
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('VisualGameNote', () => {
  it('renders an empty polite live region at mount', () => {
    const { container } = render(<VisualGameNote />);
    expect(ANNOUNCE_DELAY_MS).toBe(500);
    const live = note(container);
    expect(live.textContent).toBe('');
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('holds Q8 sentence 500 ms later, and nothing at 499 ms', () => {
    const { container } = render(<VisualGameNote />);

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1);
    });
    expect(note(container).textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(note(container).textContent).toBe(
      "This game is visual. The sign pages have every sign's name and meaning.",
    );
    expect(note(container).textContent).toBe(VISUAL_GAME_NOTE);
  });

  it('clears its timer on unmount, so an unmounted note never fills', () => {
    const { container, unmount } = render(<VisualGameNote />);
    const live = note(container);
    unmount();

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS * 2);
    });
    expect(live.textContent).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});
