// EndScreen (Q18, Q9, Q12, Q19): the one ending every game shows -- Sign
// Sprint's own end screen generalised, with the score panel's fill
// parameterised by the Q9 band (red / orange / green) and every string
// passed in, so Tap the sign, Match Pairs and (Step 10) Sign Sprint all
// render it (amendment E16 (a)). It owns its 44px header (the ✕ and the
// game's title, no progress bar), so a game early-returns it INSTEAD of its
// question screen rather than beside one. In order: the band panel (an
// uppercase kicker, the big score with its bold line and optional
// sub-line, then the XP, Best and streak chips), a "Collected!" line, one
// notice per sign lost to Q12's three-wrong-in-a-row rule with a
// "Practise signs like this" button, an optional gentle zero line, the
// list heading with its optional count and one ListRow per listed sign,
// then Done and Play again. Every sign name shown is gameName() -- the
// Highway Code short name for STOP and GIVE WAY, displayName otherwise
// (Q7, Q2; amendment E16 (b)). The big score and the XP chip pop exactly
// as Sign Sprint's do, but only when the score is not zero and the OS has
// not asked for reduced motion (amendment E16 (h), Q9's gentle zero).
// Depends on: react-router-dom (Link, via ListRow), ../../../content/schemas
// (Sign type), ../../../content/signs (gameName),
// ../../../engine/score-band (ScoreBand type), ../../../ui (Button),
// ../../../ui/ListRow (a default export imported straight from its file,
// like src/features/signs/SignScreen.tsx does -- src/ui/index.ts does not
// export it), ./SignImage, ./useReducedMotion, ./end-screen.css.
// Depended on by: src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// tests/unit/end-screen.test.tsx (Step 10 adds Sign Sprint).

import { ChevronRight } from 'lucide-react';
import type { Sign } from '../../../content/schemas';
import { gameName } from '../../../content/signs';
import type { ScoreBand } from '../../../engine/score-band';
import { Button } from '../../../ui';
import ListRow from '../../../ui/ListRow';
import SignImage from './SignImage';
import { useReducedMotion } from './useReducedMotion';
import './end-screen.css';

export interface EndScreenProps {
  /** The game's name, in the header beside the ✕. */
  title: string;
  onClose: () => void;
  /** The panel's uppercase kicker, e.g. "Round complete". */
  heading: string;
  /** The big number, e.g. "7". */
  scoreBig: string;
  /** The bold line beside the big number, e.g. "of 10 right". */
  scoreText: string;
  /** The small line under that, e.g. "5 pairs matched". */
  scoreSub?: string;
  band: ScoreBand;
  /** XP earned this round; no chip is rendered at 0 (Q9). */
  xp: number;
  /** The best-score chip's whole text, e.g. "Best 12". */
  best?: string;
  streak: number;
  /** Signs that reached 3 right answers this round. */
  collected: Sign[];
  /** Signs un-collected this round by Q12's three-wrong-in-a-row rule. */
  lost: Sign[];
  /** The gentle line shown at a score of zero (Q9, amendment P8). */
  zeroLine?: string;
  listHeading: string;
  /**
   * When given, the heading and this muted count render even with an empty
   * list; when omitted, the heading shows only when `listSigns` is not
   * empty (amendment E16 (a), scan S44).
   */
  listCount?: number;
  listSigns: Sign[];
  onDone: () => void;
  onPlayAgain: () => void;
  onPractise: (sign: Sign) => void;
}

function EndScreen({
  title,
  onClose,
  heading,
  scoreBig,
  scoreText,
  scoreSub,
  band,
  xp,
  best,
  streak,
  collected,
  lost,
  zeroLine,
  listHeading,
  listCount,
  listSigns,
  onDone,
  onPlayAgain,
  onPractise,
}: EndScreenProps) {
  const reducedMotion = useReducedMotion();
  // Q9's gentle zero: a round with nothing right never pops (amendment E16 (h)).
  const animated = !reducedMotion && Number(scoreBig) !== 0;
  const showListHeading = listCount !== undefined || listSigns.length > 0;

  return (
    <div className={`end-screen${animated ? ' end-screen--animated' : ''}`}>
      <div className="end-screen__header">
        <button type="button" className="end-screen__close" aria-label="Close" onClick={onClose}>
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
        <h1 className="end-screen__title">{title}</h1>
      </div>

      <div className={`end-screen__panel end-screen__panel--${band}`}>
        <div className="end-screen__frame">
          <p className="end-screen__kicker">{heading}</p>
          <div className="end-screen__result">
            <span className="end-screen__score">{scoreBig}</span>
            <span className="end-screen__result-text">
              <span className="end-screen__score-text">{scoreText}</span>
              {scoreSub !== undefined && <span className="end-screen__score-sub">{scoreSub}</span>}
            </span>
          </div>
          <div className="end-screen__chips">
            {xp > 0 && <span className="end-screen__xp">{`+${xp} XP`}</span>}
            {best !== undefined && <span className="end-screen__best">{best}</span>}
            <span className="end-screen__streak">
              <svg
                className="end-screen__flame"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2.5c.8 3.3 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.3 1.1-4 2.5-5.4.2 1.7 1 2.8 2.2 3.2.7-2.9.2-5.4.8-8.3Z" />
              </svg>
              <span>{`${streak}-day streak`}</span>
            </span>
          </div>
        </div>
      </div>

      {collected.length > 0 && (
        <p className="end-screen__collected">
          <span className="end-screen__collected-tick" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {`Collected! ${collected.map((sign) => gameName(sign)).join(', ')}`}
        </p>
      )}

      {lost.map((sign) => (
        <div key={sign.id} className="end-screen__lost">
          <div className="end-screen__lost-line">
            <span className="end-screen__lost-picture">
              <SignImage sign={sign} alt="" />
            </span>
            <span className="end-screen__lost-text">
              {`You lost ${gameName(sign)} — 3 wrong in a row`}
            </span>
          </div>
          <Button
            variant="secondary"
            className="end-screen__lost-button"
            onClick={() => onPractise(sign)}
          >
            Practise signs like this
          </Button>
        </div>
      ))}

      {zeroLine !== undefined && <p className="end-screen__zero">{zeroLine}</p>}

      {showListHeading && (
        <div className="end-screen__list-heading">
          <h2 className="end-screen__list-title">{listHeading}</h2>
          {listCount !== undefined && <span className="end-screen__list-count">{listCount}</span>}
        </div>
      )}

      {listSigns.length > 0 && (
        <ul className="end-screen__list">
          {listSigns.map((sign) => (
            <li key={sign.id} className="end-screen__row">
              <ListRow
                to={`/learn/signs/${sign.id}`}
                leading={
                  <span className="end-screen__row-picture">
                    <SignImage sign={sign} alt="" />
                  </span>
                }
                title={gameName(sign)}
                trailing={<ChevronRight size={22} strokeWidth={2.2} aria-hidden="true" />}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="end-screen__actions">
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
        <Button variant="primary" onClick={onPlayAgain}>
          Play again
        </Button>
      </div>
    </div>
  );
}

export default EndScreen;
