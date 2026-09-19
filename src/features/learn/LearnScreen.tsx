// Learn tab hub: entry point into the Highway Code section browser (Step
// 17), the Signs browser (Step 19), plus a placeholder row for the lessons
// feature that ships in a later phase. The Highway Code card's rule count
// comes from the ingested index (getHighwayCodeIndex), counted at render
// time -- no network call, no effect needed, since the index is bundled and
// parsed eagerly. The Traffic signs card's counts come from loadSigns() (a
// lazy chunk, loaded once in an effect) and useProgressStore's summary
// (loaded once via load()). The card itself, its title and its link render
// immediately; the "<n> of <total> collected" subtitle renders only once
// loadSigns() has resolved (amendment E19) -- nothing in its place before,
// no placeholder text. The Highway Code and Traffic signs cards each use
// SignPanel's `block` prop to fill the width (M12); the How signs work card
// below them (Step 26, amendment E33) keeps its own white-panel look
// instead (amendment E3, Step 3b) -- a 2.5px ink inner border, styled
// through learn.css -- and links to the Shape & Colour Decoder at
// /learn/signs/decoder, showing three small original shapes (a triangle, a
// circle and a rectangle the app draws, never a real sign picture), shared
// with the Traffic signs card's thumbnail row through one .learn-card__icons
// class.
// Depends on: react, react-router-dom, ../../ui (SignPanel),
// ../../content/loaders (getHighwayCodeIndex), ../../content/signs
// (loadSigns), ../../content/schemas (Sign type), ../../engine/progress-state
// (useProgressStore), ../interactives/shared/SignImage, ./learn.css.
// Depended on by: src/app/routes.tsx.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignPanel } from '../../ui';
import { getHighwayCodeIndex } from '../../content/loaders';
import { loadSigns } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { useProgressStore } from '../../engine/progress-state';
import SignImage from '../interactives/shared/SignImage';
import './learn.css';

const LEARN_CARD_SIGN_IDS = ['warning-roundabout', 'orders-no-entry', 'orders-turn-left'];

function countNumericRules(): number {
  const index = getHighwayCodeIndex();
  return index.sections.reduce(
    (total, section) => total + section.ruleIds.filter((id) => /^\d+$/.test(id)).length,
    0,
  );
}

function LearnScreen() {
  const ruleCount = countNumericRules();
  const [signCount, setSignCount] = useState(0);
  const [cardSigns, setCardSigns] = useState<Sign[]>([]);
  const [signsLoaded, setSignsLoaded] = useState(false);
  const summary = useProgressStore((state) => state.summary);
  const load = useProgressStore((state) => state.load);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (cancelled) return;
        setSignCount(signs.length);
        setCardSigns(
          LEARN_CARD_SIGN_IDS.map((id) => signs.find((sign) => sign.id === id)).filter(
            (sign): sign is Sign => sign !== undefined,
          ),
        );
        setSignsLoaded(true);
      })
      .catch(() => {
        // content/uk/signs/signs.json not ingested yet, or failed to load:
        // the subtitle stays hidden and no thumbnails show.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="learn-cards">
      <Link to="/learn/code" className="learn-card">
        <SignPanel colour="blue" block>
          <span className="learn-card__title">The Highway Code</span>
          <div>{ruleCount} rules, offline</div>
        </SignPanel>
      </Link>

      <Link to="/learn/signs" className="learn-card">
        <SignPanel colour="green" block>
          <div className="learn-card__row">
            <div className="learn-card__text">
              <div className="learn-card__title">Traffic signs</div>
              {signsLoaded && (
                <div>
                  {summary.collected} of {signCount} collected
                </div>
              )}
            </div>
            <div className="learn-card__icons">
              {cardSigns.map((sign) => (
                <SignImage key={sign.id} sign={sign} alt="" />
              ))}
            </div>
          </div>
        </SignPanel>
      </Link>

      <Link to="/learn/signs/decoder" className="learn-card learn-decoder-card">
        <div className="learn-decoder-card__inner">
          <div className="learn-card__text">
            <div className="learn-card__title">How signs work</div>
            <div className="learn-card__subtitle">Shape & Colour Decoder</div>
          </div>
          <div className="learn-card__icons">
            <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M20 5 35 33H5Z" className="learn-card__glyph-triangle" />
            </svg>
            <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="14" className="learn-card__glyph-circle" />
            </svg>
            <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
              <rect x="5" y="9" width="30" height="22" rx="3" className="learn-card__glyph-rect" />
            </svg>
          </div>
        </div>
      </Link>

      <p className="learn-cards__note">Lessons — later phase</p>
    </div>
  );
}

export default LearnScreen;
