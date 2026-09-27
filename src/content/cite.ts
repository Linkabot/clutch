// Citation ids: a small pure vocabulary for pointing at one quotable unit of
// ingested content — a Highway Code rule or section, a road sign, a National
// Standard element, or a GOV.UK guidance part (Phase 3 block 3a Step 8;
// amend-08 A35/A36). `parseCite` turns a cite string (e.g. `hc:207`,
// `sign:warning-school`) into a typed `Cite`, or null when it does not match
// exactly one of the five forms. `citeRoute`, `citeFrom` and `citeLinkLabel`
// turn a parsed `Cite` into, respectively, the router path that reads it,
// the "From the Highway Code, rule 207" style attribution line, and the
// short link label ("Read rule 207", "Sign page", "Read the source").
// Pure: no filesystem, no DOM, and no import from src/content/schemas/ (a
// schemas barrel -> theory.ts -> cite.ts import would otherwise cycle back
// through here, A36).
// Depends on: nothing.
// Depended on by: scripts/lib/theory-corpus.ts, src/content/schemas/theory.ts,
// tests/unit/cite.test.ts.

const HC_ID = /^(\d{1,3}|H[1-3])$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SIGN_ID = /^(warning|orders|motorway|direction|information|road-works)-[a-z0-9_-]+$/;
const ELEMENT_ID = /^\d\.\d\.\d+$/;

export type Cite =
  | { kind: 'hc'; id: string }
  | { kind: 'hc-section'; slug: string }
  | { kind: 'sign'; id: string }
  | { kind: 'ns'; id: string }
  | { kind: 'govuk'; slug: string; part: string };

export interface CiteTitles {
  hcSections: Record<string, string>;
  govukPages: Record<string, string>;
}

/**
 * Parses a cite string into one of the five forms, whole-string and
 * case-sensitive with no trimming, or returns null when it matches none of
 * them: `hc:<ruleId>`, `hc-section:<slug>`, `sign:<signId>`, `ns:<elementId>`
 * (`/^\d\.\d\.\d+$/`), `govuk:<slug>/<part>` (exactly one `/`).
 */
export function parseCite(id: string): Cite | null {
  if (id.startsWith('hc-section:')) {
    const slug = id.slice('hc-section:'.length);
    return SLUG.test(slug) ? { kind: 'hc-section', slug } : null;
  }
  if (id.startsWith('hc:')) {
    const ruleId = id.slice('hc:'.length);
    return HC_ID.test(ruleId) ? { kind: 'hc', id: ruleId } : null;
  }
  if (id.startsWith('sign:')) {
    const signId = id.slice('sign:'.length);
    return SIGN_ID.test(signId) ? { kind: 'sign', id: signId } : null;
  }
  if (id.startsWith('ns:')) {
    const elementId = id.slice('ns:'.length);
    return ELEMENT_ID.test(elementId) ? { kind: 'ns', id: elementId } : null;
  }
  if (id.startsWith('govuk:')) {
    const rest = id.slice('govuk:'.length);
    const segments = rest.split('/');
    if (segments.length !== 2) return null;
    const [slug, part] = segments;
    return SLUG.test(slug) && SLUG.test(part) ? { kind: 'govuk', slug, part } : null;
  }
  return null;
}

/** The router path (no base path) that reads a parsed cite. */
export function citeRoute(cite: Cite): string {
  switch (cite.kind) {
    case 'hc':
      return `/code/rule/${cite.id}`;
    case 'hc-section':
      return `/learn/code/${cite.slug}`;
    case 'sign':
      return `/learn/signs/${cite.id}`;
    case 'ns':
      return `/source/ns/${cite.id}`;
    case 'govuk':
      return `/source/govuk/${cite.slug}#${cite.part}`;
  }
}

/**
 * The "From …" attribution line. `titles` (built by the caller from
 * `content/uk/highway-code/index.json` and `content/uk/govuk/index.json`,
 * keyed by slug) supplies a section or page title; a slug missing from
 * `titles` falls back to "From the Highway Code" / "From GOV.UK".
 */
export function citeFrom(cite: Cite, titles: CiteTitles): string {
  switch (cite.kind) {
    case 'hc':
      return `From the Highway Code, rule ${cite.id}`;
    case 'hc-section': {
      const title = titles.hcSections[cite.slug];
      return title ? `From the Highway Code, ${title}` : 'From the Highway Code';
    }
    case 'sign':
      return 'From Know Your Traffic Signs';
    case 'ns':
      return `From the National Standard, element ${cite.id}`;
    case 'govuk': {
      const title = titles.govukPages[cite.slug];
      return title ? `From GOV.UK, ${title}` : 'From GOV.UK';
    }
  }
}

/** The short link label: "Read rule N" for hc, "Sign page" for sign, "Read the source" otherwise. */
export function citeLinkLabel(cite: Cite): string {
  switch (cite.kind) {
    case 'hc':
      return `Read rule ${cite.id}`;
    case 'sign':
      return 'Sign page';
    default:
      return 'Read the source';
  }
}
