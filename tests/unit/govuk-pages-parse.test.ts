// Unit tests for the pure GOV.UK page parser (scripts/lib/govuk-pages.ts):
// `parsePage`'s three shapes (a details.parts guide page, a details.body
// page split at each h2, a body wrapped in one govspeak div, and a
// transaction page), its throw on an unknown shape, that part HTML goes
// through the Highway Code sanitiser, and `licenceLine`'s three cases
// (plan.md Step 5, amend-05 A25/A27). Fixtures: tests/fixtures/govuk-parts.json
// (the live /seat-belts-law Content API response), govuk-body.json (the live
// /speed-limits response, a details.body page), govuk-transaction.json (the
// live /vehicle-tax response) and govuk-footer.html (a rendered-page footer
// excerpt holding both licence lines).
// Depends on: vitest, node:fs, node:url, node:path, scripts/lib/govuk-pages.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { licenceLine, parsePage } from '../../scripts/lib/govuk-pages';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');
}

const partsApi = JSON.parse(readFixture('govuk-parts.json'));
const bodyApi = JSON.parse(readFixture('govuk-body.json'));
const transactionApi = JSON.parse(readFixture('govuk-transaction.json'));
const footerHtml = readFixture('govuk-footer.html');

describe('parsePage', () => {
  it('NEW S5: parsePage keeps the part slugs of a details.parts page', () => {
    const { parts } = parsePage('/seat-belts-law', partsApi);
    expect(parts.map((part) => part.slug)).toEqual([
      'overview',
      'when-you-dont-need-to-wear-a-seat-belt',
      'if-your-vehicle-doesnt-have-seat-belts',
    ]);
    for (const part of parts) {
      expect(part.title.trim().length).toBeGreaterThan(0);
      expect(part.html.trim().length).toBeGreaterThan(0);
    }
  });

  it('NEW S5: parsePage splits a details.body page at each h2 and names the text before the first h2 introduction', () => {
    const h2Count = (bodyApi.details.body.match(/<h2[\s>]/gi) ?? []).length;
    const { parts } = parsePage('/speed-limits', bodyApi);
    expect(parts.length).toBe(h2Count + 1);
    expect(parts[0].slug).toBe('introduction');
    for (const part of parts) {
      expect(part.html.trim().length).toBeGreaterThan(0);
    }
  });

  it('NEW S5: parsePage splits a body wrapped in one govspeak div at each h2', () => {
    const api = {
      title: 'Wrapped body test',
      details: {
        body:
          '<div class="govspeak"><p>Lead text.</p><h2 id="a">First</h2><p>One.</p>' +
          '<h2 id="b">Second</h2><p>Two.</p></div>',
      },
    };
    const { parts } = parsePage('/wrapped-body-test', api);
    expect(parts.length).toBe(3);
    expect(parts[0].slug).toBe('introduction');
    expect(parts[0].html).toContain('Lead text.');
    expect(parts[1].slug).toBe('first');
    expect(parts[1].html).toContain('One.');
    expect(parts[2].slug).toBe('second');
    expect(parts[2].html).toContain('Two.');
  });

  it('NEW S5: parsePage builds introduction and other-ways-to-apply from a transaction page', () => {
    const { parts } = parsePage('/vehicle-tax', transactionApi);
    expect(parts.map((part) => part.slug)).toEqual(['introduction', 'other-ways-to-apply']);
    for (const part of parts) {
      expect(part.html.trim().length).toBeGreaterThan(0);
    }
  });

  it('NEW S5: parsePage throws on an unknown shape, naming the base path', () => {
    const api = { title: 'No shape', details: {} };
    expect(() => parsePage('/no-shape-page', api)).toThrow('/no-shape-page');
  });

  it('NEW S5: parsePage sends part HTML through the Highway Code sanitiser', () => {
    const api = {
      title: 'Sanitiser test',
      details: {
        body: '<p>Safe text.</p><script>alert(1)</script><p onclick="x()">Click</p>',
      },
    };
    const { parts } = parsePage('/sanitiser-test', api);
    const html = parts.map((part) => part.html).join('');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onclick=/i);
    expect(html).toContain('Safe text.');
  });
});

describe('licenceLine', () => {
  it('NEW S5: licenceLine returns the OGL sentence of a rendered page footer', () => {
    const line = licenceLine(footerHtml);
    expect(line.startsWith('All content is available under the Open Government Licence v3.0')).toBe(
      true,
    );
    expect(line).toContain('except where otherwise stated');
  });

  it('NEW S5: licenceLine throws when the Crown copyright line is missing', () => {
    const html =
      '<footer><p>All content is available under the Open Government Licence v3.0, except where otherwise stated</p></footer>';
    expect(() => licenceLine(html)).toThrow();
  });

  it('NEW S5: licenceLine throws when the OGL sentence is missing', () => {
    const html = '<footer><p>© Crown copyright</p></footer>';
    expect(() => licenceLine(html)).toThrow();
  });
});
