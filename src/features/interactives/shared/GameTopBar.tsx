// GameTopBar: the header row shared by every timed/counted game (Sign
// Sprint, Tap the sign, Match Pairs -- scout-e.md's SprintPlay and
// TapTheSign artboards) -- a 44x44 Close button, a progress bar with the
// Highway-Code dashed-yellow-line motif, and a right-hand label whose
// colour ("tone") differs by game: Sign Sprint's clock (e.g. "0:42") is
// ink, Tap the sign's count (e.g. "6/10") is muted.
// Depends on: ./games.css.
// Depended on by: tests/unit/interactives-render.test.tsx (later:
// src/features/practice/tap/TapTheSignScreen.tsx, sign-sprint,
// match-pairs -- Steps 23-25).

import './games.css';

interface GameTopBarProps {
  /** 0..1: how far through the round or round timer the player is. */
  progress: number;
  label: string;
  labelTone?: 'ink' | 'muted';
  onClose: () => void;
}

function GameTopBar({ progress, label, labelTone = 'muted', onClose }: GameTopBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className="game-top-bar">
      <button type="button" className="game-top-bar__close" aria-label="Close" onClick={onClose}>
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
      <div
        className="game-top-bar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={clamped}
      >
        <div className="game-top-bar__fill" style={{ width: `${clamped * 100}%` }} />
        <div className="game-top-bar__dashes" />
      </div>
      <div className={`game-top-bar__label game-top-bar__label--${labelTone} font-display`}>
        {label}
      </div>
    </div>
  );
}

export default GameTopBar;
