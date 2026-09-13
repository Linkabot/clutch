// Pure National Standard HTML parser: splits a role page's body HTML into
// units (<h2>, heading text "Unit N.N: Title") and, within each unit, into
// elements (<h3>, heading text "Element N.N.N: Title"). Each element's body
// holds exactly two <h4> headings — "Performance standards" and "Knowledge
// and understanding requirements" — each followed by a lead-in <p> ("You
// must be able to:" / "You must know and understand:") and then the <ul>
// whose direct <li> children become mustBeAbleTo[] / mustKnow[] as plain
// text (nested sub-lists inside an <li> are flattened into that item's
// text, since SyllabusElementSchema wants flat string arrays). Markup
// verified against all 5 live role pages before this module was written —
// see handoffs/phase-1-highway-code/step-10.md for the discovery notes.
// No network access — scripts/ingest-national-standard.ts (Step 10) supplies
// the HTML it fetched via scripts/lib/govuk.ts and writes this module's
// output to content/uk/syllabus.json.
// Depends on: node-html-parser, ../../src/content/text.ts (htmlToText,
// normaliseWhitespace), ../../src/content/schemas/syllabus.ts (the
// Role/Unit/Element shapes this module must produce).
// Depended on by: scripts/ingest-national-standard.ts,
// tests/unit/national-standard-parse.test.ts (which also loads
// tests/fixtures/national-standard-role.html).

import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement, Node as HtmlNode } from 'node-html-parser';
import { htmlToText, normaliseWhitespace } from '../../src/content/text';
import type {
  SyllabusElement,
  SyllabusRole,
  SyllabusUnit,
} from '../../src/content/schemas/syllabus';

export interface RolePageMeta {
  /** The child page's title as given by the Content API, e.g.
   * "Role 1: Prepare yourself, the vehicle, and its passengers for a journey". */
  title: string;
}

/** Matches the heading shape used at all three levels: "Role 1: Title",
 * "Unit 1.1: Title", "Element 1.1.1: Title". The colon is optional: two of
 * the 31 live element headings (1.3.1 "Plan a journey", 5.1.1 "Learn from
 * experience" — the single-element units whose element title repeats the
 * unit title) are published without it, e.g. "Element 1.3.1 Plan a
 * journey" (verified against the cached pages; recorded in step-10.md). */
const HEADING_PATTERN = /^(?:Role|Unit|Element)\s+(\d+(?:\.\d+){0,2}):?\s*(.+)$/;

const PERFORMANCE_HEADING = /^Performance standards$/i;
const KNOWLEDGE_HEADING = /^Knowledge and understanding requirements$/i;

function isElement(node: HtmlNode): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function headingText(el: HTMLElement): string {
  return normaliseWhitespace(el.text);
}

/** Splits "Role 1: Title" / "Unit 1.1: Title" / "Element 1.1.1: Title" into
 * its id and title. Throws rather than guessing when a heading does not
 * match — the discovery pass confirmed all 5 role pages use this shape for
 * every unit and element, so a mismatch means the real markup has moved. */
function splitHeading(text: string): { id: string; title: string } {
  const match = HEADING_PATTERN.exec(normaliseWhitespace(text));
  if (!match) {
    throw new Error(`heading text does not match "Role|Unit|Element N[.N[.N]]: Title": "${text}"`);
  }
  return { id: match[1], title: match[2] };
}

/** Groups a flat list of sibling nodes into buckets keyed by each element
 * whose tag name is `tag` (e.g. "H2" or "H3"): the heading itself, plus
 * every following node up to (not including) the next heading of the same
 * tag. Nodes before the first such heading are dropped — at both levels
 * here that's unit/element front matter (an anchor-link list of what
 * follows, e.g. "There are 3 elements in this unit:") that carries nothing
 * SyllabusUnitSchema / SyllabusElementSchema needs. */
function bucketsByHeading(
  nodes: HtmlNode[],
  tag: string,
): Array<{ heading: HTMLElement; nodes: HtmlNode[] }> {
  const buckets: Array<{ heading: HTMLElement; nodes: HtmlNode[] }> = [];
  let current: HtmlNode[] | null = null;
  for (const node of nodes) {
    if (isElement(node) && node.tagName === tag) {
      buckets.push({ heading: node, nodes: [] });
      current = buckets[buckets.length - 1]!.nodes;
      continue;
    }
    current?.push(node);
  }
  return buckets;
}

/** Finds the <h4> in `nodes` whose text matches `headingPattern`, then the
 * first <ul>/<ol> after it (skipping the lead-in <p> such as "You must be
 * able to:"), and returns its direct <li> children as plain text — each
 * <li>'s inner HTML (nested sub-lists included) run through htmlToText, so
 * a sub-list collapses into its parent item's text rather than becoming
 * separate items. Throws if the heading or its list is missing, matching
 * this module's policy of failing loudly on an unexpected shape rather than
 * silently returning an empty list. */
function listItemsAfterHeading(nodes: HtmlNode[], headingPattern: RegExp): string[] {
  const headingIndex = nodes.findIndex(
    (node) => isElement(node) && node.tagName === 'H4' && headingPattern.test(headingText(node)),
  );
  if (headingIndex === -1) {
    throw new Error(`no <h4> heading matching ${headingPattern} found`);
  }
  for (let i = headingIndex + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!isElement(node)) continue;
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      return node.childNodes
        .filter(isElement)
        .filter((child) => child.tagName === 'LI')
        .map((li) => htmlToText(li.innerHTML));
    }
    if (node.tagName === 'H2' || node.tagName === 'H3' || node.tagName === 'H4') break;
  }
  throw new Error(`no list found after <h4> heading matching ${headingPattern}`);
}

function buildElement(bucket: { heading: HTMLElement; nodes: HtmlNode[] }): SyllabusElement {
  const { id, title } = splitHeading(headingText(bucket.heading));
  return {
    id,
    title,
    mustBeAbleTo: listItemsAfterHeading(bucket.nodes, PERFORMANCE_HEADING),
    mustKnow: listItemsAfterHeading(bucket.nodes, KNOWLEDGE_HEADING),
  };
}

function buildUnit(bucket: { heading: HTMLElement; nodes: HtmlNode[] }): SyllabusUnit {
  const { id, title } = splitHeading(headingText(bucket.heading));
  const elements = bucketsByHeading(bucket.nodes, 'H3').map(buildElement);
  return { id, title, elements };
}

/**
 * Parses one National Standard role page's body HTML into the shape
 * SyllabusRoleSchema expects: unit boundaries at <h2> headings, element
 * boundaries at <h3> headings within each unit, and each element's two
 * requirement lists read from the <ul> following its "Performance
 * standards" / "Knowledge and understanding requirements" <h4>.
 */
export function parseRolePage(bodyHtml: string, meta: RolePageMeta): SyllabusRole {
  const { id, title } = splitHeading(meta.title);
  const root = parse(bodyHtml);
  const units = bucketsByHeading(root.childNodes, 'H2').map(buildUnit);
  return { id, title, units };
}
