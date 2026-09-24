// check:headers: checks that every module header under src/, scripts/ and tests/ is true
// against the import graph of the current tree (no build, no network, no git history), and
// reports NO-HEADER, NO-PARTS, MISSING-BY, MISSING-ON and SPURIOUS findings, exiting 1 on any.
// Files come from `git ls-files`, or from a directory walk under --root <dir>.
// Depends on: node:child_process, node:fs, node:path.
// Depended on by: nothing imports it; it is run as a child process by
// tests/unit/check-headers.test.ts.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const EXTENSION_RE = /\.(ts|tsx|mts|mjs|js|css)$/;
const RESOLVE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '.css',
  '/index.ts',
  '/index.tsx',
];
const TOP_DIRS = ['src', 'scripts', 'tests'];

// A bad argument or a git failure (C4) prints a message on stderr and exits 2.
function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  if (argv.length === 0) return { root: null };
  if (argv.length === 2 && argv[0] === '--root' && argv[1]) return { root: argv[1] };
  fail('check-headers: usage: node scripts/check-headers.mjs [--root <dir>]');
  return { root: null };
}

// C1: git ls-files, run with no shell, no other git command.
function listFilesFromGit() {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '-z', '--', ...TOP_DIRS], { encoding: 'utf8' });
  } catch (error) {
    fail(`check-headers: git ls-files failed: ${error.message}`);
    return [];
  }
  return out.split('\0').filter(Boolean);
}

// C1: --root mode walks <dir>/src, <dir>/scripts, <dir>/tests, skipping any that don't exist,
// and builds paths relative to <dir> with `/` separators (never the OS separator).
function listFilesFromWalk(root) {
  const found = [];
  const walk = (absDir, relDir) => {
    for (const entry of readdirSync(absDir)) {
      const absPath = join(absDir, entry);
      const relPath = `${relDir}/${entry}`;
      if (statSync(absPath).isDirectory()) walk(absPath, relPath);
      else found.push(relPath);
    }
  };
  for (const top of TOP_DIRS) {
    const absTop = join(root, top);
    if (existsSync(absTop)) walk(absTop, top);
  }
  return found;
}

function toAbsolutePath(root, relPath) {
  return root ? join(root, ...relPath.split('/')) : relPath;
}

// C3: UTF-8, drop a leading BOM, turn \r\n into \n.
function readNormalisedText(root, relPath) {
  const raw = readFileSync(toAbsolutePath(root, relPath), 'utf8');
  const withoutBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return withoutBom.replace(/\r\n/g, '\n');
}

// I1: strip whole-line `//` comments first, then block comments -- in that order, so a line
// comment holding `/practice/*` cannot open a fake block comment.
function stripComments(text) {
  return text.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

// I2: every specifier form the script recognises.
const IMPORT_SPECIFIER_RES = [
  /\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  /\bvi\s*\.\s*(?:mock|doMock|importActual)\s*(?:<[^>]*>)?\s*\(\s*(['"])([^'"\n]+)\1/g,
  /@import\s+(?:url\(\s*)?(['"])([^'"\n]+)\1/g,
];

// The first I2 regex on its own, used again for I5's barrel test.
const EXPORT_FROM_RE = IMPORT_SPECIFIER_RES[0];

function isRelativeSpecifier(spec) {
  return spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../');
}

// I3: resolve a relative specifier against the file set, trying the exact path then each
// known suffix in order. A file never imports itself.
function resolveRelativeImport(fileSet, fromFile, spec) {
  if (!isRelativeSpecifier(spec) || spec.includes('?')) return null;
  const fromDir = posix.dirname(fromFile);
  const joined = posix.normalize(posix.join(fromDir, spec)).replace(/\/$/, '');
  if (joined === '..' || joined.startsWith('../')) return null;
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = joined + suffix;
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

// I5: a barrel is an index.ts/index.tsx with at least one relative `export ... from`.
function isBarrelName(relPath) {
  const base = posix.basename(relPath);
  return base === 'index.ts' || base === 'index.tsx';
}

function computeBarrels(fileSet, strippedTextOf) {
  const barrels = new Set();
  for (const file of fileSet) {
    if (!isBarrelName(file)) continue;
    const stripped = strippedTextOf.get(file);
    EXPORT_FROM_RE.lastIndex = 0;
    let match;
    while ((match = EXPORT_FROM_RE.exec(stripped))) {
      if (/^export\b/.test(match[0]) && isRelativeSpecifier(match[2])) {
        barrels.add(file);
        break;
      }
    }
  }
  return barrels;
}

function buildImportGraph(fileSet, strippedTextOf) {
  const importsOf = new Map([...fileSet].map((file) => [file, new Set()]));
  for (const file of fileSet) {
    const stripped = strippedTextOf.get(file);
    for (const re of IMPORT_SPECIFIER_RES) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(stripped))) {
        const resolved = resolveRelativeImport(fileSet, file, match[2]);
        if (resolved && resolved !== file) importsOf.get(file).add(resolved);
      }
    }
  }
  const importersOf = new Map([...fileSet].map((file) => [file, new Set()]));
  for (const [file, targets] of importsOf) {
    for (const target of targets) importersOf.get(target).add(file);
  }
  return { importsOf, importersOf };
}

// H1: take comment units from the top (after an optional shebang), stopping as soon as the
// text taken so far contains "Depended on by". Returns null (NO-HEADER) if no unit was taken.
function extractHeaderUnitLines(text) {
  const lines = text.split('\n');
  let i = lines[0] && lines[0].startsWith('#!') ? 1 : 0;
  const taken = [];
  let tookAnyUnit = false;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      i++;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      taken.push(lines[i]);
      let closed = trimmed.slice(2).includes('*/');
      i++;
      while (!closed && i < lines.length) {
        taken.push(lines[i]);
        closed = lines[i].includes('*/');
        i++;
      }
      tookAnyUnit = true;
    } else if (trimmed.startsWith('//')) {
      while (i < lines.length && lines[i].trim().startsWith('//')) {
        taken.push(lines[i]);
        i++;
      }
      tookAnyUnit = true;
    } else {
      break;
    }
    if (taken.join('\n').includes('Depended on by')) break;
  }

  return tookAnyUnit ? taken : null;
}

// H2: flatten each unit line to plain words, then join and collapse whitespace.
function flattenHeaderLines(unitLines) {
  const words = unitLines
    .map((line) =>
      line
        .replace(/^\s+/, '')
        .replace(/^(\/\*\*|\/\*|\/\/|\*(?!\/))/, '')
        .replace(/\*\/\s*$/, '')
        .trim(),
    )
    .filter((line) => line.length > 0);
  return words.join(' ').replace(/\s+/g, ' ');
}

// H3: split the flattened header into its "Depends on" and "Depended on by" parts.
function splitHeaderParts(flat) {
  const onLabel = 'Depends on';
  const byLabel = 'Depended on by';
  const onIndex = flat.indexOf(onLabel);
  const byIndex = flat.indexOf(byLabel);
  if (onIndex < 0 || byIndex < 0) return null;

  const onEnd = flat.indexOf(byLabel, onIndex + onLabel.length);
  const onPart = flat.slice(onIndex + onLabel.length, onEnd < 0 ? undefined : onEnd);

  const byEnd = flat.indexOf(onLabel, byIndex + byLabel.length);
  const byPart = flat.slice(byIndex + byLabel.length, byEnd < 0 ? undefined : byEnd);

  return { onPart, byPart };
}

// N1-N5, hyphen-aware (B2): B = any character that is not a letter, digit, underscore or
// hyphen, so a header naming "progress-store.ts" does not also name "store.ts" or
// "progress.ts".
const BOUNDARY = '[^A-Za-z0-9_-]';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A path token: a run of path-ish characters that contains `/`, trailing dots removed.
function pathTokensOf(part) {
  const matches = part.match(/[\w.*@/-]+/g) || [];
  return matches.filter((token) => token.includes('/')).map((token) => token.replace(/\.+$/, ''));
}

function globTokenToRegExp(token) {
  const pattern = token
    .split('**')
    .map((segment) => segment.split('*').map(escapeRegExp).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${pattern}$`);
}

function named(part, targetPath) {
  const base = posix.basename(targetPath);

  // N1: the part contains the basename, preceded by the start of the part or a B character.
  if (new RegExp(`(^|${BOUNDARY})${escapeRegExp(base)}`).test(part)) return true;

  // N2: the regex-escaped stem matches (^|B)stem(B|$).
  const stem = base.replace(/\.[^.]+$/, '');
  if (new RegExp(`(^|${BOUNDARY})${escapeRegExp(stem)}(${BOUNDARY}|$)`).test(part)) return true;

  for (const token of pathTokensOf(part)) {
    // N3: a folder token (ends in `/`) that prefixes the target path.
    if (token.endsWith('/') && targetPath.startsWith(token)) return true;
    // N4: a glob token, anchored.
    if (token.includes('*') && globTokenToRegExp(token).test(targetPath)) return true;
  }

  // N5: a barrel is named by its folder, e.g. "/ui" or "/schemas".
  if (isBarrelName(targetPath) && part.includes(`/${posix.basename(posix.dirname(targetPath))}`)) {
    return true;
  }

  return false;
}

// K4's allowances: A1 (a following "as text" parenthetical) and A2 (a preceding contrast word).
const AS_TEXT_RE = /^[`'"]?\s*\([^)]*\bas text\b[^)]*\)/;
const CONTRAST_WORD_RE = /\b(?:from|than|like|not|never|unlike|via|through|of|by|in) $/;
const PATH_TOKEN_RE = /[\w.*@/-]+/g;

function findSpuriousPaths(file, byPart, fileSet, importersOf, barrels) {
  const spurious = [];
  const importers = importersOf.get(file);
  PATH_TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = PATH_TOKEN_RE.exec(byPart))) {
    const candidate = match[0].replace(/\.+$/, '');
    if (candidate === file || !fileSet.has(candidate)) continue;
    if (importers.has(candidate)) continue;

    const reachesThroughBarrel = [...importers].some(
      (importer) => barrels.has(importer) && importersOf.get(importer).has(candidate),
    );
    if (reachesThroughBarrel) continue;

    const after = byPart.slice(match.index + candidate.length);
    if (AS_TEXT_RE.test(after)) continue;
    const before = byPart.slice(0, match.index);
    if (CONTRAST_WORD_RE.test(before)) continue;

    spurious.push(candidate);
  }
  return spurious;
}

function collectFindings(files, root) {
  const fileSet = new Set(files);
  const rawTextOf = new Map(files.map((file) => [file, readNormalisedText(root, file)]));
  const strippedTextOf = new Map(files.map((file) => [file, stripComments(rawTextOf.get(file))]));
  const barrels = computeBarrels(fileSet, strippedTextOf);
  const { importsOf, importersOf } = buildImportGraph(fileSet, strippedTextOf);

  const findings = [];
  for (const file of files) {
    const unitLines = extractHeaderUnitLines(rawTextOf.get(file));
    if (!unitLines) {
      findings.push(`NO-HEADER ${file}`);
      continue;
    }
    const flat = flattenHeaderLines(unitLines);
    const parts = splitHeaderParts(flat);
    if (!parts) {
      findings.push(`NO-PARTS ${file}`);
      continue;
    }
    const { onPart, byPart } = parts;

    // K2: MISSING-ON applies to every file.
    for (const imported of importsOf.get(file)) {
      if (!named(onPart, imported)) findings.push(`MISSING-ON ${file} -> ${imported}`);
    }

    // K5: files under tests/ get only K1 and K2.
    if (file.startsWith('tests/')) continue;

    // K3: MISSING-BY, exempting barrels.
    if (!barrels.has(file)) {
      for (const importer of importersOf.get(file)) {
        if (!named(byPart, importer)) findings.push(`MISSING-BY ${file} <- ${importer}`);
      }
    }

    // K4: SPURIOUS, never for stylesheets.
    if (!file.endsWith('.css')) {
      for (const path of findSpuriousPaths(file, byPart, fileSet, importersOf, barrels)) {
        findings.push(`SPURIOUS ${file} : ${path}`);
      }
    }
  }

  return findings;
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const listed = root ? listFilesFromWalk(root) : listFilesFromGit();
  const files = listed.filter(
    (file) => EXTENSION_RE.test(file) && existsSync(toAbsolutePath(root, file)),
  );

  const findings = [...new Set(collectFindings(files, root))].sort();
  for (const line of findings) console.log(line);
  console.log(`check:headers: files ${files.length}, findings ${findings.length}`);
  console.log(findings.length === 0 ? 'check:headers: OK' : 'check:headers: FAIL');
  process.exit(findings.length === 0 ? 0 : 1);
}

main();
