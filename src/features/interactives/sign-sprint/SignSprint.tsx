// Sign Sprint: /practice/sprint (mounted lazily from ../registry by
// src/app/routes.tsx). A full-screen layer over the app shell (scout-e.md's
// SprintPlay and SprintEnd artboards; plan.md Step 24 and amendment E27).
// The play screen: GameTopBar (Close, the time left as a bar and an m:ss
// clock), the SIGN SPRINT badge beside the score (a +10 XP pop after each
// right answer), a roadside scene whose sign (carrying data-answer-id)
// drives in on each new question, "Name this sign" and four lettered
// option buttons. A wrong answer frames the right option green and the
// chosen one red for ./sprint's REVEAL_MS, while every option is disabled.
// The round runs on ./sprint's reducer, fed by an injected clock (`now`,
// Date.now by default) that is read only in event handlers, the interval
// callback and the loadSigns callback -- never during render. When time is
// up, the end screen shows the round's score and XP, the best score and day
// streak read back from the progress store, and the missed signs, each
// linking to its sign page, with Done and Play again. Progress writes
// (recordAnswer per accepted tap, then recordRoundFinished once per round)
// run through one promise chain held in a ref, in answer order; the end
// screen renders only after that chain settles, and a failed write is
// logged and play continues. Every random choice is seeded from the Web
// Crypto RNG, only in the loadSigns callback and the Play again handler.
// Depends on: react, react-router-dom, lucide-react (ChevronRight),
// ../../../content/signs (loadSigns), ../../../content/schemas (Sign type),
// ../../../engine/progress-state (useProgressStore), ../../../ui (Button),
// ../shared/GameTopBar, ../shared/SignImage, ../shared/random (mulberry32),
// ../shared/useReducedMotion, ./sprint, ./sprint.css.
// Depended on by: ./index.tsx, tests/unit/sign-sprint.test.tsx.

import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { loadSigns } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import { useProgressStore } from '../../../engine/progress-state';
import { Button } from '../../../ui';
import GameTopBar from '../shared/GameTopBar';
import SignImage from '../shared/SignImage';
import { mulberry32 } from '../shared/random';
import { useReducedMotion } from '../shared/useReducedMotion';
import {
  SPRINT_MS,
  TICK_MS,
  acceptsAnswer,
  buildSprintDeck,
  currentQuestion,
  formatClock,
  initialSprintState,
  sprintReducer,
  timeLeft,
  type SprintQuestion,
} from './sprint';
import './sprint.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

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
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(sprintReducer, undefined, initialSprintState);
  const [settledDeck, setSettledDeck] = useState<SprintQuestion[] | null>(null);

  const summary = useProgressStore((s) => s.summary);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);

  const signsRef = useRef<Sign[] | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const finishedDeckRef = useRef<SprintQuestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        signsRef.current = signs;
        dispatch({
          type: 'start',
          deck: buildSprintDeck(signs, mulberry32(randomSeed())),
          now: now(),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, [now]);

  const running = state.phase === 'playing' || state.phase === 'reveal';

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      dispatch({ type: 'tick', now: now() });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [running, now]);

  useEffect(() => {
    if (state.phase !== 'finished') return;
    const deck = state.deck;
    if (finishedDeckRef.current === deck) return;
    finishedDeckRef.current = deck;
    const sprintScore = state.score;
    queueWrite(writeChainRef, () => recordRoundFinished({ sprintScore }));
    void writeChainRef.current.then(() => setSettledDeck(deck));
  }, [state.phase, state.deck, state.score, recordRoundFinished]);

  function handleClose(): void {
    navigate('/practice');
  }

  function handleAnswer(option: Sign): void {
    const question = currentQuestion(state);
    if (!question) return;
    const at = now();
    if (!acceptsAnswer(state, at)) return;
    const right = option.id === question.answer.id;
    dispatch({ type: 'answer', signId: option.id, now: at });
    queueWrite(writeChainRef, () => recordAnswer(question.answer.id, right));
  }

  function handlePlayAgain(): void {
    const signs = signsRef.current;
    if (!signs) return;
    writeChainRef.current = Promise.resolve();
    setSettledDeck(null);
    dispatch({ type: 'start', deck: buildSprintDeck(signs, mulberry32(randomSeed())), now: now() });
  }

  const rootClassName = ['sprint', reducedMotion ? 'sprint--static' : 'sprint--animated'].join(' ');
  const showEnd = state.phase === 'finished' && settledDeck === state.deck;

  if (showEnd) {
    return (
      <div className={rootClassName}>
        <div className="sprint-end">
          <div className="sprint-end__header">
            <button
              type="button"
              className="sprint-end__close"
              aria-label="Close"
              onClick={handleClose}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <h1 className="sprint-end__title">Sign Sprint</h1>
          </div>

          <div className="sprint-end__panel">
            <div className="sprint-end__frame">
              <p className="sprint-end__label">Time’s up</p>
              <div className="sprint-end__result">
                <span className="sprint-end__score">{state.score}</span>
                <span className="sprint-end__named">
                  <span className="sprint-end__named-text">
                    {state.score === 1 ? 'sign named' : 'signs named'}
                  </span>
                  <span className="sprint-end__seconds">in 60 seconds</span>
                </span>
              </div>
              <div className="sprint-end__chips">
                <span className="sprint-end__xp">{`+${state.score * 10} XP`}</span>
                <span className="sprint-end__best">{`Best ${summary.sprintBest}`}</span>
                <span className="sprint-end__streak">
                  <svg
                    className="sprint-end__flame"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 2.5c.8 3.3 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.3 1.1-4 2.5-5.4.2 1.7 1 2.8 2.2 3.2.7-2.9.2-5.4.8-8.3Z" />
                  </svg>
                  <span>{`${summary.streak}-day streak`}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="sprint-end__missed-heading">
            <h2 className="sprint-end__missed-title">Missed signs</h2>
            <span className="sprint-end__missed-count">{state.missed.length}</span>
          </div>

          {state.missed.length > 0 && (
            <ul className="sprint-end__missed-list">
              {state.missed.map((sign) => (
                <li key={sign.id} className="sprint-end__missed-item">
                  <Link to={`/learn/signs/${sign.id}`} className="sprint-end__missed-row">
                    <span className="sprint-end__missed-picture">
                      <SignImage sign={sign} alt="" />
                    </span>
                    <span className="sprint-end__missed-caption">{sign.name}</span>
                    <ChevronRight
                      size={22}
                      strokeWidth={2.2}
                      className="sprint-end__missed-chevron"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="sprint-end__actions">
            <Button variant="secondary" onClick={handleClose}>
              Done
            </Button>
            <Button variant="primary" onClick={handlePlayAgain}>
              Play again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const question = currentQuestion(state);
  const revealing = state.phase === 'reveal';
  const left = timeLeft(state);

  return (
    <div className={rootClassName}>
      <GameTopBar
        progress={left / SPRINT_MS}
        label={formatClock(left)}
        labelTone="ink"
        onClose={handleClose}
      />

      {question && (
        <div className="sprint__play">
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
            <div key={state.index} className="sprint__sign" data-answer-id={question.answer.id}>
              <span className="sprint__picture">
                <SignImage sign={question.answer} alt="Sign to name" />
              </span>
            </div>
          </div>

          <h1 className="sprint__prompt">Name this sign</h1>

          <div className="sprint__options">
            {question.options.map((option, optionIndex) => {
              let feedback: 'answer' | 'wrong' | undefined;
              if (revealing && option.id === question.answer.id) feedback = 'answer';
              else if (revealing && option.id === state.chosenId) feedback = 'wrong';
              return (
                <button
                  key={`${state.index}-${option.id}`}
                  type="button"
                  className="sprint__option"
                  data-sign-id={option.id}
                  data-feedback={feedback}
                  disabled={revealing}
                  onClick={() => handleAnswer(option)}
                >
                  <span className="sprint__letter" aria-hidden="true">
                    {OPTION_LETTERS[optionIndex]}
                  </span>
                  <span className="sprint__caption">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SignSprint;
