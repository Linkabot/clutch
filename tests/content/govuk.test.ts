// Content test: every content/uk/govuk/*.json page and index.json parse
// against their schemas, the folder and the index hold exactly Step 5's 15
// slugs, every licence line names the Open Government Licence v3.0, no part
// HTML holds a script tag, an img tag or an on-attribute, every href in
// part HTML is scheme-less or http/https/mailto/tel, and every page's URL
// appears in public/ATTRIBUTION.md's GOV.UK guidance pages subsection
// (plan.md Step 5, amend-05).
// Depends on: vitest, node:fs, node:path, src/content/schemas (GovukPageSchema,
// GovukIndexSchema), tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { GovukIndexSchema, GovukPageSchema } from '../../src/content/schemas';
import { CONTENT_ROOT } from './helpers';

const SLUGS = [
  'theory-test',
  'driving-eyesight-rules',
  'seat-belts-law',
  'using-mobile-phones-when-driving-the-law',
  'drink-drive-limit',
  'speed-limits',
  'penalty-points-endorsements',
  'vehicle-insurance',
  'getting-an-mot',
  'vehicle-tax',
  'towing-with-car',
  'tow-a-trailer-with-a-car-safety-checks',
  'health-conditions-and-driving',
  'driving-lessons-learning-to-drive',
  'legal-obligations-drivers-riders',
];

const GOVUK_DIR = join(CONTENT_ROOT, 'govuk');

function readGovukJson(slug: string): unknown {
  return JSON.parse(readFileSync(join(GOVUK_DIR, `${slug}.json`), 'utf8'));
}

describe('content/uk/govuk', () => {
  it('NEW S5: every GOV.UK page file and the index parse against their schemas', () => {
    for (const slug of SLUGS) {
      expect(() => GovukPageSchema.parse(readGovukJson(slug))).not.toThrow();
    }
    const index = JSON.parse(readFileSync(join(GOVUK_DIR, 'index.json'), 'utf8'));
    expect(() => GovukIndexSchema.parse(index)).not.toThrow();
  });

  it('NEW S5: the index and the folder hold exactly the 15 slugs', () => {
    const onDisk = readdirSync(GOVUK_DIR)
      .filter((name) => name !== 'index.json')
      .map((name) => name.replace(/\.json$/, ''))
      .sort();
    expect(onDisk).toEqual([...SLUGS].sort());

    const index = GovukIndexSchema.parse(
      JSON.parse(readFileSync(join(GOVUK_DIR, 'index.json'), 'utf8')),
    );
    expect(index.pages.map((page) => page.slug).sort()).toEqual([...SLUGS].sort());
  });

  it('NEW S5: every page licence line names the Open Government Licence v3.0', () => {
    for (const slug of SLUGS) {
      const page = GovukPageSchema.parse(readGovukJson(slug));
      expect(page.licenceLine).toContain('Open Government Licence v3.0');
    }
  });

  it('NEW S5: no part HTML holds a script tag, an img tag or an on-attribute', () => {
    for (const slug of SLUGS) {
      const page = GovukPageSchema.parse(readGovukJson(slug));
      for (const part of page.parts) {
        expect(part.html).not.toMatch(/<script/i);
        expect(part.html).not.toMatch(/<img/i);
        expect(part.html).not.toMatch(/\son[a-z]+\s*=/i);
      }
    }
  });

  it('NEW S5: every href in part HTML is scheme-less or http, https, mailto or tel', () => {
    const hrefPattern = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    for (const slug of SLUGS) {
      const page = GovukPageSchema.parse(readGovukJson(slug));
      for (const part of page.parts) {
        for (const match of part.html.matchAll(hrefPattern)) {
          const href = (match[1] ?? match[2] ?? '').trim();
          const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(href);
          const safe = /^(https?:|mailto:|tel:)/i.test(href) || !hasScheme;
          expect(safe).toBe(true);
        }
      }
    }
  });

  it('NEW S5: every page URL appears in public/ATTRIBUTION.md', () => {
    const attributionMd = readFileSync(
      join(CONTENT_ROOT, '..', '..', 'public', 'ATTRIBUTION.md'),
      'utf8',
    );
    for (const slug of SLUGS) {
      const page = GovukPageSchema.parse(readGovukJson(slug));
      expect(attributionMd).toContain(page.url);
    }
  });
});
