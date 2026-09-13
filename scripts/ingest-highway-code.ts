// Fetches every Highway Code section from the gov.uk Content API and writes
// the parsed, rule-numbered JSON to content/uk/highway-code/ — the offline
// source of truth for Learn > The Highway Code (Steps 15-17). NOT run by
// Step 8: Step 9 runs it once, sequentially and politely, against the live
// API (content/.cache/highway-code/ makes a second run free, e.g. while
// extending the parser for the H1-H3 markup). Reaches gov.uk only through
// scripts/lib/govuk.ts, the one module in the repo allowed to call the
// fetch API.
// Depends on: scripts/lib/govuk.ts, scripts/lib/highway-code-parse.ts,
// ../src/content/schemas/highwayCode.ts (the HighwayCodeIndex shape),
// Node's built-in `fs` and `path` modules.
// Depended on by: `npm run ingest:highway-code` (package.json; run in Step 9).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContentApi } from './lib/govuk';
import { parseSection } from './lib/highway-code-parse';
import type { HighwayCodeIndex } from '../src/content/schemas/highwayCode';

const CACHE_DIR = 'content/.cache/highway-code';
const OUT_DIR = 'content/uk/highway-code';
const LANDING_BASE_PATH = '/guidance/the-highway-code';

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

async function main(): Promise<void> {
  const landing = (await fetchContentApi(LANDING_BASE_PATH, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

  // scout.md Correction 2: links.children is empty for this page — sections
  // live under details.child_section_groups[].child_sections[] instead, in
  // published order.
  const groups = landing.details?.child_section_groups ?? [];
  const childSections = groups.flatMap((group) => group.child_sections ?? []);
  if (childSections.length === 0) {
    throw new Error('no child_section_groups found on the Highway Code landing page');
  }

  const sectionsDir = join(OUT_DIR, 'sections');
  mkdirSync(sectionsDir, { recursive: true });

  const indexSections: HighwayCodeIndex['sections'] = [];

  for (const [order, child] of childSections.entries()) {
    const slug = slugFromBasePath(child.base_path);
    const response = (await fetchContentApi(child.base_path, {
      cacheDir: CACHE_DIR,
    })) as ContentApiResponse;

    // `kind` below comes from parseSection's own call to kindOf, so the
    // slug/title/rules precedence in plan.md amendment P3 is applied
    // uniformly for every section this script writes.
    const section = parseSection(response.details?.body ?? '', {
      slug,
      title: response.title,
      basePath: child.base_path,
      sourceUrl: `https://www.gov.uk${child.base_path}`,
      order,
    });

    writeFileSync(
      join(sectionsDir, `${slug}.json`),
      `${JSON.stringify(section, null, 2)}\n`,
      'utf8',
    );

    indexSections.push({
      slug: section.slug,
      title: section.title,
      order: section.order,
      kind: section.kind,
      ruleIds: section.rules.map((rule) => rule.id),
    });

    console.log(`${slug}: ${section.rules.length} rule(s)`);
  }

  const index: HighwayCodeIndex = {
    source: {
      title: landing.title,
      url: `https://www.gov.uk${LANDING_BASE_PATH}`,
      apiUrl: `https://www.gov.uk/api/content${LANDING_BASE_PATH}`,
      publicUpdatedAt: landing.public_updated_at ?? '',
      fetchedAt: new Date().toISOString(),
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

  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(`wrote ${indexSections.length} sections to ${OUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
