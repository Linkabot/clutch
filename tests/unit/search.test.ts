// Unit tests for the offline MiniSearch index over the Highway Code: proves
// "stopping distance" surfaces Rule 126 and "horn" surfaces Rule 112 from
// the real committed content, loaded through src/content/loaders.ts, and
// that the "Index" section itself is left out of search documents
// (plan.md S4 — documentCount is 325, not 326).
// Depends on: vitest, src/features/code/search.ts, src/content/loaders.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { search, getSearchIndex } from '../../src/features/code/search';
import { loadAllSections } from '../../src/content/loaders';

describe('search', () => {
  it('finds Rule 126 within the top 3 results for "stopping distance"', async () => {
    const results = await search('stopping distance');
    const rank = results.findIndex((result) => result.ruleId === '126');
    console.log(`"stopping distance": Rule 126 rank (0-based) = ${rank}`);
    console.log(
      '"stopping distance" top 5:',
      JSON.stringify(results.slice(0, 5).map((r) => ({ id: r.id, score: r.score }))),
    );
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(3);
  });

  it('finds Rule 112 within the top 5 results for "horn"', async () => {
    const results = await search('horn');
    const rank = results.findIndex((result) => result.ruleId === '112');
    console.log(`"horn": Rule 112 rank (0-based) = ${rank}`);
    console.log(
      '"horn" top 5:',
      JSON.stringify(results.slice(0, 5).map((r) => ({ id: r.id, score: r.score }))),
    );
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(5);
  });

  it('returns [] for a blank query', async () => {
    expect(await search('')).toEqual([]);
    expect(await search('   ')).toEqual([]);
  });

  it('never returns more results than the limit', async () => {
    const results = await search('road', 5);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.length).toBe(5);
  });

  it('builds the index from the real committed content, excluding the Index section (logs size and timing)', async () => {
    const start = Date.now();
    const sections = await loadAllSections();
    const index = await getSearchIndex();
    const elapsedMs = Date.now() - start;
    const ruleDocCount = sections.reduce((total, section) => total + section.rules.length, 0);
    const sectionDocCount = sections.filter(
      (section) => section.rules.length === 0 && section.slug !== 'index',
    ).length;
    console.log(
      `search index: ${ruleDocCount} rule documents, ${sectionDocCount} section documents, ` +
        `${index.documentCount} total documents, built/loaded in ${elapsedMs}ms (this test)`,
    );
    expect(index.documentCount).toBe(ruleDocCount + sectionDocCount);
    expect(index.documentCount).toBe(325);
  });

  it('never surfaces the "Index" section itself as a result (plan.md S4)', async () => {
    const stoppingResults = await search('stopping distance');
    const indexResults = await search('index');
    expect(stoppingResults.some((result) => result.id === 'section:index')).toBe(false);
    expect(indexResults.some((result) => result.id === 'section:index')).toBe(false);
  });
});
