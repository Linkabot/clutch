// Tap the sign: /practice/tap (src/app/routes.tsx), reading an optional
// ?sign= to seed question 1 (SignScreen.tsx's "Play with this sign"). A
// full-screen layer over the app shell (scout-e.md's Tap the sign artboard;
// plan.md Step 23 and amendments E25-E26): GameTopBar (close, progress,
// N/10), a "TAP THE SIGN" badge, the prompt caption (the page's only
// heading, carrying data-answer-id) and a 2x2 grid of option tiles built by
// ./round's buildTapRound. A tap locks the grid -- every tile gets
// data-feedback (right/wrong/answer/dim) and a tick badge pops on the
// right tile -- then QuizSheet shows ./round's sheetContent (E26: its
// outcome and XP compare the tap to the answer, but its name, rule
// sentence and hook always come from the answer, never the tapped sign),
// records the answer and hands Continue to the next question. Progress
// writes (recordAnswer, then recordRoundFinished after question 10) run
// through one promise chain in answer order, held in a ref, so the
// round-complete summary only renders once every write has actually
// settled (no interrupted writes if the player navigates away right after
// the last Continue). Play again builds a fresh round (a new
// crypto-seeded rng, no firstSignId) and drops ?sign= from the URL. Every
// random choice is seeded from the Web Crypto RNG (never a floating-point
// pseudo-random call or the wall clock), and only inside a
// loadSigns/Play-again callback, never during render.
// Depends on: react, react-router-dom, ../../../content/signs (loadSigns),
// ../../../content/schemas (Sign type), ../../../engine/progress-state
// (useProgressStore), ../../../ui (Button), ../../interactives/quiz-sheet/
// QuizSheet, ../../interactives/shared/GameTopBar, ../../interactives/
// shared/SignImage, ../../interactives/shared/distractors (isShortCaption),
// ../../interactives/shared/random (mulberry32), ../../interactives/
// shared/useReducedMotion, ./round (buildTapRound, sheetContent,
// TapQuestion), ./tap.css.
// Depended on by: src/app/routes.tsx.

import { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadSigns } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import { useProgressStore } from '../../../engine/progress-state';
import { Button } from '../../../ui';
import QuizSheet from '../../interactives/quiz-sheet/QuizSheet';
import GameTopBar from '../../interactives/shared/GameTopBar';
import SignImage from '../../interactives/shared/SignImage';
import { isShortCaption } from '../../interactives/shared/distractors';
import { mulberry32 } from '../../interactives/shared/random';
import { useReducedMotion } from '../../interactives/shared/useReducedMotion';
import { buildTapRound, sheetContent, type TapQuestion } from './round';
import './tap.css';

type LoadStatus = 'loading' | 'ready' | 'error';
type TileFeedback = 'right' | 'wrong' | 'answer' | 'dim';
type Selection = { chosenId: string; correct: boolean } | null;

const TOTAL_QUESTIONS = 10;
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** A 32-bit seed drawn from the Web Crypto RNG -- never a pseudo-random float call or the wall clock. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** The tile's data-feedback value once an answer is chosen, else undefined (no attribute). */
function feedbackFor(
  option: Sign,
  question: TapQuestion,
  selection: Selection,
): TileFeedback | undefined {
  if (!selection) return undefined;
  if (option.id === selection.chosenId) {
    return selection.correct ? 'right' : 'wrong';
  }
  if (!selection.correct && option.id === question.answer.id) {
    return 'answer';
  }
  return 'dim';
}

function TapTheSignScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const firstSignIdRef = useRef(searchParams.get('sign') ?? undefined);
  const reducedMotion = useReducedMotion();

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [round, setRound] = useState<TapQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [streak, setStreak] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        setRound(buildTapRound(signs, mulberry32(randomSeed()), firstSignIdRef.current));
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function queueWrite(write: () => Promise<void>): void {
    writeChainRef.current = writeChainRef.current.then(write).catch((error: unknown) => {
      console.error(error);
    });
  }

  function handleClose(): void {
    navigate('/practice');
  }

  function handleTap(option: Sign, question: TapQuestion): void {
    if (selection) return;
    const correct = option.id === question.answer.id;
    setSelection({ chosenId: option.id, correct });
    setStreak((previous) => (correct ? previous + 1 : 0));
    if (correct) setRightCount((previous) => previous + 1);

    queueWrite(async () => {
      await recordAnswer(question.answer.id, correct);
    });
    if (questionIndex === round.length - 1) {
      queueWrite(() => recordRoundFinished({}));
    }
  }

  function handleContinue(): void {
    if (!selection) return;
    if (questionIndex === round.length - 1) {
      writeChainRef.current
        .then(() => setFinished(true))
        .catch((error: unknown) => {
          console.error(error);
          setFinished(true);
        });
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelection(null);
  }

  function handlePlayAgain(): void {
    loadSigns()
      .then((signs) => {
        setRound(buildTapRound(signs, mulberry32(randomSeed())));
        setQuestionIndex(0);
        setSelection(null);
        setStreak(0);
        setRightCount(0);
        setFinished(false);
        writeChainRef.current = Promise.resolve();
      })
      .catch((error: unknown) => console.error(error));
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('sign');
        return next;
      },
      { replace: true },
    );
  }

  const currentQuestion = status === 'ready' && !finished ? round[questionIndex] : undefined;
  const sheet =
    currentQuestion && selection ? sheetContent(currentQuestion, selection.chosenId) : null;
  const questionNumber = status === 'ready' ? Math.min(questionIndex + 1, TOTAL_QUESTIONS) : 0;
  const rootClassName = ['tap', reducedMotion ? 'tap--static' : 'tap--animated'].join(' ');

  return (
    <div className={rootClassName}>
      <GameTopBar
        progress={questionNumber / TOTAL_QUESTIONS}
        label={`${questionNumber}/${TOTAL_QUESTIONS}`}
        onClose={handleClose}
      />

      {currentQuestion && (
        <div className="tap__body">
          <div className="tap__prompt">
            <span className="tap__badge">TAP THE SIGN</span>
            <p className="tap__lead">Tap the sign that means</p>
            <h1
              className={
                isShortCaption(currentQuestion.answer.name)
                  ? 'tap__heading'
                  : 'tap__heading tap__heading--long'
              }
              data-answer-id={currentQuestion.answer.id}
            >
              {currentQuestion.answer.name}
            </h1>
          </div>

          <div className="tap__grid">
            {currentQuestion.options.map((option, index) => {
              const feedback = feedbackFor(option, currentQuestion, selection);
              return (
                <button
                  key={option.id}
                  type="button"
                  className="tap__tile"
                  data-sign-id={option.id}
                  data-feedback={feedback}
                  aria-label={`Option ${OPTION_LETTERS[index]}`}
                  disabled={selection !== null}
                  onClick={() => handleTap(option, currentQuestion)}
                >
                  <span className="tap__picture">
                    <SignImage sign={option} alt="" />
                  </span>
                  {(feedback === 'right' || feedback === 'answer') && (
                    <span className="tap__tick" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="3.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {currentQuestion && selection && sheet && (
        <QuizSheet
          outcome={sheet.outcome}
          xpGained={sheet.xpGained}
          inARow={streak}
          answerName={sheet.answerName}
          ruleSentence={sheet.ruleSentence}
          hook={sheet.hook}
          onSignPage={() => navigate(`/learn/signs/${currentQuestion.answer.id}`)}
          onContinue={handleContinue}
        />
      )}

      {finished && (
        <div className="tap__summary">
          <h1 className="tap__summary-heading">Round complete</h1>
          <p className="tap__summary-score">{`${rightCount} of ${TOTAL_QUESTIONS} right`}</p>
          <div className="tap__summary-xp">{`+${rightCount * 10} XP`}</div>
          <div className="tap__summary-actions">
            <Button variant="secondary" onClick={handleClose}>
              Done
            </Button>
            <Button variant="primary" onClick={handlePlayAgain}>
              Play again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TapTheSignScreen;
