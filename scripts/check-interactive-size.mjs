// Checks each interactives registry entry's built size against its
// sizeBudgetKiB (plan.md Step 18): reads
// src/features/interactives/registry.ts as plain text (never imports it,
// so this works even for ids whose index.tsx does not exist yet) and
// matches only quoted `id: '...'` and numeric `sizeBudgetKiB: N` literals
// -- never the InteractiveEntry interface's own `id: string;` /
// `sizeBudgetKiB: number;` lines, which have no quote/digit right after
// the colon. Fails if the id count and the sizeBudgetKiB count differ, or
// if dist/.vite/manifest.json (written because vite.config.ts sets
// build.manifest: true) is missing. For each id, a game's built size is
// its own manifest entry's file and css (always charged), plus every
// chunk reachable through its imports (recursively) that is reachable,
// the same way, from no other manifest entry marked isEntry or
// isDynamicEntry -- so a chunk shared with the index.html shell, with
// another game, or with any other lazily loaded module (for example a
// Highway Code section chunk) is never charged to this game -- plus those
// chunks' css. Fails a game over its budget. Run after `npm run build`.
// Depends on: node:fs, node:path,
// src/features/interactives/registry.ts (read as text only),
// dist/.vite/manifest.json, dist/ (the production build).
// Depended on by: `npm run check:interactives` (later: Steps 24-26, once
// they add registry entries).
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REGISTRY_PATH = join('src', 'features', 'interactives', 'registry.ts');
const MANIFEST_PATH = join('dist', '.vite', 'manifest.json');
const DIST_DIR = 'dist';

function readRegistryEntries() {
  const source = readFileSync(REGISTRY_PATH, 'utf8');
  const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
  const budgets = [...source.matchAll(/sizeBudgetKiB:\s*(\d+)/g)].map((match) => Number(match[1]));

  if (ids.length !== budgets.length) {
    console.error(
      `check:interactives: found ${ids.length} id(s) but ${budgets.length} sizeBudgetKiB value(s) in ${REGISTRY_PATH}`,
    );
    process.exit(1);
  }

  return ids.map((id, index) => ({ id, sizeBudgetKiB: budgets[index] }));
}

function readManifest() {
  let raw;
  try {
    raw = readFileSync(MANIFEST_PATH, 'utf8');
  } catch {
    console.error(
      `check:interactives: no Vite manifest at ${MANIFEST_PATH} -- run npm run build with build.manifest: true first`,
    );
    process.exit(1);
    return undefined;
  }
  return JSON.parse(raw);
}

/** Every manifest key that is its own load root: the index.html shell entry, or a lazily (dynamically) loaded module such as a game or a Highway Code section chunk. */
function collectRootKeys(manifest) {
  return Object.keys(manifest).filter((key) => {
    const entry = manifest[key];
    return entry.isEntry === true || entry.isDynamicEntry === true;
  });
}

/** The set of dist-relative file paths (JS + CSS) reachable from `rootKey` through its OWN static `imports`, followed recursively -- never `rootKey`'s own file/css, which is charged separately and unconditionally. */
function collectImportedFiles(manifest, rootKey) {
  const files = new Set();
  const visitedKeys = new Set([rootKey]);
  const stack = [...(manifest[rootKey]?.imports ?? [])];

  while (stack.length > 0) {
    const key = stack.pop();
    if (visitedKeys.has(key)) continue;
    visitedKeys.add(key);

    const entry = manifest[key];
    if (!entry) continue;

    if (entry.file) files.add(entry.file);
    for (const cssFile of entry.css ?? []) files.add(cssFile);
    for (const importedKey of entry.imports ?? []) stack.push(importedKey);
  }

  return files;
}

/** file -> the set of root keys that reach it through their own static imports. */
function buildFileReachability(manifest, rootKeys) {
  const reachability = new Map();
  for (const rootKey of rootKeys) {
    for (const file of collectImportedFiles(manifest, rootKey)) {
      if (!reachability.has(file)) reachability.set(file, new Set());
      reachability.get(file).add(rootKey);
    }
  }
  return reachability;
}

function sumFileBytes(files) {
  let total = 0;
  for (const file of files) {
    total += statSync(join(DIST_DIR, file)).size;
  }
  return total;
}

function main() {
  const entries = readRegistryEntries();
  const manifest = readManifest();

  if (entries.length === 0) {
    console.log('check:interactives: 0 interactives, largest 0 KiB');
    return;
  }

  const rootKeys = collectRootKeys(manifest);
  const reachability = buildFileReachability(manifest, rootKeys);

  const problems = [];
  let largestKiB = 0;

  for (const { id, sizeBudgetKiB } of entries) {
    const key = `src/features/interactives/${id}/index.tsx`;
    const gameEntry = manifest[key];
    if (!gameEntry) {
      problems.push(`no manifest entry for ${key} (registry id "${id}")`);
      continue;
    }

    const ownFiles = new Set();
    if (gameEntry.file) ownFiles.add(gameEntry.file);
    for (const cssFile of gameEntry.css ?? []) ownFiles.add(cssFile);

    const nonSharedImportedFiles = [...collectImportedFiles(manifest, key)].filter((file) => {
      const reachingRoots = reachability.get(file);
      return reachingRoots && reachingRoots.size === 1 && reachingRoots.has(key);
    });

    const kiB = (sumFileBytes(ownFiles) + sumFileBytes(nonSharedImportedFiles)) / 1024;
    largestKiB = Math.max(largestKiB, kiB);

    if (kiB > sizeBudgetKiB) {
      problems.push(`${id}: ${kiB.toFixed(1)} KiB exceeds its ${sizeBudgetKiB} KiB budget`);
    }
  }

  console.log(
    `check:interactives: ${entries.length} interactives, largest ${largestKiB.toFixed(1)} KiB`,
  );

  if (problems.length > 0) {
    for (const problem of problems) console.error(`check:interactives: ${problem}`);
    process.exit(1);
  }
}

main();
