// Counts malformed hrefs anywhere in a Highway Code index or section value:
// walks every string reachable from `value` (through arrays and plain
// objects) and, inside each string, counts every `href="…"` attribute whose
// value starts with "www." (missing a scheme), starts with "guidance/"
// (missing its leading slash), or contains the zero-width space U+200B or
// its percent-encoded form "%E2%80%8B" — all found in the committed
// Highway Code corpus — or the malformed rule anchor "#rule%20" (plan.md
// amendment P2). This module only detects those patterns; repairing them is
// `rewriteHref`'s `repairHrefs` flag in scripts/lib/highway-code-parse.ts
// (plan.md D13 S12). scripts/compare-highway-code.ts calls this on a
// build's index and sections to print the build's `malformed=<n>` count.
// Depends on: nothing (plain JS/TS only).
// Depended on by: scripts/compare-highway-code.ts, tests/content/highway-code.test.ts,
// tests/unit/href-audit.test.ts.

const HREF_ATTR = /href="([^"]*)"/g;
const ZERO_WIDTH_SPACE = '\u200B';
const ZERO_WIDTH_SPACE_ENCODED = '%E2%80%8B';

function hrefIsMalformed(href: string): boolean {
  return (
    href.startsWith('www.') ||
    href.startsWith('guidance/') ||
    href.includes(ZERO_WIDTH_SPACE_ENCODED) ||
    href.includes(ZERO_WIDTH_SPACE) ||
    href.includes('#rule%20')
  );
}

function countMalformedHrefsInText(text: string): number {
  let count = 0;
  for (const match of text.matchAll(HREF_ATTR)) {
    if (hrefIsMalformed(match[1])) count += 1;
  }
  return count;
}

/**
 * Recursively walks `value` (a parsed Highway Code `Section`,
 * `HighwayCodeIndex`, or any array/object built from them, or a bare
 * string) and returns the number of malformed `href="…"` attributes found
 * inside every string it reaches. Non-string, non-array, non-object leaves
 * (numbers, booleans, null) contribute nothing.
 */
export function countMalformedHrefs(value: unknown): number {
  if (typeof value === 'string') return countMalformedHrefsInText(value);
  if (Array.isArray(value)) {
    return value.reduce((sum: number, item) => sum + countMalformedHrefs(item), 0);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).reduce((sum: number, item) => sum + countMalformedHrefs(item), 0);
  }
  return 0;
}
