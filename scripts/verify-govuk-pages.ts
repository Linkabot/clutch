// Offline proof that Step 5's committed content/uk/govuk/*.json match a
// fresh re-derivation from content/.cache/govuk-pages/ (the cache
// scripts/ingest-govuk-pages.ts fetched and wrote), reusing each page's own
// committed `fetchedAt` so an unchanged parser reproduces the committed
// JSON byte-for-byte instead of always differing by timestamp. Never
// fetches: process.env.CLUTCH_OFFLINE is forced to '1' before any call that
// could reach the network, so scripts/lib/govuk.ts's offline guard throws
// on a cache miss instead of ever calling gov.uk (same pattern as
// scripts/compare-highway-code.ts and scripts/verify-signs.ts). Prints
// `verify-govuk: pages=<n> identical=<n> differing=<n>`; exits 0 only when
// every page is identical.
// Depends on: node:fs, node:path, ./lib/govuk.ts (fetchContentApi,
// fetchCachedText), ./lib/govuk-pages.ts (BASE_PATHS, buildGovukPage,
// slugOf), ../src/content/schemas/govuk.ts (GovukPageSchema).
// Depended on by: `npm run verify:govuk-pages` (package.json; run in Step
// 5's check, always with CLUTCH_OFFLINE=1).

process.env.CLUTCH_OFFLINE = '1';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCachedText, fetchContentApi } from './lib/govuk';
import { BASE_PATHS, buildGovukPage, slugOf } from './lib/govuk-pages';
import { GovukPageSchema } from '../src/content/schemas/govuk';

const CACHE_DIR = 'content/.cache/govuk-pages';
const OUT_DIR = 'content/uk/govuk';

async function main(): Promise<void> {
  let identical = 0;
  let differing = 0;

  for (const basePath of BASE_PATHS) {
    const slug = slugOf(basePath);
    const committed = GovukPageSchema.parse(
      JSON.parse(readFileSync(join(OUT_DIR, `${slug}.json`), 'utf8')),
    );
    const api = await fetchContentApi(basePath, { cacheDir: CACHE_DIR });
    const rendered = await fetchCachedText(
      `https://www.gov.uk${basePath}`,
      join(CACHE_DIR, `page-${slug}.html`),
    );
    const fresh = buildGovukPage(basePath, api, rendered, committed.fetchedAt);

    if (JSON.stringify(fresh) === JSON.stringify(committed)) {
      identical += 1;
    } else {
      differing += 1;
      console.log(`differs: ${slug}`);
    }
  }

  console.log(
    `verify-govuk: pages=${BASE_PATHS.length} identical=${identical} differing=${differing}`,
  );
  if (differing !== 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
