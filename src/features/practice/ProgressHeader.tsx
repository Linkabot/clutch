// ProgressHeader: the Practice tab's two-part stat card -- day streak (left,
// a flame icon in sign red) and total XP earned (right, a yellow XP tile).
// Props only: it never reads the progress store itself -- PracticeScreen
// selects summary.streak/summary.xp and passes them down, which keeps this
// component trivial to render-test in isolation. Each stat sits inside its
// own .practice-header__stat wrapper so a swapped streak/xp prop is
// detectable in a test: the number nearest "day streak" is always the
// streak, and the number nearest "XP earned" is always the xp (amendment
// E20, plan.md Step 21).
// Depends on: react (JSX only), lucide-react (Flame); styled by
// ./practice.css.
// Depended on by: ./PracticeScreen.tsx, tests/unit/practice-header.test.tsx.

import { Flame } from 'lucide-react';

interface ProgressHeaderProps {
  streak: number;
  xp: number;
}

function ProgressHeader({ streak, xp }: ProgressHeaderProps) {
  return (
    <div className="practice-header">
      <div className="practice-header__stat">
        <Flame
          size={34}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden="true"
          className="practice-header__flame"
        />
        <div className="practice-header__stat-text">
          <div className="practice-header__number">{streak}</div>
          <div className="practice-header__label">day streak</div>
        </div>
      </div>
      <div className="practice-header__stat practice-header__stat--xp">
        <div className="practice-header__xp-tile" aria-hidden="true">
          XP
        </div>
        <div className="practice-header__stat-text">
          <div className="practice-header__number">{xp}</div>
          <div className="practice-header__label">XP earned</div>
        </div>
      </div>
    </div>
  );
}

export default ProgressHeader;
