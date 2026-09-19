// Pure helpers for a Highway Code section's bare sub-heading lines: the
// sanitiser leaves every sub-heading as a trimmed, non-empty line of a
// section's preambleHtml or an interlude's html that does not start with a
// tag ("<") — prose stays inside a <p>/<ul>/<li> line. interludeHtml
// (plan.md Step 8 amendment E4) normalises the whitespace around such a run
// before it is handed to HcHtml: the parser's output separates a bare
// heading line from a following <p>/<ul>/<ol>/<li>/<table> block with a
// blank line (and a trailing blank line at the run's end), which —
// combined with .hc-interlude's `white-space: pre-line`
// (src/features/code/hc-html.css) — rendered as visible empty lines inside
// the interlude band. interludeHtml collapses every whitespace run that
// contains a line break to a single "\n", then removes a "\n" that sits
// immediately before an opening block tag or immediately after a closing
// block tag or <br>, so only whitespace changes — never the html's tags or
// text content. lastHeadingLine (amendment E6) reads a chunk's last bare
// line as a plausible sub-heading (1–80 characters); ruleContextHeading
// (E6, PS26) finds the sub-heading a given rule sits under, for
// RuleScreen.tsx's "Rule {id} · {heading}" context line; preambleBlocks
// (E6, replacing item 6/P4) splits a rule section's whole preamble into
// ordered body/heading blocks, so SectionScreen.tsx can render every bare
// heading line inside it as its own .hc-interlude band, not just its last
// line.
// Depends on: ../../content/schemas (Section type), ../../content/text
// (htmlToText).
// Depended on by: src/features/code/SectionScreen.tsx (preambleBlocks),
// src/features/code/RuleScreen.tsx (ruleContextHeading), tests/unit/interlude.test.ts
// (interludeHtml), tests/unit/code-text.test.ts (lastHeadingLine,
// ruleContextHeading, preambleBlocks).
import type { Section } from '../../content/schemas';
import { htmlToText } from '../../content/text';

const OPENING_BLOCK_TAG = /\n(?=<(?:p|ul|ol|li|table)\b)/g;
const CLOSING_BLOCK_TAG_OR_BREAK = /(<\/(?:p|ul|ol|li|table)>|<br\s*\/?>)\n/g;

export function interludeHtml(html: string): string {
  const collapsed = html.trim().replace(/\s*\n\s*/g, '\n');
  return collapsed.replace(OPENING_BLOCK_TAG, '').replace(CLOSING_BLOCK_TAG_OR_BREAK, '$1');
}

const MAX_HEADING_LENGTH = 80;

/** Splits `html` into trimmed, non-empty lines that do not start with a tag —
 * how the sanitiser leaves every Highway Code sub-heading. */
function bareLines(html: string): string[] {
  return html
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('<'));
}

/**
 * The last bare line of a chunk of Highway Code html, converted to plain
 * text, when it reads as a plausible sub-heading (1 to 80 characters);
 * `undefined` when there is no bare line, or its last one is too long.
 */
export function lastHeadingLine(html: string): string | undefined {
  const lines = bareLines(html);
  const last = lines[lines.length - 1];
  if (last === undefined) return undefined;
  const text = htmlToText(last);
  return text.length >= 1 && text.length <= MAX_HEADING_LENGTH ? text : undefined;
}

/**
 * The sub-heading a rule sits under (PS26: "for every rule there should be
 * a title ... saying the rule sign number and the name of it"): among the
 * section's interludes whose beforeRuleId is not null and sits at a rule
 * index at or before the rule's own index (section.rules order), the
 * nearest one's last bare line (on a tie, the last in array order); when
 * there is none — the rule comes before the section's first interlude —
 * the section's own preamble's last bare line instead.
 */
export function ruleContextHeading(section: Section, ruleId: string): string | undefined {
  const ruleIndex = section.rules.findIndex((rule) => rule.id === ruleId);
  if (ruleIndex === -1) return undefined;

  let nearest: { index: number; html: string } | undefined;
  for (const interlude of section.interludes) {
    if (interlude.beforeRuleId === null) continue;
    const beforeIndex = section.rules.findIndex((rule) => rule.id === interlude.beforeRuleId);
    if (beforeIndex === -1 || beforeIndex > ruleIndex) continue;
    if (!nearest || beforeIndex >= nearest.index) {
      nearest = { index: beforeIndex, html: interlude.html };
    }
  }

  return nearest ? lastHeadingLine(nearest.html) : lastHeadingLine(section.preambleHtml);
}

export interface PreambleBlock {
  kind: 'body' | 'heading';
  html: string;
}

/**
 * Splits a rule section's preamble html into ordered blocks (E6c): a bare
 * line that reads as a plausible sub-heading (1–80 characters) becomes its
 * own `heading` block — SectionScreen.tsx renders it inside a
 * .hc-interlude band, exactly like the section's other interludes — and
 * every other line joins the `body` block directly before it (or starts a
 * new one). A first bare line that repeats the section's own `title` (the
 * sanitiser leaves the page's own heading as a bare line too, e.g. the
 * Introduction's own "Introduction" line) is dropped rather than becoming
 * either kind of block.
 */
export function preambleBlocks(html: string, title: string): PreambleBlock[] {
  const lines = html
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let start = 0;
  if (
    lines.length > 0 &&
    !lines[0].startsWith('<') &&
    htmlToText(lines[0]).toLowerCase() === title.trim().toLowerCase()
  ) {
    start = 1;
  }

  const blocks: PreambleBlock[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('<')) {
      const text = htmlToText(line);
      if (text.length >= 1 && text.length <= MAX_HEADING_LENGTH) {
        blocks.push({ kind: 'heading', html: line });
        continue;
      }
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === 'body') {
      last.html = `${last.html}\n${line}`;
    } else {
      blocks.push({ kind: 'body', html: line });
    }
  }
  return blocks;
}
