// Me tab (plan.md Step 11, amendment E25 (e)): three grouped sections,
// each a small capital label over a white card -- Progress (the streak/XP
// pills and a Traffic signs row, held back with the same --pending rule as
// Today until the progress store's scores AND the sign catalogue have both
// settled, amendment E25 (d)), Settings (the offline status line, plus an
// Add to Home Screen row shown only in iPhone Safari that opens the panel
// as a full-screen layer without ever touching its stored dismissal, M01),
// and About (Attribution.tsx, unchanged text and licence link, with the
// attribution file itself now behind a closed disclosure, PS11).
// Depends on: react, lucide-react (ChevronRight), ../../engine/progress-state
// (useProgressStore), ../../content/signs (loadSigns), ../practice/ProgressHeader,
// ../practice/practice.css, ../../ui/ListRow, ../../app/platform
// (readPlatform), ../../app/AddToHomeScreen, ./OfflineReady, ./Attribution,
// ./me.css.
// Depended on by: src/app/routes.tsx.

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useProgressStore } from '../../engine/progress-state';
import { loadSigns } from '../../content/signs';
import ProgressHeader from '../practice/ProgressHeader';
import '../practice/practice.css';
import ListRow from '../../ui/ListRow';
import { readPlatform } from '../../app/platform';
import AddToHomeScreen from '../../app/AddToHomeScreen';
import OfflineReady from './OfflineReady';
import Attribution from './Attribution';
import './me.css';

interface SignsState {
  status: 'loading' | 'loaded' | 'failed';
  count: number;
}

const INITIAL_SIGNS_STATE: SignsState = { status: 'loading', count: 0 };

function MeScreen() {
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
        setSigns({ status: 'loaded', count: allSigns.length });
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

  const [platform] = useState(() => readPlatform());
  const [a2hsOpen, setA2hsOpen] = useState(false);

  return (
    <div className="me">
      <section className="me-section">
        <h2 className="me-section__label">Progress</h2>
        <div
          className={pending ? 'me-progress me-progress--pending' : 'me-progress'}
          aria-busy={pending}
        >
          <ProgressHeader streak={summary.streak} xp={summary.xp} />
          <div className="me-card">
            <ListRow
              to="/learn/signs"
              title="Traffic signs"
              subtitle={
                signs.status !== 'failed'
                  ? `${summary.collected} of ${signs.count} collected`
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <section className="me-section">
        <h2 className="me-section__label">Settings</h2>
        <div className="me-card">
          <div className="me-row">
            <OfflineReady />
          </div>
          {platform.ios && !platform.standalone && (
            <button
              type="button"
              className="list-row me-row-button"
              onClick={() => setA2hsOpen(true)}
            >
              <span className="list-row__text">
                <span className="list-row__title">Add to Home Screen</span>
              </span>
              <span className="list-row__trailing">
                <ChevronRight size={20} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="me-section">
        <h2 className="me-section__label">About</h2>
        <Attribution />
      </section>

      {a2hsOpen && (
        <AddToHomeScreen persistDismissal={false} onDismiss={() => setA2hsOpen(false)} />
      )}
    </div>
  );
}

export default MeScreen;
