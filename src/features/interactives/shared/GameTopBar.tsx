// GameTopBar: the header row shared by every timed/counted game (Sign
// Sprint, Tap the sign, Match Pairs -- scout-e.md's SprintPlay and
// TapTheSign artboards) -- a 44x44 Close button, a progress bar with the
// Highway-Code dashed-yellow-line motif, and a right-hand slot. That slot
// normally holds a label whose colour ("tone") differs by game: Sign
// Sprint's clock (e.g. "0:42") is ink, Tap the sign's count (e.g. "6/10")
// is muted. A game that has an action to offer instead of a reading passes
// `action` (Sign Sprint's Finish, on a No limit round whose bar is full
// and whose clock would say nothing -- P12, amendment E23 (g)): the label
// is then not rendered at all and a small outlined pill button stands in
// its place. With no `action` the markup is exactly what it has always
// been, which is what keeps the other two games' screens unchanged.
// Depends on: ./games.css.
// Depended on by: src/features/interactives/shared/QuestionScreen.tsx
// (which spreads a game's own topBar props onto it, so Tap the sign and
// Sign Sprint reach it through there),
// src/features/interactives/match-pairs/MatchPairs.tsx (directly),
// tests/unit/interactives-render.test.tsx.

import './games.css';

interface GameTopBarProps {
  /** 0..1: how far through the round or round timer the player is. */
  progress: number;
  /** The reading in the right-hand slot; ignored when `action` is given. */
  label?: string;
  labelTone?: 'ink' | 'muted';
  /** A button standing in the label's place, e.g. Sign Sprint's Finish (P12). */
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}

function GameTopBar({ progress, label, labelTone = 'muted', action, onClose }: GameTopBarProps) {
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
      {action ? (
        <button
          type="button"
          className="game-top-bar__action font-display"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ) : (
        <div className={`game-top-bar__label game-top-bar__label--${labelTone} font-display`}>
          {label}
        </div>
      )}
    </div>
  );
}

export default GameTopBar;
