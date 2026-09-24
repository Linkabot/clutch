// Tap the sign: /practice/tap (src/app/routes.tsx), reading an optional
// ?family= (Q12) to play a round of just that family's signs -- the sign
// page's "Practise signs like this" link, and the end screen's own lost-sign
// button. An unknown or absent value plays the whole catalogue; either way
// the options still come from every sign, so the look-alike distractor
// tiers keep their candidates (./round's buildTapRound, amendment E16 (d)).
// A full-screen layer over the app shell (scout-e.md's Tap the sign
// artboard; plan.md Step 23, amendments E25-E26, Step 8/E14 and Step 9),
// played through the shared QuestionScreen: the top bar (close, progress,
// N/10), then the question region (a "TAP THE SIGN" badge, the prompt
// caption -- the page's only heading, carrying data-answer-id, showing
// gameName() so STOP and GIVE WAY read as the Highway Code names them (Q7)
// -- and a 2x2 grid of option tiles whose pictures fill them (M34)). A tap
// locks the grid -- every tile gets data-feedback (right/wrong/answer/dim)
// and a tick badge pops on the right tile -- then the quiz sheet shows
// ./round's sheetContent (E26: its outcome and XP compare the tap to the
// answer, but its label, explanation and tip always come from the answer,
// never the tapped sign), records the answer and hands Continue to the next
// question. A failed load shows the question screen's failure notice
// instead, whose Retry (a counter set from the click handler, never from
// the effect body) loads the catalogue again and builds a fresh round.
// Progress writes (recordAnswer, then recordRoundFinished with game 'tap'
// after question 10) run through one promise chain in answer order, held in
// a ref, so the shared EndScreen (Q18) only renders once every write has
// settled and its collected/lost lists are complete. That end screen
// replaces the question screen entirely: the round's score in a Q9 band
// panel, the XP and streak, a "Collected!" line, a notice per sign lost to
// Q12's three-wrong-in-a-row rule, then "Signs to look at again" -- the
// round's wrong answers, in order -- with Done and Play again. Close and
// Done both go through useExitGame (Q19). Before the quiz sheet's "Sign
// page" leaves, and again when the round ends, the whole round is stored
// with rememberRound('tap', ...) and its id put in this entry's history
// state, so Back resumes the round with its sheet open, or shows the same
// end screen (M25, M27); Play again and a fresh visit start a new round.
// The VoiceOver note (Q8) sits outside the finished/not-finished branch so
// it is announced once per visit, not once per round. Every random choice
// is seeded from the Web Crypto RNG (never a floating-point pseudo-random
// call or the wall clock), and only inside a loadSigns/Play-again callback,
// never during render.
// Depends on: react, react-router-dom, ../../../content/signs (loadSigns,
// gameName), ../../../content/schemas (Sign, SignFamily types),
// ../../../engine/progress-state (useProgressStore),
// ../../../engine/round-memory (rememberRound, recallRound, forgetRound),
// ../../../engine/score-band (scoreBand), ../../signs/families (FAMILIES),
// ../../signs/filter (filterSigns), ../../interactives/shared/QuestionScreen
// (which renders the top bar, the option buttons and the quiz sheet),
// ../../interactives/shared/EndScreen, ../../interactives/shared/
// VisualGameNote, ../../interactives/shared/exit (useExitGame),
// ../../interactives/shared/SignImage, ../../interactives/shared/distractors
// (isShortCaption), ../../interactives/shared/random (mulberry32),
// ../../interactives/shared/useReducedMotion, ./round (buildTapRound,
// sheetContent, TapQuestion), ./tap.css.
// Depended on by: src/app/routes.tsx, tests/unit/tap-the-sign.test.tsx.

import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loadSigns, gameName } from '../../../content/signs';
import type { Sign, SignFamily } from '../../../content/schemas';
import { useProgressStore } from '../../../engine/progress-state';
import { forgetRound, recallRound, rememberRound } from '../../../engine/round-memory';
import { scoreBand } from '../../../engine/score-band';
import { FAMILIES } from '../../signs/families';
import { filterSigns } from '../../signs/filter';
import QuestionScreen from '../../interactives/shared/QuestionScreen';
import EndScreen from '../../interactives/shared/EndScreen';
import VisualGameNote from '../../interactives/shared/VisualGameNote';
import { useExitGame } from '../../interactives/shared/exit';
import SignImage from '../../interactives/shared/SignImage';
import { isShortCaption } from '../../interactives/shared/distractors';
import { mulberry32 } from '../../interactives/shared/random';
import { useReducedMotion } from '../../interactives/shared/useReducedMotion';
import { buildTapRound, sheetContent, type TapQuestion } from './round';
import './tap.css';

type LoadStatus = 'loading' | 'ready' | 'error';
type TileFeedback = 'right' | 'wrong' | 'answer' | 'dim';
type Selection = { chosenId: string; correct: boolean } | null;

/** Everything Back has to bring back: the round and where the player was in it (M25, M27). */
interface TapSnapshot {
  round: TapQuestion[];
  questionIndex: number;
  selection: Selection;
  streak: number;
  rightCount: number;
  finished: boolean;
  collected: Sign[];
  lost: Sign[];
  wrongAnswers: Sign[];
}

const TOTAL_QUESTIONS = 10;
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/**
 * filterSigns' progress argument. The family filter never asks for
 * collected-only, so the map is never read -- a shared empty one keeps the
 * round out of the progress store's re-render path.
 */
const NO_PROGRESS = new Map<string, number>();

/** A 32-bit seed drawn from the Web Crypto RNG -- never a pseudo-random float call or the wall clock. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** The ?family= value when it names a real family (Q12), else null. */
function familyParam(value: string | null): SignFamily | null {
  const match = FAMILIES.find((family) => family.id === value);
  return match ? match.id : null;
}

/** The answers a round may ask about: one family's signs (Q12), or every sign. */
function poolFor(signs: Sign[], family: SignFamily | null): Sign[] {
  return family === null ? signs : filterSigns(signs, family, false, NO_PROGRESS);
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
  const location = useLocation();
  const exitGame = useExitGame();
  const [searchParams] = useSearchParams();
  const family = familyParam(searchParams.get('family'));
  const reducedMotion = useReducedMotion();

  // The round this history entry left behind, if it is still the current
  // one (M25, M27). Read once, at mount, from the entry's own state.
  const [recalled] = useState<TapSnapshot | undefined>(() => {
    const roundId = (location.state as { roundId?: string } | null)?.roundId;
    return roundId === undefined ? undefined : recallRound<TapSnapshot>('tap', roundId);
  });

  const [status, setStatus] = useState<LoadStatus>(recalled ? 'ready' : 'loading');
  const [startCount, setStartCount] = useState(0);
  const [round, setRound] = useState<TapQuestion[]>(recalled?.round ?? []);
  const [questionIndex, setQuestionIndex] = useState(recalled?.questionIndex ?? 0);
  const [selection, setSelection] = useState<Selection>(recalled?.selection ?? null);
  const [streak, setStreak] = useState(recalled?.streak ?? 0);
  const [rightCount, setRightCount] = useState(recalled?.rightCount ?? 0);
  const [finished, setFinished] = useState(recalled?.finished ?? false);
  const [collected, setCollected] = useState<Sign[]>(recalled?.collected ?? []);
  const [lost, setLost] = useState<Sign[]>(recalled?.lost ?? []);
  const [wrongAnswers, setWrongAnswers] = useState<Sign[]>(recalled?.wrongAnswers ?? []);

  const summary = useProgressStore((s) => s.summary);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const collectedRef = useRef<Sign[]>(recalled?.collected ?? []);
  const lostRef = useRef<Sign[]>(recalled?.lost ?? []);

  // The round's last write can settle after ✕ has closed the game; finish()
  // must not then navigate back to the game or remember the round (U9, the
  // same guard as Sign Sprint's, Decision 24). Setting true on every mount
  // survives StrictMode's mount, unmount, mount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // A recalled round is already on screen; only a Retry, a Play again or
    // a new ?family= (all of which bump startCount) builds another.
    if (recalled !== undefined && startCount === 0) return;
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        setRound(buildTapRound(poolFor(signs, family), signs, mulberry32(randomSeed())));
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [recalled, startCount, family]);

  /** Clears the round on screen and asks the effect above for a fresh one. */
  function startNewRound(): void {
    forgetRound('tap');
    writeChainRef.current = Promise.resolve();
    collectedRef.current = [];
    lostRef.current = [];
    setStatus('loading');
    setRound([]);
    setQuestionIndex(0);
    setSelection(null);
    setStreak(0);
    setRightCount(0);
    setFinished(false);
    setCollected([]);
    setLost([]);
    setWrongAnswers([]);
    setStartCount((count) => count + 1);
  }

  /** Retry after a failed load: the counter is bumped here, never in the effect body. */
  function handleRetry(): void {
    startNewRound();
  }

  function queueWrite(write: () => Promise<void>): void {
    writeChainRef.current = writeChainRef.current.then(write).catch((error: unknown) => {
      console.error(error);
    });
  }

  /**
   * Stores the round as it stands and puts its id in THIS history entry, so
   * coming Back to the entry restores it rather than starting again (M27).
   */
  function rememberCurrentRound(snapshot: TapSnapshot): void {
    const roundId = rememberRound('tap', snapshot);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { roundId } });
  }

  function snapshotNow(overrides: Partial<TapSnapshot> = {}): TapSnapshot {
    return {
      round,
      questionIndex,
      selection,
      streak,
      rightCount,
      finished,
      collected,
      lost,
      wrongAnswers,
      ...overrides,
    };
  }

  function handleTap(option: Sign, question: TapQuestion): void {
    if (selection) return;
    const correct = option.id === question.answer.id;
    setSelection({ chosenId: option.id, correct });
    setStreak((previous) => (correct ? previous + 1 : 0));
    if (correct) setRightCount((previous) => previous + 1);
    else setWrongAnswers((previous) => [...previous, question.answer]);

    queueWrite(async () => {
      const result = await recordAnswer(question.answer.id, correct);
      if (result.collectedNow) collectedRef.current = [...collectedRef.current, question.answer];
      if (result.lostNow) lostRef.current = [...lostRef.current, question.answer];
    });
    if (questionIndex === round.length - 1) {
      queueWrite(() => recordRoundFinished({ game: 'tap' }));
    }
  }

  function finish(): void {
    if (!mountedRef.current) return;
    const endCollected = collectedRef.current;
    const endLost = lostRef.current;
    setCollected(endCollected);
    setLost(endLost);
    setFinished(true);
    rememberCurrentRound(
      snapshotNow({ finished: true, collected: endCollected, lost: endLost, selection: null }),
    );
  }

  function handleContinue(): void {
    if (!selection) return;
    if (questionIndex === round.length - 1) {
      writeChainRef.current.then(finish).catch((error: unknown) => {
        console.error(error);
        finish();
      });
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelection(null);
  }

  function handlePlayAgain(): void {
    startNewRound();
  }

  /** The end screen's lost-sign button: a fresh round of that sign's family (Q12). */
  function handlePractise(sign: Sign): void {
    navigate(`/practice/tap?family=${sign.family}`, { replace: true });
    startNewRound();
  }

  const currentQuestion = status === 'ready' && !finished ? round[questionIndex] : undefined;
  const sheet =
    currentQuestion && selection ? sheetContent(currentQuestion, selection.chosenId) : null;
  const questionNumber = status === 'ready' ? Math.min(questionIndex + 1, TOTAL_QUESTIONS) : 0;
  const rootClassName = ['tap', reducedMotion ? 'tap--static' : 'tap--animated'].join(' ');

  const sheetProps =
    currentQuestion && selection && sheet
      ? {
          outcome: sheet.outcome,
          xpGained: sheet.xpGained,
          inARow: streak,
          answerLabel: sheet.answerName,
          explanation: sheet.ruleSentence,
          tip: sheet.hook,
          more: {
            label: 'Sign page',
            onClick: () => {
              rememberCurrentRound(snapshotNow());
              navigate(`/learn/signs/${currentQuestion.answer.id}`);
            },
          },
          onContinue: handleContinue,
        }
      : null;

  return (
    <div className={rootClassName}>
      <VisualGameNote />

      {finished ? (
        <EndScreen
          title="Tap the sign"
          onClose={exitGame}
          heading="Round complete"
          scoreBig={`${rightCount}`}
          scoreText={`of ${TOTAL_QUESTIONS} right`}
          band={scoreBand(rightCount, TOTAL_QUESTIONS)}
          xp={rightCount * 10}
          streak={summary.streak}
          collected={collected}
          lost={lost}
          listHeading="Signs to look at again"
          listCount={wrongAnswers.length}
          listSigns={wrongAnswers}
          onDone={exitGame}
          onPlayAgain={handlePlayAgain}
          onPractise={handlePractise}
        />
      ) : (
        <QuestionScreen
          topBar={{
            progress: questionNumber / TOTAL_QUESTIONS,
            label: `${questionNumber}/${TOTAL_QUESTIONS}`,
            onClose: exitGame,
          }}
          loadState={status}
          onRetry={handleRetry}
          regionClassName="tap__body"
          optionsClassName="tap__grid"
          optionClassName="tap__tile"
          prompt={
            currentQuestion && (
              <div className="tap__prompt">
                <span className="tap__badge">TAP THE SIGN</span>
                <p className="tap__lead">Tap the sign that means</p>
                <h1
                  className={
                    isShortCaption(gameName(currentQuestion.answer))
                      ? 'tap__heading'
                      : 'tap__heading tap__heading--long'
                  }
                  data-answer-id={currentQuestion.answer.id}
                >
                  {gameName(currentQuestion.answer)}
                </h1>
              </div>
            )
          }
          options={currentQuestion ? currentQuestion.options : []}
          optionKey={(option) => option.id}
          optionAttributes={(option, index) => ({
            'data-sign-id': option.id,
            'aria-label': `Option ${OPTION_LETTERS[index]}`,
          })}
          feedbackFor={(option) =>
            currentQuestion ? feedbackFor(option, currentQuestion, selection) : undefined
          }
          renderOption={(option) => {
            const feedback = currentQuestion
              ? feedbackFor(option, currentQuestion, selection)
              : undefined;
            return (
              <>
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
              </>
            );
          }}
          disabled={selection !== null}
          onAnswer={(option) => {
            if (currentQuestion) handleTap(option, currentQuestion);
          }}
          sheet={sheetProps}
        />
      )}
    </div>
  );
}

export default TapTheSignScreen;
