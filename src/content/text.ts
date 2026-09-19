// Pure string helpers for turning Highway Code HTML into plain text, for
// normalising whitespace in quoted text, and for cutting a summary line to
// length at a word boundary (truncateAtWord, PS25/M08). No DOM APIs, so
// this one module runs unchanged in the browser (src/features/code/search.ts,
// Step 14) and in Node ingestion scripts (scripts/lib/highway-code-parse.ts)
// alike.
// Depends on: nothing.
// Depended on by: scripts/lib/highway-code-parse.ts, scripts/lib/kyts-licence.ts,
// scripts/lib/kyts-parse.ts, scripts/lib/national-standard-parse.ts,
// scripts/ingest-signs.ts, scripts/verify-signs.ts, src/features/code/search.ts,
// src/features/code/RuleScreen.tsx, src/features/code/SectionScreen.tsx,
// src/features/code/rule-heading.ts, src/features/code/interlude.ts
// (htmlToText), tests/content/facts.test.ts, tests/unit/text.test.ts,
// tests/unit/code-text.test.ts (truncateAtWord).

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

// Trailing whitespace and this punctuation are stripped from a cut before
// the ellipsis is appended (e.g. a cut landing right after a comma drops
// the comma along with the space that followed it), as are an opening
// bracket or quote left dangling (a cut inside "(see ‘Signals …’)") and
// the ↗ arrow of a diagram link (amendment E7).
const TRAILING_WHITESPACE_OR_PUNCTUATION = /[\s,;:–—(‘“[↗-]+$/;

/**
 * Cuts `text` to at most `max` characters, breaking at the last word
 * boundary rather than mid-word, and appends an ellipsis (U+2026, "…") when
 * a cut was made. Text of `max` characters or fewer is returned unchanged.
 * When the first `max` characters hold no space to break at, the cut is
 * hard, at `max - 1` characters, so the result (with its ellipsis) never
 * exceeds `max` characters either way.
 */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const lastSpace = window.lastIndexOf(' ');
  const cut = lastSpace === -1 ? text.slice(0, max - 1) : text.slice(0, lastSpace);
  return `${cut.replace(TRAILING_WHITESPACE_OR_PUNCTUATION, '')}…`;
}
