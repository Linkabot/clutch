/**
 * @vitest-environment jsdom
 *
 * Render tests for the Learn tab hub (plan.md Step 4, U10; amend-04.md
 * A18-A22): the .learn-cards wrapper carries learn--pending and
 * aria-busy="true" while the progress store's scores are 'idle' or
 * 'loading', OR the sign catalogue is still loading; it drops the class and
 * aria-busy once the scores are 'ready' or 'error' AND the catalogue has
 * settled -- loaded or failed alike, so a catalogue that fails to load
 * never leaves Learn hidden forever. Copies tests/unit/journey-screen.test.tsx's
 * mock shapes and pattern (lines 48-144).
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns), src/content/schemas
 * (Sign type), src/engine/progress-store (ProgressSummary, type only),
 * src/features/learn/LearnScreen, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import type { ProgressSummary } from '../../src/engine/progress-store';
import LearnScreen from '../../src/features/learn/LearnScreen';

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

function renderLearn() {
  return render(
    <MemoryRouter>
      <LearnScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.status = 'ready';
  mocks.summary.collected = 0;
  mocks.loadSigns.mockReset();
  mocks.loadSigns.mockResolvedValue(signs);
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('LearnScreen', () => {
  it('NEW U10: Learn is hidden and busy while the scores are idle', async () => {
    mocks.status = 'idle';
    const { container } = renderLearn();
    await screen.findByText('0 of 195 collected');

    const wrapper = container.firstElementChild!;
    expect(wrapper.classList.contains('learn--pending')).toBe(true);
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
  });

  it('NEW U10: Learn is hidden and busy while the scores are loading', async () => {
    mocks.status = 'loading';
    const { container } = renderLearn();
    await screen.findByText('0 of 195 collected');

    const wrapper = container.firstElementChild!;
    expect(wrapper.classList.contains('learn--pending')).toBe(true);
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
  });

  it('GUARD U10: Learn shows when the scores are ready', async () => {
    mocks.status = 'ready';
    const { container } = renderLearn();
    await screen.findByText('0 of 195 collected');

    const wrapper = container.firstElementChild!;
    expect(wrapper.classList.contains('learn--pending')).toBe(false);
    expect(wrapper.getAttribute('aria-busy')).not.toBe('true');
  });

  it('GUARD U10: Learn shows when the scores have failed', async () => {
    mocks.status = 'error';
    const { container } = renderLearn();
    await screen.findByText('0 of 195 collected');

    const wrapper = container.firstElementChild!;
    expect(wrapper.classList.contains('learn--pending')).toBe(false);
    expect(wrapper.getAttribute('aria-busy')).not.toBe('true');
  });

  it('NEW U10: Learn stays hidden while the sign catalogue loads with the scores ready', async () => {
    mocks.status = 'ready';
    let resolveSigns: (value: Sign[]) => void = () => {};
    mocks.loadSigns.mockReset();
    mocks.loadSigns.mockReturnValue(
      new Promise<Sign[]>((resolve) => {
        resolveSigns = resolve;
      }),
    );

    const { container } = renderLearn();
    await screen.findByText('Lessons — later phase');
    const wrapper = container.firstElementChild!;
    expect(wrapper.classList.contains('learn--pending')).toBe(true);
    expect(wrapper.getAttribute('aria-busy')).toBe('true');

    resolveSigns(signs);
    await waitFor(() => expect(wrapper.classList.contains('learn--pending')).toBe(false));
    expect(wrapper.getAttribute('aria-busy')).not.toBe('true');
  });

  it('GUARD U10: Learn shows when the sign catalogue fails with the scores ready', async () => {
    mocks.status = 'ready';
    mocks.loadSigns.mockReset();
    mocks.loadSigns.mockRejectedValue(new Error('not ingested'));

    const { container } = renderLearn();
    const wrapper = container.firstElementChild!;
    await waitFor(() => expect(wrapper.classList.contains('learn--pending')).toBe(false));
    expect(wrapper.getAttribute('aria-busy')).not.toBe('true');
  });
});
