// Unit tests for the shared game helpers: mulberry32/shuffle (repeatable
// randomness, and that a shuffle actually reorders) and
// isShortCaption/pickDistractors (same-family, distinct-caption
// multiple-choice options, capped at `count`, never the answer's own
// caption, and shuffled rather than returned in input order).
// Depends on: vitest,
// src/features/interactives/shared/{random,distractors}.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle } from '../../src/features/interactives/shared/random';
import {
  isShortCaption,
  pickDistractors,
  type CaptionSign,
} from '../../src/features/interactives/shared/distractors';

describe('mulberry32', () => {
  it('gives the same sequence for one seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe('shuffle', () => {
  const tenItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it('returns a permutation of its input, without mutating it', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(items, mulberry32(1));
    expect(shuffled).not.toBe(items);
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('is repeatable for one seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(items, mulberry32(7))).toEqual(shuffle(items, mulberry32(7)));
  });

  it('changes the order of a 10-item array for a fixed seed (never the identity function)', () => {
    const shuffled = shuffle(tenItems, mulberry32(1));
    expect(shuffled).not.toEqual(tenItems);
  });

  it('gives different orders for two different seeds', () => {
    const a = shuffle(tenItems, mulberry32(1));
    const b = shuffle(tenItems, mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe('isShortCaption', () => {
  it('is true at exactly 60 characters', () => {
    expect(isShortCaption('a'.repeat(60))).toBe(true);
  });

  it('is false at 61 characters', () => {
    expect(isShortCaption('a'.repeat(61))).toBe(false);
  });
});

describe('pickDistractors', () => {
  const answer: CaptionSign = { id: 'warning-crossroads', name: 'Crossroads.', family: 'warning' };
  const signs: CaptionSign[] = [
    answer,
    { id: 'warning-t-junction', name: 'T-junction.', family: 'warning' },
    { id: 'warning-staggered-junction', name: 'Staggered junction.', family: 'warning' },
    { id: 'warning-roundabout', name: 'Roundabout.', family: 'warning' },
    // Same caption as warning-t-junction: must be excluded as a duplicate.
    { id: 'warning-duplicate-name', name: 'T-junction.', family: 'warning' },
    // Different family: must never be picked for a 'warning' answer.
    { id: 'orders-no-entry', name: 'No entry.', family: 'orders' },
  ];

  it('returns 3 same-family signs with distinct captions, never the answer', () => {
    const distractors = pickDistractors(signs, answer, 3, mulberry32(3));
    expect(distractors).toHaveLength(3);

    for (const distractor of distractors) {
      expect(distractor.family).toBe('warning');
      expect(distractor.id).not.toBe(answer.id);
      expect(distractor.name).not.toBe(answer.name);
    }

    const names = distractors.map((distractor) => distractor.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('honours shortOnly', () => {
    const withLongCaption: CaptionSign[] = [
      ...signs,
      { id: 'warning-long', name: 'a'.repeat(61), family: 'warning' },
    ];
    const distractors = pickDistractors(withLongCaption, answer, 4, mulberry32(5), {
      shortOnly: true,
    });

    expect(distractors.length).toBeGreaterThan(0);
    for (const distractor of distractors) {
      expect(isShortCaption(distractor.name)).toBe(true);
    }
  });

  // A pool with more eligible (same-family, distinct-caption) candidates
  // than `count`, used by the "returns exactly count" and "different seeds
  // give different results" tests below.
  const bigPool: CaptionSign[] = [
    answer,
    { id: 'warning-t-junction', name: 'T-junction.', family: 'warning' },
    { id: 'warning-staggered-junction', name: 'Staggered junction.', family: 'warning' },
    { id: 'warning-roundabout', name: 'Roundabout.', family: 'warning' },
    { id: 'warning-changed-priority', name: 'Change of priority.', family: 'warning' },
    { id: 'warning-low-flying-aircraft', name: 'Low-flying aircraft.', family: 'warning' },
    { id: 'warning-adverse-camber', name: 'Adverse camber.', family: 'warning' },
    { id: 'orders-no-entry', name: 'No entry.', family: 'orders' },
  ];

  it('returns exactly count when more eligible candidates exist than count', () => {
    const distractors = pickDistractors(bigPool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
  });

  it('gives different distractor sets or orders for two different seeds', () => {
    const a = pickDistractors(bigPool, answer, 3, mulberry32(1)).map((sign) => sign.id);
    const b = pickDistractors(bigPool, answer, 3, mulberry32(2)).map((sign) => sign.id);
    expect(a).not.toEqual(b);
  });

  it("never returns a sign whose caption equals the answer's, even when it is in the pool", () => {
    const nameDupe: CaptionSign = { id: 'warning-decoy', name: 'Crossroads.', family: 'warning' };
    const pool: CaptionSign[] = [
      answer,
      nameDupe,
      { id: 'warning-t-junction', name: 'T-junction.', family: 'warning' },
      { id: 'warning-staggered-junction', name: 'Staggered junction.', family: 'warning' },
    ];

    for (const seed of [1, 2, 3, 4, 5]) {
      const distractors = pickDistractors(pool, answer, 3, mulberry32(seed));
      expect(distractors.some((sign) => sign.id === 'warning-decoy')).toBe(false);
      expect(distractors.some((sign) => sign.name === answer.name)).toBe(false);
    }
  });
});
