// Journey tab / Today (Q17, plan.md Step 11, amendment E25 (c), (d)): the
// screen the app opens on. No section heading -- the header band already
// shows "Journey" (P11 struck the plan's own heading for this screen).
// Renders, in one wrapper: the streak/XP pills (ProgressHeader, unchanged,
// fed by the progress store), a white-with-yellow-outline "Start here"
// card linking to whichever game startHere() suggests, the Traffic signs
// card (the Learn tab's own SignPanel/learn-card markup and classes,
// reused rather than duplicated), and a muted note. The whole wrapper
// renders in full from the first paint but stays invisible (the --pending
// class, journey.css) until the progress store's scores AND the sign
// catalogue have both settled, so nothing flashes and nothing moves on a
// cold open (amendment E25 (d)) -- the store and the catalogue are read
// exactly as PracticeScreen.tsx and LearnScreen.tsx already do.
// Depends on: react, react-router-dom (Link), lucide-react (Play,
// ChevronRight), ../../engine/progress-state (useProgressStore),
// ../../engine/start-here (startHere), ../../engine/progress (GameId type),
// ../../content/signs (loadSigns), ../../content/schemas (Sign type),
// ../../ui (SignPanel), ../interactives/shared/SignImage,
// ../practice/ProgressHeader, ../practice/practice.css, ../learn/learn.css,
// ./journey.css.
// Depended on by: src/app/routes.tsx, tests/unit/journey-screen.test.tsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, ChevronRight } from 'lucide-react';
import { useProgressStore } from '../../engine/progress-state';
import { startHere } from '../../engine/start-here';
import type { GameId } from '../../engine/progress';
import { loadSigns } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { SignPanel } from '../../ui';
import SignImage from '../interactives/shared/SignImage';
import ProgressHeader from '../practice/ProgressHeader';
import '../practice/practice.css';
import '../learn/learn.css';
import './journey.css';

/** Today's card signs are the same three thumbnails the Learn tab shows. */
const TODAY_CARD_SIGN_IDS = ['warning-roundabout', 'orders-no-entry', 'orders-turn-left'];

const START_HERE: Record<GameId, { title: string; to: string }> = {
  tap: { title: 'Play Tap the sign – 10 questions', to: '/practice/tap' },
  sprint: { title: 'Play Sign Sprint – against the clock', to: '/practice/sprint' },
  pairs: { title: 'Play Match Pairs – 5 pairs', to: '/practice/pairs' },
};

interface SignsState {
  status: 'loading' | 'loaded' | 'failed';
  count: number;
  cardSigns: Sign[];
}

const INITIAL_SIGNS_STATE: SignsState = { status: 'loading', count: 0, cardSigns: [] };

function JourneyScreen() {
  const summary = useProgressStore((s) => s.summary);
  const status = useProgressStore((s) => s.status);
  const load = useProgressStore((s) => s.load);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const [signs, setSigns] = useState<SignsState>(INITIAL_SIGNS_STATE);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((allSigns) => {
        if (cancelled) return;
        setSigns({
          status: 'loaded',
          count: allSigns.length,
          cardSigns: TODAY_CARD_SIGN_IDS.map((id) =>
            allSigns.find((sign) => sign.id === id),
          ).filter((sign): sign is Sign => sign !== undefined),
        });
      })
      .catch(() => {
        if (!cancelled) setSigns((previous) => ({ ...previous, status: 'failed' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scoresSettled = status === 'ready' || status === 'error';
  const pending = !scoresSettled || signs.status === 'loading';

  const game = startHere(summary);
  const start = START_HERE[game];

  return (
    <div className={pending ? 'today today--pending' : 'today'} aria-busy={pending}>
      <ProgressHeader streak={summary.streak} xp={summary.xp} />

      <Link className="today__start" to={start.to}>
        <span className="today__play" aria-hidden="true">
          <Play size={24} fill="currentColor" strokeWidth={0} />
        </span>
        <span className="today__text">
          <span className="today__kicker">Start here</span>
          <span className="today__title">{start.title}</span>
        </span>
        <ChevronRight size={22} className="today__chevron" aria-hidden="true" />
      </Link>

      <Link to="/learn/signs" className="learn-card">
        <SignPanel colour="green" block>
          <div className="learn-card__row">
            <div className="learn-card__text">
              <div className="learn-card__title">Traffic signs</div>
              {signs.status !== 'failed' && (
                <div>
                  {summary.collected} of {signs.count} collected
                </div>
              )}
            </div>
            <div className="learn-card__icons">
              {signs.cardSigns.map((sign) => (
                <SignImage key={sign.id} sign={sign} alt="" />
              ))}
            </div>
          </div>
        </SignPanel>
      </Link>

      <p className="today__note">Your journey map arrives in Phase 4</p>
    </div>
  );
}

export default JourneyScreen;
