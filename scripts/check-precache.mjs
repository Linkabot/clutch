// Checks the production build's Workbox precache manifest against the
// Phase 1 precache budget (plan.md Step 18, amendment P8): Workbox writes
// manifest entries with UNQUOTED keys, e.g.
// {url:"assets/index-Cddd4Bjc.js",revision:null} — never `"url":"..."` — so
// this parses dist/sw.js with a regex rather than JSON.parse, sums each
// entry's file size on disk, and exits 1 unless: the total is within
// budget; at least 5 font files and ATTRIBUTION.md are precached; every
// built JS chunk is actually listed (Workbox silently drops any file over
// its default 2 MiB per-file limit); no entry references a third-party
// font host; and the manifest is not empty (an unparseable manifest must
// never pass). Run after `npm run build`; reads nothing outside `dist/`
// (relative to the current working directory, so it can also be pointed at
// a copy of the build elsewhere).
// Depends on: node:fs, node:path, dist/sw.js and dist/assets/*.js (the
// production build).
// Depended on by: `npm run check:precache`, .github/workflows/ci.yml.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const BUDGET_KIB = 3072;
const MIN_WOFF2_ENTRIES = 5;

function readPrecacheUrls(swPath) {
  const source = readFileSync(swPath, 'utf8');
  // Workbox's generateSW manifest entries have unquoted keys:
  // `{url:"...",revision:...}`. This also matches a quoted `"url":"..."`
  // key, in case a future Workbox version changes its own output style.
  const pattern = /\{\s*"?url"?\s*:\s*"([^"]+)"/g;
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function main() {
  const swPath = join(DIST_DIR, 'sw.js');
  const urls = readPrecacheUrls(swPath);

  if (urls.length === 0) {
    console.error('check:precache: found zero precache entries in dist/sw.js — refusing to pass');
    process.exit(1);
    return;
  }

  const problems = [];
  const precached = new Set();
  let totalBytes = 0;
  let woff2Count = 0;
  let hasAttribution = false;

  for (const url of urls) {
    precached.add(url);
    if (url.includes('googleapis') || url.includes('gstatic')) {
      problems.push(`third-party font host precached: ${url}`);
      continue;
    }
    totalBytes += statSync(join(DIST_DIR, url)).size;
    if (url.endsWith('.woff2')) woff2Count += 1;
    if (url.endsWith('ATTRIBUTION.md')) hasAttribution = true;
  }

  const totalKiB = totalBytes / 1024;
  console.log(
    `check:precache: ${urls.length} entries, ${totalKiB.toFixed(1)} KiB (budget ${BUDGET_KIB} KiB)`,
  );

  if (totalKiB > BUDGET_KIB) {
    problems.push(`total ${totalKiB.toFixed(1)} KiB exceeds the ${BUDGET_KIB} KiB budget`);
  }
  if (woff2Count < MIN_WOFF2_ENTRIES) {
    problems.push(
      `only ${woff2Count} .woff2 entries precached, expected at least ${MIN_WOFF2_ENTRIES}`,
    );
  }
  if (!hasAttribution) {
    problems.push('ATTRIBUTION.md is not precached');
  }

  const assetsDir = join(DIST_DIR, 'assets');
  const missingChunks = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => `assets/${name}`)
    .filter((assetUrl) => !precached.has(assetUrl));
  if (missingChunks.length > 0) {
    problems.push(`JS chunk(s) built but not precached: ${missingChunks.join(', ')}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`check:precache: ${problem}`);
    process.exit(1);
    return;
  }

  console.log('check:precache: OK');
}

main();
