// Unit tests for the pure Highway Code hub helpers: ruleRange (rendering a
// section's rule ids as a human-readable range) and CODE_TABS/groupSections
// (splitting the index's sections into the three tabs the hub renders,
// amendment E6d). Uses a small hand-built index object, not the real
// committed content — see tests/content/highway-code.test.ts for that.
// Depends on: vitest, src/features/code/sections.ts, src/content/schemas.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { CODE_TABS, ruleRange, groupSections } from '../../src/features/code/sections';
import type { HighwayCodeIndex } from '../../src/content/schemas';

describe('ruleRange', () => {
  it('renders a numeric range as "min–max", derived from ruleIds', () => {
    // Deliberately out of slug/title order (amendment P3: real ingested
    // data can disagree, e.g. "motorways-253-to-273" holds rules 253–274)
    // — the range must still come from ruleIds, computed as min/max.
    expect(ruleRange(['253', '254', '274'])).toBe('253–274');
  });

  it('renders a single numeric id with no dash', () => {
    expect(ruleRange(['42'])).toBe('42');
  });

  it('renders the introduction hierarchy-rule range "H1–H3"', () => {
    expect(ruleRange(['H1', 'H2', 'H3'])).toBe('H1–H3');
  });

  it('renders "" for a section with no rules', () => {
    expect(ruleRange([])).toBe('');
  });
});

describe('CODE_TABS / groupSections', () => {
  // Deliberately lists the introduction section FIRST (as the real index
  // does, order 0) to prove the Rules tab moves it to the end rather than
  // just trusting the index's own published order (amendment E6d).
  const index: HighwayCodeIndex = {
    source: {
      title: 'The Highway Code',
      url: 'https://www.gov.uk/guidance/the-highway-code',
      apiUrl: 'https://example.invalid/api/content/guidance/the-highway-code',
      publicUpdatedAt: '2025-01-01T00:00:00+00:00',
      fetchedAt: '2026-01-01T00:00:00.000Z',
    },
    licence: {
      name: 'Open Government Licence v3.0',
      url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      statement:
        'Contains public sector information licensed under the Open Government Licence v3.0.',
      footer:
        'All content is available under the Open Government Licence v3.0, except where otherwise stated',
    },
    sections: [
      {
        slug: 'introduction',
        title: 'Introduction',
        order: 0,
        kind: 'introduction',
        ruleIds: ['H1', 'H2', 'H3'],
      },
      {
        slug: 'rules-a-1-to-5',
        title: 'Rules A (1 to 5)',
        order: 1,
        kind: 'rules',
        ruleIds: ['1', '2', '3', '4', '5'],
      },
      {
        slug: 'annex-1-example',
        title: 'Annex 1. Example',
        order: 2,
        kind: 'annex',
        ruleIds: [],
      },
      {
        slug: 'rules-b-6-to-9',
        title: 'Rules B (6 to 9)',
        order: 3,
        kind: 'rules',
        ruleIds: ['6', '7', '8', '9'],
      },
      {
        slug: 'traffic-signs',
        title: 'Traffic signs',
        order: 4,
        kind: 'signals',
        ruleIds: [],
      },
      {
        slug: 'other-information',
        title: 'Other information',
        order: 5,
        kind: 'other',
        ruleIds: [],
      },
    ],
  };

  it('returns the three tabs in order: Rules, Signs & signals, Annexes', () => {
    const groups = groupSections(index);
    expect(groups.map((group) => group.label)).toEqual(['Rules', 'Signs & signals', 'Annexes']);
    expect(groups.map((group) => group.id)).toEqual(CODE_TABS.map((tab) => tab.id));
  });

  it('puts every section into exactly the tab whose kinds include its own kind', () => {
    const groups = groupSections(index);
    const total = groups.reduce((sum, group) => sum + group.sections.length, 0);
    expect(total).toBe(index.sections.length);
    for (const group of groups) {
      const tab = CODE_TABS.find((candidate) => candidate.id === group.id);
      expect(tab).toBeDefined();
      for (const section of group.sections) {
        expect(tab!.kinds).toContain(section.kind);
      }
    }
  });

  it("puts the Rules tab's kinds in CODE_TABS order (rules, then introduction), each in published order", () => {
    const groups = groupSections(index);
    const rules = groups.find((group) => group.id === 'rules');
    expect(rules?.sections.map((section) => section.slug)).toEqual([
      'rules-a-1-to-5',
      'rules-b-6-to-9',
      'introduction',
    ]);
  });

  it("keeps the Annexes tab's sections in the index's own published order within a kind", () => {
    const groups = groupSections(index);
    const annexes = groups.find((group) => group.id === 'annexes');
    expect(annexes?.sections.map((section) => section.slug)).toEqual([
      'annex-1-example',
      'other-information',
    ]);
  });
});
