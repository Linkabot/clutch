// Unit tests for the pure HTML/whitespace text helpers used by both the
// Highway Code parser (scripts/lib/highway-code-parse.ts) and the in-browser
// search index (src/features/code/search.ts, Step 14).
// Depends on: vitest, src/content/text.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { htmlToText, normaliseWhitespace } from '../../src/content/text';

describe('normaliseWhitespace', () => {
  it('collapses runs of whitespace to a single space', () => {
    expect(normaliseWhitespace('a   b\tc\nd')).toBe('a b c d');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normaliseWhitespace('  padded  ')).toBe('padded');
  });

  it('leaves an already-normalised string unchanged', () => {
    expect(normaliseWhitespace('one two three')).toBe('one two three');
  });
});

describe('htmlToText', () => {
  it('strips tags', () => {
    expect(htmlToText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes the common entities', () => {
    expect(htmlToText('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \'');
  });

  it('collapses whitespace left behind by stripped tags', () => {
    expect(htmlToText('<p>Line one.</p>\n<p>Line two.</p>')).toBe('Line one. Line two.');
  });

  it('trims the result', () => {
    expect(htmlToText('  <p>padded</p>  ')).toBe('padded');
  });

  it('keeps text out of a table intact', () => {
    expect(htmlToText('<table><tr><td>A</td><td>B</td></tr></table>')).toBe('A B');
  });
});
