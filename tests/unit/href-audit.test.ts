// Unit tests for scripts/lib/href-audit.ts's countMalformedHrefs: each of
// its four malformed href patterns, plan.md amendment P2's "#rule%20"
// addition, a clean href, and that it walks nested arrays/objects rather
// than only a bare string.
// Depends on: vitest, scripts/lib/href-audit.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { countMalformedHrefs } from '../../scripts/lib/href-audit';

const ZWSP = '\u200B';

function anchor(href: string): string {
  return `<p><a href="${href}">link</a></p>`;
}

describe('countMalformedHrefs', () => {
  it('counts an href starting with "www."', () => {
    expect(countMalformedHrefs(anchor('www.gov.uk/health-and-social-care/smoking'))).toBe(1);
  });

  it('counts an href starting with "guidance/"', () => {
    expect(
      countMalformedHrefs(anchor('guidance/the-highway-code/motorways-253-to-273#rule264')),
    ).toBe(1);
  });

  it('counts an href containing the percent-encoded zero-width space %E2%80%8B', () => {
    expect(
      countMalformedHrefs(
        anchor('%E2%80%8B%E2%80%8B/guidance/the-highway-code/motorways-253-to-273#rule269'),
      ),
    ).toBe(1);
  });

  it('counts an href containing a literal U+200B zero-width space', () => {
    expect(
      countMalformedHrefs(
        anchor(`${ZWSP}${ZWSP}/guidance/the-highway-code/motorways-253-to-273#rule269`),
      ),
    ).toBe(1);
  });

  it('counts an href containing "#rule%20" (plan.md amendment P2)', () => {
    expect(
      countMalformedHrefs(
        anchor('guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102#rule%2097'),
      ),
    ).toBe(1);
  });

  it('does not count a clean, well-formed href', () => {
    expect(countMalformedHrefs(anchor('/code/rule/98'))).toBe(0);
    expect(countMalformedHrefs(anchor('https://www.gov.uk/health-and-social-care/smoking'))).toBe(
      0,
    );
  });

  it('walks nested arrays and objects, summing every string it reaches', () => {
    const value = {
      preambleHtml: anchor('www.gov.uk/x'),
      rules: [
        { html: anchor('guidance/the-highway-code/y#rule1') + anchor('/code/rule/2'), n: 1 },
        { html: 'no links here', n: null },
      ],
    };
    expect(countMalformedHrefs(value)).toBe(2);
  });

  it('returns 0 for non-string, non-array, non-object leaves', () => {
    expect(countMalformedHrefs(null)).toBe(0);
    expect(countMalformedHrefs(undefined)).toBe(0);
    expect(countMalformedHrefs(42)).toBe(0);
    expect(countMalformedHrefs(true)).toBe(0);
  });
});
