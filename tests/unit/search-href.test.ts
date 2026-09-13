// Unit tests for resultHref(): the pure mapping from a MiniSearch result
// (the 'rule' or 'section' documents ./search.ts's buildSearchIndex
// stores) to the app route it should open.
// Depends on: vitest, src/features/code/search.ts, minisearch (SearchResult
// type, for fixture shape only).
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import type { SearchResult } from 'minisearch';
import { resultHref } from '../../src/features/code/search';

function fixture(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: 'fixture',
    terms: [],
    queryTerms: [],
    score: 1,
    match: {},
    ...overrides,
  };
}

describe('resultHref', () => {
  it('links a rule result to /code/rule/<ruleId>', () => {
    const result = fixture({
      kind: 'rule',
      ruleId: '126',
      sectionSlug: 'ignored-for-rule-results',
    });
    expect(resultHref(result)).toBe('/code/rule/126');
  });

  it('links a section result to /learn/code/<sectionSlug>', () => {
    const result = fixture({
      kind: 'section',
      sectionSlug: 'annex-6-vehicle-maintenance-safety-and-security',
    });
    expect(resultHref(result)).toBe('/learn/code/annex-6-vehicle-maintenance-safety-and-security');
  });
});
