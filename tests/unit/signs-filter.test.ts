// Unit tests for filterSigns (src/features/signs/filter.ts): family-only,
// collected-only, both together, and that signs.json order is kept (never
// re-sorted) rather than merely "some order that happens to look right" —
// plus (amendment E19) a families describe block pinning src/features/
// signs/families.ts's exact order and labels, so a changed chip/pill/
// allLabel or a dropped family fails a test rather than only Step 20/21's
// e2e assertions.
// Depends on: vitest, src/features/signs/filter.ts,
// src/features/signs/families.ts, src/content/schemas.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import { filterSigns } from '../../src/features/signs/filter';
import {
  FAMILIES,
  ALL_CHIP_LABEL,
  ALL_SIGNS_LABEL,
  familyMeta,
} from '../../src/features/signs/families';
import type { Sign, SignFamily } from '../../src/content/schemas';

function makeSign(id: string, family: SignFamily): Sign {
  return {
    id: `${family}-${id}`,
    name: id,
    meaning: id,
    family,
    shape: 'other',
    colours: [],
    rule: 'C9',
    hookId: null,
    image: `signs/${family}/${id}.svg`,
    refs: [{ kind: 'section', slug: 'traffic-signs' }],
    licence: 'Open Government Licence v3.0',
    source: {
      chapterSlug: `${family}-signs`,
      chapterUrl: `https://www.gov.uk/government/publications/know-your-traffic-signs/${family}-signs`,
      imageUrl: `https://assets.publishing.service.gov.uk/media/x/${id}.svg`,
      subHeading: '',
    },
  };
}

describe('filterSigns', () => {
  it('keeps only signs in the chosen family, "all" keeps everything', () => {
    const signs = [
      makeSign('roundabout', 'warning'),
      makeSign('no-entry', 'orders'),
      makeSign('crossroads', 'warning'),
    ];

    expect(filterSigns(signs, 'warning', false, new Map()).map((s) => s.id)).toEqual([
      'warning-roundabout',
      'warning-crossroads',
    ]);
    expect(filterSigns(signs, 'all', false, new Map()).map((s) => s.id)).toHaveLength(3);
  });

  it('collected-only keeps signs at 3+ correct and drops signs below that (2 correct excluded, 3 kept)', () => {
    const notCollected = makeSign('two-correct', 'warning'); // 2 correct: must be excluded
    const collected = makeSign('three-correct', 'warning'); // 3 correct: must be kept
    const untouched = makeSign('zero-correct', 'warning'); // no entry at all: must be excluded
    const signs = [notCollected, collected, untouched];
    const progress = new Map([
      [notCollected.id, 2],
      [collected.id, 3],
    ]);

    expect(filterSigns(signs, 'all', true, progress).map((s) => s.id)).toEqual([collected.id]);
  });

  it('applies family and collected-only together', () => {
    const collectedWarning = makeSign('collected-warning', 'warning');
    const uncollectedWarning = makeSign('uncollected-warning', 'warning');
    const collectedOrders = makeSign('collected-orders', 'orders');
    const signs = [collectedWarning, uncollectedWarning, collectedOrders];
    const progress = new Map([
      [collectedWarning.id, 3],
      [uncollectedWarning.id, 1],
      [collectedOrders.id, 3],
    ]);

    expect(filterSigns(signs, 'warning', true, progress).map((s) => s.id)).toEqual([
      collectedWarning.id,
    ]);
  });

  it('keeps signs.json order rather than re-sorting by id or family', () => {
    // Deliberately not sorted by id or family, so a filter that happened to
    // sort its output would fail this test.
    const signs = [
      makeSign('b-sign', 'warning'),
      makeSign('x-sign', 'information'),
      makeSign('a-sign', 'warning'),
      makeSign('y-sign', 'direction'),
    ];

    expect(filterSigns(signs, 'warning', false, new Map()).map((s) => s.id)).toEqual([
      'warning-b-sign',
      'warning-a-sign',
    ]);
    expect(filterSigns(signs, 'all', false, new Map()).map((s) => s.id)).toEqual([
      'warning-b-sign',
      'information-x-sign',
      'warning-a-sign',
      'direction-y-sign',
    ]);
  });
});

describe('families', () => {
  it('lists exactly the six families in order, with their chip/pill/allLabel triple', () => {
    expect(FAMILIES.map((family) => family.id)).toEqual([
      'warning',
      'orders',
      'motorway',
      'direction',
      'information',
      'road-works',
    ]);

    expect(FAMILIES).toEqual([
      { id: 'warning', chip: 'Warning', pill: 'Warning signs', allLabel: 'All warning signs' },
      {
        id: 'orders',
        chip: 'Orders',
        pill: 'Signs giving orders',
        allLabel: 'All signs giving orders',
      },
      { id: 'motorway', chip: 'Motorway', pill: 'Motorway signs', allLabel: 'All motorway signs' },
      {
        id: 'direction',
        chip: 'Direction',
        pill: 'Direction signs',
        allLabel: 'All direction signs',
      },
      {
        id: 'information',
        chip: 'Information',
        pill: 'Information signs',
        allLabel: 'All information signs',
      },
      {
        id: 'road-works',
        chip: 'Road works',
        pill: 'Road works signs',
        allLabel: 'All road works signs',
      },
    ]);
  });

  it('has the "all families" pseudo-family labels', () => {
    expect(ALL_CHIP_LABEL).toBe('All');
    expect(ALL_SIGNS_LABEL).toBe('All signs');
  });

  it('familyMeta("orders").pill is "Signs giving orders"', () => {
    expect(familyMeta('orders').pill).toBe('Signs giving orders');
  });
});
