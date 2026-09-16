// Signs browser: /learn/signs. A row of family chips (All + the six
// families) filters the grid; a two-part toggle switches between every sign
// in the chosen family and only the Collected ones (isCollected, 3+
// correct answers); a three-column grid shows each surviving sign's
// picture, caption and progress (0-3 dots, or a COLLECTED badge at 3).
// Filter state lives in the URL (?family=<id>&collected=1), so it survives
// a reload and a Back tap; changing the family chip keeps the collected
// choice (plan.md amendment E18) -- the toggle's own badge then counts
// collected signs within the newly chosen family, not the whole catalogue
// (computed by reusing filterSigns's own predicate, amendment E19, rather
// than a second inline copy of it). Each tile links to /learn/signs/<id>
// (Step 20 adds that route). Signs load lazily (loadSigns() -- see
// src/content/signs.ts's module header for why); progress renders as zero
// while it is loading or has failed, rather than blocking the grid on it.
// The "<n> of <total> collected" line and the Collected-empty-state message
// render only once signs have finished loading (amendment E19) -- while
// loading, neither shows (no placeholder text, and no false "No signs
// collected yet" for a learner who has collected signs but whose signs
// have not loaded yet).
// Depends on: react, react-router-dom, ../../content/signs (loadSigns),
// ../../content/schemas (Sign type), ../../engine/progress-state
// (useProgressStore), ../../engine/progress (isCollected),
// ../interactives/shared/SignImage, ./families (FAMILIES, ALL_CHIP_LABEL,
// ALL_SIGNS_LABEL, familyMeta), ./filter (filterSigns, SignFamilyFilter),
// ./signs.css.
// Depended on by: src/app/routes.tsx.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadSigns } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { useProgressStore } from '../../engine/progress-state';
import { isCollected } from '../../engine/progress';
import SignImage from '../interactives/shared/SignImage';
import { FAMILIES, ALL_CHIP_LABEL, ALL_SIGNS_LABEL, familyMeta } from './families';
import { filterSigns, type SignFamilyFilter } from './filter';
import './signs.css';

type SignsState =
  | { status: 'loading'; signs: Sign[] }
  | { status: 'ready'; signs: Sign[] }
  | { status: 'error'; signs: Sign[] };

/** Reads ?family=<id> from the URL; an unknown or missing value means 'all'. */
function parseFamily(value: string | null): SignFamilyFilter {
  const match = FAMILIES.find((family) => family.id === value);
  return match ? match.id : 'all';
}

function SignsScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<SignsState>({ status: 'loading', signs: [] });
  const signProgress = useProgressStore((s) => s.signProgress);
  const summary = useProgressStore((s) => s.summary);
  const progressStatus = useProgressStore((s) => s.status);
  const load = useProgressStore((s) => s.load);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((signs) => {
        if (!cancelled) setState({ status: 'ready', signs });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', signs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signs = state.signs;
  const progress = progressStatus === 'ready' ? signProgress : new Map<string, number>();

  const family = parseFamily(searchParams.get('family'));
  const collectedOnly = searchParams.get('collected') === '1';

  const toggleAllLabel = family === 'all' ? ALL_SIGNS_LABEL : familyMeta(family).allLabel;
  const collectedInFamily = filterSigns(signs, family, true, progress).length;

  const tiles = filterSigns(signs, family, collectedOnly, progress);

  function selectFamily(next: SignFamilyFilter): void {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') {
      params.delete('family');
    } else {
      params.set('family', next);
    }
    setSearchParams(params);
  }

  function selectCollected(next: boolean): void {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set('collected', '1');
    } else {
      params.delete('collected');
    }
    setSearchParams(params);
  }

  return (
    <div>
      <h1>Traffic signs</h1>
      {state.status === 'ready' && (
        <p className="signs-collected-line">
          {summary.collected} of {signs.length} collected
        </p>
      )}

      <div className="signs-chip-row" role="group" aria-label="Sign family">
        <button
          type="button"
          className="signs-chip"
          aria-pressed={family === 'all'}
          onClick={() => selectFamily('all')}
        >
          {ALL_CHIP_LABEL}
        </button>
        {FAMILIES.map((meta) => (
          <button
            key={meta.id}
            type="button"
            className="signs-chip"
            aria-pressed={family === meta.id}
            onClick={() => selectFamily(meta.id)}
          >
            {meta.chip}
          </button>
        ))}
      </div>

      <div className="signs-toggle" role="group" aria-label="Collected filter">
        <button
          type="button"
          className="signs-toggle__half"
          aria-pressed={!collectedOnly}
          onClick={() => selectCollected(false)}
        >
          {toggleAllLabel}
        </button>
        <button
          type="button"
          className="signs-toggle__half"
          aria-pressed={collectedOnly}
          onClick={() => selectCollected(true)}
        >
          Collected
          <span className="signs-toggle__badge" aria-hidden="true">
            {collectedInFamily}
          </span>
        </button>
      </div>

      {state.status === 'ready' && tiles.length === 0 && collectedOnly ? (
        <p className="signs-empty">
          No signs collected yet. Get 3 answers right for a sign in any game to collect it.
        </p>
      ) : (
        <div className="signs-grid" data-testid="signs-grid">
          {tiles.map((sign) => {
            const correct = progress.get(sign.id) ?? 0;
            return (
              <Link key={sign.id} to={`/learn/signs/${sign.id}`} className="signs-tile">
                <span className="signs-tile__picture">
                  <SignImage sign={sign} alt="" />
                </span>
                <span className="signs-tile__caption">{sign.name}</span>
                <span className="signs-tile__status">
                  {isCollected(correct) ? (
                    <span className="signs-tile__badge">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      COLLECTED
                    </span>
                  ) : (
                    [0, 1, 2].map((index) => (
                      <span
                        key={index}
                        aria-hidden="true"
                        className={
                          index < correct
                            ? 'signs-tile__dot'
                            : 'signs-tile__dot signs-tile__dot--empty'
                        }
                      />
                    ))
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SignsScreen;
