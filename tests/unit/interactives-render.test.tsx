/**
 * @vitest-environment jsdom
 *
 * Render tests (via @testing-library/react + jsdom) for the shared
 * components later games and screens build on: SignImage,
 * useReducedMotion and GameTopBar -- including the bar's right-hand slot,
 * which holds a game's label by default and a button when that game passes
 * an action instead (Sign Sprint's Finish; plan.md Step 10, amendment
 * E23 (g)). No @testing-library/jest-dom matchers
 * are available (only @testing-library/react and jsdom were added), so
 * assertions read attributes/classes off the DOM directly. Vitest itself
 * hard-codes `base: '/'` in its own Vite plugins (overriding
 * vite.config.ts's `base: '/clutch/'`, which otherwise only applies to
 * `vite build`/`vite dev`/Playwright's built preview server), so the
 * SignImage test stubs import.meta.env.BASE_URL with vi.stubEnv to prove
 * SignImage actually reads it (signImageUrl) rather than hard-coding a
 * leading slash.
 * Depends on: vitest, @testing-library/react (incl. act), jsdom (test
 * environment),
 * src/features/interactives/shared/{SignImage,useReducedMotion,GameTopBar},
 * src/content/schemas/index.ts (types).
 * Depended on by: `npm test` (Vitest run).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, renderHook, screen, fireEvent } from '@testing-library/react';
import type { Sign } from '../../src/content/schemas';
import SignImage from '../../src/features/interactives/shared/SignImage';
import { useReducedMotion } from '../../src/features/interactives/shared/useReducedMotion';
import GameTopBar from '../../src/features/interactives/shared/GameTopBar';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const crossroads: Sign = {
  id: 'warning-crossroads',
  name: 'Crossroads.',
  meaning: 'Crossroads.',
  family: 'warning',
  shape: 'triangle',
  colours: ['red'],
  rule: 'C2',
  hookId: null,
  image: 'signs/warning/crossroads.svg',
  refs: [{ kind: 'section', slug: 'traffic-signs' }],
  licence: 'Open Government Licence v3.0',
  source: {
    chapterSlug: 'warning-signs',
    chapterUrl: 'https://www.gov.uk/government/publications/know-your-traffic-signs/warning-signs',
    imageUrl: 'https://assets.publishing.service.gov.uk/media/x/crossroads.svg',
    subHeading: 'Junctions',
  },
};

/**
 * Stubs window.matchMedia with a MediaQueryList-shaped object whose
 * `addEventListener('change', …)` call is captured, so a test can flip
 * `matches` and fire the captured listener itself (inside act) to prove
 * useReducedMotion's live subscription actually re-renders.
 */
function stubMatchMedia(initialMatches: boolean) {
  let changeListener: (() => void) | null = null;
  // A plain mutable holder for `matches`, read through a getter below --
  // the DOM lib's MediaQueryList declares `matches` readonly, so a stub
  // typed as MediaQueryList cannot have it reassigned directly.
  const state = { matches: initialMatches };
  const mediaQueryList = {
    get matches() {
      return state.matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'change') changeListener = listener;
    },
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
  const matchMediaMock = vi.fn().mockReturnValue(mediaQueryList);
  vi.stubGlobal('matchMedia', matchMediaMock);

  return {
    matchMediaMock,
    fireChange(matches: boolean) {
      state.matches = matches;
      changeListener?.();
    },
  };
}

describe('SignImage', () => {
  it('renders one img with src /clutch/signs/warning/crossroads.svg and the alt prop passed', () => {
    // Stubbed to the app's real base (Vitest itself defaults BASE_URL to
    // '/' -- see the header comment) so this proves SignImage builds its
    // src from BASE_URL rather than hard-coding a leading slash.
    vi.stubEnv('BASE_URL', '/clutch/');
    const { container } = render(<SignImage sign={crossroads} alt="Option A" />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/clutch/signs/warning/crossroads.svg');
    expect(images[0].getAttribute('alt')).toBe('Option A');
  });
});

describe('useReducedMotion', () => {
  it('returns true under a stubbed matchMedia that matches', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns false under a stubbed matchMedia that does not match', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('calls matchMedia with the reduced-motion query, and re-renders live on a change event', () => {
    const { matchMediaMock, fireChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());

    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });

    expect(result.current).toBe(true);
  });
});

describe('GameTopBar', () => {
  it('calls its handler when the Close button is tapped', () => {
    const onClose = vi.fn();
    render(<GameTopBar progress={0.6} label="6/10" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps progress above 1 to aria-valuenow 1', () => {
    render(<GameTopBar progress={1.4} label="0:42" onClose={() => {}} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
  });

  it('clamps progress below 0 to aria-valuenow 0', () => {
    render(<GameTopBar progress={-0.2} label="0:42" onClose={() => {}} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('renders its label text', () => {
    render(<GameTopBar progress={0.5} label="0:42" onClose={() => {}} />);
    expect(screen.getByText('0:42')).toBeTruthy();
  });

  it('renders an action button in place of the label, and calls its handler', () => {
    const onClick = vi.fn();
    const { container } = render(
      <GameTopBar
        progress={1}
        label="0:42"
        action={{ label: 'Finish', onClick }}
        onClose={() => {}}
      />,
    );

    // The label is not rendered at all when an action is given (E23 (g)).
    expect(container.querySelector('.game-top-bar__label')).toBeNull();
    expect(screen.queryByText('0:42')).toBeNull();
    const button = screen.getByRole('button', { name: 'Finish' });
    expect(button.className).toContain('game-top-bar__action');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders its label, and no button, when no action is given', () => {
    const { container } = render(<GameTopBar progress={0.5} label="6/10" onClose={() => {}} />);

    expect(container.querySelector('.game-top-bar__action')).toBeNull();
    expect(container.querySelector('.game-top-bar__label')?.textContent).toBe('6/10');
    // Only the Close button: Tap the sign's and Match Pairs' bars are unchanged.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('applies the ink label class when labelTone is "ink", and the muted class by default', () => {
    const { rerender, container } = render(
      <GameTopBar progress={0.5} label="0:42" labelTone="ink" onClose={() => {}} />,
    );
    expect(container.querySelector('.game-top-bar__label--ink')).not.toBeNull();
    expect(container.querySelector('.game-top-bar__label--muted')).toBeNull();

    rerender(<GameTopBar progress={0.5} label="6/10" onClose={() => {}} />);
    expect(container.querySelector('.game-top-bar__label--muted')).not.toBeNull();
    expect(container.querySelector('.game-top-bar__label--ink')).toBeNull();
  });
});
