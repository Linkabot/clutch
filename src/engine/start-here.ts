// Which game Today's "Start here" card suggests (Q17, plan.md Step 11,
// amendment E25 (b)): Tap the sign while no sign has been collected yet;
// otherwise the game with the oldest lastPlayed timestamp, where never
// having been played (null) counts as older than any timestamp, and ties
// go in GAME_IDS order (tap, sprint, pairs). Pure -- no Dexie, no React --
// so it is unit-tested directly against a plain ProgressSummary, not
// through a rendered screen.
// Depends on: ./progress (GAME_IDS, GameId), ./progress-store
// (ProgressSummary, type only).
// Depended on by: src/features/journey/JourneyScreen.tsx,
// tests/unit/start-here.test.ts.

import { GAME_IDS, type GameId } from './progress';
import type { ProgressSummary } from './progress-store';

/** True when `a` is strictly older than `b` -- null (never played) is older than every timestamp, and never older than another null. */
function isOlder(a: number | null, b: number | null): boolean {
  if (a === null) return b !== null;
  if (b === null) return false;
  return a < b;
}

/** The game Today's start card should suggest, from the loaded summary. */
export function startHere(summary: ProgressSummary): GameId {
  if (summary.collected === 0) return 'tap';

  let chosen: GameId = GAME_IDS[0];
  let oldest = summary.lastPlayed[chosen];
  for (const game of GAME_IDS.slice(1)) {
    const lastPlayed = summary.lastPlayed[game];
    if (isOlder(lastPlayed, oldest)) {
      chosen = game;
      oldest = lastPlayed;
    }
  }
  return chosen;
}
