// Pure parser for the 15 GOV.UK guidance/transaction pages Step 5 ingests:
// `BASE_PATHS` names them; `parsePage` turns one gov.uk Content API response
// into `{ title, parts }`, resolving exactly three shapes (plan.md Step 5,
// amend-05 A25/A27): `details.parts[]` (a guide page — its own part slugs
// and titles are kept); `details.body` split at each top-level `<h2>`, the
// text before the first `<h2>` becoming part `introduction` — and, when the
// body's only top-level element is a single `<div class="govspeak">`, that
// div's children are split instead, because that wrapper otherwise hides
// every `<h2>` from a top-level split (A25; the live
// `/guidance/tow-a-trailer-with-a-car-safety-checks` page); or
// `schema_name === 'transaction'`, giving parts `introduction` (from
// `details.introductory_paragraph`) and `other-ways-to-apply` (from
// `details.other_ways_to_apply`, only when non-empty) (A27 (b); the live
// `/vehicle-tax` page has neither `parts` nor `body`). Any other shape
// throws, naming the base path. Every part's HTML is sanitised through
// `sanitiseHtml` (the Highway Code sanitiser, imported rather than copied).
// Page, part and index titles are whitespace-normalised with
// `normaliseWhitespace` (A26: the live `/legal-obligations-drivers-riders`
// title ends in a space).
// `licenceLine` reads a rendered page's visible text and returns the exact
// "All content is available under the Open Government Licence v3.0…"
// sentence gov.uk's footer prints, throwing when that sentence or a
// "© Crown copyright" line is missing.
// `buildGovukPage`/`buildGovukIndex` assemble the committed JSON shapes
// (GovukPageSchema/GovukIndexSchema) from `parsePage`/`licenceLine`, shared
// by scripts/ingest-govuk-pages.ts and scripts/verify-govuk-pages.ts so the
// two can never drift apart on how a page is built.
// Depends on: node-html-parser, ../../src/content/text.ts (htmlToText,
// normaliseWhitespace), ./highway-code-parse (sanitiseHtml),
// ../../src/content/schemas/govuk.ts (GovukPage/GovukIndex types).
// Depended on by: scripts/ingest-govuk-pages.ts, scripts/verify-govuk-pages.ts,
// tests/unit/govuk-pages-parse.test.ts.

import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement, Node as HtmlNode } from 'node-html-parser';
import { htmlToText, normaliseWhitespace } from '../../src/content/text';
import { sanitiseHtml } from './highway-code-parse';
import type { GovukIndex, GovukPage, GovukPart } from '../../src/content/schemas/govuk';

/** The 15 base paths Step 5 ingests (scout-a § 2 rows #5–#19), slug = the
 * last path segment. Fixed order: this order is what `content/uk/govuk/index.json`
 * and every `<slug> licence: …` print line follow. */
export const BASE_PATHS: readonly string[] = [
  '/theory-test',
  '/driving-eyesight-rules',
  '/seat-belts-law',
  '/using-mobile-phones-when-driving-the-law',
  '/drink-drive-limit',
  '/speed-limits',
  '/penalty-points-endorsements',
  '/vehicle-insurance',
  '/getting-an-mot',
  '/vehicle-tax',
  '/towing-with-car',
  '/guidance/tow-a-trailer-with-a-car-safety-checks',
  '/health-conditions-and-driving',
  '/driving-lessons-learning-to-drive',
  '/legal-obligations-drivers-riders',
];

export function slugOf(basePath: string): string {
  const slug = basePath.split('/').pop();
  if (!slug) throw new Error(`govuk-pages: base path has no slug: ${basePath}`);
  return slug;
}

interface GovukApiPart {
  slug: string;
  title: string;
  body?: string;
}

interface GovukApiResponse {
  title: string;
  schema_name?: string;
  public_updated_at?: string;
  details?: {
    parts?: GovukApiPart[];
    body?: string;
    introductory_paragraph?: string;
    other_ways_to_apply?: string;
  };
}

export interface ParsedPage {
  title: string;
  parts: GovukPart[];
}

function isElement(node: HtmlNode): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function joinHtml(nodes: HtmlNode[]): string {
  return nodes.map((node) => node.toString()).join('');
}

function slugify(text: string): string {
  return normaliseWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface RawSegment {
  slug: string;
  title: string;
  nodes: HtmlNode[];
}

/** Splits `topLevel` at each top-level `<h2>`: everything before the first
 * one becomes the `introduction` segment (its title stays "Introduction"),
 * and every following `<h2>` starts a new segment named after its own
 * heading text. */
function splitAtH2(topLevel: HtmlNode[]): RawSegment[] {
  const segments: RawSegment[] = [];
  let current: HtmlNode[] = [];
  let currentTitle = 'Introduction';

  const flush = (): void => {
    const slug = segments.length === 0 ? 'introduction' : slugify(currentTitle);
    segments.push({ slug, title: currentTitle, nodes: current });
  };

  for (const node of topLevel) {
    if (isElement(node) && node.localName === 'h2') {
      flush();
      current = [];
      currentTitle = normaliseWhitespace(node.text);
      continue;
    }
    current.push(node);
  }
  flush();

  return segments;
}

function toParsedParts(segments: RawSegment[]): GovukPart[] {
  return segments.map((segment) => ({
    slug: segment.slug,
    title: segment.title,
    html: sanitiseHtml(joinHtml(segment.nodes)),
  }));
}

/** Splits a `details.body` page into parts (plan.md Step 5, A25): when the
 * body's only top-level element is a single `<div class="govspeak">`, its
 * children are split instead of the body's own top level, so the `<h2>`s
 * that wrapper otherwise hides are found. */
function splitBodyIntoParts(bodyHtml: string): GovukPart[] {
  const root = parse(bodyHtml);
  let topLevel: HtmlNode[] = root.childNodes;
  const elementChildren = topLevel.filter(isElement);
  if (elementChildren.length === 1) {
    const only = elementChildren[0];
    const classes = (only.getAttribute('class') ?? '').split(/\s+/);
    if (only.localName === 'div' && classes.includes('govspeak')) {
      topLevel = only.childNodes;
    }
  }
  return toParsedParts(splitAtH2(topLevel));
}

/**
 * Resolves one of the three page shapes Step 5's 15 base paths use, in this
 * fixed order: `details.parts[]`, `details.body`, then
 * `schema_name === 'transaction'`. Throws, naming `basePath`, for anything
 * else.
 */
export function parsePage(basePath: string, api: unknown): ParsedPage {
  const page = api as GovukApiResponse;
  const title = normaliseWhitespace(page.title);
  const details = page.details ?? {};

  if (Array.isArray(details.parts) && details.parts.length > 0) {
    return {
      title,
      parts: details.parts.map((part) => ({
        slug: part.slug,
        title: normaliseWhitespace(part.title),
        html: sanitiseHtml(part.body ?? ''),
      })),
    };
  }

  if (typeof details.body === 'string') {
    return { title, parts: splitBodyIntoParts(details.body) };
  }

  if (page.schema_name === 'transaction') {
    const intro = details.introductory_paragraph;
    if (typeof intro !== 'string' || intro.trim() === '') {
      throw new Error(`govuk-pages: unknown page shape for ${basePath}`);
    }
    const parts: GovukPart[] = [{ slug: 'introduction', title, html: sanitiseHtml(intro) }];
    const otherWaysToApply = details.other_ways_to_apply;
    if (typeof otherWaysToApply === 'string' && otherWaysToApply.trim() !== '') {
      parts.push({
        slug: 'other-ways-to-apply',
        title: 'Other ways to apply',
        html: sanitiseHtml(otherWaysToApply),
      });
    }
    return { title, parts };
  }

  throw new Error(`govuk-pages: unknown page shape for ${basePath}`);
}

const OGL_SENTENCE_START = 'All content is available under the Open Government Licence v3.0';
const OGL_SENTENCE_SUFFIX = 'except where otherwise stated';
const CROWN_COPYRIGHT = '© Crown copyright';

/**
 * Reads a rendered gov.uk page's visible text and returns the exact "All
 * content is available under the Open Government Licence v3.0…" sentence
 * its footer prints, throwing when that sentence or a "© Crown copyright"
 * line is missing. Matches the sentence by its known start and end phrases
 * rather than by the next full stop, since "v3.0" itself contains one.
 * gov.uk wraps "Open Government Licence v3.0" in a link, so `htmlToText`'s
 * tag-to-space replacement leaves a stray space before the following comma
 * (" , except…"); that one space-before-punctuation is closed up so the
 * printed and stored sentence reads as gov.uk's own text does.
 */
export function licenceLine(renderedHtml: string): string {
  const text = htmlToText(renderedHtml).replace(/&copy;/gi, '©');

  if (!text.includes(CROWN_COPYRIGHT)) {
    throw new Error('govuk-pages: rendered page is missing the Crown copyright line');
  }

  const start = text.indexOf(OGL_SENTENCE_START);
  if (start === -1) {
    throw new Error('govuk-pages: rendered page is missing the Open Government Licence sentence');
  }
  const suffixIndex = text.indexOf(OGL_SENTENCE_SUFFIX, start);
  if (suffixIndex === -1) {
    throw new Error('govuk-pages: rendered page is missing the Open Government Licence sentence');
  }
  let end = suffixIndex + OGL_SENTENCE_SUFFIX.length;
  if (text[end] === '.') end += 1;

  return text.slice(start, end).replace(/\s+([,.:;!?])/g, '$1');
}

/** Builds the committed `GovukPage` shape for one base path, from its
 * Content API response, its rendered page HTML and a `fetchedAt` value the
 * caller supplies (a fresh timestamp when ingesting, or the committed one
 * when verifying — see scripts/verify-govuk-pages.ts). Shared so ingest and
 * verify can never build a page two different ways. */
export function buildGovukPage(
  basePath: string,
  api: unknown,
  renderedHtml: string,
  fetchedAt: string,
): GovukPage {
  const { title, parts } = parsePage(basePath, api);
  const page = api as GovukApiResponse;
  return {
    slug: slugOf(basePath),
    title,
    url: `https://www.gov.uk${basePath}`,
    basePath,
    publicUpdatedAt: page.public_updated_at ?? null,
    fetchedAt,
    licenceLine: licenceLine(renderedHtml),
    parts,
  };
}

const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const OGL_STATEMENT =
  'Contains public sector information licensed under the Open Government Licence v3.0.';

/** Builds `content/uk/govuk/index.json`'s shape: the shared OGL licence
 * block plus one `{ slug, title, url }` entry per page, in `pages`' own
 * order. */
export function buildGovukIndex(pages: GovukPage[]): GovukIndex {
  return {
    licence: {
      name: 'Open Government Licence v3.0',
      url: OGL_URL,
      statement: OGL_STATEMENT,
    },
    pages: pages.map((page) => ({ slug: page.slug, title: page.title, url: page.url })),
  };
}
