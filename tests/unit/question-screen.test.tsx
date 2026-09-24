/**
 * @vitest-environment jsdom
 *
 * Render tests (via @testing-library/react + jsdom) for QuestionScreen, the
 * shared question layer Tap the sign and Sign Sprint play through (plan.md
 * Step 8 and amendment E14): it returns a fragment, so the top bar and the
 * question region are siblings with no wrapper of its own (E14 (a)); it
 * renders one button per option with the game's own classes,
 * data-feedback, the caller's extra attributes and its rendered content,
 * hands the tapped option to onAnswer and disables every option on
 * request; it renders no region at all when there are no options, so a
 * finished round's own summary keeps its centring; a given sheet renders
 * last as an aria-modal dialog with the question region inert while it is
 * open (M40/M41), set with setAttribute because this repo's jsdom has no
 * inert IDL property (E14 (f)); the sheet's "Sign page" button appears only
 * when `more` is given; and loadState 'error' swaps the region for the
 * centred load-failure notice, whose Retry calls onRetry.
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * src/features/interactives/shared/QuestionScreen,
 * src/features/interactives/quiz-sheet/QuizSheet.tsx (types).
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuestionScreen from '../../src/features/interactives/shared/QuestionScreen';
import type { QuestionScreenProps } from '../../src/features/interactives/shared/QuestionScreen';
import type { QuizSheetProps } from '../../src/features/interactives/quiz-sheet/QuizSheet';

interface Option {
  id: string;
  label: string;
}

const OPTIONS: Option[] = [
  { id: 'a', label: 'Option one' },
  { id: 'b', label: 'Option two' },
  { id: 'c', label: 'Option three' },
];

afterEach(() => {
  cleanup();
});

function renderScreen(overrides: Partial<QuestionScreenProps<Option>> = {}) {
  const props: QuestionScreenProps<Option> = {
    topBar: { progress: 0.5, label: '3/10', onClose: vi.fn() },
    loadState: 'ready',
    onRetry: vi.fn(),
    prompt: <h1 className="probe__prompt">Name this sign</h1>,
    options: OPTIONS,
    regionClassName: 'probe__body',
    optionsClassName: 'probe__grid',
    optionClassName: 'probe__tile',
    optionKey: (option) => option.id,
    renderOption: (option) => <span className="probe__caption">{option.label}</span>,
    disabled: false,
    onAnswer: vi.fn(),
    ...overrides,
  };
  const view = render(<QuestionScreen {...props} />);
  return { ...view, props };
}

function sheetProps(overrides: Partial<QuizSheetProps> = {}): QuizSheetProps {
  return {
    outcome: 'correct',
    xpGained: 10,
    inARow: 1,
    answerLabel: 'Slippery road',
    explanation: 'Triangles warn.',
    tip: null,
    more: { label: 'Sign page', onClick: vi.fn() },
    onContinue: vi.fn(),
    ...overrides,
  };
}

describe('QuestionScreen: layout', () => {
  it('renders the top bar and the region as siblings, with no wrapper of its own', () => {
    const { container } = renderScreen();
    const children = Array.from(container.children);
    expect(children).toHaveLength(2);
    expect(children[0].classList.contains('game-top-bar')).toBe(true);
    expect(children[1].classList.contains('probe__body')).toBe(true);
    // The prompt and the options live inside the region, in that order.
    const region = children[1];
    expect(Array.from(region.children, (child) => child.className)).toEqual([
      'probe__prompt',
      'probe__grid',
    ]);
  });

  it('renders no region when there are no options', () => {
    const { container } = renderScreen({ options: [] });
    const children = Array.from(container.children);
    expect(children).toHaveLength(1);
    expect(children[0].classList.contains('game-top-bar')).toBe(true);
    expect(container.querySelector('.probe__body')).toBeNull();
    expect(container.querySelector('.probe__prompt')).toBeNull();
  });

  it('renders children inside the region, after the options', () => {
    const { container } = renderScreen({
      children: <div className="probe__pop">+10 XP</div>,
    });
    const region = container.querySelector('.probe__body');
    if (!region) throw new Error('QuestionScreen did not render the question region');
    expect(Array.from(region.children, (child) => child.className)).toEqual([
      'probe__prompt',
      'probe__grid',
      'probe__pop',
    ]);
  });
});

describe('QuestionScreen: options', () => {
  it('renders one button per option with optionClassName and data-feedback', () => {
    const { container } = renderScreen({
      feedbackFor: (option) => (option.id === 'b' ? 'wrong' : 'dim'),
      optionAttributes: (option, index) => ({
        'data-sign-id': option.id,
        'aria-label': `Option ${index + 1}`,
      }),
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.probe__tile');
    expect(buttons).toHaveLength(3);
    expect(Array.from(buttons, (button) => button.getAttribute('data-feedback'))).toEqual([
      'dim',
      'wrong',
      'dim',
    ]);
    expect(Array.from(buttons, (button) => button.getAttribute('data-sign-id'))).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(Array.from(buttons, (button) => button.getAttribute('aria-label'))).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
    ]);
    expect(Array.from(buttons, (button) => button.textContent)).toEqual([
      'Option one',
      'Option two',
      'Option three',
    ]);
    expect(buttons[0].parentElement?.className).toBe('probe__grid');
  });

  it('optionAttributes cannot clobber the button the screen builds', () => {
    const onAnswer = vi.fn();
    const { container } = renderScreen({
      onAnswer,
      feedbackFor: () => 'dim',
      optionAttributes: () => ({ className: 'hijacked', type: 'submit', 'data-feedback': 'right' }),
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.probe__tile');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].className).toBe('probe__tile');
    expect(buttons[0].getAttribute('type')).toBe('button');
    expect(buttons[0].getAttribute('data-feedback')).toBe('dim');
    fireEvent.click(buttons[0]);
    expect(onAnswer).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it('writes no data-feedback attribute when feedbackFor gives undefined', () => {
    const { container } = renderScreen();
    const buttons = container.querySelectorAll('button.probe__tile');
    for (const button of buttons) {
      expect(button.hasAttribute('data-feedback')).toBe(false);
    }
  });

  it('gives onAnswer the tapped option', () => {
    const { container, props } = renderScreen();
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.probe__tile');
    fireEvent.click(buttons[2]);
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
    expect(props.onAnswer).toHaveBeenCalledWith(OPTIONS[2]);
  });

  it('disables every option when disabled is true', () => {
    const { container } = renderScreen({ disabled: true });
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.probe__tile');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });
});

describe('QuestionScreen: the sheet', () => {
  it('renders the sheet as an aria-modal dialog and makes the region inert while it is open', () => {
    const { container, rerender, props } = renderScreen({ sheet: sheetProps() });
    const region = container.querySelector('.probe__body');
    if (!region) throw new Error('QuestionScreen did not render the question region');

    const dialog = screen.getByRole('dialog');
    expect(dialog.classList.contains('quiz-sheet')).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // jsdom 30.0.1 has no inert IDL property, so only the attribute shows.
    expect(region.hasAttribute('inert')).toBe(true);

    rerender(<QuestionScreen {...props} sheet={null} />);
    expect(container.querySelector('.probe__body')?.hasAttribute('inert')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders no Sign page button when more is not given', () => {
    renderScreen({ sheet: sheetProps({ more: undefined }) });
    expect(screen.queryByRole('button', { name: 'Sign page' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });
});

describe('QuestionScreen: load failure', () => {
  it("shows This didn't load. instead of the region, and Retry calls onRetry", () => {
    const { container, props } = renderScreen({ loadState: 'error' });
    expect(container.querySelector('.probe__body')).toBeNull();
    expect(container.querySelector('.probe__tile')).toBeNull();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("This didn't load.");
    expect(alert.parentElement?.className).toBe('question-screen__failed');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows nothing but the top bar while the content is still loading', () => {
    const { container } = renderScreen({ loadState: 'loading' });
    const children = Array.from(container.children);
    expect(children).toHaveLength(1);
    expect(children[0].classList.contains('game-top-bar')).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
