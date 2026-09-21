/**
 * @vitest-environment jsdom
 *
 * Render tests for the Journey tab / Today (plan.md Step 11, amendment E25
 * (c), (d), (i); fold-in E26 (b)): the progress store is loaded on mount;
 * the .today wrapper carries today--pending at 'idle' and 'loading' alike,
 * drops it once the scores are 'ready', and shows the screen anyway (not
 * pending) if the store lands on 'error'; the wrapper also stays pending
 * while the sign catalogue itself is still loading, even once the scores
 * are 'ready'; the streak and XP numbers land in the pill their own label
 * names, never swapped; the Start here card links to and names whichever
 * game startHere() points the loaded summary at; the Traffic signs card
 * links to /learn/signs; and its count line appears once the sign
 * catalogue has loaded, and is left out (title only) if it fails.
 * The progress store is mocked by its path relative to this file, and
 * src/content/signs is mocked partially (importOriginal) so only loadSigns
 * is replaced -- the same shape tests/unit/sprint-start.test.tsx uses.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns), src/content/schemas
 * (Sign type), src/engine/progress-store (ProgressSummary, type only),
 * src/features/journey/JourneyScreen, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import type { ProgressSummary } from '../../src/engine/progress-store';
import JourneyScreen from '../../src/features/journey/JourneyScreen';

const mocks = vi.hoisted(() => ({
  loadSigns: vi.fn<() => Promise<Sign[]>>(),
  load: vi.fn<() => Promise<void>>(),
  status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
  summary: {
    xp: 240,
    streak: 3,
    sprintBest: 0,
    sprintBests: { '30s': 0, '1m': 0, '5m': 0, none: 0 },
    collected: 0,
    lastPlayed: { tap: null, sprint: null, pairs: null },
    sprintLast: null,
  } as ProgressSummary,
}));

vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: mocks.loadSigns };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({ summary: mocks.summary, status: mocks.status, load: mocks.load }),
}));

let signs: Sign[];

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import('../../src/content/signs')>('../../src/content/signs');
  signs = await actual.loadSigns();
});

function renderToday() {
  return render(
    <MemoryRouter>
      <JourneyScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.status = 'ready';
  mocks.summary.collected = 0;
  mocks.summary.lastPlayed = { tap: null, sprint: null, pairs: null };
  mocks.loadSigns.mockReset();
  mocks.loadSigns.mockResolvedValue(signs);
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('JourneyScreen (Today)', () => {
  it('loads the progress store on mount', async () => {
    renderToday();
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
  });

  it('keeps Today hidden until the scores have loaded, and shows it anyway if they fail', async () => {
    mocks.status = 'idle';
    const { container, rerender } = renderToday();
    await screen.findByText('Your journey map arrives in Phase 4');
    expect(container.querySelector('.today')?.className).toContain('today--pending');

    mocks.status = 'loading';
    rerender(
      <MemoryRouter>
        <JourneyScreen />
      </MemoryRouter>,
    );
    expect(container.querySelector('.today')?.className).toContain('today--pending');

    mocks.status = 'ready';
    rerender(
      <MemoryRouter>
        <JourneyScreen />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(container.querySelector('.today')?.className).not.toContain('today--pending'),
    );

    cleanup();
    mocks.status = 'error';
    const errored = renderToday();
    await waitFor(() =>
      expect(errored.container.querySelector('.today')?.className).not.toContain('today--pending'),
    );
  });

  it('stays hidden while the sign catalogue is still loading, even with the scores ready', async () => {
    mocks.status = 'ready';
    let resolveSigns: (value: Sign[]) => void = () => {};
    mocks.loadSigns.mockReset();
    mocks.loadSigns.mockReturnValue(
      new Promise<Sign[]>((resolve) => {
        resolveSigns = resolve;
      }),
    );

    const { container } = renderToday();
    await screen.findByText('Your journey map arrives in Phase 4');
    expect(container.querySelector('.today')?.className).toContain('today--pending');

    resolveSigns(signs);
    await waitFor(() =>
      expect(container.querySelector('.today')?.className).not.toContain('today--pending'),
    );
  });

  it('gives the streak and the XP to the right pills', async () => {
    renderToday();
    await screen.findByText('Your journey map arrives in Phase 4');

    const streakStat = screen.getByText('day streak').closest('.practice-header__stat');
    const xpStat = screen.getByText('XP earned').closest('.practice-header__stat');
    expect(streakStat).not.toBeNull();
    expect(xpStat).not.toBeNull();
    expect(streakStat!.textContent).toContain('3');
    expect(streakStat!.textContent).not.toContain('240');
    expect(xpStat!.textContent).toContain('240');
    expect(xpStat!.textContent).not.toContain('3');
  });

  it('the Traffic signs card opens the signs browser', async () => {
    renderToday();
    const trafficSigns = await screen.findByRole('link', { name: /Traffic signs/ });
    expect(trafficSigns.getAttribute('href')).toBe('/learn/signs');
  });

  it('suggests the game the loaded summary points to', async () => {
    mocks.summary.collected = 3;
    mocks.summary.lastPlayed = { tap: 5000, sprint: 1000, pairs: 2000 };
    renderToday();

    const start = await screen.findByRole('link', { name: /Start here/ });
    expect(start.getAttribute('href')).toBe('/practice/sprint');
    expect(start.textContent).toContain('Play Sign Sprint – against the clock');
  });

  it('shows the collected count once the sign catalogue has loaded, and no count if it fails', async () => {
    mocks.summary.collected = 12;
    renderToday();
    await screen.findByText('12 of 195 collected');

    cleanup();
    mocks.loadSigns.mockReset();
    mocks.loadSigns.mockRejectedValue(new Error('not ingested'));
    renderToday();
    await screen.findByText('Traffic signs');
    await waitFor(() => expect(screen.queryByText(/collected/)).toBeNull());
  });
});
