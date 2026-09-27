// Reads the committed theory corpus (the Highway Code sections, signs,
// National Standard syllabus and GOV.UK guidance pages) and resolves a cite
// string to the quotable strings of the unit it names (Phase 3 block 3a
// Step 8; amend-08 A35/A37). `loadCorpus(root)` takes the repo root (the
// folder holding `content/`) and reads every file once; `unitTexts(cite,
// corpus)` returns `string[] | null` — null when the cite does not parse or
// names no unit in the corpus, and never `[]` or a list holding `''`: `hc`
// -> `[htmlToText(rule.html)]`; `hc-section` -> `[htmlToText(bodyHtml)]`, or
// null when that text is empty (the introduction and the 14 `rules`
// sections today); `sign` -> `[meaning]`; `ns` -> `[title, ...mustBeAbleTo,
// ...mustKnow]`, each list in file order; `govuk` -> `[htmlToText(part.html)]`.
// Depends on: node:fs, node:path, ../../src/content/text (htmlToText),
// ../../src/content/cite (parseCite).
// Depended on by: tests/unit/cite.test.ts, scripts/lib/theory-checks.ts,
// tests/unit/theory-checks.test.ts, tests/content/theory.test.ts,
// scripts/lib/theory-content.ts, scripts/draft-theory.ts, scripts/reads.ts,
// tests/content/prompts.test.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { htmlToText } from '../../src/content/text';
import { parseCite } from '../../src/content/cite';

interface CorpusRule {
  html: string;
}

interface CorpusSection {
  bodyHtml: string;
}

interface CorpusSign {
  meaning: string;
}

interface CorpusElement {
  title: string;
  mustBeAbleTo: string[];
  mustKnow: string[];
}

interface CorpusGovukPart {
  html: string;
}

export interface TheoryCorpus {
  rulesById: Map<string, CorpusRule>;
  sectionsBySlug: Map<string, CorpusSection>;
  signsById: Map<string, CorpusSign>;
  elementsById: Map<string, CorpusElement>;
  govukPartsByKey: Map<string, CorpusGovukPart>;
}

const HC_SECTIONS_DIR = 'content/uk/highway-code/sections';

/** Reads every committed content file once and indexes it for `unitTexts`. */
export function loadCorpus(root: string): TheoryCorpus {
  const readJson = (relPath: string): unknown =>
    JSON.parse(readFileSync(join(root, relPath), 'utf8'));

  const sectionFiles = readdirSync(join(root, HC_SECTIONS_DIR)).filter((name) =>
    name.endsWith('.json'),
  );
  const rulesById = new Map<string, CorpusRule>();
  const sectionsBySlug = new Map<string, CorpusSection>();
  for (const fileName of sectionFiles) {
    const section = readJson(`${HC_SECTIONS_DIR}/${fileName}`) as {
      slug: string;
      bodyHtml: string;
      rules: { id: string; html: string }[];
    };
    sectionsBySlug.set(section.slug, { bodyHtml: section.bodyHtml });
    for (const rule of section.rules) rulesById.set(rule.id, { html: rule.html });
  }

  const signsFile = readJson('content/uk/signs/signs.json') as {
    signs: { id: string; meaning: string }[];
  };
  const signsById = new Map<string, CorpusSign>();
  for (const sign of signsFile.signs) signsById.set(sign.id, { meaning: sign.meaning });

  const syllabus = readJson('content/uk/syllabus.json') as {
    roles: {
      units: {
        elements: { id: string; title: string; mustBeAbleTo: string[]; mustKnow: string[] }[];
      }[];
    }[];
  };
  const elementsById = new Map<string, CorpusElement>();
  for (const role of syllabus.roles) {
    for (const unit of role.units) {
      for (const element of unit.elements) {
        elementsById.set(element.id, {
          title: element.title,
          mustBeAbleTo: element.mustBeAbleTo,
          mustKnow: element.mustKnow,
        });
      }
    }
  }

  const govukIndex = readJson('content/uk/govuk/index.json') as { pages: { slug: string }[] };
  const govukPartsByKey = new Map<string, CorpusGovukPart>();
  for (const page of govukIndex.pages) {
    const pageFile = readJson(`content/uk/govuk/${page.slug}.json`) as {
      parts: { slug: string; html: string }[];
    };
    for (const part of pageFile.parts) {
      govukPartsByKey.set(`${page.slug}/${part.slug}`, { html: part.html });
    }
  }

  return { rulesById, sectionsBySlug, signsById, elementsById, govukPartsByKey };
}

/** Resolves a cite string to its quotable strings, or null (never `[]`). */
export function unitTexts(cite: string, corpus: TheoryCorpus): string[] | null {
  const parsed = parseCite(cite);
  if (!parsed) return null;
  switch (parsed.kind) {
    case 'hc': {
      const rule = corpus.rulesById.get(parsed.id);
      return rule ? [htmlToText(rule.html)] : null;
    }
    case 'hc-section': {
      const section = corpus.sectionsBySlug.get(parsed.slug);
      if (!section) return null;
      const text = htmlToText(section.bodyHtml);
      return text === '' ? null : [text];
    }
    case 'sign': {
      const sign = corpus.signsById.get(parsed.id);
      return sign ? [sign.meaning] : null;
    }
    case 'ns': {
      const element = corpus.elementsById.get(parsed.id);
      return element ? [element.title, ...element.mustBeAbleTo, ...element.mustKnow] : null;
    }
    case 'govuk': {
      const part = corpus.govukPartsByKey.get(`${parsed.slug}/${parsed.part}`);
      return part ? [htmlToText(part.html)] : null;
    }
  }
}
