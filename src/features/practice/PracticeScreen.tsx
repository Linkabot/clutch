// Practice tab: /practice (src/app/routes.tsx). The XP/streak header
// (ProgressHeader, fed by useProgressStore's summary) sits above four game
// cards, each a react-router Link to a game route -- Sign Sprint
// (/practice/sprint, Step 24), Tap the sign (/practice/tap, Step 23), Match
// Pairs (/practice/pairs, Step 25) and the Shape & Colour Decoder
// (/learn/signs/decoder, Step 26). All four routes exist (Steps 23-26).
// The Tap card's four small pictures are real SignImages, loaded lazily via
// loadSigns (the same cancelled-flag pattern as SignsScreen.tsx); the Match
// Pairs and Decoder tiles are original shape art the app draws itself,
// never a rotated or recoloured real sign picture (plan.md D7, amendment
// E18).
// Depends on: react, react-router-dom, lucide-react (ChevronRight),
// ../../engine/progress-state (useProgressStore), ../../content/signs
// (loadSigns), ../../content/schemas (Sign type), ../../ui (Roundel),
// ../interactives/shared/SignImage, ./ProgressHeader, ./practice.css.
// Depended on by: src/app/routes.tsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProgressStore } from '../../engine/progress-state';
import { loadSigns } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { Roundel } from '../../ui';
import SignImage from '../interactives/shared/SignImage';
import ProgressHeader from './ProgressHeader';
import './practice.css';

/** In display order for the Tap card's 2x2 grid -- plan.md Step 21. */
const TAP_SIGN_IDS = [
  'warning-slippery-road',
  'warning-roundabout',
  'warning-crossroads',
  'warning-uneven-road',
];

function PracticeScreen() {
  const summary = useProgressStore((s) => s.summary);
  const load = useProgressStore((s) => s.load);
  const [tapSigns, setTapSigns] = useState<Sign[]>([]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        const bySignId = new Map(signs.map((sign) => [sign.id, sign]));
        setTapSigns(
          TAP_SIGN_IDS.map((id) => bySignId.get(id)).filter((sign): sign is Sign => Boolean(sign)),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <ProgressHeader streak={summary.streak} xp={summary.xp} />

      <div className="practice-cards">
        <Link to="/practice/sprint" className="practice-card">
          <span className="practice-card__tile">
            <Roundel value={60} />
          </span>
          <span className="practice-card__text">
            <span className="practice-card__title">Sign Sprint</span>
            <span className="practice-card__subtitle">Name signs against the clock</span>
          </span>
          <ChevronRight size={22} className="practice-card__chevron" aria-hidden="true" />
        </Link>

        <Link to="/practice/tap" className="practice-card">
          <span className="practice-card__tile">
            <span className="practice-card__tap-grid">
              {tapSigns.map((sign) => (
                <SignImage key={sign.id} sign={sign} alt="" />
              ))}
            </span>
          </span>
          <span className="practice-card__text">
            <span className="practice-card__title">Tap the sign</span>
            <span className="practice-card__subtitle">Read the name, tap the sign</span>
          </span>
          <ChevronRight size={22} className="practice-card__chevron" aria-hidden="true" />
        </Link>

        <Link to="/practice/pairs" className="practice-card">
          <span className="practice-card__tile">
            <span className="practice-card__pairs-card practice-card__pairs-card--picture">
              <svg width="16" height="15" viewBox="0 0 22 20" aria-hidden="true">
                <path
                  d="M11 2.5 19.5 17.5H2.5Z"
                  strokeLinejoin="round"
                  className="practice-card__pairs-glyph"
                />
              </svg>
            </span>
            <span className="practice-card__pairs-card practice-card__pairs-card--name">
              <span className="practice-card__pairs-bar" />
              <span className="practice-card__pairs-bar practice-card__pairs-bar--short" />
            </span>
          </span>
          <span className="practice-card__text">
            <span className="practice-card__title">Match Pairs</span>
            <span className="practice-card__subtitle">Match signs to their names</span>
          </span>
          <ChevronRight size={22} className="practice-card__chevron" aria-hidden="true" />
        </Link>

        <Link to="/learn/signs/decoder" className="practice-card">
          <span className="practice-card__tile">
            <svg width="46" height="44" viewBox="0 0 46 44" aria-hidden="true">
              <path
                d="M12 3 21 19H3Z"
                strokeLinejoin="round"
                className="practice-card__decoder-triangle"
              />
              <circle cx="34" cy="11.5" r="8" className="practice-card__decoder-circle" />
              <rect
                x="7"
                y="26"
                width="32"
                height="15"
                rx="2.5"
                className="practice-card__decoder-rect"
              />
            </svg>
          </span>
          <span className="practice-card__text">
            <span className="practice-card__title">Shape & Colour Decoder</span>
            <span className="practice-card__subtitle">What shapes and colours mean</span>
          </span>
          <ChevronRight size={22} className="practice-card__chevron" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default PracticeScreen;
