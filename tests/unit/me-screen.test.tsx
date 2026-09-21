/**
 * @vitest-environment jsdom
 *
 * Render tests for the Me tab (plan.md Step 11, amendment E25 (e), (i);
 * fold-in E26 (b)): the progress store is loaded on mount; its three
 * sections render in order (Progress, Settings, About); the Progress group
 * stays hidden (me-progress--pending) at 'idle' and 'loading' alike, and
 * while the sign catalogue itself is still loading even once the scores
 * are 'ready', and shows anyway if the store errors; the streak and XP
 * numbers land in the pill their own label names, never swapped; the
 * Traffic signs row links to /learn/signs and shows no count if the
 * catalogue fails; the Add to Home Screen row shows only when
 * readPlatform() reports iOS Safari, not standalone; tapping it opens the
 * panel and its own Not now closes it again without writing
 * platform.DISMISSED_KEY (persistDismissal={false}); and the Attribution
 * disclosure starts closed, keeps a first heading that isn't a single-#
 * title, says so when the fetch itself fails, and renders the (mocked)
 * fetched file through the real renderMarkdown.
 * jsdom's localStorage outlives a test case, so every case here starts
 * from a cleared store -- without that the dismissal case below would
 * inherit a stale key and prove nothing.
 * src/app/platform is mocked with importOriginal so DISMISSED_KEY stays
 * the real constant AddToHomeScreen.tsx imports; only readPlatform is
 * replaced.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/app/platform (DISMISSED_KEY, mocked
 * readPlatform), src/content/schemas (Sign type),
 * src/engine/progress-store (ProgressSummary, type only),
 * src/features/me/MeScreen, and mocks of src/engine/progress-state and
 * src/content/signs.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import type { ProgressSummary } from '../../src/engine/progress-store';
import { DISMISSED_KEY } from '../../src/app/platform';
import MeScreen from '../../src/features/me/MeScreen';

const mocks = vi.hoisted(() => ({
  loadSigns: vi.fn<() => Promise<Sign[]>>(),
  load: vi.fn<() => Promise<void>>(),
  status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
  summary: {
    xp: 240,
    streak: 3,
    sprintBest: 0,
    sprintBests: { '30s': 0, '1m': 0, '5m': 0, none: 0 },
    collected: 12,
    lastPlayed: { tap: null, sprint: null, pairs: null },
    sprintLast: null,
  } as ProgressSummary,
  readPlatform: vi.fn<() => { ios: boolean; standalone: boolean; dismissed: boolean }>(),
}));

vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: mocks.loadSigns };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({ summary: mocks.summary, status: mocks.status, load: mocks.load }),
}));

vi.mock('../../src/app/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/platform')>();
  return { ...actual, readPlatform: mocks.readPlatform };
});

let signs: Sign[];

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import('../../src/content/signs')>('../../src/content/signs');
  signs = await actual.loadSigns();
});

function meTree() {
  return (
    <MemoryRouter>
      <MeScreen />
    </MemoryRouter>
  );
}

function renderMe() {
  return render(meTree());
}

function stubAttributionFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Attribution\n\n## Fonts\n\n### Overpass\n\n- A bullet\n'),
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.status = 'ready';
  mocks.summary.collected = 12;
  mocks.loadSigns.mockReset();
  mocks.loadSigns.mockResolvedValue(signs);
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(undefined);
  mocks.readPlatform.mockReset();
  mocks.readPlatform.mockReturnValue({ ios: false, standalone: false, dismissed: false });
  stubAttributionFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MeScreen', () => {
  it('has the three sections in order', async () => {
    renderMe();
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Progress', 'Settings', 'About']);
  });

  it('loads the progress store on mount', async () => {
    renderMe();
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
  });

  it('keeps the Progress numbers hidden until the scores have loaded, and shows them anyway if they fail', async () => {
    mocks.status = 'idle';
    const { container, rerender } = renderMe();
    await screen.findByTestId('offline-status');
    expect(container.querySelector('.me-progress')?.className).toContain('me-progress--pending');

    mocks.status = 'loading';
    rerender(meTree());
    expect(container.querySelector('.me-progress')?.className).toContain('me-progress--pending');

    mocks.status = 'ready';
    rerender(meTree());
    await waitFor(() =>
      expect(container.querySelector('.me-progress')?.className).not.toContain(
        'me-progress--pending',
      ),
    );

    cleanup();
    mocks.status = 'error';
    const errored = renderMe();
    await waitFor(() =>
      expect(errored.container.querySelector('.me-progress')?.className).not.toContain(
        'me-progress--pending',
      ),
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

    const { container } = renderMe();
    await screen.findByTestId('offline-status');
    expect(container.querySelector('.me-progress')?.className).toContain('me-progress--pending');

    resolveSigns(signs);
    await waitFor(() =>
      expect(container.querySelector('.me-progress')?.className).not.toContain(
        'me-progress--pending',
      ),
    );
  });

  it('gives the streak and the XP to the right pills', async () => {
    renderMe();
    await screen.findByTestId('offline-status');

    const streakStat = screen.getByText('day streak').closest('.practice-header__stat');
    const xpStat = screen.getByText('XP earned').closest('.practice-header__stat');
    expect(streakStat).not.toBeNull();
    expect(xpStat).not.toBeNull();
    expect(streakStat!.textContent).toContain('3');
    expect(streakStat!.textContent).not.toContain('240');
    expect(xpStat!.textContent).toContain('240');
    expect(xpStat!.textContent).not.toContain('3');
  });

  it('the Traffic signs row opens the signs browser, and shows no count if the catalogue fails', async () => {
    renderMe();
    const row = await screen.findByRole('link', { name: /Traffic signs/ });
    expect(row.getAttribute('href')).toBe('/learn/signs');
    expect(row.textContent).toContain('12 of 195 collected');

    cleanup();
    mocks.loadSigns.mockReset();
    mocks.loadSigns.mockRejectedValue(new Error('not ingested'));
    renderMe();
    const failedRow = await screen.findByRole('link', { name: 'Traffic signs' });
    expect(failedRow.textContent).not.toContain('collected');
  });

  it('keeps a first heading that is not a single-# title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('## Fonts\n\n- A bullet\n'),
      }),
    );
    const { container } = renderMe();
    await screen.findByTestId('offline-status');

    const summary = container.querySelector('details.attribution > summary');
    if (!summary) throw new Error('no attribution summary');
    fireEvent.click(summary);

    const heading = await screen.findByRole('heading', { name: 'Fonts', level: 4 });
    expect(heading).toBeTruthy();
  });

  it('says so when the attribution file cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('') }),
    );
    const { container } = renderMe();
    await screen.findByTestId('offline-status');

    const summary = container.querySelector('details.attribution > summary');
    if (!summary) throw new Error('no attribution summary');
    fireEvent.click(summary);

    await screen.findByText('Attribution file unavailable');
  });

  it('shows the Add to Home Screen row only in iPhone Safari', async () => {
    mocks.readPlatform.mockReturnValue({ ios: true, standalone: false, dismissed: false });
    renderMe();
    expect(await screen.findByRole('button', { name: 'Add to Home Screen' })).toBeTruthy();
    cleanup();

    mocks.readPlatform.mockReturnValue({ ios: true, standalone: true, dismissed: false });
    renderMe();
    await screen.findByTestId('offline-status');
    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).toBeNull();
    cleanup();

    mocks.readPlatform.mockReturnValue({ ios: false, standalone: false, dismissed: false });
    renderMe();
    await screen.findByTestId('offline-status');
    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).toBeNull();
  });

  it('the row opens the panel, and Not now closes it without storing a dismissal', async () => {
    mocks.readPlatform.mockReturnValue({ ios: true, standalone: false, dismissed: false });
    renderMe();

    fireEvent.click(await screen.findByRole('button', { name: 'Add to Home Screen' }));
    expect(await screen.findByRole('heading', { name: 'Add to Home Screen' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Add to Home Screen' })).toBeNull(),
    );
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull();
  });

  it('renders the attribution file inside a closed disclosure', async () => {
    const { container } = renderMe();
    await screen.findByTestId('offline-status');

    const details = container.querySelector('details.attribution');
    expect(details?.hasAttribute('open')).toBe(false);

    const summary = container.querySelector('details.attribution > summary');
    if (!summary) throw new Error('no attribution summary');
    fireEvent.click(summary);

    const heading = await screen.findByRole('heading', { name: 'Overpass', level: 5 });
    expect(heading).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
