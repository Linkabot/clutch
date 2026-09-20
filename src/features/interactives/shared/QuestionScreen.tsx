// QuestionScreen: the question layer every "pick one of four" game renders
// through (plan.md Step 8 and amendment E14) -- Tap the sign and Sign
// Sprint today, Phase 3's question kinds next. It returns a React fragment,
// never a root element of its own, so each game keeps its own full-screen
// flex root and the region below the bar keeps the game's own class
// (regionClassName: tap__body, sprint__play) and that class's flex sizing
// (E14 (a)). It renders GameTopBar from the game's own topBar props --
// spread wholesale, so a later GameTopBar prop reaches both games without
// touching this file -- then either the load-failure notice, centred in the
// game's full-screen flex layer by .question-screen__failed (E14 (e)), or,
// only when the content is ready AND there are options, the question
// region: the game's prompt (everything shown above the options, in the
// game's own order), one button per option, then any overlay children. A
// game with no options renders nothing but the bar, so a finished round's
// own summary card keeps its centring. A quiz sheet, when given, renders
// last, and while it is open the question region takes the inert attribute
// so focus and the accessibility tree stay inside the sheet (M40/M41).
// inert is set with setAttribute/removeAttribute, never the HTMLElement
// property: React 18's types have no inert prop, and this repo's jsdom
// (30.0.1) has no inert IDL property at all, so assigning to it would set
// an expando that reflects no attribute and no test could see (E14 (f)).
// Depends on: react, ../quiz-sheet/QuizSheet (the component and its props
// type), ./GameTopBar, ../../../ui/LoadFailed (default export, straight
// from its file, like src/features/signs/SignScreen.tsx), ./question.css.
// Depended on by: src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// tests/unit/question-screen.test.tsx.

import { useEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import LoadFailed from '../../../ui/LoadFailed';
import QuizSheet from '../quiz-sheet/QuizSheet';
import type { QuizSheetProps } from '../quiz-sheet/QuizSheet';
import GameTopBar from './GameTopBar';
import './question.css';

/** What an answered option shows: written to the button's data-feedback. */
export type OptionFeedback = 'right' | 'wrong' | 'answer' | 'dim';

export interface QuestionScreenProps<O> {
  /** GameTopBar's own props, spread wholesale onto it. */
  topBar: ComponentProps<typeof GameTopBar>;
  loadState: 'loading' | 'ready' | 'error';
  /** Called by the load-failure notice's Retry button. */
  onRetry: () => void;
  /** Everything shown above the options, in the game's own order. */
  prompt: ReactNode;
  options: readonly O[];
  /** The game's own class for the question region (tap__body, sprint__play). */
  regionClassName: string;
  optionsClassName: string;
  optionClassName: string;
  optionKey: (option: O, index: number) => string;
  /** The option button's content. */
  renderOption: (option: O, index: number) => ReactNode;
  /** The option button's data-feedback, or undefined for no attribute. */
  feedbackFor?: (option: O, index: number) => OptionFeedback | undefined;
  /** Extra attributes for the option button, such as data-sign-id. */
  optionAttributes?: (option: O, index: number) => Record<string, string | undefined>;
  disabled: boolean;
  onAnswer: (option: O) => void;
  sheet?: QuizSheetProps | null;
  /** Overlays rendered inside the region, after the options. */
  children?: ReactNode;
}

/**
 * Declared as a function, not an arrow: `const X = <O>(...) => ...` in a
 * .tsx file parses as JSX, not as a type parameter.
 */
function QuestionScreen<O>({
  topBar,
  loadState,
  onRetry,
  prompt,
  options,
  regionClassName,
  optionsClassName,
  optionClassName,
  optionKey,
  renderOption,
  feedbackFor,
  optionAttributes,
  disabled,
  onAnswer,
  sheet = null,
  children,
}: QuestionScreenProps<O>) {
  const regionRef = useRef<HTMLDivElement>(null);
  const sheetOpen = sheet !== null && sheet !== undefined;

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    if (sheetOpen) region.setAttribute('inert', '');
    else region.removeAttribute('inert');
  }, [sheetOpen]);

  return (
    <>
      <GameTopBar {...topBar} />

      {loadState === 'error' && (
        <div className="question-screen__failed">
          <LoadFailed onRetry={onRetry} />
        </div>
      )}

      {loadState === 'ready' && options.length > 0 && (
        <div ref={regionRef} className={regionClassName}>
          {prompt}

          <div className={optionsClassName}>
            {options.map((option, index) => (
              <button
                {...(optionAttributes?.(option, index) ?? {})}
                key={optionKey(option, index)}
                type="button"
                className={optionClassName}
                data-feedback={feedbackFor?.(option, index)}
                disabled={disabled}
                onClick={() => onAnswer(option)}
              >
                {renderOption(option, index)}
              </button>
            ))}
          </div>

          {children}
        </div>
      )}

      {sheet && <QuizSheet {...sheet} />}
    </>
  );
}

export default QuestionScreen;
