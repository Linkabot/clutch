// Unit tests for the shared game helpers: mulberry32/shuffle (repeatable
// randomness, and that a shuffle actually reorders) and
// isShortCaption/pickDistractors -- distinct-caption multiple-choice
// options, capped at `count`, never the answer's own caption, and shuffled
// rather than returned in input order. pickDistractors' look-alike tiers
// (Q14, plan.md P6/E10 (f)): same family + same shape + same colour set
// first, then other families with the same look, then the remaining
// same-family candidates, each tier shuffled by `rng`, colour sets matching
// regardless of order, and a look needing both the shape and the colour set
// (E11); an 'other'-shape answer keeps the old same-family-only pick.
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
  const answer: CaptionSign = {
    id: 'warning-crossroads',
    name: 'Crossroads.',
    family: 'warning',
    shape: 'triangle',
    colours: ['red'],
  };
  const signs: CaptionSign[] = [
    answer,
    {
      id: 'warning-t-junction',
      name: 'T-junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-staggered-junction',
      name: 'Staggered junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-roundabout',
      name: 'Roundabout.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    // Same caption as warning-t-junction: must be excluded as a duplicate.
    {
      id: 'warning-duplicate-name',
      name: 'T-junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    // Different family and look: must never be picked for a 'warning' answer.
    {
      id: 'orders-no-entry',
      name: 'No entry.',
      family: 'orders',
      shape: 'circle',
      colours: ['red'],
    },
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
      {
        id: 'warning-long',
        name: 'a'.repeat(61),
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
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
    {
      id: 'warning-t-junction',
      name: 'T-junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-staggered-junction',
      name: 'Staggered junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-roundabout',
      name: 'Roundabout.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-changed-priority',
      name: 'Change of priority.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-low-flying-aircraft',
      name: 'Low-flying aircraft.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'warning-adverse-camber',
      name: 'Adverse camber.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    },
    {
      id: 'orders-no-entry',
      name: 'No entry.',
      family: 'orders',
      shape: 'circle',
      colours: ['red'],
    },
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
    const nameDupe: CaptionSign = {
      id: 'warning-decoy',
      name: 'Crossroads.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const pool: CaptionSign[] = [
      answer,
      nameDupe,
      {
        id: 'warning-t-junction',
        name: 'T-junction.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
      {
        id: 'warning-staggered-junction',
        name: 'Staggered junction.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
    ];

    for (const seed of [1, 2, 3, 4, 5]) {
      const distractors = pickDistractors(pool, answer, 3, mulberry32(seed));
      expect(distractors.some((sign) => sign.id === 'warning-decoy')).toBe(false);
      expect(distractors.some((sign) => sign.name === answer.name)).toBe(false);
    }
  });
});

describe('pickDistractors: look-alike tiers (Q14)', () => {
  it('look-alike: a red-triangle warning answer with enough same-look signs gets only same-look distractors', () => {
    const answer: CaptionSign = {
      id: 'warning-crossroads',
      name: 'Crossroads.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameLook: CaptionSign[] = [
      {
        id: 'warning-t-junction',
        name: 'T-junction.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
      {
        id: 'warning-staggered-junction',
        name: 'Staggered junction.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
      {
        id: 'warning-roundabout',
        name: 'Roundabout.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
      {
        id: 'warning-low-flying-aircraft',
        name: 'Low-flying aircraft.',
        family: 'warning',
        shape: 'triangle',
        colours: ['red'],
      },
    ];
    const differentLookSameFamily: CaptionSign = {
      id: 'warning-other-shape',
      name: 'Other shape warning.',
      family: 'warning',
      shape: 'other',
      colours: [],
    };
    const crossFamilySameLook: CaptionSign = {
      id: 'orders-decoy',
      name: 'Orders decoy.',
      family: 'orders',
      shape: 'triangle',
      colours: ['red'],
    };
    const pool = [answer, ...sameLook, differentLookSameFamily, crossFamilySameLook];

    const distractors = pickDistractors(pool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
    for (const distractor of distractors) {
      expect(distractor.family).toBe('warning');
      expect(distractor.shape).toBe('triangle');
      expect(distractor.colours).toEqual(['red']);
    }
  });

  it('look-alike: with too few, same-look signs come first then same-family ones', () => {
    const answer: CaptionSign = {
      id: 'warning-crossroads',
      name: 'Crossroads.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameLook: CaptionSign = {
      id: 'warning-t-junction',
      name: 'T-junction.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameFamilyDifferentLook: CaptionSign[] = [
      { id: 'warning-a', name: 'Warning A.', family: 'warning', shape: 'other', colours: [] },
      { id: 'warning-b', name: 'Warning B.', family: 'warning', shape: 'other', colours: [] },
    ];
    const pool = [answer, sameLook, ...sameFamilyDifferentLook];

    const distractors = pickDistractors(pool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
    expect(distractors.some((sign) => sign.id === sameLook.id)).toBe(true);
    expect(distractors.filter((sign) => sign.shape === 'other')).toHaveLength(2);
  });

  it("look-alike: an 'other'-shape answer gets today's family pick", () => {
    const answer: CaptionSign = {
      id: 'orders-stop-sign-and-road-marking',
      name: 'Stop.',
      family: 'orders',
      shape: 'other',
      colours: [],
    };
    const sameFamily: CaptionSign[] = [
      { id: 'orders-a', name: 'Orders A.', family: 'orders', shape: 'circle', colours: ['red'] },
      { id: 'orders-b', name: 'Orders B.', family: 'orders', shape: 'circle', colours: ['blue'] },
      { id: 'orders-c', name: 'Orders C.', family: 'orders', shape: 'other', colours: [] },
    ];
    const otherFamilySameShape: CaptionSign = {
      id: 'direction-x',
      name: 'Direction X.',
      family: 'direction',
      shape: 'other',
      colours: [],
    };
    const pool = [answer, ...sameFamily, otherFamilySameShape];

    const distractors = pickDistractors(pool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
    for (const distractor of distractors) {
      expect(distractor.family).toBe('orders');
    }
  });

  it('look-alike: a blue-rectangle motorway answer with fewer than three same-family look-alikes gets blue-rectangle information-family signs next', () => {
    const answer: CaptionSign = {
      id: 'motorway-a',
      name: 'Motorway A.',
      family: 'motorway',
      shape: 'rectangle',
      colours: ['blue'],
    };
    const sameFamilyLook: CaptionSign = {
      id: 'motorway-b',
      name: 'Motorway B.',
      family: 'motorway',
      shape: 'rectangle',
      colours: ['blue'],
    };
    const infoFamilyLook: CaptionSign[] = [
      {
        id: 'information-a',
        name: 'Information A.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
      {
        id: 'information-b',
        name: 'Information B.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
    ];
    const otherMotorway: CaptionSign = {
      id: 'motorway-c',
      name: 'Motorway C.',
      family: 'motorway',
      shape: 'other',
      colours: [],
    };
    const pool = [answer, sameFamilyLook, ...infoFamilyLook, otherMotorway];

    const distractors = pickDistractors(pool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
    expect(distractors.some((sign) => sign.id === sameFamilyLook.id)).toBe(true);
    expect(distractors.some((sign) => sign.id === otherMotorway.id)).toBe(false);
    for (const sign of infoFamilyLook) {
      expect(distractors.some((distractor) => distractor.id === sign.id)).toBe(true);
    }
  });

  it('look-alike: same-family look-alikes come before other families', () => {
    const answer: CaptionSign = {
      id: 'motorway-a',
      name: 'Motorway A.',
      family: 'motorway',
      shape: 'rectangle',
      colours: ['blue'],
    };
    const sameFamilyLook: CaptionSign = {
      id: 'motorway-b',
      name: 'Motorway B.',
      family: 'motorway',
      shape: 'rectangle',
      colours: ['blue'],
    };
    const infoFamilyLook: CaptionSign[] = [
      {
        id: 'information-a',
        name: 'Information A.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
      {
        id: 'information-b',
        name: 'Information B.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
      {
        id: 'information-c',
        name: 'Information C.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
      {
        id: 'information-d',
        name: 'Information D.',
        family: 'information',
        shape: 'rectangle',
        colours: ['blue'],
      },
    ];
    const pool = [answer, sameFamilyLook, ...infoFamilyLook];

    const distractors = pickDistractors(pool, answer, 3, mulberry32(1));
    expect(distractors).toHaveLength(3);
    expect(distractors.some((sign) => sign.id === sameFamilyLook.id)).toBe(true);
  });

  it('look-alike: the colour set matches in any order', () => {
    const answer: CaptionSign = {
      id: 'information-a',
      name: 'Information A.',
      family: 'information',
      shape: 'rectangle',
      colours: ['green', 'white'],
    };
    // Another family (E11): only a set match puts it in tier 2, ahead of the
    // same-family blue sign in tier 3, whatever the seed.
    const reversedOrder: CaptionSign = {
      id: 'direction-b',
      name: 'Direction B.',
      family: 'direction',
      shape: 'rectangle',
      colours: ['white', 'green'],
    };
    const differentColours: CaptionSign = {
      id: 'information-c',
      name: 'Information C.',
      family: 'information',
      shape: 'rectangle',
      colours: ['blue'],
    };
    const pool = [answer, reversedOrder, differentColours];

    const distractors = pickDistractors(pool, answer, 1, mulberry32(1));
    expect(distractors).toHaveLength(1);
    expect(distractors[0].id).toBe(reversedOrder.id);
  });

  it('look-alike: the same shape in another colour is not a look-alike', () => {
    const answer: CaptionSign = {
      id: 'information-a',
      name: 'Information A.',
      family: 'information',
      shape: 'rectangle',
      colours: ['green'],
    };
    const sameFamilyBlue: CaptionSign[] = Array.from({ length: 3 }, (_, index) => ({
      id: `information-blue-${index}`,
      name: `Information blue ${index}.`,
      family: 'information',
      shape: 'rectangle',
      colours: ['blue'],
    }));
    const otherFamilyGreen: CaptionSign[] = Array.from({ length: 2 }, (_, index) => ({
      id: `direction-green-${index}`,
      name: `Direction green ${index}.`,
      family: 'direction',
      shape: 'rectangle',
      colours: ['green'],
    }));
    const pool = [answer, ...sameFamilyBlue, ...otherFamilyGreen];

    for (let seed = 1; seed <= 5; seed++) {
      const distractors = pickDistractors(pool, answer, 3, mulberry32(seed));
      expect(distractors).toHaveLength(3);
      expect(
        distractors
          .slice(0, 2)
          .map((sign) => sign.id)
          .sort(),
      ).toEqual(['direction-green-0', 'direction-green-1']);
    }
  });

  it('look-alike: the same colour on another shape is not a look-alike', () => {
    const answer: CaptionSign = {
      id: 'warning-a',
      name: 'Warning A.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameLook: CaptionSign = {
      id: 'warning-b',
      name: 'Warning B.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameFamilyOther: CaptionSign[] = Array.from({ length: 2 }, (_, index) => ({
      id: `warning-other-${index}`,
      name: `Warning other ${index}.`,
      family: 'warning',
      shape: 'other',
      colours: [],
    }));
    const otherFamilyRedCircles: CaptionSign[] = Array.from({ length: 3 }, (_, index) => ({
      id: `orders-red-circle-${index}`,
      name: `Orders red circle ${index}.`,
      family: 'orders',
      shape: 'circle',
      colours: ['red'],
    }));
    const pool = [answer, sameLook, ...sameFamilyOther, ...otherFamilyRedCircles];

    for (let seed = 1; seed <= 5; seed++) {
      const distractors = pickDistractors(pool, answer, 3, mulberry32(seed));
      expect(distractors).toHaveLength(3);
      expect(distractors[0].id).toBe(sameLook.id);
      for (const distractor of distractors) {
        expect(distractor.family).toBe('warning');
      }
    }
  });

  it('look-alike: each tier is shuffled with the rng', () => {
    const answer: CaptionSign = {
      id: 'warning-a',
      name: 'Warning A.',
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    };
    const sameLook: CaptionSign[] = Array.from({ length: 6 }, (_, index) => ({
      id: `warning-look-${index}`,
      name: `Warning look ${index}.`,
      family: 'warning',
      shape: 'triangle',
      colours: ['red'],
    }));
    const pool = [answer, ...sameLook];

    const results = new Set(
      Array.from({ length: 20 }, (_, index) =>
        pickDistractors(pool, answer, 3, mulberry32(index + 1))
          .map((sign) => sign.id)
          .join(','),
      ),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
