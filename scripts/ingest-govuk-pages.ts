// Fetches the 15 GOV.UK guidance/transaction pages (scripts/lib/govuk-pages.ts's
// BASE_PATHS) from the gov.uk Content API plus their rendered HTML, and
// writes content/uk/govuk/<slug>.json and content/uk/govuk/index.json — the
// offline source-unit corpus for Phase 3's theory content (Step 5). Run
// once, sequentially and politely; content/.cache/govuk-pages/ makes later
// runs (this script's own offline re-run in the step's check, or a
// developer iterating on the parser) free. Reaches gov.uk only through
// scripts/lib/govuk.ts, the one module in the repo allowed to call the
// fetch API. Prints one `<slug> licence: <licenceLine>` line per page and
// exits 1 if any page's licence line does not name the Open Government
// Licence v3.0.
// Depends on: node:fs, node:path, ./lib/govuk.ts (fetchContentApi,
// fetchCachedText), ./lib/govuk-pages.ts (BASE_PATHS, buildGovukPage,
// buildGovukIndex, slugOf), ../src/content/schemas/govuk.ts (GovukPage
// type).
// Depended on by: `npm run ingest:govuk-pages` (package.json; run once,
// live, in Step 5).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCachedText, fetchContentApi } from './lib/govuk';
import { BASE_PATHS, buildGovukIndex, buildGovukPage, slugOf } from './lib/govuk-pages';
import type { GovukPage } from '../src/content/schemas/govuk';

const CACHE_DIR = 'content/.cache/govuk-pages';
const OUT_DIR = 'content/uk/govuk';

async function main(): Promise<void> {
  const pages: GovukPage[] = [];
  let anyMissingLicence = false;

  for (const basePath of BASE_PATHS) {
    const slug = slugOf(basePath);
    const api = await fetchContentApi(basePath, { cacheDir: CACHE_DIR });
    const rendered = await fetchCachedText(
      `https://www.gov.uk${basePath}`,
      join(CACHE_DIR, `page-${slug}.html`),
    );
    const page = buildGovukPage(basePath, api, rendered, new Date().toISOString());
    pages.push(page);
    console.log(`${slug} licence: ${page.licenceLine}`);
    if (!page.licenceLine.includes('Open Government Licence v3.0')) {
      anyMissingLicence = true;
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const page of pages) {
    writeFileSync(join(OUT_DIR, `${page.slug}.json`), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
  }
  const index = buildGovukIndex(pages);
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  console.log(`wrote ${OUT_DIR}: pages=${pages.length}`);
  if (anyMissingLicence) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
