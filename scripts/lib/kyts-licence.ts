// Licence-exception scan for a KYTS chapter's RENDERED page (not the
// Content API body): proves gov.uk's three standard licence statements
// (Crown copyright, the OGL sentence, and the third-party sentence added by
// Step 28a) are present on every used chapter page and that no other
// copyright- or licence-flavoured sentence has crept in unnoticed (plan.md
// amendment P5, open item 6). scripts/ingest-signs.ts fails the whole run
// on any problem this reports, and imports `CROWN_LINE`/`OGL_SENTENCE`/
// `THIRD_PARTY_SENTENCE` from here instead of defining its own copies
// (plan.md amendment E11(5), extended by Step 28a).
// Depends on: node-html-parser, ../../src/content/text.ts
// (normaliseWhitespace).
// Depended on by: scripts/ingest-signs.ts, scripts/verify-signs.ts,
// tests/unit/kyts-licence.test.ts (which also loads
// tests/fixtures/kyts-page-standard.html and
// tests/fixtures/kyts-page-exception.html), tests/content/signs.test.ts
// (THIRD_PARTY_SENTENCE, Step 28a).

import { parse } from 'node-html-parser';
import { normaliseWhitespace } from '../../src/content/text';

/** The exact text of gov.uk's three standard licence statements, matched
 * verbatim by `licenceProblems` below and reused by scripts/ingest-signs.ts
 * when it writes `content/uk/signs/signs.json`'s `licence` block, so the
 * three never drift apart (plan.md amendment E11(5), extended by Step 28a
 * to require THIRD_PARTY_SENTENCE too). */
export const CROWN_LINE = '© Crown copyright 2023';
export const OGL_SENTENCE =
  'This publication is licensed under the terms of the Open Government Licence v3.0 except where otherwise stated.';
export const THIRD_PARTY_SENTENCE =
  'Where we have identified any third party copyright information you will need to obtain permission from the copyright holders concerned.';

// Never bare "licence"/"license" (plan.md amendment P5): KYTS body text
// elsewhere on a chapter page uses that word in sentences with nothing to
// do with the publication's own licensing (e.g. an excise licence check).
const KEEP_PATTERN =
  /©|copyright|open government licence|except where otherwise stated|third[- ]party/i;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

function sentencesOf(line: string): string[] {
  return line
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Scans each rendered chapter page for licence-exception problems (plan.md
 * amendment P5): removes `<footer>`, `<script>` and `<style>`, reads
 * `<main>`'s visible text as whitespace-normalised, non-empty lines,
 * splits each line into sentences after `.`, `!` or `?` followed by
 * whitespace, and keeps only sentences that mention copyright, licence
 * matters or third-party rights (never bare "licence"/"license"). Returns
 * one problem string per issue found: a page with no `<main>`; a page
 * missing the exact "© Crown copyright 2023" line; a page missing the
 * exact Open Government Licence sentence; a page missing the exact
 * third-party sentence (`THIRD_PARTY_SENTENCE`, Step 28a); a kept sentence
 * absent from some other page (a chapter-specific statement); a kept
 * sentence containing "©" other than the Crown copyright line; a kept
 * sentence containing "except" other than the OGL sentence. An empty
 * return means no problems.
 */
export function licenceProblems(renderedPages: string[]): string[] {
  const problems: string[] = [];
  const keptPerPage: Set<string>[] = [];

  for (const [pageIndex, html] of renderedPages.entries()) {
    const root = parse(html);
    root.querySelectorAll('footer').forEach((el) => el.remove());
    root.querySelectorAll('script').forEach((el) => el.remove());
    root.querySelectorAll('style').forEach((el) => el.remove());
    const main = root.querySelector('main');

    if (!main) {
      problems.push(`page ${pageIndex}: no <main> element`);
      keptPerPage.push(new Set());
      continue;
    }

    const lines = main.structuredText
      .split('\n')
      .map((line) => normaliseWhitespace(line))
      .filter((line) => line.length > 0);

    const kept = new Set<string>();
    for (const line of lines) {
      for (const sentence of sentencesOf(line)) {
        if (KEEP_PATTERN.test(sentence)) kept.add(sentence);
      }
    }
    keptPerPage.push(kept);

    if (!lines.includes(CROWN_LINE)) {
      problems.push(`page ${pageIndex}: missing the line "${CROWN_LINE}"`);
    }
    if (!kept.has(OGL_SENTENCE)) {
      problems.push(`page ${pageIndex}: missing the sentence "${OGL_SENTENCE}"`);
    }
    if (!kept.has(THIRD_PARTY_SENTENCE)) {
      problems.push(`page ${pageIndex}: missing the sentence "${THIRD_PARTY_SENTENCE}"`);
    }
    for (const sentence of kept) {
      if (sentence.includes('©') && sentence !== CROWN_LINE) {
        problems.push(`page ${pageIndex}: unexpected © sentence: "${sentence}"`);
      }
      if (/except/i.test(sentence) && sentence !== OGL_SENTENCE) {
        problems.push(`page ${pageIndex}: unexpected "except" sentence: "${sentence}"`);
      }
    }
  }

  const everyKeptSentence = new Set<string>();
  keptPerPage.forEach((kept) => kept.forEach((sentence) => everyKeptSentence.add(sentence)));
  for (const sentence of everyKeptSentence) {
    if (!keptPerPage.every((kept) => kept.has(sentence))) {
      problems.push(`sentence not present on every page: "${sentence}"`);
    }
  }

  return problems;
}
