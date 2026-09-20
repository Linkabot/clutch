/**
 * @vitest-environment jsdom
 *
 * Render tests for Sign Sprint's start page (Q10, Q11; plan.md Step 10 and
 * amendment E23 (b), (c), (h)) -- what /practice/sprint shows before a
 * round, rendered through SignSprint itself, since the page only exists
 * inside the game's layer. Covered: the page's one h1 and the absence of
 * the play screen's blue badge; opening on the choices the progress store
 * remembered; the family chips (All clears them, a family turns on and off,
 * and turning the last one off selects All again) and the count of signs
 * those choices put in the sprint, measured over the real catalogue (131
 * for All, 57 for Warning, 85 for Warning and Orders); the score card's
 * best following the chosen length; the last round's score, band dot and
 * length, and the whole row's absence when there is no last round; the
 * load() call that makes a cold open show a real best rather than 0 (scan
 * S12), and the page holding back everything but its header until the
 * store's scores have landed, so the card never draws at 0 and then grows
 * (amendment E24 (a)); and Start saving the choices before the round it
 * starts is played with them.
 * The progress store is mocked by its path relative to this file, and
 * src/content/signs is mocked partially (importOriginal) so only loadSigns
 * is replaced -- the same shape tests/unit/sign-sprint.test.tsx uses, which
 * covers the play screen and the ending.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom
 * (test environment), src/content/signs (loadSigns), src/content/schemas
 * (Sign type), src/engine/progress-store (its option types),
 * src/features/interactives/sign-sprint/SignSprint, and a mock of
 * src/engine/progress-state.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Sign } from '../../src/content/schemas';
import type {
  AnswerResult,
  RoundFinishedOptions,
  SprintChoices,
} from '../../src/engine/progress-store';
import SignSprint from '../../src/features/interactives/sign-sprint/SignSprint';

const mocks = vi.hoisted(() => ({
  loadSigns: vi.fn<() => Promise<Sign[]>>(),
  load: vi.fn<() => Promise<void>>(),
  recordAnswer: vi.fn<(signId: string, correct: boolean) => Promise<AnswerResult>>(),
  recordRoundFinished: vi.fn<(options?: RoundFinishedOptions) => Promise<void>>(),
  getSprintChoices: vi.fn<() => Promise<SprintChoices>>(),
  setSprintChoices: vi.fn<(choices: SprintChoices) => Promise<void>>(),
  status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
  summary: {
    xp: 0,
    streak: 5,
    sprintBest: 12,
    sprintBests: { '30s': 4, '1m': 12, '5m': 40, none: 23 },
    sprintLast: null as { score: number; length: string; answered: number } | null,
    collected: 0,
  },
}));

vi.mock('../../src/content/signs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/signs')>();
  return { ...actual, loadSigns: mocks.loadSigns };
});

vi.mock('../../src/engine/progress-state', () => ({
  useProgressStore: (selector: (state: unknown) => unknown) =>
    selector({
      summary: mocks.summary,
      status: mocks.status,
      load: mocks.load,
      recordAnswer: mocks.recordAnswer,
      recordRoundFinished: mocks.recordRoundFinished,
      getSprintChoices: mocks.getSprintChoices,
      setSprintChoices: mocks.setSprintChoices,
    }),
}));

let signs: Sign[];

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import('../../src/content/signs')>('../../src/content/signs');
  signs = await actual.loadSigns();
});

let t = 0;
const now = () => t;

function renderSprint() {
  const view = render(
    <MemoryRouter initialEntries={['/practice/sprint']}>
      <Routes>
        <Route path="/practice/sprint" element={<SignSprint now={now} />} />
        <Route path="/practice" element={<p>Practice tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
}

/** Waits for the start page's Start button, which appears only once the choices and the catalogue have both arrived. */
function findStart(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Start' });
}

function textOf(container: HTMLElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function chip(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  t = 0;
  mocks.status = 'ready';
  mocks.summary.sprintLast = null;
  mocks.loadSigns.mockReset();
  mocks.loadSigns.mockResolvedValue(signs);
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(undefined);
  mocks.recordAnswer.mockReset();
  mocks.recordAnswer.mockResolvedValue({ collectedNow: false, lostNow: false });
  mocks.recordRoundFinished.mockReset();
  mocks.recordRoundFinished.mockResolvedValue(undefined);
  mocks.getSprintChoices.mockReset();
  mocks.getSprintChoices.mockResolvedValue({ length: '1m', families: [] });
  mocks.setSprintChoices.mockReset();
  mocks.setSprintChoices.mockResolvedValue(undefined);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Sign Sprint start page', () => {
  it('shows exactly one h1, Sign Sprint, and no badge', async () => {
    const container = renderSprint();
    await findStart();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Sign Sprint');
    expect(container.querySelector('.sprint__badge')).toBeNull();
    expect(screen.queryByText('SIGN SPRINT')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('the start page loads the progress store on mount', async () => {
    renderSprint();
    await findStart();
    expect(mocks.load).toHaveBeenCalled();
  });

  // On a cold open the scores land ~150 ms after the choices (measured on
  // the real build): a card drawn before them reads 0, has no Last round
  // row, and then grows by a row under the learner's thumb (amendment E24 (a)).
  it('holds the page back until the scores have loaded, and shows it anyway if they fail', async () => {
    mocks.status = 'loading';
    const tree = () => (
      <MemoryRouter initialEntries={['/practice/sprint']}>
        <Routes>
          <Route path="/practice/sprint" element={<SignSprint now={now} />} />
        </Routes>
      </MemoryRouter>
    );
    const view = render(tree());

    // The choices and the catalogue have both arrived; only the scores are missing.
    await waitFor(() => expect(mocks.getSprintChoices).toHaveBeenCalled());
    await waitFor(() => expect(mocks.loadSigns).toHaveBeenCalled());
    await act(async () => {
      await mocks.getSprintChoices.mock.results[0].value;
      await mocks.loadSigns.mock.results[0].value;
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign Sprint');
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(view.container.querySelector('.sprint-start__card')).toBeNull();

    mocks.status = 'ready';
    view.rerender(tree());
    await findStart();
    expect(view.container.querySelector('.sprint-start__card')).not.toBeNull();

    // A store that failed to load still gets the page, with its zeros.
    cleanup();
    mocks.status = 'error';
    renderSprint();
    await findStart();
  });

  it('opens on the stored choices', async () => {
    mocks.getSprintChoices.mockResolvedValue({ length: '30s', families: ['warning'] });
    const container = renderSprint();
    await findStart();

    expect(screen.getByRole('tab', { name: '30 sec' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '1 min' }).getAttribute('aria-selected')).toBe('false');
    expect(chip('Warning').getAttribute('aria-pressed')).toBe('true');
    expect(chip('All').getAttribute('aria-pressed')).toBe('false');
    expect(textOf(container, '.sprint-start__count')).toBe('57 signs in this sprint');
    expect(textOf(container, '.sprint-start__kicker')).toBe('Best at 30 sec');
  });

  it('All clears the families, and turning the last family off selects All', async () => {
    mocks.getSprintChoices.mockResolvedValue({ length: '1m', families: ['warning', 'orders'] });
    renderSprint();
    await findStart();

    expect(chip('All').getAttribute('aria-pressed')).toBe('false');
    expect(chip('Warning').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Orders').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(chip('All'));
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Warning').getAttribute('aria-pressed')).toBe('false');
    expect(chip('Orders').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(chip('Motorway'));
    expect(chip('Motorway').getAttribute('aria-pressed')).toBe('true');
    expect(chip('All').getAttribute('aria-pressed')).toBe('false');

    // The last family off is All again, never "no signs at all".
    fireEvent.click(chip('Motorway'));
    expect(chip('Motorway').getAttribute('aria-pressed')).toBe('false');
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
  });

  it('counts the signs in the sprint: 131 for All', async () => {
    const container = renderSprint();
    await findStart();
    expect(textOf(container, '.sprint-start__count')).toBe('131 signs in this sprint');

    fireEvent.click(chip('Warning'));
    expect(textOf(container, '.sprint-start__count')).toBe('57 signs in this sprint');

    fireEvent.click(chip('Orders'));
    expect(textOf(container, '.sprint-start__count')).toBe('85 signs in this sprint');

    fireEvent.click(chip('All'));
    expect(textOf(container, '.sprint-start__count')).toBe('131 signs in this sprint');
  });

  it('the best follows the chosen length', async () => {
    const container = renderSprint();
    await findStart();

    expect(textOf(container, '.sprint-start__kicker')).toBe('Best at 1 min');
    expect(textOf(container, '.sprint-start__number')).toBe('12');
    // The explainer belongs to No limit alone (Lincoln, 20 September 2026).
    expect(screen.queryByText('No limit: play until you stop.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '5 min' }));
    expect(textOf(container, '.sprint-start__kicker')).toBe('Best at 5 min');
    expect(textOf(container, '.sprint-start__number')).toBe('40');

    fireEvent.click(screen.getByRole('tab', { name: 'No limit' }));
    expect(textOf(container, '.sprint-start__kicker')).toBe('Best at No limit');
    expect(textOf(container, '.sprint-start__number')).toBe('23');
    expect(screen.getByText('No limit: play until you stop.')).toBeTruthy();
  });

  it('the last round shows its score, band dot and length, and is left out when there is none', async () => {
    mocks.summary.sprintLast = { score: 8, length: '1m', answered: 12 };
    const container = renderSprint();
    await findStart();

    const stats = container.querySelectorAll('.sprint-start__stat');
    expect(stats).toHaveLength(2);
    expect(stats[1].querySelector('.sprint-start__kicker')?.textContent).toBe('Last round');
    expect(stats[1].querySelector('.sprint-start__number')?.textContent).toContain('8');
    // 8 of the 1-minute maximum of 10 is Q9's orange band.
    expect(stats[1].querySelector('.sprint-start__dot--orange')).not.toBeNull();
    expect(textOf(container, '.sprint-start__last-length')).toBe('1 min');

    cleanup();
    mocks.summary.sprintLast = null;
    const fresh = renderSprint();
    await findStart();
    expect(fresh.querySelectorAll('.sprint-start__stat')).toHaveLength(1);
    expect(screen.queryByText('Last round')).toBeNull();
  });

  it('Start saves the choices and starts the round with them', async () => {
    const container = renderSprint();
    const startButton = await findStart();

    fireEvent.click(screen.getByRole('tab', { name: '30 sec' }));
    fireEvent.click(chip('Road works'));
    fireEvent.click(startButton);

    await waitFor(() =>
      expect(mocks.setSprintChoices).toHaveBeenCalledWith({
        length: '30s',
        families: ['road-works'],
      }),
    );

    // The round on screen is the one those choices describe: a 30-second
    // clock, and road works signs to name. Three in a row, from a family
    // that is 6 of the 131 signs: a deck dealt from every family would pass
    // one question in twenty by luck, and three about once in ten thousand
    // (a mutant that ignored the families survived a single warning-sign
    // check, warning being 57 of the 131 -- amendment E24 (b)).
    await waitFor(() => expect(container.querySelector('.sprint__sign')).not.toBeNull());
    expect(textOf(container, '.game-top-bar__label')).toBe('0:30');
    let previous: string | null = null;
    for (let asked = 1; asked <= 3; asked++) {
      await waitFor(() => {
        const shown = container.querySelector('.sprint__sign')?.getAttribute('data-answer-id');
        expect(shown).toBeTruthy();
        expect(shown).not.toBe(previous);
      });
      const answerId = container.querySelector('.sprint__sign')?.getAttribute('data-answer-id');
      if (!answerId) throw new Error('no sign on screen');
      expect(signs.find((sign) => sign.id === answerId)?.family).toBe('road-works');
      const right = container.querySelector<HTMLButtonElement>(
        `.sprint__option[data-sign-id="${answerId}"]`,
      );
      if (!right) throw new Error(`no option for ${answerId}`);
      fireEvent.click(right);
      previous = answerId;
    }
  });
});
