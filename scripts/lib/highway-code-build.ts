// Builds the Highway Code index and sections purely in memory from the
// gov.uk Content API (live, or replayed from `cacheDir` — see
// scripts/lib/govuk.ts, including its CLUTCH_OFFLINE cache-miss guard):
// fetches the landing page and every child section, parses each section's
// body HTML, and returns both the top-level index and the array of parsed
// sections. scripts/ingest-highway-code.ts (Step 9) calls this and writes
// the result to content/uk/highway-code/; scripts/compare-highway-code.ts
// (Step 2) calls it with no file writes at all, to diff the result against
// what's already committed there.
// Under `CLUTCH_OFFLINE=1`, when the caller passes no `fetchedAt` of its
// own, `index.source.fetchedAt` reuses the value already committed at
// content/uk/highway-code/index.json (falling back to the current time
// only when that file doesn't exist yet), so an offline
// `ingest:highway-code` run (Step 7's re-parse) and the comparator both
// reproduce the committed JSON byte-for-byte instead of drifting by
// timestamp on every run (plan.md amendment E1). Online behaviour (no
// `CLUTCH_OFFLINE`) is unchanged: always the current time, unless the
// caller passes its own `fetchedAt`, which always wins.
// `ParseOptions`/`PARSE_FLAGS` start empty: `BuildHighwayCodeOptions`
// already extends `ParseOptions` so a later step can add a named boolean
// flag to both without changing this module's option shape again. Today
// neither interface has a field, so there is nothing yet to forward into
// `parseSection` — its own signature is unchanged (out of this step's
// scope); a later step that gives `ParseOptions` its first field edits
// `scripts/lib/highway-code-parse.ts` and this module together to thread it
// all the way through.
// Depends on: ./govuk.ts (fetchContentApi), ./highway-code-parse.ts
// (parseSection), ../../src/content/schemas/highwayCode.ts (HighwayCodeIndex,
// Section shapes), Node's built-in `fs` and `path` modules (to read the
// committed index.json's fetchedAt back under CLUTCH_OFFLINE=1).
// Depended on by: scripts/ingest-highway-code.ts, scripts/compare-highway-code.ts.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContentApi } from './govuk';
import { parseSection } from './highway-code-parse';
import type { HighwayCodeIndex, Section } from '../../src/content/schemas/highwayCode';

const LANDING_BASE_PATH = '/guidance/the-highway-code';
const COMMITTED_INDEX_PATH = join('content', 'uk', 'highway-code', 'index.json');

/**
 * Named boolean flags the parser can be run with. Empty for now — Step 2
 * only wires the plumbing; a later step adds a field here (and the
 * matching name to `PARSE_FLAGS` below) for each new parser behaviour that
 * needs to be toggled on or off.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberately empty until a later step adds its first named flag (see module header).
export interface ParseOptions {}

/** Every flag name `ParseOptions` currently declares, read by
 * scripts/compare-highway-code.ts so its `--flags on|off|<name>` never
 * hard-codes a flag list of its own. */
export const PARSE_FLAGS: readonly string[] = [];

export interface BuildHighwayCodeOptions extends ParseOptions {
  /** Forwarded to every `fetchContentApi` call (landing page and every
   * child section alike). */
  cacheDir?: string;
  /** Used for `index.source.fetchedAt` instead of the default when set —
   * an explicit override that always wins. Left unset, `buildHighwayCode`
   * still avoids a fresh timestamp under `CLUTCH_OFFLINE=1` on its own (see
   * module header, plan.md amendment E1); scripts/compare-highway-code.ts
   * additionally passes the committed value explicitly, which is simply
   * the same value `buildHighwayCode` would already have found. */
  fetchedAt?: string;
}

export interface BuildHighwayCodeResult {
  index: HighwayCodeIndex;
  sections: Section[];
}

interface ContentApiChildSection {
  title: string;
  base_path: string;
}

interface ContentApiChildSectionGroup {
  child_sections?: ContentApiChildSection[];
}

interface ContentApiResponse {
  title: string;
  public_updated_at?: string;
  details?: {
    child_section_groups?: ContentApiChildSectionGroup[];
    body?: string;
  };
}

function slugFromBasePath(basePath: string): string {
  const slug = basePath.split('/').filter(Boolean).pop();
  if (!slug) throw new Error(`could not derive a slug from base_path "${basePath}"`);
  return slug;
}

/**
 * Under `CLUTCH_OFFLINE=1`, returns the `source.fetchedAt` already
 * committed at content/uk/highway-code/index.json, so a caller that passes
 * no `fetchedAt` of its own (the ingest script) still reproduces the
 * committed JSON byte-for-byte instead of writing a fresh timestamp for
 * content that was only ever replayed from cache (plan.md amendment E1).
 * Returns `undefined` — letting the caller fall back to the current time —
 * when offline mode is off, or when the committed file doesn't exist yet
 * (e.g. the very first ingest, which has nothing to reuse).
 */
function offlineCommittedFetchedAt(): string | undefined {
  if (process.env.CLUTCH_OFFLINE !== '1') return undefined;
  if (!existsSync(COMMITTED_INDEX_PATH)) return undefined;
  const committed = JSON.parse(readFileSync(COMMITTED_INDEX_PATH, 'utf8')) as HighwayCodeIndex;
  return committed.source.fetchedAt;
}

/**
 * Fetches (or replays from `options.cacheDir`) the Highway Code landing
 * page and every child section, and parses each into a `Section`. Makes no
 * file writes of its own — the caller decides what, if anything, to do
 * with the result.
 */
export async function buildHighwayCode(
  options: BuildHighwayCodeOptions = {},
): Promise<BuildHighwayCodeResult> {
  const { cacheDir, fetchedAt } = options;

  const landing = (await fetchContentApi(LANDING_BASE_PATH, { cacheDir })) as ContentApiResponse;

  // scout.md Correction 2: links.children is empty for this page — sections
  // live under details.child_section_groups[].child_sections[] instead, in
  // published order.
  const groups = landing.details?.child_section_groups ?? [];
  const childSections = groups.flatMap((group) => group.child_sections ?? []);
  if (childSections.length === 0) {
    throw new Error('no child_section_groups found on the Highway Code landing page');
  }

  const sections: Section[] = [];
  const indexSections: HighwayCodeIndex['sections'] = [];

  for (const [order, child] of childSections.entries()) {
    const slug = slugFromBasePath(child.base_path);
    const response = (await fetchContentApi(child.base_path, { cacheDir })) as ContentApiResponse;

    // `kind` below comes from parseSection's own call to kindOf, so the
    // slug/title/rules precedence in plan.md amendment P3 is applied
    // uniformly for every section this builds.
    const section = parseSection(response.details?.body ?? '', {
      slug,
      title: response.title,
      basePath: child.base_path,
      sourceUrl: `https://www.gov.uk${child.base_path}`,
      order,
    });

    sections.push(section);
    indexSections.push({
      slug: section.slug,
      title: section.title,
      order: section.order,
      kind: section.kind,
      ruleIds: section.rules.map((rule) => rule.id),
    });
  }

  const index: HighwayCodeIndex = {
    source: {
      title: landing.title,
      url: `https://www.gov.uk${LANDING_BASE_PATH}`,
      apiUrl: `https://www.gov.uk/api/content${LANDING_BASE_PATH}`,
      publicUpdatedAt: landing.public_updated_at ?? '',
      fetchedAt: fetchedAt ?? offlineCommittedFetchedAt() ?? new Date().toISOString(),
    },
    licence: {
      name: 'Open Government Licence v3.0',
      url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      statement:
        'Contains public sector information licensed under the Open Government Licence v3.0.',
      footer:
        'All content is available under the Open Government Licence v3.0, except where otherwise stated',
    },
    sections: indexSections,
  };

  return { index, sections };
}
