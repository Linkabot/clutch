// Offline proof that Step 15's committed outputs (content/uk/signs/signs.json,
// content/uk/signs/attribution.json, public/signs/attribution.json and every
// picture under public/signs/) match a fresh re-derivation from
// content/.cache/kyts/ — the same cache scripts/ingest-signs.ts fetched and
// wrote, read back through EXACTLY the same cache-path construction (never
// re-fetched: process.env.CLUTCH_OFFLINE is forced to '1' before any call
// that might reach the network, so a cache miss throws instead of fetching,
// plan.md § Step 15). Re-parses the seven cached chapter bodies
// (parseChapter), re-scans the seven cached rendered pages
// (licenceProblems), re-selects and re-classifies every sign
// (candidateFiles/selectSigns, fed the committed selection.json,
// shape-rules.json and hooks.json), and compares that fresh result with the
// committed files: caption text (captionMismatch, R8 signs included — their
// name/meaning already come from selectSigns's own paragraph override),
// picture bytes and both attribution.json copies (hashMismatch, plan.md
// amendment E10), the licence scan (licenceProblems), each sign's
// rule/shape/colours against both the fresh classification and § Shape and
// colour rules' expected table copied here verbatim (classMismatch, amended
// P7), every shipped .svg not listed in the manifest (orphanFiles, .svg
// files only, plan.md amendment E10), and — plan.md amendment E14 — every
// sign's hookId/image/refs/licence/thirdPartyMark/source, every manifest
// entry's sourceUrl/chapterUrl/licence/copyright/thirdPartyMark (plus
// duplicate or one-sided files), and signs.json's own
// publication/licence/signingSystemText, against the same objects
// scripts/ingest-signs.ts would build from the cache (provenanceMismatch).
// Step 28a additionally compares four sorted file lists — committed signs',
// committed manifest's, fresh signs' and fresh manifest's own
// thirdPartyMark===true entries — against EXPECTED_THIRD_PARTY_MARKS,
// copied here rather than read from selection.json, counting any
// difference as thirdPartyMismatch. Never imports src/content/signs.ts —
// only the Zod schemas and the same ingestion-library functions
// scripts/ingest-signs.ts itself uses.
// Depends on: node:crypto, node:fs, node:path, ./lib/govuk.ts
// (fetchContentApi, fetchCachedText, fetchCachedBytes), ./lib/kyts-parse.ts
// (parseChapter), ./lib/kyts-select.ts (candidateFiles, selectSigns,
// KytsChapter), ./lib/kyts-licence.ts (licenceProblems, CROWN_LINE,
// OGL_SENTENCE, THIRD_PARTY_SENTENCE), ../src/content/text.ts (htmlToText),
// ../src/content/schemas/signs.ts (SignSelectionFileSchema,
// ShapeRulesFileSchema, HooksFileSchema, SignsFileSchema,
// AttributionManifestSchema, Sign, SignFamily types).
// Depended on by: `npm run verify:signs` (package.json; run in Step 15's
// check, always with CLUTCH_OFFLINE=1).

process.env.CLUTCH_OFFLINE = '1';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCachedBytes, fetchCachedText, fetchContentApi } from './lib/govuk';
import { parseChapter } from './lib/kyts-parse';
import { candidateFiles, selectSigns } from './lib/kyts-select';
import type { KytsChapter } from './lib/kyts-select';
import {
  licenceProblems,
  CROWN_LINE,
  OGL_SENTENCE,
  THIRD_PARTY_SENTENCE,
} from './lib/kyts-licence';
import { htmlToText } from '../src/content/text';
import {
  SignSelectionFileSchema,
  ShapeRulesFileSchema,
  HooksFileSchema,
  SignsFileSchema,
  AttributionManifestSchema,
} from '../src/content/schemas/signs';
import type { Sign, SignFamily } from '../src/content/schemas/signs';

const CACHE_DIR = 'content/.cache/kyts';
const PUBLICATION_BASE_PATH = '/government/publications/know-your-traffic-signs';
const PUBLICATION_URL = `https://www.gov.uk${PUBLICATION_BASE_PATH}`;
const SIGNING_SYSTEM_SLUG = 'the-signing-system';
const OUT_DIR = 'content/uk/signs';
const PUBLIC_DIR = 'public/signs';
const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';

interface ContentApiResponse {
  title: string;
  public_updated_at?: string;
  details?: { body?: string };
}

interface FreshManifestEntry {
  file: string;
  sourceUrl: string;
  chapterUrl: string;
  licence: string;
  copyright: string;
  thirdPartyMark?: true;
}

function chapterUrl(slug: string): string {
  return `${PUBLICATION_URL}/${slug}`;
}

// § Shape and colour rules' expected per-family rule counts, amended P7
// (orders 52 -> 54, C1 gains the two R8 files). Copied verbatim from
// plan.md, not derived from shape-rules.json, so a change to either drifts
// loudly instead of silently agreeing with itself.
const EXPECTED_RULE_COUNTS: Record<SignFamily, Record<string, number>> = {
  warning: { C2: 62, C1: 4 },
  orders: { C3: 20, C4: 6, C1: 2, C9: 26 },
  motorway: { C6: 14, C5: 4, C1: 4 },
  direction: { 'C7-green': 2, 'C7-white': 2, 'C7-green-white': 2, C9: 19 },
  information: { 'C7-green': 1, 'C7-white': 1, C8: 10 },
  'road-works': { C9: 16 },
};

// The named ids plan.md's "Expected classification of the 195 signs" (§
// Shape and colour rules, amended P7) calls out individually.
const EXPECTED_NAMED_RULES: Record<string, string> = {
  'warning-ford': 'C1',
  'warning-try-your-brakes': 'C1',
  'warning-children-lights': 'C1',
  'warning-school-20mph': 'C1',
  'orders-stop-sign-and-road-marking': 'C1',
  'orders-give-way-road-marking': 'C1',
  'motorway-countdown-marker-3': 'C1',
  'motorway-marker-post-phone': 'C1',
  'motorway-docks': 'C1',
  'motorway-hertfordshire': 'C1',
  'orders-left-arrow': 'C4',
  'orders-turn-left': 'C4',
  'orders-either-side': 'C4',
  'orders-keep-left': 'C4',
  'orders-mini-roundabout': 'C4',
  'orders-min-30-mph': 'C4',
  'motorway-directions-from-junction-ahead': 'C5',
  'motorway-directions-from-a-roundabout-ahead': 'C5',
  'motorway-motorway-to-motorway-junction': 'C5',
  'motorway-appropriate-lanes-for-turning-movements': 'C5',
  'direction-london-a2': 'C7-green',
  'direction-map-type-roundabout-ahead': 'C7-green',
  'direction-junction-ahead-two-non-primary-routes': 'C7-white',
  'direction-flag-type-sign-non-primary': 'C7-white',
  'direction-sign-primary-route-indicating-non-primary-route': 'C7-green-white',
  'direction-sign-non-primary-route-indicating-primary-route': 'C7-green-white',
  'information-road-ahead-primary-route': 'C7-green',
  'information-road-ahead-non-primary-route': 'C7-white',
};

const FAMILY_ORDER: SignFamily[] = [
  'warning',
  'orders',
  'motorway',
  'direction',
  'information',
  'road-works',
];

// The three files Step 28a expects marked `thirdPartyMark: true`, copied
// here verbatim rather than read from selection.json -- so a wrong or
// stale selection.json drifts loudly (thirdPartyMismatch) instead of
// silently agreeing with itself, same reasoning as EXPECTED_RULE_COUNTS
// above.
const EXPECTED_THIRD_PARTY_MARKS = [
  'signs/direction/england.svg',
  'signs/direction/english-heritage.svg',
  'signs/direction/national-trust.svg',
];

/** Every `.svg` file under `dir`, returned as a path relative to `public/`
 * (e.g. "signs/warning/crossroads.svg"), matching `signs.json`'s `image` and
 * `attribution.json`'s `file` fields exactly. */
function listSvgFiles(dir: string, relBase: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${relBase}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...listSvgFiles(join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      out.push(rel);
    }
  }
  return out;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main(): Promise<void> {
  const selection = SignSelectionFileSchema.parse(
    JSON.parse(readFileSync(join(OUT_DIR, 'selection.json'), 'utf8')),
  );
  const shapeRules = ShapeRulesFileSchema.parse(
    JSON.parse(readFileSync(join(OUT_DIR, 'shape-rules.json'), 'utf8')),
  );
  const hooks = HooksFileSchema.parse(
    JSON.parse(readFileSync(join(OUT_DIR, 'hooks.json'), 'utf8')),
  );

  const committedSignsFile = SignsFileSchema.parse(
    JSON.parse(readFileSync(join(OUT_DIR, 'signs.json'), 'utf8')),
  );
  const committedManifest = AttributionManifestSchema.parse(
    JSON.parse(readFileSync(join(OUT_DIR, 'attribution.json'), 'utf8')),
  );

  // Same publication/signing-system fetches scripts/ingest-signs.ts makes,
  // through the exact same cache paths, so `provenanceMismatch` (plan.md
  // amendment E14) can rebuild signs.json's publication/licence/
  // signingSystemText the same way the ingestion does.
  const publication = (await fetchContentApi(PUBLICATION_BASE_PATH, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

  // Re-parse the seven cached chapter bodies and re-scan the seven cached
  // rendered pages, through the exact cache paths scripts/ingest-signs.ts
  // uses.
  const chapters: KytsChapter[] = [];
  const renderedPages: string[] = [];
  for (const { slug } of selection.chapters) {
    const response = (await fetchContentApi(`${PUBLICATION_BASE_PATH}/${slug}`, {
      cacheDir: CACHE_DIR,
    })) as ContentApiResponse;
    chapters.push({ slug, pictures: parseChapter(response.details?.body ?? '') });

    const page = await fetchCachedText(chapterUrl(slug), join(CACHE_DIR, `page-${slug}.html`));
    renderedPages.push(page);
  }

  const licenceProblemsList = licenceProblems(renderedPages);
  for (const problem of licenceProblemsList) console.log(`licenceProblems: ${problem}`);

  // Every candidate's bytes, from its own media-id cache path (plan.md
  // amendment E11(1)) — same as scripts/ingest-signs.ts.
  const wanted = candidateFiles(chapters, selection);
  const fileBytes = new Map<string, Buffer>();
  for (const { file, url, mediaId } of wanted) {
    const bytes = await fetchCachedBytes(url, join(CACHE_DIR, 'pictures', mediaId, file));
    fileBytes.set(file, bytes);
  }

  const { signs: freshSigns } = selectSigns(chapters, selection, shapeRules, fileBytes, hooks);
  const freshById = new Map<string, Sign>(freshSigns.map((sign) => [sign.id, sign]));

  const signingSystem = (await fetchContentApi(`${PUBLICATION_BASE_PATH}/${SIGNING_SYSTEM_SLUG}`, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

  // The exact objects scripts/ingest-signs.ts would write today (plan.md
  // amendment E14).
  const freshPublication = {
    title: publication.title,
    url: PUBLICATION_URL,
    publicUpdatedAt: publication.public_updated_at ?? '',
  };
  const freshLicence = {
    name: 'Open Government Licence v3.0',
    url: OGL_URL,
    copyright: CROWN_LINE,
    statement: OGL_SENTENCE,
    thirdPartyStatement: THIRD_PARTY_SENTENCE,
  };
  const freshSigningSystemText = htmlToText(signingSystem.details?.body ?? '');
  const freshEntries: FreshManifestEntry[] = freshSigns.map((sign) => ({
    file: sign.image,
    sourceUrl: sign.source.imageUrl,
    chapterUrl: sign.source.chapterUrl,
    licence: sign.licence,
    copyright: CROWN_LINE,
    ...(sign.thirdPartyMark ? { thirdPartyMark: true as const } : {}),
  }));

  const committedSigns = committedSignsFile.signs;
  const committedById = new Map<string, Sign>(committedSigns.map((sign) => [sign.id, sign]));

  // --- signs / per-family counts (from the committed signs.json) ---------
  const byFamilyCount: Record<SignFamily, number> = {
    warning: 0,
    orders: 0,
    motorway: 0,
    direction: 0,
    information: 0,
    'road-works': 0,
  };
  for (const sign of committedSigns) byFamilyCount[sign.family] += 1;

  // --- files / bytesKiB / maxKiB (from the shipped .svg files on disk) ---
  const diskSvgRelPaths = existsSync(PUBLIC_DIR) ? listSvgFiles(PUBLIC_DIR, 'signs') : [];
  let totalBytes = 0;
  let maxBytes = 0;
  for (const rel of diskSvgRelPaths) {
    const size = statSync(join('public', rel)).size;
    totalBytes += size;
    if (size > maxBytes) maxBytes = size;
  }
  const bytesKiB = totalBytes / 1024;
  const maxKiB = maxBytes / 1024;

  // --- captionMismatch -----------------------------------------------------
  let captionMismatch = 0;
  const allIds = new Set<string>([...committedById.keys(), ...freshById.keys()]);
  for (const id of allIds) {
    const committed = committedById.get(id);
    const fresh = freshById.get(id);
    if (!committed || !fresh) {
      captionMismatch += 1;
      console.log(
        `captionMismatch: id only on one side: ${id} (committed=${Boolean(committed)} fresh=${Boolean(fresh)})`,
      );
      continue;
    }
    if (committed.name !== fresh.name || committed.meaning !== fresh.meaning) {
      captionMismatch += 1;
      console.log(`captionMismatch: ${id}`);
    }
  }

  // --- hashMismatch ----------------------------------------------------------
  let hashMismatch = 0;
  for (const entry of committedManifest.entries) {
    const file = entry.file.split('/').pop() ?? entry.file;
    const cachedBytes = fileBytes.get(file);
    const shippedPath = join('public', entry.file);
    const shippedBytes = existsSync(shippedPath) ? readFileSync(shippedPath) : null;
    const cachedSha = cachedBytes ? sha256(cachedBytes) : null;
    const shippedSha = shippedBytes ? sha256(shippedBytes) : null;
    const shasAgree =
      cachedSha !== null &&
      shippedSha !== null &&
      cachedSha === shippedSha &&
      shippedSha === entry.sha256;
    const lengthsAgree =
      cachedBytes !== undefined &&
      shippedBytes !== null &&
      cachedBytes.length === shippedBytes.length &&
      shippedBytes.length === entry.bytes;
    if (!shasAgree || !lengthsAgree) {
      hashMismatch += 1;
      console.log(`hashMismatch: ${entry.file}`);
    }
  }
  const publicAttributionPath = join(PUBLIC_DIR, 'attribution.json');
  const ukAttributionPath = join(OUT_DIR, 'attribution.json');
  const attributionsMatch =
    existsSync(publicAttributionPath) &&
    readFileSync(publicAttributionPath).equals(readFileSync(ukAttributionPath));
  if (!attributionsMatch) {
    hashMismatch += 1;
    console.log(
      `hashMismatch: ${publicAttributionPath} is not byte-identical to ${ukAttributionPath}`,
    );
  }

  // --- classMismatch -----------------------------------------------------
  let classMismatch = 0;
  for (const family of FAMILY_ORDER) {
    const expected = EXPECTED_RULE_COUNTS[family];
    const actual: Record<string, number> = {};
    for (const sign of committedSigns) {
      if (sign.family !== family) continue;
      actual[sign.rule] = (actual[sign.rule] ?? 0) + 1;
    }
    const keys = new Set<string>([...Object.keys(expected), ...Object.keys(actual)]);
    for (const rule of keys) {
      const diff = Math.abs((actual[rule] ?? 0) - (expected[rule] ?? 0));
      if (diff > 0) {
        classMismatch += diff;
        console.log(
          `classMismatch: ${family} ${rule} expected ${expected[rule] ?? 0}, got ${actual[rule] ?? 0}`,
        );
      }
    }
  }
  for (const [id, expectedRule] of Object.entries(EXPECTED_NAMED_RULES)) {
    const sign = committedById.get(id);
    if (!sign || sign.rule !== expectedRule) {
      classMismatch += 1;
      console.log(
        `classMismatch: named id ${id} expected rule ${expectedRule}, got ${sign?.rule ?? 'missing'}`,
      );
    }
  }
  for (const [id, committed] of committedById) {
    const fresh = freshById.get(id);
    if (!fresh) continue;
    if (
      committed.rule !== fresh.rule ||
      committed.shape !== fresh.shape ||
      JSON.stringify(committed.colours) !== JSON.stringify(fresh.colours)
    ) {
      classMismatch += 1;
      console.log(`classMismatch: ${id} committed classification differs from the fresh one`);
    }
  }

  // --- orphanFiles ---------------------------------------------------------
  const manifestFiles = new Set<string>(committedManifest.entries.map((entry) => entry.file));
  let orphanFiles = 0;
  for (const rel of diskSvgRelPaths) {
    if (!manifestFiles.has(rel)) {
      orphanFiles += 1;
      console.log(`orphanFiles: ${rel}`);
    }
  }

  // --- provenanceMismatch (plan.md amendment E14) -------------------------
  let provenanceMismatch = 0;
  for (const [id, committed] of committedById) {
    const fresh = freshById.get(id);
    if (!fresh) continue;
    if (
      committed.hookId !== fresh.hookId ||
      committed.image !== fresh.image ||
      JSON.stringify(committed.refs) !== JSON.stringify(fresh.refs) ||
      committed.licence !== fresh.licence ||
      committed.thirdPartyMark !== fresh.thirdPartyMark ||
      JSON.stringify(committed.source) !== JSON.stringify(fresh.source)
    ) {
      provenanceMismatch += 1;
      console.log(`provenanceMismatch: sign ${id} provenance differs from the fresh one`);
    }
  }

  const committedFileCounts = new Map<string, number>();
  for (const entry of committedManifest.entries) {
    committedFileCounts.set(entry.file, (committedFileCounts.get(entry.file) ?? 0) + 1);
  }
  const freshFileCounts = new Map<string, number>();
  for (const entry of freshEntries) {
    freshFileCounts.set(entry.file, (freshFileCounts.get(entry.file) ?? 0) + 1);
  }
  const committedEntryByFile = new Map(
    committedManifest.entries.map((entry) => [entry.file, entry]),
  );
  const freshEntryByFile = new Map(freshEntries.map((entry) => [entry.file, entry]));
  const manifestFileUnion = new Set<string>([
    ...committedFileCounts.keys(),
    ...freshFileCounts.keys(),
  ]);
  for (const file of manifestFileUnion) {
    const cCount = committedFileCounts.get(file) ?? 0;
    const fCount = freshFileCounts.get(file) ?? 0;
    if (cCount === 0 || fCount === 0) {
      provenanceMismatch += 1;
      console.log(`provenanceMismatch: manifest file only on one side: ${file}`);
      continue;
    }
    if (cCount > 1) {
      provenanceMismatch += 1;
      console.log(`provenanceMismatch: manifest file listed more than once (committed): ${file}`);
    }
    if (fCount > 1) {
      provenanceMismatch += 1;
      console.log(`provenanceMismatch: manifest file listed more than once (fresh): ${file}`);
    }
    if (cCount === 1 && fCount === 1) {
      const committedEntry = committedEntryByFile.get(file);
      const freshEntry = freshEntryByFile.get(file);
      if (
        committedEntry &&
        freshEntry &&
        (committedEntry.sourceUrl !== freshEntry.sourceUrl ||
          committedEntry.chapterUrl !== freshEntry.chapterUrl ||
          committedEntry.licence !== freshEntry.licence ||
          committedEntry.copyright !== freshEntry.copyright ||
          committedEntry.thirdPartyMark !== freshEntry.thirdPartyMark)
      ) {
        provenanceMismatch += 1;
        console.log(`provenanceMismatch: manifest entry differs from the fresh one: ${file}`);
      }
    }
  }

  if (JSON.stringify(committedSignsFile.publication) !== JSON.stringify(freshPublication)) {
    provenanceMismatch += 1;
    console.log('provenanceMismatch: publication differs from the fresh value');
  }
  if (JSON.stringify(committedSignsFile.licence) !== JSON.stringify(freshLicence)) {
    provenanceMismatch += 1;
    console.log('provenanceMismatch: licence differs from the fresh value');
  }
  if (committedSignsFile.signingSystemText !== freshSigningSystemText) {
    provenanceMismatch += 1;
    console.log('provenanceMismatch: signingSystemText differs from the fresh value');
  }

  // --- thirdPartyMismatch (Step 28a) --------------------------------------
  const expectedThirdPartyList = [...EXPECTED_THIRD_PARTY_MARKS].sort().join(',');
  const thirdPartyLists: [string, string][] = [
    [
      'committed signs',
      committedSigns
        .filter((sign) => sign.thirdPartyMark === true)
        .map((sign) => sign.image)
        .sort()
        .join(','),
    ],
    [
      'committed manifest',
      committedManifest.entries
        .filter((entry) => entry.thirdPartyMark === true)
        .map((entry) => entry.file)
        .sort()
        .join(','),
    ],
    [
      'fresh signs',
      freshSigns
        .filter((sign) => sign.thirdPartyMark === true)
        .map((sign) => sign.image)
        .sort()
        .join(','),
    ],
    [
      'fresh manifest',
      freshEntries
        .filter((entry) => entry.thirdPartyMark === true)
        .map((entry) => entry.file)
        .sort()
        .join(','),
    ],
  ];
  let thirdPartyMismatch = 0;
  for (const [label, list] of thirdPartyLists) {
    if (list !== expectedThirdPartyList) {
      thirdPartyMismatch += 1;
      console.log(`thirdPartyMismatch: ${label} marks ${list}, expected ${expectedThirdPartyList}`);
    }
  }

  const signs = committedSigns.length;
  const files = diskSvgRelPaths.length;
  const licenceProblemsCount = licenceProblemsList.length;

  console.log(
    `verify: signs=${signs} warning=${byFamilyCount.warning} orders=${byFamilyCount.orders} ` +
      `motorway=${byFamilyCount.motorway} direction=${byFamilyCount.direction} ` +
      `information=${byFamilyCount.information} road-works=${byFamilyCount['road-works']} ` +
      `files=${files} bytesKiB=${bytesKiB.toFixed(1)} maxKiB=${maxKiB.toFixed(1)} ` +
      `captionMismatch=${captionMismatch} hashMismatch=${hashMismatch} ` +
      `licenceProblems=${licenceProblemsCount} classMismatch=${classMismatch} ` +
      `orphanFiles=${orphanFiles} provenanceMismatch=${provenanceMismatch} ` +
      `thirdPartyMismatch=${thirdPartyMismatch}`,
  );

  const expectedCounts: Record<SignFamily, number> = {
    warning: 66,
    orders: 54,
    motorway: 22,
    direction: 25,
    information: 12,
    'road-works': 16,
  };
  let ok = signs === 195 && files === 195;
  for (const family of FAMILY_ORDER) ok = ok && byFamilyCount[family] === expectedCounts[family];
  ok =
    ok &&
    captionMismatch === 0 &&
    hashMismatch === 0 &&
    licenceProblemsCount === 0 &&
    classMismatch === 0 &&
    orphanFiles === 0 &&
    provenanceMismatch === 0 &&
    thirdPartyMismatch === 0;

  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
