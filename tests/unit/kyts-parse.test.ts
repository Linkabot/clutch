// Unit tests for the pure KYTS chapter parser: picture discovery,
// media id/file extraction from the image src, caption extraction from the
// figure's own figcaption (or "" when there is none), the h2-h4 sub-heading
// path, and the preceding-paragraph text R8 needs (plan.md amended P7)
// against the fixture (tests/fixtures/kyts-chapter.html), plus (plan.md
// amendment E11) proof that the parser reads through the fixture's real
// <div class="govspeak"> wrapper and still falls back correctly without one.
// Depends on: vitest, node:fs, node:url, node:path,
// scripts/lib/kyts-parse.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseChapter } from '../../scripts/lib/kyts-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, '..', 'fixtures', 'kyts-chapter.html'), 'utf8');

const EXPECTED_FILES = [
  'no-entry-example.svg',
  'turn-left-ahead-example.svg',
  'give-way-road-marking.svg',
  'stop-sign-and-road-marking.svg',
  'bracket-example.svg',
  'plate-example.svg',
  'uncaptioned-example.svg',
  'no-entry-duplicate-example.svg',
];

describe('parseChapter', () => {
  const pictures = parseChapter(fixtureHtml);

  it('finds all eight pictures, in document order', () => {
    expect(pictures.map((p) => p.file)).toEqual(EXPECTED_FILES);
  });

  it('numbers each picture by its 0-based document position', () => {
    expect(pictures.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('reads the media id and file name from the image src', () => {
    expect(pictures[0].mediaId).toBe('aaaa1111bbbb2222cccc3333');
    expect(pictures[0].file).toBe('no-entry-example.svg');
    expect(pictures[0].url).toBe(
      'https://assets.publishing.service.gov.uk/media/aaaa1111bbbb2222cccc3333/no-entry-example.svg',
    );
  });

  it('extracts a figure caption from its own figcaption, htmlToText-normalised', () => {
    expect(pictures[0].caption).toBe('No entry for vehicles.');
    expect(pictures[1].caption).toBe('Turn left ahead only.');
    expect(pictures[2].caption).toBe('(alternative in Wales)');
    expect(pictures[4].caption).toBe('(a bracketed annotation)');
  });

  it('gives an empty caption to a figure with no figcaption', () => {
    expect(pictures[3].caption).toBe(''); // stop-sign-and-road-marking.svg
    expect(pictures[6].caption).toBe(''); // uncaptioned-example.svg
  });

  it('gives a later picture the same caption as an earlier one when the fixture repeats it', () => {
    expect(pictures[7].caption).toBe(pictures[0].caption);
    expect(pictures[7].file).not.toBe(pictures[0].file);
  });

  it('tracks the h2 sub-heading in effect before any h3 has appeared', () => {
    expect(pictures[0].subHeading).toBe('Prohibitory examples');
    expect(pictures[3].subHeading).toBe('Prohibitory examples');
    expect(pictures[4].subHeading).toBe('Prohibitory examples');
  });

  it('appends an h3 to the sub-heading path once one appears', () => {
    expect(pictures[5].subHeading).toBe('Prohibitory examples › Plates and duplicates');
    expect(pictures[7].subHeading).toBe('Prohibitory examples › Plates and duplicates');
  });

  it('records null preceding-paragraph text when the previous element is not a <p>', () => {
    expect(pictures[0].precedingParagraphText).toBeNull(); // preceded by the <h2>
    expect(pictures[1].precedingParagraphText).toBeNull(); // preceded by another <figure>
    expect(pictures[4].precedingParagraphText).toBeNull(); // preceded by the STOP <figure>
    expect(pictures[6].precedingParagraphText).toBeNull();
  });

  it("records the preceding <p>'s text for the GIVE WAY and STOP pictures (R8)", () => {
    expect(pictures[2].precedingParagraphText).toBe(
      "The 'GIVE WAY' sign and road markings: an example paragraph used only to exercise R8 in the fixture.",
    );
    expect(pictures[3].precedingParagraphText).toBe(
      "The 'STOP' sign and road markings: another example paragraph used only to exercise R8 in the fixture.",
    );
  });

  it('E11: (b) reads through the real <div class="govspeak"> wrapper the fixture uses', () => {
    expect(fixtureHtml).toContain('class="govspeak"');
    expect(pictures.map((p) => p.file)).toEqual(EXPECTED_FILES);
  });

  it('E11: (c) falls back to the root and finds the same pictures without the wrapper', () => {
    const withoutWrapper = fixtureHtml
      .replace(/<div class="govspeak">\s*/, '')
      .replace(/\s*<\/div>\s*$/, '');
    expect(withoutWrapper).not.toContain('class="govspeak"');
    const unwrapped = parseChapter(withoutWrapper);
    expect(unwrapped.map((p) => p.file)).toEqual(EXPECTED_FILES);
  });
});
