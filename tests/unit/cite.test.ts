// Unit tests for the citation vocabulary (src/content/cite.ts) and its
// pairing with the theory corpus reader (scripts/lib/theory-corpus.ts):
// parseCite's five forms and its null cases, citeRoute/citeFrom/
// citeLinkLabel's exact strings, and unitTexts resolving real committed
// content (Phase 3 block 3a Step 8, plan.md and amend-08 A35-A37).
// Depends on: vitest, node:fs, node:url, node:path, ../../src/content/cite,
// ../../scripts/lib/theory-corpus.
// Depended on by: `npm test` (Vitest run).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCite, citeRoute, citeFrom, citeLinkLabel } from '../../src/content/cite';
import { loadCorpus, unitTexts } from '../../scripts/lib/theory-corpus';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function readJson(relPath: string) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8'));
}

const hcIndex = readJson('content/uk/highway-code/index.json');
const govukIndex = readJson('content/uk/govuk/index.json');
const titles = {
  hcSections: Object.fromEntries(
    hcIndex.sections.map((section: { slug: string; title: string }) => [
      section.slug,
      section.title,
    ]),
  ),
  govukPages: Object.fromEntries(
    govukIndex.pages.map((page: { slug: string; title: string }) => [page.slug, page.title]),
  ),
};

describe('parseCite', () => {
  it('NEW S8: parseCite parses each of the five forms', () => {
    expect(parseCite('hc:207')).toEqual({ kind: 'hc', id: '207' });
    expect(parseCite('hc:H1')).toEqual({ kind: 'hc', id: 'H1' });
    expect(parseCite('hc-section:traffic-signs')).toEqual({
      kind: 'hc-section',
      slug: 'traffic-signs',
    });
    expect(parseCite('sign:warning-school')).toEqual({ kind: 'sign', id: 'warning-school' });
    expect(parseCite('ns:4.1.2')).toEqual({ kind: 'ns', id: '4.1.2' });
    expect(parseCite('govuk:speed-limits/national-speed-limits')).toEqual({
      kind: 'govuk',
      slug: 'speed-limits',
      part: 'national-speed-limits',
    });
  });

  it('NEW S8: parseCite returns null for hc:, ns:9.9, foo:1 and govuk:speed-limits', () => {
    expect(parseCite('hc:')).toBeNull();
    expect(parseCite('ns:9.9')).toBeNull();
    expect(parseCite('foo:1')).toBeNull();
    expect(parseCite('govuk:speed-limits')).toBeNull();
  });
});

describe('citeRoute', () => {
  it('NEW S8: citeRoute maps each form to its router path', () => {
    expect(citeRoute(parseCite('hc:207')!)).toBe('/code/rule/207');
    expect(citeRoute(parseCite('hc:H1')!)).toBe('/code/rule/H1');
    expect(citeRoute(parseCite('hc-section:traffic-signs')!)).toBe('/learn/code/traffic-signs');
    expect(citeRoute(parseCite('sign:warning-school')!)).toBe('/learn/signs/warning-school');
    expect(citeRoute(parseCite('ns:4.1.2')!)).toBe('/source/ns/4.1.2');
    expect(citeRoute(parseCite('govuk:speed-limits/national-speed-limits')!)).toBe(
      '/source/govuk/speed-limits#national-speed-limits',
    );
  });
});

describe('citeFrom', () => {
  it('NEW S8: citeFrom gives each form its From line', () => {
    expect(citeFrom(parseCite('hc:207')!, titles)).toBe('From the Highway Code, rule 207');
    expect(citeFrom(parseCite('hc:H1')!, titles)).toBe('From the Highway Code, rule H1');
    expect(citeFrom(parseCite('hc-section:traffic-signs')!, titles)).toBe(
      'From the Highway Code, Traffic signs',
    );
    expect(citeFrom(parseCite('sign:warning-school')!, titles)).toBe(
      'From Know Your Traffic Signs',
    );
    expect(citeFrom(parseCite('ns:4.1.2')!, titles)).toBe(
      'From the National Standard, element 4.1.2',
    );
    expect(citeFrom(parseCite('govuk:speed-limits/national-speed-limits')!, titles)).toBe(
      'From GOV.UK, Speed limits',
    );
    const noTitles = { hcSections: {}, govukPages: {} };
    expect(citeFrom(parseCite('hc-section:traffic-signs')!, noTitles)).toBe(
      'From the Highway Code',
    );
    expect(citeFrom(parseCite('govuk:speed-limits/national-speed-limits')!, noTitles)).toBe(
      'From GOV.UK',
    );
  });
});

describe('citeLinkLabel', () => {
  it('NEW S8: citeLinkLabel is Read rule N for hc, Sign page for sign and Read the source otherwise', () => {
    expect(citeLinkLabel(parseCite('hc:207')!)).toBe('Read rule 207');
    expect(citeLinkLabel(parseCite('hc:H1')!)).toBe('Read rule H1');
    expect(citeLinkLabel(parseCite('sign:warning-school')!)).toBe('Sign page');
    expect(citeLinkLabel(parseCite('hc-section:traffic-signs')!)).toBe('Read the source');
    expect(citeLinkLabel(parseCite('ns:4.1.2')!)).toBe('Read the source');
    expect(citeLinkLabel(parseCite('govuk:speed-limits/national-speed-limits')!)).toBe(
      'Read the source',
    );
  });
});

describe('unitTexts', () => {
  const corpus = loadCorpus(REPO_ROOT);

  it('NEW S8: unitTexts of hc:207 contains judge your speed', () => {
    const texts = unitTexts('hc:207', corpus);
    expect(texts).not.toBeNull();
    expect(texts!.some((text) => text.includes('judge your speed'))).toBe(true);
  });

  it('NEW S8: unitTexts of ns:4.1.2 has at least two strings', () => {
    const texts = unitTexts('ns:4.1.2', corpus);
    expect(texts).not.toBeNull();
    expect(texts!.length).toBeGreaterThanOrEqual(2);
  });

  it('NEW S8: unitTexts of sign:warning-school is its meaning alone', () => {
    expect(unitTexts('sign:warning-school', corpus)).toEqual(['Children going to or from school.']);
  });

  it('NEW S8: unitTexts of a real govuk part from Step 5 resolves', () => {
    const page = govukIndex.pages.find((p: { slug: string }) => p.slug === 'speed-limits');
    const pageFile = readJson(`content/uk/govuk/${page.slug}.json`);
    const part = pageFile.parts[0];
    const texts = unitTexts(`govuk:${page.slug}/${part.slug}`, corpus);
    expect(texts).not.toBeNull();
    expect(texts!.length).toBeGreaterThan(0);
    expect(texts![0].length).toBeGreaterThan(0);
  });

  it('NEW S8: unitTexts of hc:999 is null', () => {
    expect(unitTexts('hc:999', corpus)).toBeNull();
  });
});
