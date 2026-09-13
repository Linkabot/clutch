// Unit tests for the pure Highway Code parser: rule boundaries, HTML
// sanitisation, link rewriting and MUST/MUST NOT law detection against the
// fixture (tests/fixtures/highway-code-section.html), plus every kindOf
// precedence case named in plan.md amendment P3.
// Depends on: vitest, node:fs, node:url, node:path,
// scripts/lib/highway-code-parse.ts, src/content/schemas/highwayCode.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseSection, kindOf } from '../../scripts/lib/highway-code-parse';
import { SectionSchema } from '../../src/content/schemas/highwayCode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'highway-code-section.html'),
  'utf8',
);

const meta = {
  slug: 'example-rules-for-fixture-testing',
  title: '  Example rules for fixture testing  ',
  basePath: '/guidance/the-highway-code/example-rules-for-fixture-testing',
  sourceUrl: 'https://www.gov.uk/guidance/the-highway-code/example-rules-for-fixture-testing',
  order: 5,
};

describe('parseSection', () => {
  const section = parseSection(fixtureHtml, meta);

  it('parses cleanly against SectionSchema', () => {
    expect(() => SectionSchema.parse(section)).not.toThrow();
  });

  it('trims and whitespace-normalises the section title', () => {
    expect(section.title).toBe('Example rules for fixture testing');
  });

  it('finds rules 124, 125, 126 and H1 in order', () => {
    expect(section.rules.map((rule) => rule.id)).toEqual(['124', '125', '126', 'H1']);
  });

  it('has an empty bodyHtml for a section with rules', () => {
    expect(section.bodyHtml).toBe('');
  });

  it('keeps both preamble paragraphs in preambleHtml', () => {
    expect(section.preambleHtml).toContain('This fixture section covers example speed-limit');
    expect(section.preambleHtml).toContain('It exists only to exercise rule boundaries');
  });

  it('never lets a script tag survive in any rule', () => {
    for (const rule of section.rules) {
      expect(rule.html).not.toContain('<script');
    }
  });

  describe('Rule 124', () => {
    const rule = section.rules[0];

    it('is flagged as law from one MUST NOT and no bare MUST', () => {
      expect(rule.mustNotCount).toBe(1);
      expect(rule.mustCount).toBe(0);
      expect(rule.law).toBe(true);
    });

    it('keeps its table', () => {
      expect(rule.html).toContain('<table');
    });
  });

  describe('Rule 125', () => {
    const rule = section.rules[1];

    it('rewrites the cross-link to Rule 98 and records the cross-reference', () => {
      expect(rule.crossRefs).toEqual(['98']);
      expect(rule.html).toContain('href="/code/rule/98"');
    });
  });

  describe('Rule 126', () => {
    const rule = section.rules[2];

    it('is advice, not law', () => {
      expect(rule.law).toBe(false);
    });

    it('takes its lead from the leading strong in the first paragraph', () => {
      expect(rule.lead).toBe('Stopping distances.');
    });

    it('records the diagram image and replaces it with an hc-image link', () => {
      expect(rule.images).toHaveLength(1);
      expect(rule.images[0].src).toBe(
        'https://assets.publishing.service.gov.uk/media/65f828c3fc7fcf0011c647f9/the-highway-code-stopping-distance.jpg',
      );
      expect(rule.html).not.toContain('<img');
      expect(rule.html).toContain('hc-image');
    });

    it('keeps the external law citation marked rel="external noopener"', () => {
      expect(rule.html).toContain('rel="external noopener"');
    });
  });

  describe('Rule H1', () => {
    const rule = section.rules[3];

    it('has no number (a heading with no id, matched by its text)', () => {
      expect(rule.number).toBeNull();
    });
  });
});

describe('kindOf', () => {
  it('is introduction when the slug is introduction', () => {
    expect(kindOf({ slug: 'introduction', title: 'Introduction', rules: [] })).toBe('introduction');
  });

  it('is introduction even when the title/rules would otherwise say something else', () => {
    expect(
      kindOf({
        slug: 'introduction',
        title: 'Annex 9. Signals, signs and markings',
        rules: [{ id: '1' }],
      }),
    ).toBe('introduction');
  });

  it('is rules when the section has at least one numeric rule id', () => {
    expect(
      kindOf({
        slug: 'general-rules-all-drivers-riders-103-to-158',
        title: 'General rules (103 to 158)',
        rules: [{ id: '103' }, { id: '104' }],
      }),
    ).toBe('rules');
  });

  it('trims a trailing-space title before classifying (8 of 31 live titles have one)', () => {
    expect(
      kindOf({
        slug: 'rules-about-animals-47-to-58',
        title: 'Rules about animals (47 to 58) ',
        rules: [{ id: '47' }, { id: '48' }],
      }),
    ).toBe('rules');
  });

  it('classes a section "rules" even when its slug range disagrees with its content', () => {
    expect(
      kindOf({
        slug: 'motorways-253-to-273',
        title: 'Motorways',
        rules: [{ id: '274' }],
      }),
    ).toBe('rules');
  });

  it('is annex when the trimmed title matches "Annex N."', () => {
    expect(
      kindOf({
        slug: 'annex-6-vehicle-maintenance-safety-and-security',
        title: 'Annex 6. Vehicle maintenance, safety and security',
        rules: [],
      }),
    ).toBe('annex');
  });

  it('is signals when the title mentions signals, signs or markings', () => {
    expect(
      kindOf({ slug: 'light-signals', title: 'Light signals controlling traffic', rules: [] }),
    ).toBe('signals');
    expect(kindOf({ slug: 'road-signs', title: 'Traffic signs', rules: [] })).toBe('signals');
    expect(kindOf({ slug: 'road-markings', title: 'Road markings', rules: [] })).toBe('signals');
  });

  it('is other when nothing else matches', () => {
    expect(kindOf({ slug: 'index', title: 'Index', rules: [] })).toBe('other');
  });
});
