// Pure string helpers for turning Highway Code HTML into plain text and for
// normalising whitespace in quoted text. No DOM APIs, so this one module
// runs unchanged in the browser (src/features/code/search.ts, Step 14) and
// in Node ingestion scripts (scripts/lib/highway-code-parse.ts) alike.
// Depends on: nothing.
// Depended on by: scripts/lib/highway-code-parse.ts, src/features/code/search.ts
// (Step 14), tests/content/facts.test.ts (Step 11), tests/unit/text.test.ts.

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

const NAMED_ENTITY = /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g;
const TAG = /<[^>]*>/g;

/** Collapses every run of whitespace to a single space and trims the ends. */
export function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeCommonEntities(value: string): string {
  return value.replace(NAMED_ENTITY, (match) => NAMED_ENTITIES[match] ?? match);
}

/**
 * Strips HTML tags, decodes the common entities (&amp; &lt; &gt; &quot;
 * &#39; &nbsp;), and collapses whitespace. Good enough for search indexing
 * and quote verification against ingested Highway Code HTML; it is not a
 * general-purpose HTML-to-text converter (block boundaries just become a
 * space, not a paragraph break).
 */
export function htmlToText(html: string): string {
  const withoutTags = html.replace(TAG, ' ');
  const decoded = decodeCommonEntities(withoutTags);
  return normaliseWhitespace(decoded);
}
