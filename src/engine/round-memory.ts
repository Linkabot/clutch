// In-memory, one-slot-per-game round memory (M25, M27, Q18): no table, no
// persistence, just enough for a game's Back-navigation history entry to
// recall the round it left, if it is still the game's current round. Ids
// are a counter behind a per-load token: history entries survive a page
// reload but this module's state does not, so an id saved before a reload
// must never match a round remembered after it.
// Depends on: ./progress (GameId).
// Depended on by: src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// tests/unit/round-memory.test.ts.

import type { GameId } from './progress';

interface Slot {
  id: string;
  snapshot: unknown;
}

const slots = new Map<GameId, Slot>();

/** Differs on every page load (time plus random digits), so ids never repeat across reloads. */
const LOAD_TOKEN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

let nextId = 0;

/** Stores `snapshot` as `game`'s current round and returns a fresh id for it. */
export function rememberRound<T>(game: GameId, snapshot: T): string {
  nextId += 1;
  const id = `${LOAD_TOKEN}-${nextId}`;
  slots.set(game, { id, snapshot });
  return id;
}

/** Returns `game`'s snapshot only when `id` matches its current slot; `undefined` otherwise (a stale id or another game). */
export function recallRound<T>(game: GameId, id: string): T | undefined {
  const slot = slots.get(game);
  if (!slot || slot.id !== id) return undefined;
  return slot.snapshot as T;
}

/** Clears `game`'s slot, leaving every other game's slot untouched. */
export function forgetRound(game: GameId): void {
  slots.delete(game);
}
