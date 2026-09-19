/**
 * @vitest-environment jsdom
 *
 * Render tests (via @testing-library/react + jsdom) for QuizSheet, the
 * feedback sheet shown after a quiz answer (plan.md Step 22 and amendment
 * E23): the correct and wrong sheets' title, XP badge, in-a-row streak,
 * body text (the rule sentence on its own line under the bold name, plan.md
 * E10 (g)), hook line, tick or cross, root classes and dialog name; the
 * nine confetti pieces; reduced motion (a stubbed window.matchMedia) giving
 * the static class, no confetti and no animated class anywhere; and the two
 * buttons, including Continue taking focus on mount. No
 * @testing-library/jest-dom matchers are available, so assertions read
 * text, classes and attributes off the DOM directly. jsdom applies no CSS,
 * so these tests pin the class switches the stylesheet keys motion off, not
 * the keyframes themselves.
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * src/features/interactives/quiz-sheet/QuizSheet.
 * Depended on by: `npm test` (Vitest run).
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuizSheet from '../../src/features/interactives/quiz-sheet/QuizSheet';

type QuizSheetProps = ComponentProps<typeof QuizSheet>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Stubs window.matchMedia with a MediaQueryList-shaped object (the approach
 * tests/unit/interactives-render.test.tsx uses), so useReducedMotion reads
 * `matches` from it.
 */
function stubMatchMedia(matches: boolean) {
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
  const matchMediaMock = vi.fn().mockReturnValue(mediaQueryList);
  vi.stubGlobal('matchMedia', matchMediaMock);
  return matchMediaMock;
}

function renderSheet(overrides: Partial<QuizSheetProps> = {}) {
  const props: QuizSheetProps = {
    outcome: 'correct',
    xpGained: 10,
    inARow: 5,
    answerName: 'Slippery road.',
    ruleSentence: 'Triangles warn.',
    hook: 'Three sides, one message: watch out ahead.',
    onSignPage: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  };
  const view = render(<QuizSheet {...props} />);
  const root = view.container.querySelector<HTMLElement>('.quiz-sheet');
  if (!root) throw new Error('QuizSheet did not render a .quiz-sheet root');
  return { ...view, props, root };
}

function bodyText(root: HTMLElement): string {
  const body = root.querySelector('.quiz-sheet__body');
  if (!body) throw new Error('QuizSheet did not render a .quiz-sheet__body');
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('QuizSheet: correct answer', () => {
  it('shows Correct, +10 XP, 5 in a row, the bold name and the hook', () => {
    const { root } = renderSheet();
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(screen.getByText('+10 XP')).toBeTruthy();
    expect(root.querySelector('.quiz-sheet__xp')?.textContent).toBe('+10 XP');
    expect(screen.getByText('5 in a row')).toBeTruthy();
    expect(root.querySelector('.quiz-sheet__body strong')?.textContent).toBe('Slippery road.');
    expect(root.querySelector('.quiz-sheet__hook')?.textContent).toBe(
      'Three sides, one message: watch out ahead.',
    );
  });

  it('renders 9 hidden confetti pieces before the panel and the quiz-sheet--animated class', () => {
    const { root } = renderSheet();
    const pieces = root.querySelectorAll('[data-confetti]');
    expect(pieces).toHaveLength(9);
    for (const piece of pieces) {
      expect(piece.getAttribute('aria-hidden')).toBe('true');
    }
    // The ChosenQuiz artboard's nine pieces, in its order.
    expect(Array.from(pieces, (piece) => piece.getAttribute('data-confetti'))).toEqual([
      'triangle',
      'circle',
      'ring',
      'diamond',
      'rectangle',
      'triangle',
      'circle',
      'diamond',
      'ring',
    ]);
    expect(
      Array.from(
        pieces,
        (piece) => `${piece.getAttribute('width')}x${piece.getAttribute('height')}`,
      ),
    ).toEqual(['22x20', '16x16', '18x18', '14x14', '22x14', '20x18', '14x14', '12x12', '16x16']);
    const panel = root.querySelector('.quiz-sheet__panel');
    if (!panel) throw new Error('QuizSheet did not render a .quiz-sheet__panel');
    expect(panel.querySelectorAll('[data-confetti]')).toHaveLength(0);
    expect(pieces[0].compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(root.classList.contains('quiz-sheet--animated')).toBe(true);
    expect(root.classList.contains('quiz-sheet--static')).toBe(false);
  });

  it('shows +20 XP when xpGained is 20', () => {
    const { root } = renderSheet({ xpGained: 20 });
    expect(screen.getByText('+20 XP')).toBeTruthy();
    expect(root.querySelector('.quiz-sheet__xp')?.textContent).toBe('+20 XP');
    expect(screen.queryByText('+10 XP')).toBeNull();
  });

  it('shows no streak row at 1 in a row', () => {
    const { root } = renderSheet({ inARow: 1 });
    expect(root.textContent).not.toContain('in a row');
    expect(root.querySelector('.quiz-sheet__streak')).toBeNull();
  });

  it('shows 2 in a row with 4 chevron svgs from two in a row', () => {
    const { root } = renderSheet({ inARow: 2 });
    expect(screen.getByText('2 in a row')).toBeTruthy();
    const streak = root.querySelector('.quiz-sheet__streak');
    if (!streak) throw new Error('QuizSheet did not render a .quiz-sheet__streak');
    expect(streak.querySelectorAll('svg')).toHaveLength(4);
  });

  it('shows the bold name then the rule sentence in the body', () => {
    const { root } = renderSheet();
    expect(bodyText(root)).toBe('Slippery road. Triangles warn.');
    expect(root.querySelector('.quiz-sheet__body strong')?.textContent).toBe('Slippery road.');
  });

  it('shows only the name when the rule sentence is null', () => {
    const { root } = renderSheet({ ruleSentence: null });
    expect(bodyText(root)).toBe('Slippery road.');
    expect(root.textContent).not.toContain('null');
  });

  it('renders no hook line and no null text when the hook is null', () => {
    const { root } = renderSheet({ hook: null });
    expect(root.querySelector('.quiz-sheet__hook')).toBeNull();
    expect(root.textContent).not.toContain('null');
  });

  it('has the quiz-sheet--correct class, one tick and no cross', () => {
    const { root } = renderSheet();
    expect(root.classList.contains('quiz-sheet--correct')).toBe(true);
    expect(root.classList.contains('quiz-sheet--wrong')).toBe(false);
    expect(root.querySelectorAll('[data-icon="tick"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-icon="cross"]')).toHaveLength(0);
  });

  it('is a dialog named Correct', () => {
    const { root } = renderSheet();
    expect(screen.getByRole('dialog', { name: 'Correct' })).toBe(root);
  });
});

describe('QuizSheet: wrong answer', () => {
  it('shows Incorrect and Right answer:, with no XP badge and no confetti', () => {
    const { root } = renderSheet({ outcome: 'wrong' });
    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.queryByText('Correct')).toBeNull();
    expect(bodyText(root).startsWith('Right answer:')).toBe(true);
    expect(root.querySelector('.quiz-sheet__xp')).toBeNull();
    expect(root.textContent).not.toContain('XP');
    expect(root.querySelectorAll('[data-confetti]')).toHaveLength(0);
  });

  it('shows no streak row even at 3 in a row', () => {
    const { root } = renderSheet({ outcome: 'wrong', inARow: 3 });
    expect(root.textContent).not.toContain('in a row');
    expect(root.querySelector('.quiz-sheet__streak')).toBeNull();
  });

  it('shows Right answer:, the bold name, then the rule sentence in the body', () => {
    const { root } = renderSheet({ outcome: 'wrong' });
    expect(bodyText(root)).toBe('Right answer: Slippery road. Triangles warn.');
    expect(root.querySelector('.quiz-sheet__body strong')?.textContent).toBe('Slippery road.');
  });

  it('shows the hook line when there is one', () => {
    const { root } = renderSheet({ outcome: 'wrong' });
    expect(root.querySelector('.quiz-sheet__hook')?.textContent).toBe(
      'Three sides, one message: watch out ahead.',
    );
  });

  it('has the quiz-sheet--wrong class, one cross and no tick', () => {
    const { root } = renderSheet({ outcome: 'wrong' });
    expect(root.classList.contains('quiz-sheet--wrong')).toBe(true);
    expect(root.classList.contains('quiz-sheet--correct')).toBe(false);
    expect(root.querySelectorAll('[data-icon="cross"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-icon="tick"]')).toHaveLength(0);
  });

  it('is a dialog named Incorrect', () => {
    const { root } = renderSheet({ outcome: 'wrong' });
    expect(screen.getByRole('dialog', { name: 'Incorrect' })).toBe(root);
  });
});

describe('QuizSheet: reduced motion', () => {
  it('renders quiz-sheet--static, 0 confetti and no --animated class anywhere, streak intact', () => {
    const matchMediaMock = stubMatchMedia(true);
    const { container, root } = renderSheet({ inARow: 5 });
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(root.querySelectorAll('[data-confetti]')).toHaveLength(0);
    expect(root.classList.contains('quiz-sheet--static')).toBe(true);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
    expect(screen.getByText('5 in a row')).toBeTruthy();
  });

  it('stays animated when matchMedia does not match', () => {
    stubMatchMedia(false);
    const { root } = renderSheet();
    expect(root.classList.contains('quiz-sheet--animated')).toBe(true);
    expect(root.querySelectorAll('[data-confetti]')).toHaveLength(9);
  });
});

describe('QuizSheet: buttons', () => {
  it('renders Continue as a button--primary button that has focus after mount and calls onContinue', () => {
    // Spied before render: the focus call happens in the mount effect. jsdom
    // ignores focus options, so only the spy can see preventScroll.
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      const { props } = renderSheet();
      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton.tagName).toBe('BUTTON');
      expect(continueButton.classList.contains('button--primary')).toBe(true);
      expect(document.activeElement).toBe(continueButton);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      const continueCall = focusSpy.mock.contexts.indexOf(continueButton);
      expect(continueCall).toBeGreaterThanOrEqual(0);
      expect(focusSpy.mock.calls[continueCall]).toEqual([{ preventScroll: true }]);
      fireEvent.click(continueButton);
      expect(props.onContinue).toHaveBeenCalledTimes(1);
      expect(props.onSignPage).not.toHaveBeenCalled();
    } finally {
      focusSpy.mockRestore();
    }
  });

  it('calls onSignPage from the Sign page button', () => {
    const { props } = renderSheet({ outcome: 'wrong' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign page' }));
    expect(props.onSignPage).toHaveBeenCalledTimes(1);
    expect(props.onContinue).not.toHaveBeenCalled();
  });
});

describe('QuizSheet: rule sentence layout', () => {
  it('puts the rule sentence on its own line', () => {
    const { root } = renderSheet();
    const body = root.querySelector('.quiz-sheet__body');
    if (!body) throw new Error('QuizSheet did not render a .quiz-sheet__body');
    const strong = body.querySelector('strong');
    if (!strong) throw new Error('QuizSheet did not render a strong name');
    const brs = body.querySelectorAll('br');
    expect(brs).toHaveLength(1);
    expect(strong.compareDocumentPosition(brs[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const { root: noSentenceRoot } = renderSheet({ ruleSentence: null });
    const noSentenceBody = noSentenceRoot.querySelector('.quiz-sheet__body');
    if (!noSentenceBody) throw new Error('QuizSheet did not render a .quiz-sheet__body');
    expect(noSentenceBody.querySelectorAll('br')).toHaveLength(0);
  });
});
