// Whitespace-only normalisation for a section.interlude's sanitised html
// before it is handed to HcHtml (plan.md Step 8 amendment E4): the parser's
// output separates a bare heading line from a following <p>/<ul>/<ol>/<li>/
// <table> block with a blank line (and a trailing blank line at the run's
// end), which — combined with .hc-interlude's `white-space: pre-line`
// (src/features/code/hc-html.css) — rendered as visible empty lines inside
// the interlude band. interludeHtml collapses every whitespace run that
// contains a line break to a single "\n", then removes a "\n" that sits
// immediately before an opening block tag or immediately after a closing
// block tag or <br>, so only whitespace changes — never the html's tags or
// text content.
// Depends on: nothing (pure string function).
// Depended on by: src/features/code/SectionScreen.tsx,
// src/features/code/RuleScreen.tsx, tests/unit/interlude.test.ts.

const OPENING_BLOCK_TAG = /\n(?=<(?:p|ul|ol|li|table)\b)/g;
const CLOSING_BLOCK_TAG_OR_BREAK = /(<\/(?:p|ul|ol|li|table)>|<br\s*\/?>)\n/g;

export function interludeHtml(html: string): string {
  const collapsed = html.trim().replace(/\s*\n\s*/g, '\n');
  return collapsed.replace(OPENING_BLOCK_TAG, '').replace(CLOSING_BLOCK_TAG_OR_BREAK, '$1');
}
