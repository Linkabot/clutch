// Match Pairs: /practice/pairs (mounted lazily from ../registry by
// src/app/routes.tsx). A full-screen layer over the app shell (scout-e.md's
// CHOSEN 1A PairsA artboard; plan.md Step 25, amendment E31 and Step 9):
// GameTopBar (Close, locked pairs as a bar and an n/5 label), the MATCH
// PAIRS badge, "Tap a sign, then its name." and a board of two grid columns
// of tiles (PS29, M14: sign tiles and name tiles are direct grid children
// sharing row tracks, so row N's sign and row N's name always share a top
// and a height) -- 5 sign pictures (Sign 1-5, in pick order) in column 1
// and their 5 names, shuffled, in column 2. A name tile shows gameName(),
// so STOP and GIVE WAY read as the Highway Code names them rather than by
// their long KYTS instructions (Q7, Q2; amendment E16 (b)). Tapping a sign
// selects it (a yellow halo); tapping its own name locks the pair (a green
// border, a tick and faded content), with a +10 XP pop on the name when it
// was matched on the first try; tapping another name flashes that name red
// for ./pairs' FLASH_MS (shaking only when motion is allowed) and clears
// the selection. The round runs on ./pairs' reducer. A failed load shows
// the shared LoadFailed notice, whose Retry (a counter set from the click
// handler, never from the effect body) loads the catalogue again and builds
// a fresh round. Progress writes (recordAnswer for each first-try match,
// then recordRoundFinished with game 'pairs' once per round) run through
// one promise chain held in a ref, in lock order; the shared EndScreen
// (Q18) replaces the board once that chain has settled AND ./pairs'
// END_HOLD_MS after the fifth lock -- the pairs matched first time in a Q9
// band panel, the round's XP and the day streak, a "Collected!" line, then
// "Took more than one try" listing the missed signs, with Done and Play
// again. Pairs never reports a wrong answer to the progress store (Q12
// (a)), so it never shows a lost-sign notice, but it passes the same
// onPractise handler Tap does so the prop stays uniform. Close and Done
// both go through useExitGame (Q19). Before an end-screen row leaves, the
// round is stored with rememberRound('pairs', ...) and its id put in this
// entry's history state, so Back comes back to the same end screen (M25,
// M27). The VoiceOver note (Q8) sits outside the finished/not-finished
// branch, so it is announced once per visit, not once per round. Every
// random choice is seeded from the Web Crypto RNG, only in the loadSigns
// callback and the Play again handler.
// Depends on: react, react-router-dom, ../../../content/signs (loadSigns,
// gameName), ../../../content/schemas (Sign type),
// ../../../engine/progress-state (useProgressStore),
// ../../../engine/round-memory (rememberRound, recallRound, forgetRound),
// ../../../engine/score-band (scoreBand), ../../../ui/LoadFailed (a default
// export imported straight from its file, like
// src/features/signs/SignScreen.tsx does), ../shared/GameTopBar,
// ../shared/EndScreen, ../shared/VisualGameNote, ../shared/exit
// (useExitGame), ../shared/SignImage, ../shared/random (mulberry32),
// ../shared/useReducedMotion, ./pairs, ./pairs.css.
// Depended on by: ./index.tsx, tests/unit/match-pairs.test.tsx.

import { useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadSigns, gameName } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import { useProgressStore } from '../../../engine/progress-state';
import { forgetRound, recallRound, rememberRound } from '../../../engine/round-memory';
import { scoreBand } from '../../../engine/score-band';
import LoadFailed from '../../../ui/LoadFailed';
import GameTopBar from '../shared/GameTopBar';
import EndScreen from '../shared/EndScreen';
import VisualGameNote from '../shared/VisualGameNote';
import { useExitGame } from '../shared/exit';
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

/** Everything Back has to bring back: the finished round and what it collected (M25, M27). */
interface PairsSnapshot {
  state: PairsState;
  collected: Sign[];
}

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
  const location = useLocation();
  const exitGame = useExitGame();
  const reducedMotion = useReducedMotion();

  // The round this history entry left behind, if it is still the current
  // one (M25, M27). Read once, at mount, from the entry's own state.
  const [recalled] = useState<PairsSnapshot | undefined>(() => {
    const roundId = (location.state as { roundId?: string } | null)?.roundId;
    return roundId === undefined ? undefined : recallRound<PairsSnapshot>('pairs', roundId);
  });

  const [state, dispatch] = useReducer(screenReducer, recalled?.state ?? null);
  const [settledRound, setSettledRound] = useState<PairsRound | null>(
    recalled?.state.round ?? null,
  );
  const [heldRound, setHeldRound] = useState<PairsRound | null>(recalled?.state.round ?? null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    recalled ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const [collected, setCollected] = useState<Sign[]>(recalled?.collected ?? []);

  const summary = useProgressStore((s) => s.summary);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const recordRoundFinished = useProgressStore((s) => s.recordRoundFinished);

  const signsRef = useRef<Sign[] | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const finishedRoundRef = useRef<PairsRound | null>(recalled?.state.round ?? null);
  const collectedRef = useRef<Sign[]>(recalled?.collected ?? []);

  useEffect(() => {
    // A recalled round is already on screen; only a Retry builds another.
    if (recalled !== undefined && attempt === 0) return;
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        signsRef.current = signs;
        setLoadState('ready');
        dispatch({ type: 'new-round', round: buildPairsRound(signs, mulberry32(randomSeed())) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [recalled, attempt]);

  /** Retry after a failed load: the counter is bumped here, never in the effect body. */
  function handleRetry(): void {
    setLoadState('loading');
    setAttempt((a) => a + 1);
  }

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
    queueWrite(writeChainRef, () => recordRoundFinished({ game: 'pairs' }));
    void writeChainRef.current.then(() => {
      setCollected(collectedRef.current);
      setSettledRound(round);
    });
  }, [finished, round, recordRoundFinished]);

  // The end screen's hold: at least END_HOLD_MS after the fifth lock.
  useEffect(() => {
    if (!finished || round === null) return;
    const timeout = setTimeout(() => setHeldRound(round), END_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [finished, round]);

  function handleSignTap(signId: string): void {
    dispatch({ type: 'tap-sign', signId });
  }

  function handleNameTap(signId: string): void {
    if (state === null) return;
    const action: PairsAction = { type: 'tap-name', signId };
    const next = pairsReducer(state, action);
    const sign = state.round.signs.find((candidate) => candidate.id === signId);
    dispatch(action);
    if (sign && next.earnedIds.length > state.earnedIds.length) {
      queueWrite(writeChainRef, async () => {
        const result = await recordAnswer(signId, true);
        if (result.collectedNow) collectedRef.current = [...collectedRef.current, sign];
      });
    }
  }

  function handlePlayAgain(): void {
    const signs = signsRef.current;
    if (!signs) return;
    forgetRound('pairs');
    writeChainRef.current = Promise.resolve();
    finishedRoundRef.current = null;
    collectedRef.current = [];
    setCollected([]);
    setSettledRound(null);
    setHeldRound(null);
    dispatch({ type: 'new-round', round: buildPairsRound(signs, mulberry32(randomSeed())) });
  }

  /** Uniform with Tap's (amendment E16 (a)): a fresh Tap round of that sign's family. */
  function handlePractise(sign: Sign): void {
    navigate(`/practice/tap?family=${sign.family}`);
  }

  const rootClassName = ['pairs', reducedMotion ? 'pairs--static' : 'pairs--animated'].join(' ');
  const lockedCount = state?.lockedIds.length ?? 0;
  const showEnd =
    state !== null && state.finished && settledRound === state.round && heldRound === state.round;

  // The end screen's rows leave this entry, so the finished round is stored
  // under an id in the entry's own history state before they can -- coming
  // Back then lands on this same end screen (M25, M27). Once per round: the
  // ref guard means the replace below (which re-runs this effect) does not
  // remember it twice, and Play again's new round object clears it.
  const rememberedRoundRef = useRef<PairsRound | null>(recalled?.state.round ?? null);
  useEffect(() => {
    if (!showEnd || state === null) return;
    if (rememberedRoundRef.current === state.round) return;
    rememberedRoundRef.current = state.round;
    const roundId = rememberRound<PairsSnapshot>('pairs', { state, collected });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { roundId } });
  }, [showEnd, state, collected, navigate, location.pathname, location.search]);

  const firstTry = state?.earnedIds.length ?? 0;
  const missedSigns = state
    ? state.missedIds
        .map((id) => state.round.signs.find((sign) => sign.id === id))
        .filter((sign): sign is Sign => sign !== undefined)
    : [];

  return (
    <div className={rootClassName}>
      <VisualGameNote />

      {showEnd && state !== null ? (
        <EndScreen
          title="Match Pairs"
          onClose={exitGame}
          heading="All pairs matched"
          scoreBig={`${firstTry}`}
          scoreText="right first time"
          scoreSub={`${PAIRS_PER_ROUND} pairs matched`}
          band={scoreBand(firstTry, PAIRS_PER_ROUND)}
          xp={state.xp}
          streak={summary.streak}
          collected={collected}
          lost={[]}
          listHeading="Took more than one try"
          listCount={missedSigns.length}
          listSigns={missedSigns}
          onDone={exitGame}
          onPlayAgain={handlePlayAgain}
          onPractise={handlePractise}
        />
      ) : (
        <>
          <GameTopBar
            progress={lockedCount / PAIRS_PER_ROUND}
            label={`${lockedCount}/${PAIRS_PER_ROUND}`}
            labelTone="muted"
            onClose={exitGame}
          />

          {loadState === 'error' && (
            <div className="pairs__failed">
              <LoadFailed onRetry={handleRetry} />
            </div>
          )}

          {state !== null && (
            <div className="pairs__intro">
              <span className="pairs__badge">MATCH PAIRS</span>
              <h1 className="pairs__prompt">Tap a sign, then its name.</h1>
            </div>
          )}

          {state !== null && (
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
                    <span className="pairs__content">{gameName(sign)}</span>
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
        </>
      )}
    </div>
  );
}

export default MatchPairs;
