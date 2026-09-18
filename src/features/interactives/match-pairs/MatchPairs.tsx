// Match Pairs: /practice/pairs (mounted lazily from ../registry by
// src/app/routes.tsx). A full-screen layer over the app shell (scout-e.md's
// CHOSEN 1A PairsA artboard; plan.md Step 25 and amendment E31): GameTopBar
// (Close, locked pairs as a bar and an n/5 label), the MATCH PAIRS badge,
// "Tap a sign, then its name." and a board of two grid columns of tiles
// (PS29, M14: sign tiles and name tiles are direct grid children sharing
// row tracks, so row N's sign and row N's name always share a top and a
// height) -- 5 sign pictures (Sign 1-5, in pick order) in column 1 and
// their 5 names, shuffled, in column 2. Tapping a sign selects it (a
// yellow halo); tapping its own name
// locks the pair (a green border, a tick and faded content), with a +10 XP
// pop on the name when it was matched on the first try; tapping another
// name flashes that name red for ./pairs' FLASH_MS (shaking only when
// motion is allowed) and clears the selection. The round runs on ./pairs'
// reducer. Progress writes (recordAnswer for each first-try match, then
// recordRoundFinished once per round) run through one promise chain held
// in a ref, in lock order; the end card (All pairs matched, the round's XP,
// Done and Play again) replaces the board once that chain has settled AND
// ./pairs' END_HOLD_MS after the fifth lock, and a failed write is logged
// and play continues. Every random choice is seeded from the Web Crypto
// RNG, only in the loadSigns callback and the Play again handler.
// Depends on: react, react-router-dom, ../../../content/signs (loadSigns),
// ../../../content/schemas (Sign type), ../../../engine/progress-state
// (useProgressStore), ../../../ui (Button), ../shared/GameTopBar,
// ../shared/SignImage, ../shared/random (mulberry32),
// ../shared/useReducedMotion, ./pairs, ./pairs.css.
// Depended on by: ./index.tsx, tests/unit/match-pairs.test.tsx.

import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSigns } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import { useProgressStore } from '../../../engine/progress-state';
import { Button } from '../../../ui';
import GameTopBar from '../shared/GameTopBar';
import SignImage from '../shared/SignImage';
import { mulberry32 } from '../shared/random';
import { useReducedMotion } from '../shared/useReducedMotion';
import {
  END_HOLD_MS,
  FLASH_MS,
  PAIRS_PER_ROUND,
  buildPairsRound,
  initialPairsState,
  pairsReducer,
  type PairsAction,
  type PairsRound,
  type PairsState,
} from './pairs';
import './pairs.css';

type ScreenAction = { type: 'new-round'; round: PairsRound } | PairsAction;

/** The screen's state: null while signs load, then the round's state; `new-round` replaces it whole. */
function screenReducer(state: PairsState | null, action: ScreenAction): PairsState | null {
  if (action.type === 'new-round') return initialPairsState(action.round);
  if (state === null) return state;
  return pairsReducer(state, action);
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

function TickBadge() {
  return (
    <span className="pairs__tick" aria-hidden="true">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function MatchPairs() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(screenReducer, null);
  const [settledRound, setSettledRound] = useState<PairsRound | null>(null);
  const [heldRound, setHeldRound] = useState<PairsRound | null>(null);

  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);

  const signsRef = useRef<Sign[] | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const finishedRoundRef = useRef<PairsRound | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        signsRef.current = signs;
        dispatch({ type: 'new-round', round: buildPairsRound(signs, mulberry32(randomSeed())) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const round = state?.round ?? null;
  const finished = state?.finished ?? false;
  const wrongCount = state?.wrong?.count ?? null;

  // A wrong name's flash: cleared FLASH_MS later, unless a newer wrong attempt replaced it.
  useEffect(() => {
    if (wrongCount === null) return;
    const timeout = setTimeout(() => {
      dispatch({ type: 'flash-over', count: wrongCount });
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [wrongCount]);

  // The round-finished write, queued once per round (the ref guard survives StrictMode's second run).
  useEffect(() => {
    if (!finished || round === null) return;
    if (finishedRoundRef.current === round) return;
    finishedRoundRef.current = round;
    queueWrite(writeChainRef, () => recordRoundFinished({}));
    void writeChainRef.current.then(() => setSettledRound(round));
  }, [finished, round, recordRoundFinished]);

  // The end card's hold: at least END_HOLD_MS after the fifth lock.
  useEffect(() => {
    if (!finished || round === null) return;
    const timeout = setTimeout(() => setHeldRound(round), END_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [finished, round]);

  function handleClose(): void {
    navigate('/practice');
  }

  function handleSignTap(signId: string): void {
    dispatch({ type: 'tap-sign', signId });
  }

  function handleNameTap(signId: string): void {
    if (state === null) return;
    const action: PairsAction = { type: 'tap-name', signId };
    const next = pairsReducer(state, action);
    dispatch(action);
    if (next.earnedIds.length > state.earnedIds.length) {
      queueWrite(writeChainRef, () => recordAnswer(signId, true));
    }
  }

  function handlePlayAgain(): void {
    const signs = signsRef.current;
    if (!signs) return;
    writeChainRef.current = Promise.resolve();
    finishedRoundRef.current = null;
    setSettledRound(null);
    setHeldRound(null);
    dispatch({ type: 'new-round', round: buildPairsRound(signs, mulberry32(randomSeed())) });
  }

  const rootClassName = ['pairs', reducedMotion ? 'pairs--static' : 'pairs--animated'].join(' ');
  const lockedCount = state?.lockedIds.length ?? 0;
  const showEnd =
    state !== null && state.finished && settledRound === state.round && heldRound === state.round;

  return (
    <div className={rootClassName}>
      <GameTopBar
        progress={lockedCount / PAIRS_PER_ROUND}
        label={`${lockedCount}/${PAIRS_PER_ROUND}`}
        labelTone="muted"
        onClose={handleClose}
      />

      {state !== null && (
        <div className="pairs__intro">
          <span className="pairs__badge">MATCH PAIRS</span>
          <h1 className="pairs__prompt">Tap a sign, then its name.</h1>
        </div>
      )}

      {state !== null && showEnd && (
        <div className="pairs__end">
          <h2 className="pairs__end-heading">All pairs matched</h2>
          <div className="pairs__end-xp">{`+${state.xp} XP`}</div>
          <div className="pairs__end-actions">
            <Button variant="secondary" onClick={handleClose}>
              Done
            </Button>
            <Button variant="primary" onClick={handlePlayAgain}>
              Play again
            </Button>
          </div>
        </div>
      )}

      {state !== null && !showEnd && (
        <div className="pairs__board">
          {state.round.signs.map((sign, index) => {
            const locked = state.lockedIds.includes(sign.id);
            const selected = state.selectedId === sign.id;
            return (
              <button
                key={sign.id}
                type="button"
                className="pairs__tile pairs__tile--sign"
                data-pair-sign=""
                data-sign-id={sign.id}
                data-state={locked ? 'locked' : selected ? 'selected' : undefined}
                aria-label={`Sign ${index + 1}`}
                aria-pressed={selected}
                disabled={locked}
                onClick={() => handleSignTap(sign.id)}
              >
                <span className="pairs__content">
                  <span className="pairs__picture">
                    <SignImage sign={sign} alt="" />
                  </span>
                </span>
                {locked && <TickBadge />}
              </button>
            );
          })}

          {state.round.names.map((sign) => {
            const locked = state.lockedIds.includes(sign.id);
            const wrong = !locked && state.wrong?.nameId === sign.id;
            return (
              <button
                key={sign.id}
                type="button"
                className="pairs__tile pairs__tile--name"
                data-pair-name=""
                data-sign-id={sign.id}
                data-state={locked ? 'locked' : wrong ? 'wrong' : undefined}
                disabled={locked}
                onClick={() => handleNameTap(sign.id)}
              >
                <span className="pairs__content">{sign.name}</span>
                {locked && <TickBadge />}
                {locked && state.earnedIds.includes(sign.id) && (
                  <span className="pairs__xp" aria-hidden="true">
                    +10 XP
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MatchPairs;
