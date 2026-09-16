// Learn tab hub: entry point into the Highway Code section browser and its
// search screen (Step 17), the Signs browser (Step 19), plus a placeholder
// row for the lessons feature that ships in a later phase. The Highway
// Code card's rule count comes from the ingested index (getHighwayCodeIndex),
// counted at render time — no network call, no effect needed, since the
// index is bundled and parsed eagerly. The Traffic signs card's counts come
// from loadSigns() (a lazy chunk, loaded once in an effect) and
// useProgressStore's summary.collected (loaded once via load()). The card
// itself, its title and its link render immediately; the "<n> of <total>
// collected" subtitle renders only once loadSigns() has resolved
// (amendment E19) -- nothing in its place before, no placeholder text.
// Below it, the white "How signs work" card (Step 26, amendment E33) links
// to the Shape & Colour Decoder at /learn/signs/decoder: a panel with a
// 2.5px ink inner border, styled inline with tokens, holding its title,
// subtitle and small original shape art (a triangle, a circle and a
// rectangle the app draws, never a real sign picture).
// Depends on: react, react-router-dom, ../../ui (SignPanel),
// ../../content/loaders (getHighwayCodeIndex), ../../content/signs
// (loadSigns), ../../content/schemas (Sign type), ../../engine/progress-state
// (useProgressStore), ../interactives/shared/SignImage, ../signs/signs.css
// (the .learn-signs-card full-width SignPanel rule and thumbnail sizing).
// Depended on by: src/app/routes.tsx.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignPanel } from '../../ui';
import { getHighwayCodeIndex } from '../../content/loaders';
import { loadSigns } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { useProgressStore } from '../../engine/progress-state';
import SignImage from '../interactives/shared/SignImage';
import '../signs/signs.css';

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
    <div>
      <h1>Learn</h1>
      <Link to="/learn/code" style={{ display: 'block', textDecoration: 'none' }}>
        <SignPanel colour="blue">
          <span className="font-display">The Highway Code</span>
          <div>{ruleCount} rules, offline</div>
        </SignPanel>
      </Link>
      {/* A Link styled with Button's own classes: satisfies "secondary
          Button" and "Link" at once without nesting a <button> inside an
          <a> (invalid HTML — Button.tsx renders a native <button>). */}
      <Link
        to="/learn/code/search"
        className="button button--secondary"
        style={{ marginTop: '12px', textDecoration: 'none' }}
      >
        Search The Highway Code
      </Link>
      <Link
        to="/learn/signs"
        className="learn-signs-card"
        style={{ display: 'block', marginTop: '22px', textDecoration: 'none' }}
      >
        <SignPanel colour="green">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-display" style={{ fontSize: '20px' }}>
                Traffic signs
              </div>
              {signsLoaded && (
                <div>
                  {summary.collected} of {signCount} collected
                </div>
              )}
            </div>
            <div className="learn-signs-card__images">
              {cardSigns.map((sign) => (
                <SignImage key={sign.id} sign={sign} alt="" />
              ))}
            </div>
          </div>
        </SignPanel>
      </Link>
      <Link
        to="/learn/signs/decoder"
        className="learn-decoder-card"
        style={{
          display: 'block',
          marginTop: '12px',
          textDecoration: 'none',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '14px',
          padding: '5px',
          boxShadow: '0 0 0 1px var(--color-hairline)',
          color: 'var(--color-ink)',
        }}
      >
        <div
          style={{
            border: '2.5px solid var(--color-ink)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: '20px' }}>
              How signs work
            </div>
            <div style={{ color: 'var(--color-muted)' }}>Shape & Colour Decoder</div>
          </div>
          <svg width="72" height="24" viewBox="0 0 72 24" aria-hidden="true">
            <path
              d="M11 2.5 20 20.5H2Z"
              style={{
                fill: 'var(--color-on-sign)',
                stroke: 'var(--color-sign-red)',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            />
            <circle
              cx="35"
              cy="12"
              r="9"
              style={{
                fill: 'var(--color-on-sign)',
                stroke: 'var(--color-sign-red)',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            />
            <rect
              x="50"
              y="3"
              width="21"
              height="18"
              rx="2.5"
              style={{ fill: 'var(--color-sign-blue)' }}
            />
          </svg>
        </div>
      </Link>
      <p style={{ color: 'var(--color-muted)' }}>Lessons — later phase</p>
    </div>
  );
}

export default LearnScreen;
