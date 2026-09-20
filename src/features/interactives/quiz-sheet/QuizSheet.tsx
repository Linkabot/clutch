// QuizSheet: the bottom-anchored feedback sheet shown after a question of
// any kind is answered (scout-e.md's ChosenQuiz and Tap the sign artboards;
// plan.md Step 22, amendments E23 and E14 (d)). Its labels are generic, so
// Phase 3's question kinds can render it too: a correct answer gets a
// sign-green sheet with a tick, the "Correct" title, a yellow "+N XP"
// badge, four chevrons with "N in a row" from two in a row, the bold answer
// label then the explanation on its own line below it (plan.md E10 (g)),
// and nine pieces of app-drawn confetti falling behind the sheet. A wrong
// answer gets a sign-red sheet: a cross, "Incorrect", then "Right answer: "
// with the bold answer label and the explanation, also on its own line.
// Both show the bold tip line when there is one, a primary "Continue"
// button that takes focus when the sheet mounts, and -- only when `more` is
// given -- a button beside it that takes the learner somewhere for more
// (Tap the sign passes "Sign page"). The root is a modal dialog: the
// question behind it goes inert (M40, done by the question screen that
// renders this sheet). Every shape drawn here is original generic art,
// never a real sign picture (plan.md D7). When the user asks for reduced
// motion the root carries quiz-sheet--static instead of quiz-sheet--animated
// and no confetti is rendered, so the stylesheet animates nothing.
// Depends on: react, ../../../ui (Button), ../shared/useReducedMotion,
// ./quiz-sheet.css.
// Depended on by: src/features/interactives/shared/QuestionScreen.tsx (the
// one renderer of this sheet; Tap the sign reaches it from there, and Sign
// Sprint and Match Pairs use their own feedback UI),
// tests/unit/quiz-sheet.test.tsx, tests/unit/question-screen.test.tsx (its
// props type only).

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../ui';
import { useReducedMotion } from '../shared/useReducedMotion';
import './quiz-sheet.css';

export interface QuizSheetProps {
  outcome: 'correct' | 'wrong';
  xpGained: number;
  inARow: number;
  /** The right answer, in bold: a sign's game name, a rule number, a term. */
  answerLabel: string;
  /** One sentence saying why, on its own line under the label. */
  explanation: string | null;
  /** A memory aid shown in bold under the explanation. */
  tip: string | null;
  /** An optional second button beside Continue. */
  more?: { label: string; onClick: () => void };
  onContinue: () => void;
}

type ConfettiShape = 'triangle' | 'circle' | 'ring' | 'diamond' | 'rectangle';

/** Shape geometry as drawn on the ChosenQuiz artboard; colours come from quiz-sheet.css. */
const CONFETTI_ART: Record<ConfettiShape, ReactNode> = {
  triangle: <path d="M11 2.5 19.5 17.5H2.5Z" strokeWidth="3" strokeLinejoin="round" />,
  circle: <circle cx="8" cy="8" r="7" />,
  ring: <circle cx="9" cy="9" r="7" strokeWidth="3" />,
  diamond: <path d="M7 1 13 7 7 13 1 7Z" />,
  rectangle: <rect x="1" y="1" width="20" height="12" rx="2" strokeWidth="1.5" />,
};

/**
 * The ChosenQuiz artboard's nine pieces, in its order. Position, duration
 * and delay are set per piece (nth-child) in quiz-sheet.css.
 */
const CONFETTI: { shape: ConfettiShape; width: number; height: number; viewBox: string }[] = [
  { shape: 'triangle', width: 22, height: 20, viewBox: '0 0 22 20' },
  { shape: 'circle', width: 16, height: 16, viewBox: '0 0 16 16' },
  { shape: 'ring', width: 18, height: 18, viewBox: '0 0 18 18' },
  { shape: 'diamond', width: 14, height: 14, viewBox: '0 0 14 14' },
  { shape: 'rectangle', width: 22, height: 14, viewBox: '0 0 22 14' },
  { shape: 'triangle', width: 20, height: 18, viewBox: '0 0 22 20' },
  { shape: 'circle', width: 14, height: 14, viewBox: '0 0 16 16' },
  { shape: 'diamond', width: 12, height: 12, viewBox: '0 0 14 14' },
  { shape: 'ring', width: 16, height: 16, viewBox: '0 0 18 18' },
];

const CHEVRON_COUNT = 4;

function QuizSheet({
  outcome,
  xpGained,
  inARow,
  answerLabel,
  explanation,
  tip,
  more,
  onContinue,
}: QuizSheetProps) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const correct = outcome === 'correct';

  useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLButtonElement>('.button--primary')
      ?.focus({ preventScroll: true });
  }, []);

  const rootClassName = [
    'quiz-sheet',
    correct ? 'quiz-sheet--correct' : 'quiz-sheet--wrong',
    reducedMotion ? 'quiz-sheet--static' : 'quiz-sheet--animated',
  ].join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClassName}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {correct && !reducedMotion && (
        <div className="quiz-sheet__confetti" aria-hidden="true">
          {CONFETTI.map((piece, index) => (
            <svg
              key={index}
              className="quiz-sheet__piece"
              data-confetti={piece.shape}
              aria-hidden="true"
              width={piece.width}
              height={piece.height}
              viewBox={piece.viewBox}
            >
              {CONFETTI_ART[piece.shape]}
            </svg>
          ))}
        </div>
      )}
      <div className="quiz-sheet__panel">
        <div className="quiz-sheet__frame">
          <div className="quiz-sheet__header">
            <div className="quiz-sheet__heading">
              <div
                className="quiz-sheet__icon"
                data-icon={correct ? 'tick' : 'cross'}
                aria-hidden="true"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {correct ? (
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  ) : (
                    <path d="M6 6l12 12M18 6L6 18" />
                  )}
                </svg>
              </div>
              <h2 id={titleId} className="quiz-sheet__title">
                {correct ? 'Correct' : 'Incorrect'}
              </h2>
            </div>
            {correct && <div className="quiz-sheet__xp">{`+${xpGained} XP`}</div>}
          </div>
          {correct && inARow >= 2 && (
            <div className="quiz-sheet__streak">
              {Array.from({ length: CHEVRON_COUNT }, (_, index) => (
                <svg
                  key={index}
                  className="quiz-sheet__chevron"
                  aria-hidden="true"
                  width="14"
                  height="20"
                  viewBox="0 0 14 20"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3l7 7-7 7" />
                </svg>
              ))}
              <span className="quiz-sheet__streak-text">{`${inARow} in a row`}</span>
            </div>
          )}
          <p className="quiz-sheet__body">
            {!correct && 'Right answer: '}
            <strong>{answerLabel}</strong>
            {explanation !== null && (
              <>
                {' '}
                <br />
                {explanation}
              </>
            )}
          </p>
          {tip !== null && <p className="quiz-sheet__hook">{tip}</p>}
          <div className="quiz-sheet__actions">
            {more && (
              <button type="button" className="quiz-sheet__sign-page" onClick={more.onClick}>
                {more.label}
              </button>
            )}
            <Button variant="primary" className="quiz-sheet__continue" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizSheet;
