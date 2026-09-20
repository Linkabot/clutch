// Sign Sprint: /practice/sprint (mounted lazily from ../registry by
// src/app/routes.tsx). A full-screen layer over the app shell (scout-e.md's
// SprintPlay artboard; plan.md Step 24, amendment E27, Step 8/E14, Step 9
// and Step 10 with amendment E23). The layer holds one of three things,
// with the Q8 VoiceOver note outside them all so it is announced once per
// visit: ./SprintStart (the start page, shown when the game opens, after
// Done, and after Finish before a single answer), the play screen, or the
// shared EndScreen.
// The play screen is rendered through the shared QuestionScreen: the top
// bar (Close, a progress bar, and either the time left as an m:ss clock or
// -- on a No limit round, whose bar stays full -- a Finish button, P12),
// then the question region: the SIGN SPRINT badge beside the score (a +10
// XP pop after each right answer), a roadside scene whose sign (carrying
// data-answer-id) drives in on each new question, "Name this sign" and
// four lettered option buttons captioned with gameName(), so STOP and GIVE
// WAY read as the Highway Code names them (Q7, Q2). A wrong answer frames
// the right option green and the chosen one red for ./sprint's REVEAL_MS,
// while every option is disabled. The round runs on ./sprint's reducer at
// the length chosen on the start page, fed by an injected clock (`now`,
// Date.now by default) that is read only in event handlers, the interval
// callback and the Start handler -- never during render. The catalogue
// loads once per visit here (the start page needs it to count, Play again
// needs it to deal again); a failed load is the start page's own notice,
// whose Retry (an attempt counter set from the click handler, never from
// the effect body) loads it again.
// A timed round ends on the clock and a No limit round ends on Finish
// (before any answer, Finish goes back to the start page and records
// nothing); ✕ always leaves through useExitGame (Q19) with no ending at
// all -- even in the moment a finished round's last write is still
// settling, when what runs afterwards finds the layer gone and shows,
// remembers and navigates nothing (amendment E24 (d)). The ending is the
// shared EndScreen (Q18): the score in its Q9 band
// panel -- scaled to the round's length, or to what a No limit round
// answered -- the XP (none at 0, and no pop), the best for that length and
// the day streak, a "Collected!" line, a notice per sign lost to Q12's
// three-wrong-in-a-row rule with a family round to practise, the gentle
// zero line when nothing was named but something was missed (Q9, amendment
// P8), then the missed signs, each opening its sign page. Done clears the
// entry's round and comes back to the start page on the same URL (Q11);
// Play again deals a new deck from the same choices. Progress writes
// (recordAnswer per accepted tap, then one recordRoundFinished carrying
// the game, score, length and answers) run through a single promise chain
// held in a ref, in answer order; the ending renders only after that chain
// settles, so its collected and lost lists are complete, and a failed
// write is logged and play continues. When the ending is about to show it
// is stored with rememberRound('sprint', ...) and its id put in this
// history entry, so a sign page opened from a missed row and then Back
// returns to the same end screen (M25, M27). Every random choice is seeded
// from the Web Crypto RNG, only in the Start and Play again handlers.
// Depends on: react, react-router-dom, ../../../content/signs (loadSigns,
// gameName), ../../../content/schemas (Sign type),
// ../../../engine/progress (SprintLengthId type),
// ../../../engine/progress-store (SprintChoices type),
// ../../../engine/progress-state (useProgressStore),
// ../../../engine/round-memory (rememberRound, recallRound, forgetRound),
// ../../../engine/score-band (scoreBand, sprintBandMax),
// ../shared/QuestionScreen (which renders the top bar and the option
// buttons), ../shared/EndScreen, ../shared/VisualGameNote, ../shared/exit
// (useExitGame), ../shared/SignImage, ../shared/random (mulberry32),
// ../shared/useReducedMotion, ./SprintStart, ./sprint, ./sprint.css.
// Depended on by: ./index.tsx, tests/unit/sign-sprint.test.tsx,
// tests/unit/sprint-start.test.tsx.

import { useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadSigns, gameName } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import type { SprintLengthId } from '../../../engine/progress';
import type { SprintChoices } from '../../../engine/progress-store';
import { useProgressStore } from '../../../engine/progress-state';
import { forgetRound, recallRound, rememberRound } from '../../../engine/round-memory';
import { scoreBand, sprintBandMax, type ScoreBand } from '../../../engine/score-band';
import QuestionScreen from '../shared/QuestionScreen';
import EndScreen from '../shared/EndScreen';
import VisualGameNote from '../shared/VisualGameNote';
import { useExitGame } from '../shared/exit';
import SignImage from '../shared/SignImage';
import { mulberry32 } from '../shared/random';
import { useReducedMotion } from '../shared/useReducedMotion';
import SprintStart from './SprintStart';
import {
  TICK_MS,
  acceptsAnswer,
  buildSprintDeck,
  currentQuestion,
  formatClock,
  initialSprintState,
  lengthMs,
  sprintReducer,
  timeLeft,
  type SprintQuestion,
} from './sprint';
import './sprint.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** Q9's gentle zero, exactly as Lincoln saw it (amendment P8). */
const ZERO_LINE = 'No signs named this time — have a look at the ones below.';

/** The end screen's small line under the score, per timed length (amendment E23 (f)). */
const TIMED_SCORE_SUB: Record<Exclude<SprintLengthId, 'none'>, string> = {
  '30s': 'in 30 seconds',
  '1m': 'in 60 seconds',
  '5m': 'in 5 minutes',
};

/** Everything the end screen needs, so Back can draw it again (M25, M27). */
interface SprintEnding {
  score: number;
  xp: number;
  length: SprintLengthId;
  families: string[];
  answered: number;
  missed: Sign[];
  collected: Sign[];
  lost: Sign[];
}

/** Q9's band: a timed round is judged against its length's maximum, a No limit round against what it answered. */
function endingBand(ending: SprintEnding): ScoreBand {
  return ending.length === 'none'
    ? scoreBand(ending.score, ending.answered)
    : scoreBand(ending.score, sprintBandMax(ending.length));
}

function endingScoreSub(ending: SprintEnding): string {
  return ending.length === 'none'
    ? `of ${ending.answered} answered`
    : TIMED_SCORE_SUB[ending.length];
}

interface SignSprintProps {
  /** The clock the round reads (milliseconds); injected by tests. */
  now?: () => number;
}

function systemNow(): number {
  return Date.now();
}

/** A 32-bit seed drawn from the Web Crypto RNG. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Appends `write` to the chain held in `chain`, in call order; a failed write is logged and the chain carries on. */
function queueWrite(chain: { current: Promise<void> }, write: () => Promise<void>): void {
  chain.current = chain.current.then(write).catch((error: unknown) => {
    console.error(error);
  });
}

function SignSprint({ now = systemNow }: SignSprintProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const exitGame = useExitGame();
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(sprintReducer, undefined, initialSprintState);

  // The ending this history entry left behind, if it is still the current
  // round (M25, M27). Read once, at mount, from the entry's own state.
  const [recalled] = useState<SprintEnding | undefined>(() => {
    const roundId = (location.state as { roundId?: string } | null)?.roundId;
    return roundId === undefined ? undefined : recallRound<SprintEnding>('sprint', roundId);
  });

  const [ending, setEnding] = useState<SprintEnding | null>(recalled ?? null);
  const [signs, setSigns] = useState<Sign[] | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [choices, setChoices] = useState<SprintChoices>(
    recalled
      ? { length: recalled.length, families: recalled.families }
      : { length: '1m', families: [] },
  );

  const summary = useProgressStore((s) => s.summary);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);

  const signsRef = useRef<Sign[] | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const finishedDeckRef = useRef<SprintQuestion[] | null>(null);
  const collectedRef = useRef<Sign[]>(recalled?.collected ?? []);
  const lostRef = useRef<Sign[]>(recalled?.lost ?? []);
  // False once the layer has gone: the round's last write can settle after
  // ✕ has left the game, and what runs then must not bring the player back
  // (amendment E24 (d)).
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((loaded) => {
        if (cancelled) return;
        signsRef.current = loaded;
        setSigns(loaded);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Retry after a failed load: the counter is bumped here, never in the effect body. */
  function handleRetry(): void {
    setLoadState('loading');
    setAttempt((a) => a + 1);
  }

  const running = state.phase === 'playing' || state.phase === 'reveal';

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      dispatch({ type: 'tick', now: now() });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [running, now]);

  const { phase, deck, score, xp, length, answered, missed } = state;
  const roundFamilies = choices.families;

  useEffect(() => {
    if (phase !== 'finished') return;
    if (finishedDeckRef.current === deck) return;
    finishedDeckRef.current = deck;
    queueWrite(writeChainRef, () =>
      recordRoundFinished({
        game: 'sprint',
        sprintScore: score,
        sprintLength: length,
        sprintAnswered: answered,
      }),
    );
    void writeChainRef.current.then(() => {
      // ✕ during the write: the round is recorded, but there is no ending
      // to show, nothing to remember and nowhere to navigate (E24 (d)).
      if (!mountedRef.current) return;
      const finished: SprintEnding = {
        score,
        xp,
        length,
        families: [...roundFamilies],
        answered,
        missed,
        collected: collectedRef.current,
        lost: lostRef.current,
      };
      setEnding(finished);
      // The ending is remembered on THIS entry, so opening a missed sign
      // and coming Back draws the same end screen again (M25, M27).
      const roundId = rememberRound('sprint', finished);
      navigate(location.pathname, { replace: true, state: { roundId } });
    });
  }, [
    phase,
    deck,
    score,
    xp,
    length,
    answered,
    missed,
    roundFamilies,
    recordRoundFinished,
    navigate,
    location.pathname,
  ]);

  function startRound(roundChoices: SprintChoices): void {
    const catalogue = signsRef.current;
    if (!catalogue) return;
    writeChainRef.current = Promise.resolve();
    collectedRef.current = [];
    lostRef.current = [];
    setEnding(null);
    dispatch({
      type: 'start',
      deck: buildSprintDeck(catalogue, mulberry32(randomSeed()), roundChoices.families),
      length: roundChoices.length,
      now: now(),
    });
  }

  /** Start on the start page: the choices are already saved (amendment E23 (c)). */
  function handleStart(nextChoices: SprintChoices): void {
    setChoices(nextChoices);
    startRound(nextChoices);
  }

  function handleAnswer(option: Sign): void {
    const question = currentQuestion(state);
    if (!question) return;
    const at = now();
    if (!acceptsAnswer(state, at)) return;
    const right = option.id === question.answer.id;
    dispatch({ type: 'answer', signId: option.id, now: at });
    queueWrite(writeChainRef, async () => {
      const result = await recordAnswer(question.answer.id, right);
      if (result.collectedNow) collectedRef.current = [...collectedRef.current, question.answer];
      if (result.lostNow) lostRef.current = [...lostRef.current, question.answer];
    });
  }

  /** A No limit round's only ending; before a single answer it goes back to the start page instead (P12). */
  function handleFinish(): void {
    if (state.answered === 0) {
      dispatch({ type: 'reset' });
      return;
    }
    dispatch({ type: 'finish' });
  }

  function handlePlayAgain(): void {
    forgetRound('sprint');
    startRound(choices);
  }

  /** Done: the round is forgotten, this entry's state cleared, and the start page shown on the same URL (Q11). */
  function handleDone(): void {
    forgetRound('sprint');
    navigate(location.pathname, { replace: true, state: null });
    setEnding(null);
    dispatch({ type: 'reset' });
  }

  /** The end screen's lost-sign button: a fresh Tap round of that sign's family (Q12), pushed so Back returns here. */
  function handlePractise(sign: Sign): void {
    navigate(`/practice/tap?family=${sign.family}`);
  }

  const question = currentQuestion(state);
  const revealing = state.phase === 'reveal';
  const left = timeLeft(state);
  const rootClassName = ['sprint', reducedMotion ? 'sprint--static' : 'sprint--animated'].join(' ');

  // A No limit round's bar is full and its slot holds Finish: left and
  // lengthMs are both Infinity, whose ratio is NaN (scan S11).
  const topBar =
    state.length === 'none'
      ? { progress: 1, action: { label: 'Finish', onClick: handleFinish }, onClose: exitGame }
      : {
          progress: left / lengthMs(state.length),
          label: formatClock(left),
          labelTone: 'ink' as const,
          onClose: exitGame,
        };

  return (
    <div className={rootClassName}>
      <VisualGameNote />

      {ending ? (
        <EndScreen
          title="Sign Sprint"
          onClose={exitGame}
          heading={ending.length === 'none' ? 'Round complete' : 'Time’s up'}
          scoreBig={`${ending.score}`}
          scoreText={ending.score === 1 ? 'sign named' : 'signs named'}
          scoreSub={endingScoreSub(ending)}
          band={endingBand(ending)}
          xp={ending.xp}
          best={`Best ${summary.sprintBests[ending.length]}`}
          streak={summary.streak}
          collected={ending.collected}
          lost={ending.lost}
          zeroLine={ending.score === 0 && ending.missed.length > 0 ? ZERO_LINE : undefined}
          listHeading="Missed signs"
          listCount={ending.missed.length}
          listSigns={ending.missed}
          onDone={handleDone}
          onPlayAgain={handlePlayAgain}
          onPractise={handlePractise}
        />
      ) : state.phase === 'ready' ? (
        <SprintStart
          signs={signs}
          loadState={loadState}
          onRetry={handleRetry}
          onStart={handleStart}
          onClose={exitGame}
        />
      ) : (
        <QuestionScreen
          topBar={topBar}
          loadState="ready"
          onRetry={handleRetry}
          regionClassName="sprint__play"
          optionsClassName="sprint__options"
          optionClassName="sprint__option"
          prompt={
            question && (
              <>
                <div className="sprint__status">
                  <span className="sprint__badge">SIGN SPRINT</span>
                  <div className="sprint__score-group">
                    {state.lastAnswerRight && (
                      <span key={state.score} className="sprint__xp">
                        +10 XP
                      </span>
                    )}
                    <span className="sprint__tick" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="3.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span className="sprint__score">{state.score}</span>
                  </div>
                </div>

                <div className="sprint__panel">
                  <div className="sprint__ground" />
                  <div className="sprint__tree sprint__tree--1" />
                  <div className="sprint__tree sprint__tree--2" />
                  <div className="sprint__tree sprint__tree--3" />
                  <div className="sprint__tree sprint__tree--4" />
                  <div className="sprint__post" />
                  <div
                    key={state.index}
                    className="sprint__sign"
                    data-answer-id={question.answer.id}
                  >
                    <span className="sprint__picture">
                      <SignImage sign={question.answer} alt="Sign to name" />
                    </span>
                  </div>
                </div>

                <h1 className="sprint__prompt">Name this sign</h1>
              </>
            )
          }
          options={question ? question.options : []}
          optionKey={(option) => `${state.index}-${option.id}`}
          optionAttributes={(option) => ({ 'data-sign-id': option.id })}
          feedbackFor={(option) => {
            if (!revealing || !question) return undefined;
            if (option.id === question.answer.id) return 'answer';
            if (option.id === state.chosenId) return 'wrong';
            return undefined;
          }}
          renderOption={(option, optionIndex) => (
            <>
              <span className="sprint__letter" aria-hidden="true">
                {OPTION_LETTERS[optionIndex]}
              </span>
              <span className="sprint__caption">{gameName(option)}</span>
            </>
          )}
          disabled={revealing}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}

export default SignSprint;
