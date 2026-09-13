// Content test: content/uk/facts.json (Step 11) parses against
// FactsFileSchema, and every `quote-in-rule` fact's quote is a real,
// whitespace-normalised substring of the ingested Highway Code text it
// cites -- proving every number traces back to gov.uk's own wording,
// never to memory or to plan.md. Plan amendment P6 additionally requires
// that a fact with a numeric `value` name that value (digit or an
// accepted word form) inside its OWN quote, so a table row's label can
// never stand in for the number itself.
// Depends on: vitest, node:fs, node:path, src/content/schemas,
// src/content/text.ts, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FactsFileSchema } from '../../src/content/schemas';
import type { Fact, FactsFile, Rule, Section } from '../../src/content/schemas';
import { htmlToText, normaliseWhitespace } from '../../src/content/text';
import { CONTENT_ROOT, readJson } from './helpers';

const SECTIONS_DIR = join(CONTENT_ROOT, 'highway-code', 'sections');

// The 13 ids seeded by Step 11. A dropped fact (quote not present in the
// ingested text) is removed from this list in the same commit that drops
// it, and named in that step's report -- never silently omitted here.
const EXPECTED_IDS = [
  'speed-limit-built-up-default',
  'speed-limit-built-up-wales',
  'speed-limit-cars-single-carriageway',
  'speed-limit-cars-dual-carriageway',
  'speed-limit-cars-motorway',
  'following-gap-seconds',
  'following-gap-wet-multiplier',
  'following-gap-icy-multiplier',
  'tunnel-stop-gap-metres',
  'fog-visibility-headlights-metres',
  'child-restraint-height-metres',
  'seat-belt-child-age',
  'tyre-tread-minimum-mm',
];

// Word forms accepted alongside the plain numeral (plan amendment P6).
const WORD_FORMS: Record<string, RegExp> = {
  '1': /\bone\b/i,
  '2': /\btwo\b|\bdoubled\b/i,
  '3': /\bthree\b/i,
  '4': /\bfour\b/i,
  '5': /\bfive\b/i,
  '6': /\bsix\b/i,
  '7': /\bseven\b/i,
  '8': /\beight\b/i,
  '9': /\bnine\b/i,
  '10': /\bten\b/i,
};

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

function findRule(sections: LoadedSection[], id: string): Rule | undefined {
  for (const { section } of sections) {
    const rule = section.rules.find((r) => r.id === id);
    if (rule) return rule;
  }
  return undefined;
}

/** The htmlToText of whatever a fact cites: a rule's html, or a section's bodyHtml (annexes). */
function citedText(sections: LoadedSection[], fact: Fact): string {
  if (fact.source.rule !== null) {
    const rule = findRule(sections, fact.source.rule);
    if (!rule) throw new Error(`fact ${fact.id} cites unknown rule ${fact.source.rule}`);
    return htmlToText(rule.html);
  }
  if (fact.source.section !== null) {
    const found = sections.find((s) => s.slug === fact.source.section);
    if (!found) throw new Error(`fact ${fact.id} cites unknown section ${fact.source.section}`);
    return htmlToText(found.section.bodyHtml);
  }
  throw new Error(`fact ${fact.id} has neither source.rule nor source.section`);
}

describe('content/uk/facts.json', () => {
  const facts = readJson<FactsFile>('facts.json');
  const sections = loadSections();

  it('parses against FactsFileSchema', () => {
    expect(() => FactsFileSchema.parse(facts)).not.toThrow();
  });

  it('has unique ids', () => {
    const ids = facts.facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the 13 seeded ids, unless a dropped id was removed here and reported', () => {
    const ids = facts.facts.map((f) => f.id);
    for (const id of EXPECTED_IDS) {
      expect(ids, `expected seeded id ${id}`).toContain(id);
    }
  });

  it('every source.url starts with a gov.uk or gov.uk-assets origin', () => {
    for (const fact of facts.facts) {
      const url = fact.source.url;
      expect(
        url.startsWith('https://www.gov.uk/') ||
          url.startsWith('https://assets.publishing.service.gov.uk/'),
        `${fact.id} source.url ${url}`,
      ).toBe(true);
    }
  });

  it('every source.rule / source.section resolves to an ingested rule or section', () => {
    for (const fact of facts.facts) {
      if (fact.source.rule !== null) {
        expect(
          findRule(sections, fact.source.rule),
          `${fact.id} rule ${fact.source.rule}`,
        ).toBeDefined();
      }
      if (fact.source.section !== null) {
        expect(
          sections.some((s) => s.slug === fact.source.section),
          `${fact.id} section ${fact.source.section}`,
        ).toBe(true);
      }
    }
  });

  it('every quote-in-rule fact quotes a verbatim, whitespace-normalised substring of the cited text', () => {
    for (const fact of facts.facts) {
      if (fact.verification.method !== 'quote-in-rule') continue;
      const cited = citedText(sections, fact);
      expect(fact.quote, `${fact.id} has a quote`).toBeTruthy();
      expect(cited, `${fact.id} quote not found in cited text`).toContain(
        normaliseWhitespace(fact.quote ?? ''),
      );
    }
  });

  // Plan amendment P6: a fact with a numeric value must name that value,
  // or an accepted word form, inside its OWN quote -- not merely inside
  // its source rule somewhere else. This is what stops a table row's
  // label standing in for the number it is meant to prove.
  it('every quote-in-rule fact with a numeric value names that value in its own quote', () => {
    for (const fact of facts.facts) {
      if (fact.verification.method !== 'quote-in-rule') continue;
      if (typeof fact.value !== 'number') continue;
      const quote = normaliseWhitespace(fact.quote ?? '').toLowerCase();
      const hasDigit = quote.includes(String(fact.value).toLowerCase());
      const wordForm = WORD_FORMS[String(fact.value)];
      const hasWord = wordForm ? wordForm.test(quote) : false;
      expect(hasDigit || hasWord, `${fact.id} quote does not name its value ${fact.value}`).toBe(
        true,
      );
    }
  });
});
