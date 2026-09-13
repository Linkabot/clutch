// Offline full-text search over the Highway Code: builds an in-memory
// MiniSearch index from every rule and non-rule section, memoised behind
// one promise so the phone builds it once, on first search, from the lazy
// per-section chunks src/content/loaders.ts already precaches. There is no
// prebuilt search index file shipped with the app, and nothing in this
// module reaches the network.
// Depends on: minisearch, src/content/loaders.ts, src/content/text.ts,
// src/content/schemas.
// Depended on by: src/features/code/SearchScreen.tsx.

import MiniSearch, { type SearchResult } from 'minisearch';
import { loadAllSections } from '../../content/loaders';
import { htmlToText } from '../../content/text';
import type { Section } from '../../content/schemas';

export type SearchDocument =
  | {
      id: string;
      kind: 'rule';
      ruleId: string;
      title: string;
      lead: string;
      sectionSlug: string;
      sectionTitle: string;
      text: string;
    }
  | {
      id: string;
      kind: 'section';
      title: string;
      lead: string;
      sectionSlug: string;
      sectionTitle: string;
      text: string;
    };

/**
 * Builds a MiniSearch index over every rule (one document each) and every
 * non-rule section (one document from its bodyHtml). Prefix and fuzzy
 * matching are on, query terms combine with AND, and the lead/title fields
 * are boosted so a rule's short summary line outweighs a passing mention
 * deep in its body text.
 */
export function buildSearchIndex(sections: Section[]): MiniSearch<SearchDocument> {
  const documents: SearchDocument[] = [];
  for (const section of sections) {
    if (section.rules.length > 0) {
      for (const rule of section.rules) {
        documents.push({
          id: `rule:${rule.id}`,
          kind: 'rule',
          ruleId: rule.id,
          title: rule.title,
          lead: rule.lead ?? '',
          sectionSlug: section.slug,
          sectionTitle: section.title,
          text: htmlToText(rule.html),
        });
      }
    } else {
      documents.push({
        id: `section:${section.slug}`,
        kind: 'section',
        title: section.title,
        lead: '',
        sectionSlug: section.slug,
        sectionTitle: section.title,
        text: htmlToText(section.bodyHtml),
      });
    }
  }

  const index = new MiniSearch<SearchDocument>({
    fields: ['title', 'lead', 'text'],
    storeFields: ['kind', 'ruleId', 'title', 'lead', 'sectionSlug', 'sectionTitle'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.15,
      combineWith: 'AND',
      boost: { lead: 4, title: 2 },
    },
  });
  index.addAll(documents);
  return index;
}

let indexPromise: Promise<MiniSearch<SearchDocument>> | undefined;

/**
 * The in-memory search index, built once (from loadAllSections(), i.e. from
 * already-precached chunks) and memoised for the lifetime of the page.
 */
export function getSearchIndex(): Promise<MiniSearch<SearchDocument>> {
  if (!indexPromise) {
    indexPromise = loadAllSections().then(buildSearchIndex);
  }
  return indexPromise;
}

/** Searches the Highway Code. Returns [] for a blank query; never returns more than `limit` results. */
export async function search(query: string, limit = 50): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const index = await getSearchIndex();
  return index.search(trimmed).slice(0, limit);
}

/**
 * Maps a search result to the app route it should open: a rule's own
 * /code/rule/:id page for a 'rule' document, or the owning section's
 * /learn/code/:slug page for a 'section' document.
 */
export function resultHref(result: SearchResult): string {
  return result.kind === 'rule'
    ? `/code/rule/${result.ruleId}`
    : `/learn/code/${result.sectionSlug}`;
}
