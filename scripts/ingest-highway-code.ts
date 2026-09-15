// Fetches every Highway Code section from the gov.uk Content API — via
// buildHighwayCode, which does the actual fetch + parse work — and writes
// the result to content/uk/highway-code/, the offline source of truth for
// Learn > The Highway Code (Steps 15-17). NOT run by Step 8: Step 9 runs it
// once, sequentially and politely, against the live API
// (content/.cache/highway-code/ makes a second run free, e.g. while
// extending the parser for the H1-H3 markup, or offline via
// scripts/compare-highway-code.ts, Step 2). Reaches gov.uk only through
// scripts/lib/govuk.ts (via scripts/lib/highway-code-build.ts), the one
// module in the repo allowed to call the fetch API.
// Depends on: scripts/lib/highway-code-build.ts (buildHighwayCode),
// Node's built-in `fs` and `path` modules.
// Depended on by: `npm run ingest:highway-code` (package.json; run in Step 9).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildHighwayCode } from './lib/highway-code-build';

const CACHE_DIR = 'content/.cache/highway-code';
const OUT_DIR = 'content/uk/highway-code';

async function main(): Promise<void> {
  const { index, sections } = await buildHighwayCode({ cacheDir: CACHE_DIR });

  const sectionsDir = join(OUT_DIR, 'sections');
  mkdirSync(sectionsDir, { recursive: true });

  for (const section of sections) {
    writeFileSync(
      join(sectionsDir, `${section.slug}.json`),
      `${JSON.stringify(section, null, 2)}\n`,
      'utf8',
    );
    console.log(`${section.slug}: ${section.rules.length} rule(s)`);
  }

  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(`wrote ${sections.length} sections to ${OUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
