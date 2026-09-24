// Sign Sprint's start page (Q10, Q11; plan.md Step 10 and amendment E23
// (b), (c)) -- what opening /practice/sprint shows, and where the end
// screen's Done comes back to. In order: a 44px header with the close ✕ on
// the left and the page's one centred title; a score card whose first row
// is the best for the length chosen below (it changes with the control)
// beside the 60 roundel, and whose second row is the last round's score, a
// dot in its Q9 band colour and that round's length (the row is left out
// when there is no last round); the day-streak pill; "Which signs" with a
// sideways-scrolling row of family chips (All, or one or more families --
// All means every family, and turning the last family off selects All
// again) over a count of the signs those choices put in the sprint;
// "Length" as the shared segmented control (30 sec / 1 min / 5 min / No
// limit), with the No limit explainer under it only while No limit is
// chosen; and a full-width Start pinned to the bottom, within thumb reach.
// Nothing here repeats the play screen's blue badge. The page reads the
// learner's last choices through the progress store and opens on them,
// and Start saves them before the round begins, so a reload comes back to
// the same ones. It also calls load() on mount, because nothing else on
// /practice/sprint loads the progress store and every best would otherwise
// read 0 on a cold open (scan S12). Until the stored choices, the
// catalogue and the store's scores have all arrived it shows its header
// alone, so no control appears at a default and then jumps, and the score
// card never draws at 0 and then grows a row (amendment E24 (a)); a store
// that failed to load still gets the page. If the catalogue failed to load it shows
// the header and the shared load-failure notice, whose Retry is the
// game's own (the failure belongs here now, because this is what is on
// screen while the catalogue loads).
// Depends on: react, ../../../content/schemas (Sign type),
// ../../../engine/progress (SPRINT_LENGTHS, SprintLengthId),
// ../../../engine/progress-store (SprintChoices type),
// ../../../engine/progress-state (useProgressStore),
// ../../../engine/score-band (scoreBand, sprintBandMax),
// ../../signs/families (FAMILIES, ALL_CHIP_LABEL), ../../../ui (Button,
// Roundel), ../../../ui/SegmentedControl and ../../../ui/LoadFailed (both
// default exports imported straight from their files -- src/ui/index.ts
// does not export either), ./sprint (eligibleSigns). Its styles are the
// .sprint-start rules in ./sprint.css, which ./SignSprint.tsx imports.
// Depended on by: ./SignSprint.tsx (which renders it; it is reached that way by
// tests/unit/sprint-start.test.tsx, which imports only SignSprint).

import { useEffect, useState } from 'react';
import type { Sign } from '../../../content/schemas';
import { SPRINT_LENGTHS, type SprintLengthId } from '../../../engine/progress';
import type { SprintChoices } from '../../../engine/progress-store';
import { useProgressStore } from '../../../engine/progress-state';
import { scoreBand, sprintBandMax, type ScoreBand } from '../../../engine/score-band';
import { ALL_CHIP_LABEL, FAMILIES } from '../../signs/families';
import { Button, Roundel } from '../../../ui';
import SegmentedControl from '../../../ui/SegmentedControl';
import LoadFailed from '../../../ui/LoadFailed';
import { eligibleSigns } from './sprint';

/** Each length's own words, on the control and in the card's kicker (Lincoln, 20 September 2026). */
const LENGTH_LABELS: Record<SprintLengthId, string> = {
  '30s': '30 sec',
  '1m': '1 min',
  '5m': '5 min',
  none: 'No limit',
};

const LENGTH_OPTIONS = SPRINT_LENGTHS.map((id) => ({ id, label: LENGTH_LABELS[id] }));

/** What the progress store remembers about the round just played. */
interface LastRound {
  score: number;
  length: SprintLengthId;
  answered: number;
}

/** The dot's colour beside the last round's score: its Q9 band (a No limit round is judged against what it answered). */
function lastRoundBand(last: LastRound): ScoreBand {
  return last.length === 'none'
    ? scoreBand(last.score, last.answered)
    : scoreBand(last.score, sprintBandMax(last.length));
}

interface SprintStartProps {
  /** The catalogue, once it has loaded; the count and the deck both come from it. */
  signs: readonly Sign[] | null;
  loadState: 'loading' | 'ready' | 'error';
  /** Called by the load-failure notice's Retry button. */
  onRetry: () => void;
  /** Start: the chosen length and families, already saved. */
  onStart: (choices: SprintChoices) => void;
  onClose: () => void;
}

function SprintStart({ signs, loadState, onRetry, onStart, onClose }: SprintStartProps) {
  const summary = useProgressStore((s) => s.summary);
  const status = useProgressStore((s) => s.status);
  const load = useProgressStore((s) => s.load);
  const getSprintChoices = useProgressStore((s) => s.getSprintChoices);
  const setSprintChoices = useProgressStore((s) => s.setSprintChoices);

  // null until the stored choices have arrived, so the controls never show
  // a default and then jump to the saved one (amendment E23 (c)).
  const [length, setLength] = useState<SprintLengthId | null>(null);
  const [families, setFamilies] = useState<string[]>([]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getSprintChoices()
      .then((stored) => {
        if (cancelled) return;
        setLength(stored.length);
        setFamilies(stored.families);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setLength('1m');
      });
    return () => {
      cancelled = true;
    };
  }, [getSprintChoices]);

  /** All: every family at once, which the stored choices spell as an empty list. */
  function chooseAll(): void {
    setFamilies([]);
  }

  /** Turning the last family off leaves the empty list, which is All (amendment E23 (b)). */
  function toggleFamily(id: string): void {
    setFamilies((current) =>
      current.includes(id) ? current.filter((family) => family !== id) : [...current, id],
    );
  }

  function chooseLength(id: string): void {
    const match = SPRINT_LENGTHS.find((candidate) => candidate === id);
    if (match) setLength(match);
  }

  /** Saves the choices, then starts the round; a rejected save is logged and the round starts anyway. */
  function handleStart(): void {
    if (length === null) return;
    const chosen: SprintChoices = { length, families };
    void setSprintChoices(chosen)
      .catch((error: unknown) => {
        console.error(error);
      })
      .then(() => {
        onStart(chosen);
      });
  }

  const header = (
    <div className="sprint-start__header">
      <button type="button" className="sprint-start__close" aria-label="Close" onClick={onClose}>
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
      <h1 className="sprint-start__title">Sign Sprint</h1>
    </div>
  );

  if (loadState === 'error') {
    return (
      <div className="sprint-start">
        {header}
        <div className="sprint-start__failed">
          <LoadFailed onRetry={onRetry} />
        </div>
      </div>
    );
  }

  // The scores arrive ~150 ms after the choices on a cold open (measured);
  // drawn before them, the card reads "0", has no Last round row, and then
  // grows by a row and pushes every control down (amendment E24 (a)). A
  // store that failed to load still gets the page, with its zeros.
  const scoresPending = status === 'idle' || status === 'loading';

  if (length === null || signs === null || scoresPending) {
    return <div className="sprint-start">{header}</div>;
  }

  const count = eligibleSigns(signs, families).length;

  return (
    <div className="sprint-start">
      {header}

      <div className="sprint-start__body">
        <div className="sprint-start__card">
          <div className="sprint-start__stat">
            <p className="sprint-start__kicker">{`Best at ${LENGTH_LABELS[length]}`}</p>
            <p className="sprint-start__number">{summary.sprintBests[length]}</p>
            <span className="sprint-start__roundel">
              <Roundel value={60} />
            </span>
          </div>

          {summary.sprintLast !== null && (
            <div className="sprint-start__stat">
              <p className="sprint-start__kicker">Last round</p>
              <p className="sprint-start__number">
                <span>{summary.sprintLast.score}</span>
                <span
                  className={`sprint-start__dot sprint-start__dot--${lastRoundBand(summary.sprintLast)}`}
                  aria-hidden="true"
                />
                <span className="sprint-start__last-length">
                  {LENGTH_LABELS[summary.sprintLast.length]}
                </span>
              </p>
            </div>
          )}
        </div>

        <span className="sprint-start__streak">
          <svg
            className="sprint-start__flame"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2.5c.8 3.3 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.3 1.1-4 2.5-5.4.2 1.7 1 2.8 2.2 3.2.7-2.9.2-5.4.8-8.3Z" />
          </svg>
          <span>{`${summary.streak}-day streak`}</span>
        </span>

        <h2 className="sprint-start__heading">Which signs</h2>
        <div className="sprint-start__chips" role="group" aria-label="Which signs">
          <button
            type="button"
            className="sprint-start__chip"
            aria-pressed={families.length === 0}
            onClick={chooseAll}
          >
            {ALL_CHIP_LABEL}
          </button>
          {FAMILIES.map((family) => (
            <button
              key={family.id}
              type="button"
              className="sprint-start__chip"
              aria-pressed={families.includes(family.id)}
              onClick={() => toggleFamily(family.id)}
            >
              {family.chip}
            </button>
          ))}
        </div>
        <p className="sprint-start__count">{`${count} signs in this sprint`}</p>

        <h2 className="sprint-start__heading">Length</h2>
        <SegmentedControl
          label="Length"
          options={LENGTH_OPTIONS}
          value={length}
          onChange={chooseLength}
        />
        {length === 'none' && <p className="sprint-start__hint">No limit: play until you stop.</p>}
      </div>

      <div className="sprint-start__actions">
        <Button variant="primary" onClick={handleStart}>
          Start
        </Button>
      </div>
    </div>
  );
}

export default SprintStart;
