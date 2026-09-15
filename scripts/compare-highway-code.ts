// Offline comparator for the Highway Code build: runs `buildHighwayCode`
// entirely in memory (this script never writes a file) and diffs the
// result against the committed `content/uk/highway-code/index.json` and
// every `content/uk/highway-code/sections/*.json`, using `diffJson`.
//
// `--flags off|on|<name>` toggles every name in `PARSE_FLAGS` off, on, or
// just the one named flag, builds with that, and prints one summary line:
//   compare: files=<n> identical=<n> differing=<n> paths=<n>
//
// `--attribute` instead builds once with every flag off, diffs that build
// against the committed files (exactly as `--flags off` does) to get the
// set of differing paths, then builds once per name in `PARSE_FLAGS` to
// see which of those single-flag builds also change each differing path
// (relative to the flags-off build) — printing:
//   attribute: paths=<n> unattributed=<n>
//   flag <name>: paths=<n>          (one line per PARSE_FLAGS entry)
// A path with `unattributed` > 0 means no single flag explains it (an
// unintended difference); PARSE_FLAGS is empty for now, so today this
// always prints `paths=0 unattributed=0` and no `flag` lines.
//
// Under `CLUTCH_OFFLINE=1` this reuses the committed index's own
// `fetchedAt` for the build (instead of the current time), so an
// unchanged parser reproduces the committed JSON byte-for-byte rather than
// always differing by timestamp; scripts/lib/govuk.ts's offline guard is
// what actually forbids a network request while offline.
//
// Depends on: node:fs, node:path, scripts/lib/highway-code-build.ts
// (buildHighwayCode, BuildHighwayCodeResult, ParseOptions, PARSE_FLAGS),
// scripts/lib/json-diff.ts (diffJson), ../src/content/schemas/highwayCode.ts
// (HighwayCodeIndex, for the committed index's fetchedAt field).
// Depended on by: `npm run compare:highway-code` (package.json; this
// step's own check, and later steps' checks).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildHighwayCode,
  PARSE_FLAGS,
  type BuildHighwayCodeResult,
  type ParseOptions,
} from './lib/highway-code-build';
import { diffJson } from './lib/json-diff';
import type { HighwayCodeIndex } from '../src/content/schemas/highwayCode';

const CACHE_DIR = 'content/.cache/highway-code';
const COMMITTED_DIR = 'content/uk/highway-code';

interface CommittedFile {
  /** "index.json" or "sections/<slug>.json" — for messages only. */
  relPath: string;
  /** null for index.json; the section's own `slug` field otherwise. */
  slug: string | null;
  value: unknown;
}

function readCommittedFiles(): CommittedFile[] {
  const indexValue = JSON.parse(readFileSync(join(COMMITTED_DIR, 'index.json'), 'utf8')) as unknown;
  const files: CommittedFile[] = [{ relPath: 'index.json', slug: null, value: indexValue }];

  const sectionsDir = join(COMMITTED_DIR, 'sections');
  const sectionFileNames = readdirSync(sectionsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  for (const name of sectionFileNames) {
    const value = JSON.parse(readFileSync(join(sectionsDir, name), 'utf8')) as { slug: string };
    files.push({ relPath: `sections/${name}`, slug: value.slug, value });
  }
  return files;
}

function committedFetchedAt(files: CommittedFile[]): string {
  const indexFile = files.find((file) => file.slug === null);
  if (!indexFile) throw new Error('committed index.json missing from comparator input');
  return (indexFile.value as HighwayCodeIndex).source.fetchedAt;
}

function buildValueFor(file: CommittedFile, build: BuildHighwayCodeResult): unknown {
  if (file.slug === null) return build.index;
  return build.sections.find((section) => section.slug === file.slug);
}

/** `--flags off` clears every name in `PARSE_FLAGS`; `--flags on` sets all
 * of them; `--flags <name>` sets only that one. `PARSE_FLAGS` is empty
 * until a later step, so every case below currently returns `{}`. */
function parseFlags(raw: string): ParseOptions {
  const flags: Record<string, boolean> = {};
  if (raw === 'off') {
    for (const name of PARSE_FLAGS) flags[name] = false;
    return flags;
  }
  if (raw === 'on') {
    for (const name of PARSE_FLAGS) flags[name] = true;
    return flags;
  }
  if (!PARSE_FLAGS.includes(raw)) {
    const known = PARSE_FLAGS.length > 0 ? PARSE_FLAGS.join(', ') : '(none defined yet)';
    throw new Error(`unknown --flags value "${raw}" (expected "off", "on", or one of: ${known})`);
  }
  for (const name of PARSE_FLAGS) flags[name] = name === raw;
  return flags;
}

function buildWithFlags(
  raw: string,
  fetchedAt: string | undefined,
): Promise<BuildHighwayCodeResult> {
  return buildHighwayCode({ cacheDir: CACHE_DIR, fetchedAt, ...parseFlags(raw) });
}

async function runCompare(flagsArg: string): Promise<void> {
  const committed = readCommittedFiles();
  const fetchedAt = process.env.CLUTCH_OFFLINE === '1' ? committedFetchedAt(committed) : undefined;
  const build = await buildWithFlags(flagsArg, fetchedAt);

  let identical = 0;
  let differing = 0;
  let totalPaths = 0;

  for (const file of committed) {
    const paths = diffJson(file.value, buildValueFor(file, build));
    if (paths.length === 0) {
      identical += 1;
    } else {
      differing += 1;
    }
    totalPaths += paths.length;
  }

  console.log(
    `compare: files=${committed.length} identical=${identical} differing=${differing} paths=${totalPaths}`,
  );
}

async function runAttribute(): Promise<void> {
  const committed = readCommittedFiles();
  const fetchedAt = process.env.CLUTCH_OFFLINE === '1' ? committedFetchedAt(committed) : undefined;
  const offBuild = await buildWithFlags('off', fetchedAt);

  const differing = committed.flatMap((file) =>
    diffJson(file.value, buildValueFor(file, offBuild)).map((path) => ({ slug: file.slug, path })),
  );
  const attributed = differing.map(() => false);
  const flagCounts = new Map<string, number>();

  for (const flagName of PARSE_FLAGS) {
    const flagBuild = await buildWithFlags(flagName, fetchedAt);
    const changedPathsBySlug = new Map<string | null, Set<string>>();
    const changedPathsFor = (slug: string | null): Set<string> => {
      const cached = changedPathsBySlug.get(slug);
      if (cached) return cached;
      const offValue =
        slug === null ? offBuild.index : offBuild.sections.find((section) => section.slug === slug);
      const flagValue =
        slug === null
          ? flagBuild.index
          : flagBuild.sections.find((section) => section.slug === slug);
      const computed = new Set(diffJson(offValue, flagValue));
      changedPathsBySlug.set(slug, computed);
      return computed;
    };

    let count = 0;
    differing.forEach((entry, i) => {
      if (changedPathsFor(entry.slug).has(entry.path)) {
        count += 1;
        attributed[i] = true;
      }
    });
    flagCounts.set(flagName, count);
  }

  const unattributed = attributed.filter((flag) => !flag).length;
  console.log(`attribute: paths=${differing.length} unattributed=${unattributed}`);
  for (const flagName of PARSE_FLAGS) {
    console.log(`flag ${flagName}: paths=${flagCounts.get(flagName) ?? 0}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--attribute')) {
    await runAttribute();
    return;
  }

  const flagsIndex = args.indexOf('--flags');
  const flagsArg = flagsIndex === -1 ? undefined : args[flagsIndex + 1];
  if (flagsArg === undefined) {
    throw new Error('usage: compare-highway-code --flags off|on|<name>, or --attribute');
  }
  await runCompare(flagsArg);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
