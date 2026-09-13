// Pure Highway Code HTML parser: splits a section's body HTML into rules
// (or, for a section with no rules at all, keeps the whole sanitised body),
// sanitises every kept element against a fixed tag/attribute allowlist —
// dropping raw-text elements (script/style/noscript/template/iframe/
// object/embed) whole, escaping any '<' that could re-open a tag once this
// output is later parsed again, and allowing only http/https/mailto/tel
// (or scheme-less) hrefs and image srcs — and classifies a section's kind
// from its slug, trimmed title and rule ids.
// No network access — scripts/ingest-highway-code.ts (Step 9) supplies the
// HTML it fetched via scripts/lib/govuk.ts and writes this module's output
// to content/uk/highway-code/.
// Depends on: node-html-parser, ../../src/content/text.ts
// (normaliseWhitespace), ../../src/content/schemas/highwayCode.ts (the
// Section/Rule/RuleImage shapes this module must produce).
// Depended on by: scripts/ingest-highway-code.ts,
// tests/unit/highway-code-parse.test.ts (which also loads
// tests/fixtures/highway-code-section.html).

import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement, Node as HtmlNode, TextNode } from 'node-html-parser';
import { normaliseWhitespace } from '../../src/content/text';
import type { Rule, RuleImage, Section } from '../../src/content/schemas/highwayCode';

export interface SectionMeta {
  slug: string;
  title: string;
  basePath: string;
  sourceUrl: string;
  order: number;
}

export interface KindOfInput {
  slug: string;
  title: string;
  rules: Array<{ id: string }>;
}

const NUMERIC_ID = /^\d+$/;
const RULE_HEADING_ID = /^rule(\d{1,3}|H[1-3])$/i;
const RULE_HEADING_TEXT = /^Rule (\d{1,3}|H[1-3])\b/;
const ANNEX_TITLE = /^Annex \d+\./;
const SIGNALS_TITLE = /signals|signs|markings/i;
const HC_RULE_ANCHOR = /^\/guidance\/the-highway-code\/[a-z0-9-]+#rule(\d{1,3}|H[1-3])$/i;
const HC_SECTION_LINK = /^\/guidance\/the-highway-code\/([a-z0-9-]+)$/i;
const STRONG_CONTENT = /<strong>([\s\S]*?)<\/strong>/g;

const ALLOWED_TAGS = new Set([
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'a',
  'abbr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h4',
  'h5',
  'div',
  'span',
  'sup',
  'sub',
]);

/** Tags whose entire subtree — the wrapping tag AND its content — is
 * dropped, never unwrapped into "keep sanitised children" like an
 * ordinary unknown tag. `script`/`style`/`noscript` are raw-text elements
 * (see `parse(bodyHtml, { blockTextElements: … })` below): a browser never
 * treats a literal '<'/'>' inside them as a tag boundary while parsing the
 * original page, so their text can legally contain markup that would
 * become live once spliced into ordinary body HTML and re-parsed by
 * `dangerouslySetInnerHTML`. `template`/`iframe`/`object`/`embed` are
 * dropped for the same reason the plan's suggestions list them alongside
 * script/style/noscript (review-b.md B2 + suggestion 5): each can carry
 * content or attributes a plain "unwrap and keep the text" rule is not
 * safe for. */
const DROPPED_ENTIRELY_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
]);

/** Any '<' immediately followed by an ASCII letter, '/', '!' or '?' could
 * begin a tag, end tag, markup declaration or bogus comment if this text
 * were parsed as HTML again — exactly what `dangerouslySetInnerHTML` does
 * to this module's output. Escaping just that '<' neutralises it while
 * leaving every other byte — a bare '<' followed by a space or digit, an
 * existing entity, everything else — exactly as this module has always
 * emitted it (plan.md M4 refinement item 3: a scan of committed html text
 * found zero such sequences outside real tags, so this changes no
 * committed byte). */
const TAG_LIKE_LT = /<(?=[A-Za-z/!?])/g;

function escapeTagLikeLessThan(rawText: string): string {
  return rawText.replace(TAG_LIKE_LT, '&lt;');
}

const HREF_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Removes every ASCII control character and space (code point 32 or
 * below, plus 127, DEL) from `value`. Written as a code-point filter
 * rather than a regex escape range, so no unprintable byte sits in this
 * source file. */
function stripAsciiControlAndSpace(value: string): string {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x20 && code !== 0x7f) result += ch;
  }
  return result;
}

/** True when `value` is safe to emit as an href/src (plan.md M4
 * refinement item 4). Scheme-less values — relative paths, `#fragments`,
 * gov.uk authoring errors already present in committed content — always
 * pass unchanged, since only a URL *scheme* can execute script. Otherwise,
 * with ASCII control characters and spaces stripped from a COPY of the
 * value, the scheme must be one this app ever links to.
 * node-html-parser's `getAttribute` already entity-decodes the value
 * (`&#x6A;avascript:` arrives here as `javascript:`), so this needs no
 * decoding of its own to catch that trick, only the control/whitespace
 * strip for cases like a tab inside `java` + TAB + `script:`. */
function safeHref(value: string): boolean {
  const stripped = stripAsciiControlAndSpace(value);
  const scheme = HREF_SCHEME.exec(stripped);
  if (!scheme) return true;
  return ALLOWED_HREF_SCHEMES.has(scheme[0].toLowerCase());
}

/**
 * Classifies a section's kind. Precedence (checked in this fixed order):
 * `introduction` if the slug is exactly "introduction"; `rules` if the
 * section has at least one numeric rule id; `annex` if the trimmed title
 * matches "Annex N."; `signals` if the trimmed title mentions signals,
 * signs or markings; else `other`. Deliberately does not look at slug
 * ranges: gov.uk section slugs and titles do not reliably match the rule
 * numbers they hold (plan.md amendment P3), so `rules` is decided from the
 * parsed rule ids, never from the slug or title text.
 */
export function kindOf({ slug, title, rules }: KindOfInput): Section['kind'] {
  if (slug === 'introduction') return 'introduction';
  if (rules.some((rule) => NUMERIC_ID.test(rule.id))) return 'rules';
  const trimmedTitle = normaliseWhitespace(title);
  if (ANNEX_TITLE.test(trimmedTitle)) return 'annex';
  if (SIGNALS_TITLE.test(trimmedTitle)) return 'signals';
  return 'other';
}

interface RuleHeadingInfo {
  id: string;
  number: number | null;
  title: string;
}

function normaliseRuleId(raw: string): string {
  return NUMERIC_ID.test(raw) ? raw : raw.toUpperCase();
}

/** An <h3> starts a rule when its id matches "ruleNNN"/"ruleHN", or — the
 * hierarchy rules H1-H3 have unverified markup, so id may be absent —
 * when its own text starts with "Rule NNN"/"Rule HN". */
function readRuleHeading(el: HTMLElement): RuleHeadingInfo | null {
  const id = el.getAttribute('id');
  const idMatch = id ? RULE_HEADING_ID.exec(id) : null;
  const title = normaliseWhitespace(el.text);
  const textMatch = idMatch ? null : RULE_HEADING_TEXT.exec(title);
  const match = idMatch ?? textMatch;
  if (!match) return null;
  const ruleId = normaliseRuleId(match[1]);
  const number = NUMERIC_ID.test(ruleId) ? Number.parseInt(ruleId, 10) : null;
  return { id: ruleId, number, title };
}

interface RuleBucket {
  heading: RuleHeadingInfo;
  nodes: HtmlNode[];
}

/** Walks the body's top-level children in order. Before the first rule
 * heading, every top-level node — the <h2> included — goes to the
 * preamble: a page's introductory prose is routinely <h2>-headed before
 * its first rule (e.g. the Introduction section's "Introduction",
 * "Wording of The Highway Code", etc.), and none of it must be dropped.
 * Once a rule has started, every following sibling belongs to it until the
 * next rule heading or any <h2>, whichever comes first (content after a
 * stray <h2> and before the next rule heading belongs to neither bucket,
 * matching the plan's boundary rule). */
function splitIntoBuckets(topLevel: HtmlNode[]): { preamble: HtmlNode[]; rules: RuleBucket[] } {
  const preamble: HtmlNode[] = [];
  const rules: RuleBucket[] = [];
  let current: HtmlNode[] | null = preamble;
  let ruleStarted = false;

  for (const node of topLevel) {
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.localName === 'h3') {
        const heading = readRuleHeading(el);
        if (heading) {
          const bucket: RuleBucket = { heading, nodes: [] };
          rules.push(bucket);
          current = bucket.nodes;
          ruleStarted = true;
          continue;
        }
      }
      if (el.localName === 'h2' && ruleStarted) {
        current = null;
        continue;
      }
    }
    current?.push(node);
  }

  return { preamble, rules };
}

function isWhitespaceNode(node: HtmlNode): boolean {
  return node.nodeType === NodeType.TEXT_NODE && (node as TextNode).isWhitespace;
}

/** True when every non-whitespace child of a <p> is an <img>: a diagram
 * paragraph (e.g. the stopping-distance chart image) that carries no lead
 * text of its own and must not be mistaken for the rule's opening
 * paragraph. */
function isImageOnlyParagraph(paragraph: HTMLElement): boolean {
  const meaningfulChildren = paragraph.childNodes.filter((child) => !isWhitespaceNode(child));
  if (meaningfulChildren.length === 0) return false;
  return meaningfulChildren.every(
    (child) =>
      child.nodeType === NodeType.ELEMENT_NODE && (child as HTMLElement).localName === 'img',
  );
}

/** The rule's lead is the text of a <strong> that opens the first <p> that
 * is not image-only (e.g. "Stopping distances."), skipping any earlier <p>
 * whose only non-whitespace children are <img> elements (a diagram
 * paragraph placed before the rule's real text) and ignoring any
 * purely-whitespace text node ahead of the <strong>. Anything else (no
 * such <p>, or its first real child is not a <strong>) means no lead. */
function findLead(nodes: HtmlNode[]): string | null {
  const leadParagraph = nodes.find(
    (node) =>
      node.nodeType === NodeType.ELEMENT_NODE &&
      (node as HTMLElement).localName === 'p' &&
      !isImageOnlyParagraph(node as HTMLElement),
  ) as HTMLElement | undefined;
  if (!leadParagraph) return null;

  const firstMeaningfulChild = leadParagraph.childNodes.find((child) => !isWhitespaceNode(child));
  if (!firstMeaningfulChild || firstMeaningfulChild.nodeType !== NodeType.ELEMENT_NODE) return null;

  const el = firstMeaningfulChild as HTMLElement;
  return el.localName === 'strong' ? normaliseWhitespace(el.text) : null;
}

interface SanitiseContext {
  crossRefs: Set<string>;
  images: RuleImage[];
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rewrites a Highway Code href per the plan's three rules, in order: a
 * link straight to another rule becomes an in-app rule link (and the rule
 * id is recorded as a cross-reference); a link to a Highway Code section
 * with no rule anchor becomes an in-app section link; any other relative
 * gov.uk path is made absolute. Anything already absolute (e.g. a
 * legislation.gov.uk citation) passes through unchanged here — it gets its
 * rel/target from the caller once it is known to be absolute. */
function rewriteHref(href: string, crossRefs: Set<string>): string {
  const ruleAnchor = HC_RULE_ANCHOR.exec(href);
  if (ruleAnchor) {
    const ruleId = normaliseRuleId(ruleAnchor[1]);
    crossRefs.add(ruleId);
    return `/code/rule/${ruleId}`;
  }
  const sectionLink = HC_SECTION_LINK.exec(href);
  if (sectionLink) {
    return `/learn/code/${sectionLink[1]}`;
  }
  return href.startsWith('/') ? `https://www.gov.uk${href}` : href;
}

/** Builds the sanitised attribute string for a kept `<a>`, or returns
 * `null` when the href's scheme is not one `safeHref` allows — the
 * caller then unwraps the anchor to its sanitised children instead of
 * emitting it (plan.md M4 refinement item 4). */
function sanitiseAnchorAttrs(el: HTMLElement, ctx: SanitiseContext): string | null {
  const href = el.getAttribute('href');
  const title = el.getAttribute('title');
  if (!href) return title ? ` title="${escapeAttribute(title)}"` : '';

  const rewritten = rewriteHref(href, ctx.crossRefs);
  if (!safeHref(rewritten)) return null;
  const isAbsolute = /^https?:\/\//i.test(rewritten);
  let attrs = ` href="${escapeAttribute(rewritten)}"`;
  if (isAbsolute) attrs += ` rel="external noopener" target="_blank"`;
  if (title) attrs += ` title="${escapeAttribute(title)}"`;
  return attrs;
}

function sanitiseDivAttrs(el: HTMLElement): string {
  const className = el.getAttribute('class') ?? '';
  return className.split(/\s+/).includes('call-to-action') ? ' class="call-to-action"' : '';
}

function sanitiseCellAttrs(el: HTMLElement): string {
  const colspan = el.getAttribute('colspan');
  const rowspan = el.getAttribute('rowspan');
  let attrs = '';
  if (colspan) attrs += ` colspan="${escapeAttribute(colspan)}"`;
  if (rowspan) attrs += ` rowspan="${escapeAttribute(rowspan)}"`;
  return attrs;
}

function sanitiseAttrsFor(tag: string, el: HTMLElement): string {
  switch (tag) {
    case 'abbr': {
      const title = el.getAttribute('title');
      return title ? ` title="${escapeAttribute(title)}"` : '';
    }
    case 'div':
      return sanitiseDivAttrs(el);
    case 'th':
    case 'td':
      return sanitiseCellAttrs(el);
    default:
      return '';
  }
}

/** An <img> is never kept: it is recorded in `images[]` and replaced with a
 * clearly-labelled link out, since Phase 1 ships no images offline. When
 * the source isn't `safeHref`-safe (plan.md M4 refinement item 4), the
 * image is still recorded — offline metadata is unaffected — but rendered
 * as plain, unlinked text instead of a clickable link. */
function imageReplacement(el: HTMLElement, ctx: SanitiseContext): string {
  const src = el.getAttribute('src') ?? '';
  const alt = (el.getAttribute('alt') ?? '').trim();
  ctx.images.push({ src, alt });
  const label = alt.length > 0 ? alt : 'view image';
  if (!safeHref(src)) return `Diagram (online): ${escapeText(label)}`;
  const href = escapeAttribute(src);
  return `<a class="hc-image" href="${href}" rel="external noopener" target="_blank">Diagram (online): ${escapeText(label)}</a>`;
}

function sanitiseNode(node: HtmlNode, ctx: SanitiseContext): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return escapeTagLikeLessThan((node as TextNode).rawText);
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.localName;

  if (DROPPED_ENTIRELY_TAGS.has(tag)) return '';
  if (tag === 'img') return imageReplacement(el, ctx);
  if (tag === 'br') return '<br />';

  const innerHtml = el.childNodes.map((child) => sanitiseNode(child, ctx)).join('');

  if (tag === 'a') {
    const attrs = sanitiseAnchorAttrs(el, ctx);
    // An unsafe href (plan.md M4 refinement item 4) unwraps the anchor to
    // its already-sanitised children, same shape as any other disallowed
    // wrapper below.
    return attrs === null ? innerHtml : `<a${attrs}>${innerHtml}</a>`;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    // Any other unknown wrapper tag gov.uk might introduce later: drop the
    // tag and every attribute, keep the already-sanitised inner content.
    // script/style/noscript/template/iframe/object/embed never reach this
    // branch — they are dropped whole, above.
    return innerHtml;
  }

  return `<${tag}${sanitiseAttrsFor(tag, el)}>${innerHtml}</${tag}>`;
}

function sanitiseNodes(nodes: HtmlNode[], ctx: SanitiseContext): string {
  return nodes.map((node) => sanitiseNode(node, ctx)).join('');
}

/** Counts `<strong>PHRASE</strong>` occurrences in already-sanitised HTML,
 * collapsing whitespace inside each <strong> before comparing so stray
 * newlines/indentation never hide a MUST or MUST NOT. */
function countStrongPhrase(html: string, phrase: string): number {
  let count = 0;
  for (const match of html.matchAll(STRONG_CONTENT)) {
    if (normaliseWhitespace(match[1]) === phrase) count += 1;
  }
  return count;
}

function buildRule(bucket: RuleBucket): Rule {
  const ctx: SanitiseContext = { crossRefs: new Set<string>(), images: [] };
  const html = sanitiseNodes(bucket.nodes, ctx);
  const mustNotCount = countStrongPhrase(html, 'MUST NOT');
  const mustCount = countStrongPhrase(html, 'MUST');

  return {
    id: bucket.heading.id,
    number: bucket.heading.number,
    title: bucket.heading.title,
    lead: findLead(bucket.nodes),
    html,
    law: mustCount + mustNotCount > 0,
    mustCount,
    mustNotCount,
    crossRefs: [...ctx.crossRefs],
    images: ctx.images,
  };
}

/**
 * Parses one Highway Code section page body into the shape SectionSchema
 * expects: rule boundaries at matching <h3> headings, everything before the
 * first rule as `preambleHtml`, and — for a section with no rules at all —
 * the whole sanitised body as `bodyHtml` instead (in which case
 * `preambleHtml` is empty and `rules` is empty).
 */
export function parseSection(bodyHtml: string, meta: SectionMeta): Section {
  // `pre` is deliberately left out of blockTextElements (unlike
  // node-html-parser's default, which raw-texts it alongside
  // script/style/noscript): its content is then parsed as ordinary nodes
  // and sanitised like everything else, instead of surviving as
  // unescaped raw text (plan.md M4 item 1).
  const root = parse(bodyHtml, {
    blockTextElements: { script: true, noscript: true, style: true },
  });
  const topLevel = root.childNodes;
  const { preamble, rules: ruleBuckets } = splitIntoBuckets(topLevel);

  const rules = ruleBuckets.map((bucket) => buildRule(bucket));
  const hasRules = rules.length > 0;

  const preambleHtml = hasRules
    ? sanitiseNodes(preamble, { crossRefs: new Set<string>(), images: [] })
    : '';
  const bodyHtmlOut = hasRules
    ? ''
    : sanitiseNodes(topLevel, { crossRefs: new Set<string>(), images: [] });

  const title = normaliseWhitespace(meta.title);

  return {
    slug: meta.slug,
    title,
    basePath: meta.basePath,
    sourceUrl: meta.sourceUrl,
    order: meta.order,
    kind: kindOf({ slug: meta.slug, title, rules }),
    preambleHtml,
    bodyHtml: bodyHtmlOut,
    rules,
  };
}
