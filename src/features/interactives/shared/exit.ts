// Where a game's Close (the top bar's or the end screen's) and its end
// screen's Done go (Q19, plan.md Step 9): back to the in-app screen the
// game was opened from -- a sign page's "Practise signs like this", Today,
// Practice, or another end screen's sign row -- and otherwise to the tab
// that owns the game's own route, which for /practice/* is Practice. The
// rule itself is src/app/back.ts's backTarget, unchanged and untouched;
// exitTarget only names it for the games, and useExitGame() turns it into
// the one navigation call every game makes. The history index is read from
// window.history.state at click time, never during render, exactly as
// src/app/App.tsx's Back button does: a page reload and a cold deep link
// both start a fresh history stack, so an index read at render time would
// be stale. NavigateFunction has separate (-1-style) and (string-style)
// overloads, so the -1 | string union is branched on typeof rather than
// passed straight through.
// Depends on: react-router-dom (useLocation, useNavigate),
// ../../../app/back (backTarget).
// Depended on by: src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// tests/unit/exit.test.ts.

import { useLocation, useNavigate } from 'react-router-dom';
import { backTarget } from '../../../app/back';

/**
 * Where leaving a game at `pathname` should go, given the browser history
 * index `historyIdx` (`window.history.state?.idx`, or undefined on a fresh
 * stack): -1 to go back one in-app entry, else the path of the tab that
 * owns the route.
 */
export function exitTarget(pathname: string, historyIdx: number | undefined): -1 | string {
  return backTarget(pathname, historyIdx);
}

/** Returns the handler a game's Close (✕) and its end screen's Done both call. */
export function useExitGame(): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    const target = exitTarget(
      location.pathname,
      (window.history.state as { idx?: number } | null)?.idx,
    );
    if (typeof target === 'number') {
      navigate(target);
    } else {
      navigate(target);
    }
  };
}
