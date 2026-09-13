// Fetches the National Standard for Driving Cars and Light Vans (category
// B) from the gov.uk Content API and writes the parsed role/unit/element
// tree to content/uk/syllabus.json — the offline syllabus source of truth
// (Step 10). Run once, sequentially and politely; content/.cache/national-standard/
// makes later runs (e.g. while developing the parser) free. Reaches gov.uk
// only through scripts/lib/govuk.ts, the one module in the repo allowed to
// call the fetch API.
// Depends on: scripts/lib/govuk.ts, scripts/lib/national-standard-parse.ts,
// ../src/content/schemas/syllabus.ts (the Syllabus shape), Node's built-in
// `fs` module.
// Depended on by: `npm run ingest:national-standard` (package.json; run in
// Step 10).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchContentApi } from './lib/govuk';
import { parseRolePage } from './lib/national-standard-parse';
import type { Syllabus, SyllabusRole } from '../src/content/schemas/syllabus';

const CACHE_DIR = 'content/.cache/national-standard';
const OUT_PATH = 'content/uk/syllabus.json';
const LANDING_BASE_PATH = '/guidance/national-standard-for-driving-cars-and-light-vans-category-b';

interface ContentApiChildSection {
  title: string;
  base_path: string;
}

interface ContentApiChildSectionGroup {
  child_sections?: ContentApiChildSection[];
}

interface ContentApiLinkedItem {
  title: string;
  base_path: string;
}

interface ContentApiResponse {
  title: string;
  details?: {
    child_section_groups?: ContentApiChildSectionGroup[];
    body?: string;
    /** An "Updated" date text gov.uk sometimes renders in a page's details;
     * absent on every page fetched for this ingestion (confirmed by
     * inspecting the cache — see step-10.md), in which case `lastUpdated`
     * stays null rather than falling back to unrelated API metadata. */
    updated?: string;
  };
  links?: {
    children?: ContentApiLinkedItem[];
  };
}

async function main(): Promise<void> {
  const landing = (await fetchContentApi(LANDING_BASE_PATH, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

  // Same manual shape as the Highway Code landing page (scripts/ingest-highway-code.ts):
  // children live under details.child_section_groups[].child_sections[]. Fall
  // back to links.children only if that is empty, and say which was used.
  const groups = landing.details?.child_section_groups ?? [];
  let childSections: ContentApiChildSection[] = groups.flatMap(
    (group) => group.child_sections ?? [],
  );
  let childSource: 'child_section_groups' | 'links.children' = 'child_section_groups';
  if (childSections.length === 0) {
    childSections = landing.links?.children ?? [];
    childSource = 'links.children';
  }
  console.log(`children source: ${childSource} (${childSections.length} page(s))`);

  const roles: SyllabusRole[] = [];
  let lastUpdated: string | null = null;

  for (const child of childSections) {
    const response = (await fetchContentApi(child.base_path, {
      cacheDir: CACHE_DIR,
    })) as ContentApiResponse;

    if (child.title.startsWith('Role ')) {
      const role = parseRolePage(response.details?.body ?? '', { title: child.title });
      const elementCount = role.units.reduce((sum, unit) => sum + unit.elements.length, 0);
      roles.push(role);
      console.log(
        `role ${role.id} (${role.title}): ${role.units.length} unit(s), ${elementCount} element(s)`,
      );
    }

    if (child.base_path.endsWith('/introduction')) {
      lastUpdated = response.details?.updated ?? null;
    }
  }

  const unitCount = roles.reduce((sum, role) => sum + role.units.length, 0);
  const elementCount = roles.reduce(
    (sum, role) => sum + role.units.reduce((unitSum, unit) => unitSum + unit.elements.length, 0),
    0,
  );

  const syllabus: Syllabus = {
    source: {
      title: landing.title,
      url: `https://www.gov.uk${LANDING_BASE_PATH}`,
      apiUrl: `https://www.gov.uk/api/content${LANDING_BASE_PATH}`,
      fetchedAt: new Date().toISOString(),
      lastUpdated,
    },
    licence: {
      name: 'Open Government Licence v3.0',
      url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      statement:
        'Contains public sector information licensed under the Open Government Licence v3.0.',
      footer:
        'All content is available under the Open Government Licence v3.0, except where otherwise stated',
    },
    roles,
    counts: {
      roles: roles.length,
      units: unitCount,
      elements: elementCount,
    },
  };

  mkdirSync('content/uk', { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(syllabus, null, 2)}\n`, 'utf8');
  console.log(
    `wrote ${OUT_PATH}: roles=${roles.length} units=${unitCount} elements=${elementCount}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
