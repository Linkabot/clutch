// Selects and classifies KYTS pictures into `signs.json`'s Sign objects:
// applies plan.md § Chosen signs' R1-R8 (R8 first — the paragraph-caption
// override for the STOP and GIVE WAY signs, amended P7), classifies every
// survivor with the exported `classifySign` against § Shape and colour
// rules' C1-C9 table (content/uk/signs/shape-rules.json — Step 16
// re-classifies committed signs by calling `classifySign` directly, plan.md
// amendment E11(3)), and builds the id, image path, refs, licence and
// source every Sign needs. `candidateFiles` tells scripts/ingest-signs.ts
// which pictures are worth fetching bytes for at all — every picture that
// R1-R5 alone would keep, plus every allow-listed file for the four
// allow-list families, each with its own `url`/`mediaId` so the caller
// fetches and caches the SELECTED picture's own bytes, never another
// picture that happens to share its file name (plan.md amendment E11(1))
// — before `selectSigns` re-derives R1-R5 itself once those bytes are
// known and additionally applies R6. `svgIsSafe` implements R6's content
// test (`<script`, an `on…=` attribute, or a remote `href`/`xlink:href`) on
// one already-fetched SVG's own text; R6's SIZE test (150 KiB) is checked
// inside `selectSigns` against the same file's byte length, `<=`, so a file
// of exactly 153,600 bytes is kept (plan.md amendment E11(6a)). A sign's
// `hookId` is the id of the hook in the `hooks` parameter whose
// `appliesTo.signIds` names it, else `null` (plan.md amendment E11(2) — no
// hard-coded table). No network access — the caller supplies the parsed
// chapters (scripts/lib/kyts-parse.ts), every candidate file's bytes, and
// the parsed hooks.json.
// Depends on: ../../src/content/schemas/signs.ts (Sign, SignColour,
// SignFamily, SignRule, SignSelectionFile, SignShape, ShapeRulesFile,
// HooksFile types), ./kyts-parse.ts (KytsPicture, type only).
// Depended on by: scripts/ingest-signs.ts, scripts/verify-signs.ts,
// tests/content/signs.test.ts (classifySign, from committed content only),
// tests/unit/kyts-select.test.ts (which also loads
// tests/fixtures/kyts-chapter.html).

import type {
  Sign,
  SignColour,
  SignFamily,
  SignRule,
  SignSelectionFile,
  SignShape,
  ShapeRulesFile,
  HooksFile,
} from '../../src/content/schemas/signs';
import type { KytsPicture } from './kyts-parse';

export interface KytsChapter {
  slug: string;
  pictures: KytsPicture[];
}

export interface FileRef {
  family: SignFamily;
  file: string;
  /** The selected picture's own gov.uk media URL — fetch bytes from here,
   * never by looking a file name up across chapters (plan.md amendment
   * E11(1)). */
  url: string;
  mediaId: string;
}

export interface DroppedPicture {
  file: string;
  family: SignFamily;
  reason: string;
}

export interface SelectSignsResult {
  signs: Sign[];
  dropped: DroppedPicture[];
}

const CHAPTER_URL_ROOT = 'https://www.gov.uk/government/publications/know-your-traffic-signs';
const MAX_SVG_BYTES = 153_600;

type AllowListFamily = 'motorway' | 'direction' | 'information' | 'road-works';
const ALLOW_LIST_FAMILIES: ReadonlySet<string> = new Set<AllowListFamily>([
  'motorway',
  'direction',
  'information',
  'road-works',
]);

function isAllowListFamily(family: SignFamily): family is AllowListFamily {
  return ALLOW_LIST_FAMILIES.has(family);
}

/** A sign's own memory hook (§ Memory hooks): the id of the first hook in
 * `hooks.hooks` whose `appliesTo` is a `signIds` list naming `signId`, else
 * `null`. Reads `hooks.json` itself (via the `hooks` parameter) rather than
 * a hard-coded table, so a future hooks.json edit is never silently out of
 * sync (plan.md amendment E11(2)). */
function hookIdFor(signId: string, hooks: HooksFile): string | null {
  for (const hook of hooks.hooks) {
    if ('signIds' in hook.appliesTo && hook.appliesTo.signIds.includes(signId)) {
      return hook.id;
    }
  }
  return null;
}

const SCRIPT_TAG = /<script/i;
const EVENT_ATTR = /\bon[a-z]+\s*=/i;
const REMOTE_HREF = /(?:xlink:href|href)\s*=\s*["']https?:/i;

/** R6's content-safety test (plan.md § Chosen signs): false when `text` —
 * an already-fetched SVG file's own source — contains a `<script` tag, an
 * `on…=` event-handler attribute, or an `href`/`xlink:href` pointing at an
 * absolute http(s) URL. */
export function svgIsSafe(text: string): boolean {
  if (SCRIPT_TAG.test(text)) return false;
  if (EVENT_ATTR.test(text)) return false;
  if (REMOTE_HREF.test(text)) return false;
  return true;
}

function fileStem(file: string): string {
  return file.replace(/\.svg$/i, '');
}

interface PictureContext {
  pic: KytsPicture;
  family: SignFamily;
  chapterSlug: string;
}

interface R8Override {
  caption: string;
  name: string;
  meaning: string;
}

function familyBySlug(selection: SignSelectionFile): Map<string, SignFamily> {
  return new Map(selection.chapters.map((chapter) => [chapter.slug, chapter.family]));
}

/** R8 (plan.md amended P7), applied before every other rule: for the two
 * named files in `selection.r8NamedParagraphCaptions`, the caption comes
 * from the `<p>` `kyts-parse.ts` recorded immediately before the figure,
 * not from a `<figcaption>` (the STOP figure has none at all; the GIVE WAY
 * figure's own figcaption, "(alternative in Wales)", is not used). Throws —
 * the whole ingestion fails, per the plan — when the named picture is
 * missing from its chapter, or its preceding paragraph is missing or
 * doesn't start with the expected prefix. An entry whose named chapter
 * isn't even present in `chapters` is skipped rather than treated as fatal:
 * the real ingestion always supplies all seven chapters, so this only
 * matters for a caller (a unit test) that deliberately passes a subset. */
function buildR8Overrides(
  chapters: KytsChapter[],
  selection: SignSelectionFile,
): Map<KytsPicture, R8Override> {
  const overrides = new Map<KytsPicture, R8Override>();
  const picturesBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter.pictures]));

  for (const entry of selection.r8NamedParagraphCaptions) {
    const pictures = picturesBySlug.get(entry.chapter);
    if (!pictures) continue;
    const pic = pictures.find((candidate) => candidate.file === entry.file);
    if (!pic) {
      throw new Error(`R8: picture not found for ${entry.chapter}/${entry.file}`);
    }
    const paragraph = pic.precedingParagraphText;
    if (!paragraph || !paragraph.startsWith(entry.paragraphPrefix)) {
      throw new Error(`R8: paragraph missing or not immediately preceding ${entry.file}`);
    }
    const colonIndex = paragraph.indexOf(':');
    const name = colonIndex >= 0 ? paragraph.slice(0, colonIndex) : paragraph;
    overrides.set(pic, { caption: paragraph, name, meaning: paragraph });
  }

  return overrides;
}

/** Walks `chapters` in chapter order, then document order within a
 * chapter, into one flat list of `{ pic, family, chapterSlug }`: for the
 * four allow-list families this is exactly the allow-listed files in the
 * plan's own list order (throwing when a listed file isn't found in its
 * named chapter — "sits in another chapter" or is missing entirely, § Chosen
 * signs R7); for warning and orders it is every picture, in document
 * order. */
function orderPictures(chapters: KytsChapter[], selection: SignSelectionFile): PictureContext[] {
  const families = familyBySlug(selection);
  const ordered: PictureContext[] = [];

  for (const chapter of chapters) {
    const family = families.get(chapter.slug);
    if (!family) throw new Error(`unknown chapter slug: ${chapter.slug}`);

    if (isAllowListFamily(family)) {
      const allowList = selection.allowLists[family];
      for (const file of allowList) {
        const pic = chapter.pictures.find((candidate) => candidate.file === file);
        if (!pic) {
          throw new Error(`R7: allow-listed file not found in ${chapter.slug}: ${file}`);
        }
        ordered.push({ pic, family, chapterSlug: chapter.slug });
      }
    } else {
      for (const pic of chapter.pictures) {
        ordered.push({ pic, family, chapterSlug: chapter.slug });
      }
    }
  }

  return ordered;
}

type RuleCheckResult =
  { ok: true; caption: string; name: string; meaning: string } | { ok: false; reason: string };

/** R1-R5, in that numeric order, against one picture. Pure — it reads
 * `selectedFileNames`/`selectedCaptionsByFamily` but never writes them;
 * `markSelected` below commits a picture only once it is fully kept (R6
 * included), so a picture that fails R6 never blocks a later duplicate
 * from R4. R6 (size and content safety) needs the file's bytes, so it is
 * checked by the caller instead. */
function evaluateR1toR5(
  ctx: PictureContext,
  selection: SignSelectionFile,
  overrides: Map<KytsPicture, R8Override>,
  selectedFileNames: ReadonlySet<string>,
  selectedCaptionsByFamily: ReadonlyMap<SignFamily, ReadonlySet<string>>,
): RuleCheckResult {
  const override = overrides.get(ctx.pic);
  const caption = override?.caption ?? ctx.pic.caption;

  if (caption === '') return { ok: false, reason: 'R1-empty-caption' };
  if (!override && selection.r2CaptionPrefixes.some((prefix) => caption.startsWith(prefix))) {
    return { ok: false, reason: 'R2-annotation-caption' };
  }
  if (selection.r3PlateFiles.some((f) => f.family === ctx.family && f.file === ctx.pic.file)) {
    return { ok: false, reason: 'R3-plate-file' };
  }
  if (selectedFileNames.has(ctx.pic.file)) {
    return { ok: false, reason: 'R4-duplicate-file' };
  }
  if (selectedCaptionsByFamily.get(ctx.family)?.has(caption)) {
    return { ok: false, reason: 'R4-duplicate-caption' };
  }
  if (
    ctx.family === 'motorway' &&
    selection.r5SubHeadingPrefixes.some((prefix) => ctx.pic.subHeading.startsWith(prefix))
  ) {
    return { ok: false, reason: 'R5-motorway-subheading' };
  }

  return {
    ok: true,
    caption,
    name: override?.name ?? caption,
    meaning: override?.meaning ?? caption,
  };
}

function markSelected(
  ctx: PictureContext,
  caption: string,
  selectedFileNames: Set<string>,
  selectedCaptionsByFamily: Map<SignFamily, Set<string>>,
): void {
  selectedFileNames.add(ctx.pic.file);
  const familyCaptions = selectedCaptionsByFamily.get(ctx.family) ?? new Set<string>();
  familyCaptions.add(caption);
  selectedCaptionsByFamily.set(ctx.family, familyCaptions);
}

/** Every `{ family, file }` `selectSigns` will need bytes for: pictures
 * that pass R1-R5 alone (R6 not yet checked here — it needs the very bytes
 * this function exists to let the caller go and fetch), restricted to the
 * allow-listed files for the four allow-list families. Throws the same way
 * `selectSigns` does when an allow-listed file fails R1-R5 or is missing —
 * a run that would fail there is not worth fetching bytes for at all. */
export function candidateFiles(
  chaptersInOrder: KytsChapter[],
  selection: SignSelectionFile,
): FileRef[] {
  const ordered = orderPictures(chaptersInOrder, selection);
  const overrides = buildR8Overrides(chaptersInOrder, selection);
  const selectedFileNames = new Set<string>();
  const selectedCaptionsByFamily = new Map<SignFamily, Set<string>>();
  const files: FileRef[] = [];

  for (const ctx of ordered) {
    const result = evaluateR1toR5(
      ctx,
      selection,
      overrides,
      selectedFileNames,
      selectedCaptionsByFamily,
    );
    if (result.ok) {
      markSelected(ctx, result.caption, selectedFileNames, selectedCaptionsByFamily);
      files.push({
        family: ctx.family,
        file: ctx.pic.file,
        url: ctx.pic.url,
        mediaId: ctx.pic.mediaId,
      });
    } else if (isAllowListFamily(ctx.family)) {
      throw new Error(
        `R7: allow-listed file ${ctx.family}/${ctx.pic.file} failed ${result.reason}`,
      );
    }
  }

  return files;
}

interface ShapeMatchContext {
  family: SignFamily;
  file: string;
  caption: string;
  subHeading: string;
}

type ShapeRule = ShapeRulesFile['rules'][number];
type ShapeRuleMatch = ShapeRule['match'];

function matchesShapeRule(match: ShapeRuleMatch, ctx: ShapeMatchContext): boolean {
  if (match.family !== undefined && match.family !== ctx.family) return false;
  if (match.families !== undefined && !match.families.includes(ctx.family)) return false;
  if (
    match.files !== undefined &&
    !match.files.some((f) => f.family === ctx.family && f.file === ctx.file)
  ) {
    return false;
  }
  if (
    match.captionStartsWith !== undefined &&
    !match.captionStartsWith.some((prefix) => ctx.caption.startsWith(prefix))
  ) {
    return false;
  }
  if (
    match.subHeadingContains !== undefined &&
    !ctx.subHeading.includes(match.subHeadingContains)
  ) {
    return false;
  }
  return true;
}

/** C7's route-colour test (§ Shape and colour rules): lower-cases the
 * caption; N = it contains `containsToken` ("non-primary route"); P =
 * after deleting every occurrence of `containsToken` it still contains
 * `remainderToken` ("primary route"). Both → "green-white"; P only →
 * "green"; N only → "white"; neither → `null` (C7 does not match; the
 * picture falls through to C8/C9). */
function routeColourOutcome(
  caption: string,
  test: { containsToken: string; remainderToken: string },
): 'green' | 'white' | 'green-white' | null {
  const lower = caption.toLowerCase();
  const containsN = lower.includes(test.containsToken);
  const withoutToken = lower.split(test.containsToken).join('');
  const containsP = withoutToken.includes(test.remainderToken);
  if (containsP && containsN) return 'green-white';
  if (containsP) return 'green';
  if (containsN) return 'white';
  return null;
}

/** Classifies one sign with § Shape and colour rules' C1-C9 table, tried in
 * `shapeRules.rules`' own order (the first match wins, exactly as
 * committed in content/uk/signs/shape-rules.json). C7 carries no
 * shape/colours of its own — a match there only counts once
 * `routeColourOutcome` resolves to one of its three named outcomes; a
 * `null` outcome falls through to the next rule (C8, then C9), same as any
 * other non-match. */
export function classifySign(
  ctx: ShapeMatchContext,
  shapeRules: ShapeRulesFile,
): { rule: SignRule; shape: SignShape; colours: SignColour[] } {
  for (const rule of shapeRules.rules) {
    if (!matchesShapeRule(rule.match, ctx)) continue;

    if (rule.id === 'C7') {
      if (!rule.match.routeColourTest) continue;
      const outcome = routeColourOutcome(ctx.caption, rule.match.routeColourTest);
      if (!outcome) continue;
      const key = `C7-${outcome}` as const;
      const resolved = rule.outcomes?.[key];
      if (!resolved) throw new Error(`shape-rules.json is missing outcome ${key}`);
      return { rule: key, shape: resolved.shape, colours: resolved.colours };
    }

    if (rule.shape === undefined || rule.colours === undefined) {
      throw new Error(`shape rule ${rule.id} has no shape/colours`);
    }
    return { rule: rule.id, shape: rule.shape, colours: rule.colours };
  }

  throw new Error(`no shape rule matched ${ctx.family}/${ctx.file}`);
}

/**
 * Applies R1-R8 (§ Chosen signs, amended P7) and classifies every survivor
 * with C1-C9 (§ Shape and colour rules), returning the finished `Sign`
 * objects in chapter/document order plus every dropped picture and why.
 * `fileBytes` should hold an entry for every file `candidateFiles` names —
 * `selectSigns` re-derives R1-R5 itself (`evaluateR1toR5`) rather than
 * trusting the caller's candidate list, so a caller that fetched the wrong
 * set only loses signs to an "R6-missing-bytes" drop instead of silently
 * mismatching. A listed allow-list file that fails any rule, R1-R6
 * included, throws (§ Chosen signs R7): those files were hand-verified, so
 * any failure means gov.uk's content changed and the run must stop, not
 * quietly ship 194 signs. `hooks` is the parsed hooks.json, used only to
 * resolve each sign's own `hookId` (`hookIdFor`, plan.md amendment E11(2)).
 */
export function selectSigns(
  chaptersInOrder: KytsChapter[],
  selection: SignSelectionFile,
  shapeRules: ShapeRulesFile,
  fileBytes: Map<string, Buffer>,
  hooks: HooksFile,
): SelectSignsResult {
  const ordered = orderPictures(chaptersInOrder, selection);
  const overrides = buildR8Overrides(chaptersInOrder, selection);
  const selectedFileNames = new Set<string>();
  const selectedCaptionsByFamily = new Map<SignFamily, Set<string>>();
  const signs: Sign[] = [];
  const dropped: DroppedPicture[] = [];

  for (const ctx of ordered) {
    const isAllowListed = isAllowListFamily(ctx.family);
    const basic = evaluateR1toR5(
      ctx,
      selection,
      overrides,
      selectedFileNames,
      selectedCaptionsByFamily,
    );

    let result: RuleCheckResult = basic;
    if (basic.ok) {
      const bytes = fileBytes.get(ctx.pic.file);
      if (!bytes) result = { ok: false, reason: 'R6-missing-bytes' };
      else if (bytes.length > MAX_SVG_BYTES) result = { ok: false, reason: 'R6-size' };
      else if (!svgIsSafe(bytes.toString('utf8'))) result = { ok: false, reason: 'R6-unsafe' };
    }

    if (!result.ok) {
      if (isAllowListed) {
        throw new Error(
          `R7: allow-listed file ${ctx.family}/${ctx.pic.file} failed ${result.reason}`,
        );
      }
      dropped.push({ file: ctx.pic.file, family: ctx.family, reason: result.reason });
      continue;
    }

    markSelected(ctx, result.caption, selectedFileNames, selectedCaptionsByFamily);

    const { rule, shape, colours } = classifySign(
      {
        family: ctx.family,
        file: ctx.pic.file,
        caption: result.caption,
        subHeading: ctx.pic.subHeading,
      },
      shapeRules,
    );
    const id = `${ctx.family}-${fileStem(ctx.pic.file)}`;

    signs.push({
      id,
      name: result.name,
      meaning: result.meaning,
      family: ctx.family,
      shape,
      colours,
      rule,
      hookId: hookIdFor(id, hooks),
      image: `signs/${ctx.family}/${ctx.pic.file}`,
      refs: [{ kind: 'section', slug: 'traffic-signs' }],
      licence: 'Open Government Licence v3.0',
      source: {
        chapterSlug: ctx.chapterSlug,
        chapterUrl: `${CHAPTER_URL_ROOT}/${ctx.chapterSlug}`,
        imageUrl: ctx.pic.url,
        subHeading: ctx.pic.subHeading,
      },
    });
  }

  return { signs, dropped };
}
