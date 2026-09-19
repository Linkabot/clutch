// Unit tests for the in-memory round memory (src/engine/round-memory.ts,
// M25, M27, Q18). The module holds module-level state, so every test clears
// every game's slot first.
// Depends on: vitest, src/engine/round-memory.ts, src/engine/progress
// (GAME_IDS).
// Depended on by: `npm test` (Vitest run).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_IDS } from '../../src/engine/progress';
import { forgetRound, recallRound, rememberRound } from '../../src/engine/round-memory';

beforeEach(() => {
  for (const game of GAME_IDS) forgetRound(game);
});

describe('round memory', () => {
  it('recalls a snapshot by the id it was given', () => {
    const id = rememberRound('tap', { score: 3 });
    expect(recallRound('tap', id)).toEqual({ score: 3 });
  });

  it('returns undefined for a stale id', () => {
    const id = rememberRound('sprint', { score: 5 });
    rememberRound('sprint', { score: 9 });
    expect(recallRound('sprint', id)).toBeUndefined();
  });

  it('returns undefined when the id belongs to another game', () => {
    const id = rememberRound('pairs', { locked: 2 });
    expect(recallRound('tap', id)).toBeUndefined();
  });

  it('forgetRound clears only that game', () => {
    const tapId = rememberRound('tap', { score: 1 });
    const sprintId = rememberRound('sprint', { score: 2 });

    forgetRound('tap');

    expect(recallRound('tap', tapId)).toBeUndefined();
    expect(recallRound('sprint', sprintId)).toEqual({ score: 2 });
  });

  it('an id from before a reload never recalls a round remembered after it', async () => {
    // Each import after vi.resetModules() is a fresh page load: history.state
    // keeps `before`, but the module starts again. Both loads remember their
    // first round, so a plain counter would give both the same id.
    vi.resetModules();
    const firstLoad = await import('../../src/engine/round-memory');
    const before = firstLoad.rememberRound('tap', { score: 1 });

    vi.resetModules();
    const secondLoad = await import('../../src/engine/round-memory');
    secondLoad.rememberRound('tap', { score: 2 });

    expect(secondLoad.recallRound('tap', before)).toBeUndefined();
  });
});
