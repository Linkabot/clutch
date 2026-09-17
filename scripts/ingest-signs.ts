// Fetches every real KYTS chapter, scans each rendered page for licence
// exceptions, selects and classifies the ~200 signs plan.md § Chosen signs
// names, and writes content/uk/signs/signs.json,
// content/uk/signs/attribution.json (and a byte-identical copy at
// public/signs/attribution.json, plan.md amendment E10) plus every chosen
// picture under public/signs/<family>/. NOT run by Step 14: only Step 15
// runs it against the live API (content/.cache/kyts/ makes a second run
// free, and CLUTCH_OFFLINE=1 makes an offline run fail loudly with no
// cache to replay from — Step 14's own check proves that, before any
// network access exists to replay). Reaches gov.uk only through
// scripts/lib/govuk.ts, the one module in the repo allowed to call fetch.
// Fails the run (throws, caught below) on any licence problem, on a
// missing/failing allow-listed file (scripts/lib/kyts-select.ts's R7), on
// a missing or misplaced R8 paragraph, on a selection.json thirdPartyMarks
// entry that matches no selected sign (Step 28a), when the final per-family
// or total sign count doesn't exactly match content/uk/signs/selection.json's
// expectedCounts/expectedTotal, or when the assembled `signs.json`/
// attribution manifest fails to validate against their schemas — nothing
// is written to public/signs/ or content/uk/signs/ until every one of
// those has already passed (plan.md amendment E11(4)). Every candidate
// picture's bytes are fetched from ITS OWN gov.uk media URL and cached by
// media id (`candidateFiles`' own `url`/`mediaId`, plan.md amendment
// E11(1)) — never looked up by file name across chapters, which could
// silently pair a sign with another chapter's bytes if a file name were
// ever repeated.
// Depends on: node:crypto, node:fs, node:path, ./lib/govuk.ts
// (fetchContentApi, fetchCachedText, fetchCachedBytes), ./lib/kyts-parse.ts
// (parseChapter), ./lib/kyts-select.ts (candidateFiles, selectSigns,
// KytsChapter), ./lib/kyts-licence.ts (licenceProblems, CROWN_LINE,
// OGL_SENTENCE, THIRD_PARTY_SENTENCE), ../src/content/text.ts (htmlToText),
// ../src/content/schemas/signs.ts (SignSelectionFileSchema,
// ShapeRulesFileSchema, HooksFileSchema, SignsFileSchema,
// AttributionManifestSchema, AttributionManifest, Sign types).
// Depended on by: `npm run ingest:signs` (package.json; run in Step 15).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
import type { AttributionManifest } from '../src/content/schemas/signs';

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

function chapterUrl(slug: string): string {
  return `${PUBLICATION_URL}/${slug}`;
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

  const publication = (await fetchContentApi(PUBLICATION_BASE_PATH, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

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

  const signingSystem = (await fetchContentApi(`${PUBLICATION_BASE_PATH}/${SIGNING_SYSTEM_SLUG}`, {
    cacheDir: CACHE_DIR,
  })) as ContentApiResponse;

  const problems = licenceProblems(renderedPages);
  if (problems.length > 0) {
    throw new Error(`licence scan found ${problems.length} problem(s):\n${problems.join('\n')}`);
  }

  // Every candidate's own url/mediaId (plan.md amendment E11(1)): fetched
  // and cached by media id, never looked up by file name across chapters.
  const wanted = candidateFiles(chapters, selection);
  const fileBytes = new Map<string, Buffer>();
  for (const { file, url, mediaId } of wanted) {
    const bytes = await fetchCachedBytes(url, join(CACHE_DIR, 'pictures', mediaId, file));
    fileBytes.set(file, bytes);
  }

  const { signs } = selectSigns(chapters, selection, shapeRules, fileBytes, hooks);

  const counts: Partial<Record<string, number>> = {};
  for (const sign of signs) counts[sign.family] = (counts[sign.family] ?? 0) + 1;
  for (const family of selection.families) {
    const expected = selection.expectedCounts[family];
    const actual = counts[family] ?? 0;
    if (actual !== expected) {
      throw new Error(`expected ${expected} ${family} signs, got ${actual}`);
    }
  }
  if (signs.length !== selection.expectedTotal) {
    throw new Error(`expected ${selection.expectedTotal} signs total, got ${signs.length}`);
  }

  // Every sign paired with its own already-fetched bytes, computed once and
  // reused for both the manifest below and the file writes further down —
  // never re-derived, so the two can't diverge.
  const signBytes = signs.map((sign) => {
    const file = sign.image.split('/').pop();
    const bytes = file ? fileBytes.get(file) : undefined;
    if (!file || !bytes) throw new Error(`missing fetched bytes for ${sign.image}`);
    return { sign, bytes };
  });

  // Build both output objects and validate them BEFORE touching the
  // filesystem (plan.md amendment E11(4)): public/signs/ is deleted only
  // once both are known-good.
  const entries: AttributionManifest['entries'] = signBytes.map(({ sign, bytes }) => ({
    file: sign.image,
    sourceUrl: sign.source.imageUrl,
    chapterUrl: sign.source.chapterUrl,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    licence: sign.licence,
    copyright: CROWN_LINE,
    ...(sign.thirdPartyMark ? { thirdPartyMark: true as const } : {}),
  }));

  const signsFile = SignsFileSchema.parse({
    publication: {
      title: publication.title,
      url: PUBLICATION_URL,
      publicUpdatedAt: publication.public_updated_at ?? '',
    },
    licence: {
      name: 'Open Government Licence v3.0',
      url: OGL_URL,
      copyright: CROWN_LINE,
      statement: OGL_SENTENCE,
      thirdPartyStatement: THIRD_PARTY_SENTENCE,
    },
    signingSystemText: htmlToText(signingSystem.details?.body ?? ''),
    signs,
  });
  const attributionFile = AttributionManifestSchema.parse({ entries });

  if (existsSync(PUBLIC_DIR)) rmSync(PUBLIC_DIR, { recursive: true, force: true });

  for (const { sign, bytes } of signBytes) {
    const destPath = join(PUBLIC_DIR, sign.image.slice('signs/'.length));
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, bytes);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'signs.json'), `${JSON.stringify(signsFile, null, 2)}\n`, 'utf8');

  const attributionJson = `${JSON.stringify(attributionFile, null, 2)}\n`;
  writeFileSync(join(OUT_DIR, 'attribution.json'), attributionJson, 'utf8');
  writeFileSync(join(PUBLIC_DIR, 'attribution.json'), attributionJson, 'utf8');

  const bytesKiB = entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1024;
  console.log(
    `ingest: signs=${signs.length} files=${entries.length} bytesKiB=${bytesKiB.toFixed(1)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
