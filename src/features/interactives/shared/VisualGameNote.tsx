// VisualGameNote (Q8): the one thing VoiceOver is told when a picture game
// opens -- that the game is visual, and where the names and meanings live.
// Per-picture descriptions stay in Phase 7. The note renders in a
// .visually-hidden live region (src/app/theme.css) so it is heard and never
// seen, and it starts EMPTY: filling it 500 ms after mount is what makes an
// aria-live="polite" region announce, since a region that already has its
// text at mount is only read as part of the page. The timer is cleared on
// unmount, and the games mount this component outside their
// finished/not-finished branch so a round ending (or Play again) never
// re-announces it -- once per visit (amendment E16 (f), (o)).
// Depends on: react (useEffect, useState); the .visually-hidden utility in
// src/app/theme.css.
// Depended on by: src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// tests/unit/visual-game-note.test.tsx.

import { useEffect, useState } from 'react';

/** How long after mount the live region is filled, so VoiceOver announces it. */
export const ANNOUNCE_DELAY_MS = 500;

/** Q8's sentence, verbatim. */
export const VISUAL_GAME_NOTE =
  "This game is visual. The sign pages have every sign's name and meaning.";

function VisualGameNote() {
  const [note, setNote] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setNote(VISUAL_GAME_NOTE), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {note}
    </p>
  );
}

export default VisualGameNote;
