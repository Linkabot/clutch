// Content test: the ingested Highway Code (content/uk/highway-code/,
// written by `npm run ingest:highway-code`, Step 9) parses against its
// schemas and matches the shape Learn > The Highway Code (Steps 15-17)
// depends on — rules 1-307 unique, H1-H3 present in the introduction,
// cross-references resolve, kind counts match plan.md amendment P3, the
// flagged law rules carry their MUST/MUST NOT count, the licence text is
// exactly what was ingested from gov.uk under OGL v3.0, and — plan.md M4
// hardening, review-b.md finding B2 + suggestion B-S1 — every committed
// href is scheme-less or uses http/https/mailto/tel and no tag carries an
// on…= attribute. Phase 2 Step 7 (re-parse from the cache with every
// parser flag on, plan.md § Steps) adds: the traffic-signs section's
// figcaption-linked diagram count, every section's `interludes` is an
// array, and no committed href is malformed (scripts/lib/href-audit.ts).
// Depends on: vitest, node:fs, node:path, src/content/schemas,
// scripts/lib/href-audit.ts, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { HighwayCodeIndexSchema, SectionSchema } from '../../src/content/schemas';
import type { HighwayCodeIndex, Rule, Section } from '../../src/content/schemas';
import { countMalformedHrefs } from '../../scripts/lib/href-audit';
import { CONTENT_ROOT, readJson } from './helpers';

const SECTIONS_DIR = join(CONTENT_ROOT, 'highway-code', 'sections');

interface LoadedSection {
  slug: string;
  section: Section;
}

function loadSections(): LoadedSection[] {
  const files = readdirSync(SECTIONS_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => ({
    slug: f.replace(/\.json$/, ''),
    section: JSON.parse(readFileSync(join(SECTIONS_DIR, f), 'utf8')) as Section,
  }));
}

function findRule(sections: LoadedSection[], id: string): Rule {
  for (const { section } of sections) {
    const rule = section.rules.find((r) => r.id === id);
    if (rule) return rule;
  }
  throw new Error(`rule ${id} not found in any committed section`);
}

/** Every sanitised HTML block in the committed corpus: each section's
 * preamble and (for a section with no rules) whole body, plus every
 * rule's own html. Used by the M4 hardening checks below. */
function allSanitisedHtml(sections: LoadedSection[]): string[] {
  const blocks: string[] = [];
  for (const { section } of sections) {
    blocks.push(section.preambleHtml, section.bodyHtml);
    for (const rule of section.rules) blocks.push(rule.html);
  }
  return blocks;
}

const ALLOWED_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HREF_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Mirrors scripts/lib/highway-code-parse.ts's `safeHref` independently
 * (plan.md M4 refinement item 5): a scheme-less href (relative path,
 * fragment, or one of the 5 known scheme-less gov.uk authoring errors)
 * always passes — only a URL *scheme* can execute script — so this flags
 * a committed href only when, after stripping ASCII control characters
 * and spaces, it has a scheme other than http, https, mailto or tel. */
function hasUnsafeHrefScheme(href: string): boolean {
  let stripped = '';
  for (const ch of href) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x20 && code !== 0x7f) stripped += ch;
  }
  const scheme = HREF_SCHEME.exec(stripped);
  if (!scheme) return false;
  return !ALLOWED_HREF_SCHEMES.has(scheme[0].toLowerCase());
}

describe('content/uk/highway-code', () => {
  const index = readJson<HighwayCodeIndex>('highway-code/index.json');
  const sections = loadSections();

  it('index.json parses against HighwayCodeIndexSchema', () => {
    expect(() => HighwayCodeIndexSchema.parse(index)).not.toThrow();
  });

  it('every sections/*.json parses against SectionSchema', () => {
    for (const { slug, section } of sections) {
      expect(() => SectionSchema.parse(section), slug).not.toThrow();
    }
  });

  it('index sections[] and files are the same 31 slugs', () => {
    const indexSlugs = index.sections
      .map((s) => s.slug)
      .slice()
      .sort();
    const fileSlugs = sections
      .map((s) => s.slug)
      .slice()
      .sort();
    expect(fileSlugs).toHaveLength(31);
    expect(fileSlugs).toEqual(indexSlugs);
  });

  it('has numeric rule ids exactly 1..307, unique, none missing', () => {
    const numericIds = sections
      .flatMap(({ section }) => section.rules.map((r) => r.id))
      .filter((id) => /^\d+$/.test(id))
      .map(Number)
      .sort((a, b) => a - b);
    expect(numericIds).toHaveLength(307);
    expect(new Set(numericIds).size).toBe(307);
    for (let n = 1; n <= 307; n += 1) {
      expect(numericIds[n - 1]).toBe(n);
    }
  });

  it('has H1, H2 and H3 in the introduction', () => {
    const introduction = sections.find((s) => s.slug === 'introduction');
    expect(introduction).toBeDefined();
    const ids = introduction!.section.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['H1', 'H2', 'H3']));
  });

  it('every crossRefs entry resolves to an existing rule id', () => {
    const allIds = new Set(sections.flatMap(({ section }) => section.rules.map((r) => r.id)));
    for (const { slug, section } of sections) {
      for (const rule of section.rules) {
        for (const ref of rule.crossRefs) {
          expect(allIds.has(ref), `${slug} rule ${rule.id} crossRefs ${ref}`).toBe(true);
        }
      }
    }
  });

  it('every ruleIds in the index matches its section file', () => {
    const bySlug = new Map(sections.map((s) => [s.slug, s.section]));
    for (const entry of index.sections) {
      const file = bySlug.get(entry.slug);
      expect(file, entry.slug).toBeDefined();
      expect(
        file!.rules.map((r) => r.id),
        entry.slug,
      ).toEqual(entry.ruleIds);
    }
  });

  it('kinds count to introduction 1, rules 14, signals 6, annex 8, other 2', () => {
    const counts: Record<Section['kind'], number> = {
      introduction: 0,
      rules: 0,
      signals: 0,
      annex: 0,
      other: 0,
    };
    for (const { section } of sections) counts[section.kind] += 1;
    expect(counts).toEqual({ introduction: 1, rules: 14, signals: 6, annex: 8, other: 2 });
  });

  it('rule 124 is law from at least one MUST NOT', () => {
    const rule = findRule(sections, '124');
    expect(rule.law).toBe(true);
    expect(rule.mustNotCount).toBeGreaterThanOrEqual(1);
  });

  it('rule 112 has at least one MUST NOT', () => {
    const rule = findRule(sections, '112');
    expect(rule.mustNotCount).toBeGreaterThanOrEqual(1);
  });

  it('rule 126 mentions the two-second gap and leads with "Stopping distances."', () => {
    const rule = findRule(sections, '126');
    expect(rule.html).toContain('at least a two-second gap');
    expect(rule.lead).toBe('Stopping distances.');
  });

  it('no rule html contains <img or <script', () => {
    for (const { section } of sections) {
      for (const rule of section.rules) {
        expect(rule.html).not.toContain('<img');
        expect(rule.html).not.toContain('<script');
      }
    }
  });

  it('at least one annex bodyHtml contains <strong>MUST', () => {
    const annexHasMust = sections.some(
      ({ section }) => section.kind === 'annex' && section.bodyHtml.includes('<strong>MUST'),
    );
    expect(annexHasMust).toBe(true);
  });

  it('licence.statement equals the OGL sentence', () => {
    expect(index.licence.statement).toBe(
      'Contains public sector information licensed under the Open Government Licence v3.0.',
    );
  });

  it('no tag in any committed html/preambleHtml/bodyHtml carries an on…= attribute', () => {
    const onAttr = /<[^>]*\son[a-z]+\s*=/i;
    for (const html of allSanitisedHtml(sections)) {
      expect(html).not.toMatch(onAttr);
    }
  });

  it('every committed href is scheme-less or uses http, https, mailto or tel', () => {
    for (const html of allSanitisedHtml(sections)) {
      for (const match of html.matchAll(/href="([^"]*)"/g)) {
        expect(hasUnsafeHrefScheme(match[1]), match[1]).toBe(false);
      }
    }
  });

  it('the traffic-signs section has 169 hc-image links, at least 160 captioned', () => {
    const trafficSigns = sections.find((s) => s.slug === 'traffic-signs');
    expect(trafficSigns).toBeDefined();
    const html = allSanitisedHtml([trafficSigns!]).join('');
    const links = html.match(/class="hc-image"/g) ?? [];
    const captioned = html.match(/\(diagram, online\)<\/a>/g) ?? [];
    expect(links).toHaveLength(169);
    expect(captioned.length).toBeGreaterThanOrEqual(160);
  });

  it('every section parses with interludes as an array', () => {
    for (const { slug, section } of sections) {
      expect(Array.isArray(section.interludes), slug).toBe(true);
    }
  });

  it('countMalformedHrefs over the committed index and every section is 0', () => {
    expect(countMalformedHrefs(index)).toBe(0);
    for (const { slug, section } of sections) {
      expect(countMalformedHrefs(section), slug).toBe(0);
    }
  });
});
