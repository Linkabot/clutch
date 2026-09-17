// Offline full-text search over the Highway Code: builds an in-memory
// MiniSearch index from every rule and non-rule section except the "Index"
// section itself (plan.md S4 — it is still browsable via loadSection, just
// not a search result), memoised behind a PromiseCache (../../content/memo)
// so the phone builds it once, on first search, from the lazy per-section
// chunks src/content/loaders.ts already precaches, and so a failed build
// can be retried instead of replaying the same rejection forever (C-S1).
// There is no prebuilt search index file shipped with the app, and nothing
// in this module reaches the network.
// Depends on: minisearch, src/content/loaders.ts, src/content/text.ts,
// src/content/schemas, src/content/memo.ts.
// Depended on by: src/features/code/SearchScreen.tsx,
// tests/unit/search-href.test.ts, tests/unit/search.test.ts.

import MiniSearch, { type SearchResult } from 'minisearch';
import { loadAllSections } from '../../content/loaders';
import { htmlToText } from '../../content/text';
import { createPromiseCache } from '../../content/memo';
import type { Section } from '../../content/schemas';

/** Slug of the Highway Code's own "Index" section, left out of search documents (plan.md S4). */
const INDEX_SECTION_SLUG = 'index';

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
 * non-rule section (one document from its bodyHtml), except the "Index"
 * section (plan.md S4: it lists rule numbers only, so it is browsable but
 * not a useful search result). Prefix and fuzzy matching are on, query
 * terms combine with AND, and the lead/title fields are boosted so a
 * rule's short summary line outweighs a passing mention deep in its body
 * text.
 */
export function buildSearchIndex(sections: Section[]): MiniSearch<SearchDocument> {
  const documents: SearchDocument[] = [];
  for (const section of sections) {
    if (section.slug === INDEX_SECTION_SLUG) continue;
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

/** Single-key cache: there is only ever one search index for the page's lifetime. */
const SEARCH_INDEX_KEY = 'search-index';
const indexCache = createPromiseCache<string, MiniSearch<SearchDocument>>();

/**
 * The in-memory search index, built once (from loadAllSections(), i.e. from
 * already-precached chunks) and memoised for the lifetime of the page. If
 * the build rejects (e.g. a section chunk failed to fetch), the next call
 * retries instead of replaying the same rejection forever (plan.md C-S1).
 */
export function getSearchIndex(): Promise<MiniSearch<SearchDocument>> {
  return indexCache.get(SEARCH_INDEX_KEY, () => loadAllSections().then(buildSearchIndex));
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
