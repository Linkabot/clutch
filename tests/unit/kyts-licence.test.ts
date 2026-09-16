// Unit tests for the licence-exception scan (plan.md amendment P5) against
// two rendered-page fixtures: two standard pages report no problems (the
// "Licensed camping…" sentence in tests/fixtures/kyts-page-standard.html
// must not be mistaken for a licence exception, and the stray <footer>
// copyright mention must be stripped before scanning); a standard page
// plus tests/fixtures/kyts-page-exception.html's added "© Example Ltd."
// sentence reports at least one problem; a page missing the exact
// "© Crown copyright 2023" line reports at least one problem. The tests
// named `E11: (h)`-`(k)` (plan.md amendment E11) each isolate one of the
// scan's four "kept sentence" problem kinds — a missing OGL sentence, a
// kept sentence absent from another page, a kept sentence with an
// unexpected "©", a kept sentence with an unexpected "except" — on pages
// built here so that kind is the ONLY problem `licenceProblems` reports.
// Depends on: vitest, node:fs, node:url, node:path,
// scripts/lib/kyts-licence.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { licenceProblems, CROWN_LINE, OGL_SENTENCE } from '../../scripts/lib/kyts-licence';

const __dirname = dirname(fileURLToPath(import.meta.url));
const standardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'kyts-page-standard.html'),
  'utf8',
);
const exceptionHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'kyts-page-exception.html'),
  'utf8',
);

describe('licenceProblems', () => {
  it('reports no problems across two standard pages', () => {
    expect(licenceProblems([standardHtml, standardHtml])).toEqual([]);
  });

  it('reports at least one problem when one page has an extra © sentence', () => {
    const problems = licenceProblems([standardHtml, exceptionHtml]);
    expect(problems.length).toBeGreaterThanOrEqual(1);
  });

  it('reports at least one problem for a page missing the exact Crown copyright line', () => {
    const withoutCrownLine = standardHtml.replace('© Crown copyright 2023', 'Crown copyright 2023');
    const problems = licenceProblems([standardHtml, withoutCrownLine]);
    expect(problems.length).toBeGreaterThanOrEqual(1);
  });

  it('reports a missing <main> as its own problem', () => {
    const problems = licenceProblems(['<html><body><p>No main element here.</p></body></html>']);
    expect(problems).toEqual(['page 0: no <main> element']);
  });
});

const THIRD_PARTY_SENTENCE =
  'Where we have identified any third party copyright information you will need to obtain permission from the copyright holders concerned.';
const STANDARD_PARAGRAPHS = [CROWN_LINE, OGL_SENTENCE, THIRD_PARTY_SENTENCE];

function page(paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join('\n');
  return `<html><body><main id="content">${body}</main><footer><p>ignored</p></footer></body></html>`;
}

describe('licenceProblems: E11 problem-kind isolation', () => {
  it('E11: (h) kind (c) alone — a page missing the exact OGL sentence', () => {
    const missingOgl = page([CROWN_LINE, THIRD_PARTY_SENTENCE]);
    const problems = licenceProblems([missingOgl, missingOgl]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.includes('missing the sentence'))).toBe(true);
  });

  it('E11: (i) kind (d) alone — a kept sentence not present on every page', () => {
    const extra = 'This chapter also credits third party contributors separately.';
    const pageA = page([...STANDARD_PARAGRAPHS, extra]);
    const pageB = page(STANDARD_PARAGRAPHS);
    const problems = licenceProblems([pageA, pageB]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.includes('not present on every page'))).toBe(true);
  });

  it('E11: (j) kind (e) alone — a kept sentence with © other than the Crown line', () => {
    const extra = 'Some images © Third Party Photography.';
    const withExtra = page([...STANDARD_PARAGRAPHS, extra]);
    const problems = licenceProblems([withExtra, withExtra]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.includes('unexpected © sentence'))).toBe(true);
  });

  it('E11: (k) kind (f) alone — a kept sentence with "except" other than the OGL sentence', () => {
    const extra = 'This publication excludes third party content except where separately licensed.';
    const withExtra = page([...STANDARD_PARAGRAPHS, extra]);
    const problems = licenceProblems([withExtra, withExtra]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.includes('unexpected "except" sentence'))).toBe(true);
  });
});
