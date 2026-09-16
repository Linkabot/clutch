// Unit tests for src/content/loaders.ts: the Highway Code index, per-section
// lazy loading, rule lookup, facts, and the SectionSchema `interludes`
// default (plan.md S3), all read from the real committed content/uk/ files
// (Vitest supports import.meta.glob, so no fixtures are needed here).
// Depends on: vitest, src/content/loaders.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import {
  getHighwayCodeIndex,
  getFacts,
  loadSection,
  loadRule,
  SectionNotFound,
} from '../../src/content/loaders';

describe('getHighwayCodeIndex', () => {
  it('lists all 31 committed sections', () => {
    expect(getHighwayCodeIndex().sections.length).toBe(31);
  });
});

describe('getFacts', () => {
  it('returns the committed facts, including the stopping-distance set', () => {
    const facts = getFacts();
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((fact) => fact.id === 'stopping-distance-20')).toBe(true);
  });
});

describe('loadSection', () => {
  // P4: content/uk/highway-code/sections/index.json is a real section
  // (titled "Index", slug "index") distinct from the top-level Highway
  // Code index.json. loadSection('index') must resolve to the section, not
  // the index — the exact-path glob in loaders.ts is what keeps them apart.
  it('resolves the "Index" section for slug "index", not the Highway Code index', async () => {
    const section = await loadSection('index');
    expect(section.slug).toBe('index');
    expect(section.title).toBe('Index');
    expect(section).not.toHaveProperty('licence');
    expect(section).not.toHaveProperty('sections');
  });

  it('rejects with SectionNotFound for a slug the index does not list', async () => {
    await expect(loadSection('nope')).rejects.toBeInstanceOf(SectionNotFound);
  });
});

describe('loadRule', () => {
  it('resolves Rule 126 together with its owning section', async () => {
    const result = await loadRule('126');
    expect(result).not.toBeNull();
    expect(result?.rule.id).toBe('126');
    expect(result?.section.slug).toBe(
      'general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158',
    );
  });

  it('resolves null for an id the index does not list', async () => {
    expect(await loadRule('999')).toBeNull();
  });
});

describe('SectionSchema interludes default (plan.md S3)', () => {
  it('a committed section with no interludes key parses to interludes: []', async () => {
    const section = await loadSection('index');
    expect(section.interludes).toEqual([]);
  });
});
