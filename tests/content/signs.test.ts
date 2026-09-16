// Content test: content/uk/signs/signs.json and attribution.json (Step 15's
// ingestion output) parse against their Zod schemas and match plan.md's
// § Chosen signs (amended P7: 195 signs, family counts 66/54/22/25/12/16,
// name === meaning for every sign except the two R8 ids) -- every sign's
// image exists under public/ within the 150 KiB budget, the attribution
// manifest accounts for every public/signs/**/*.svg file byte-for-byte, and
// every ref resolves to a Highway Code section. It also re-classifies every
// committed sign with scripts/lib/kyts-select.ts's exported `classifySign`
// against content/uk/signs/shape-rules.json and checks the result against
// both the sign's own stored rule/shape/colours and § Shape and colour
// rules' fixed per-rule counts (amended: orders C3 20, C4 6, C1 2, C9 26),
// checks every rule sentence and the exceptions sentence is a verbatim
// substring of signingSystemText, checks every content/uk/signs/hooks.json
// cite against signingSystemText or the named sign's caption, and checks
// every Decoder example file against its pair's shape and colour.
// Depends on: vitest, node:fs, node:crypto, node:path, src/content/schemas,
// scripts/lib/kyts-select.ts, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SignsFileSchema,
  AttributionManifestSchema,
  type Sign,
  type SignsFile,
  type AttributionManifest,
  type ShapeRulesFile,
  type HooksFile,
} from '../../src/content/schemas';
import { classifySign } from '../../scripts/lib/kyts-select';
import { CONTENT_ROOT, readJson } from './helpers';

const PUBLIC_ROOT = join(CONTENT_ROOT, '..', '..', 'public');
const MAX_SVG_BYTES = 153_600;

// The two signs P7 named, whose `meaning` is the whole paragraph while
// `name` is only the text before its first colon.
const R8_IDS = ['orders-stop-sign-and-road-marking', 'orders-give-way-road-marking'];

const signsFile = readJson<SignsFile>('signs/signs.json');
const manifest = readJson<AttributionManifest>('signs/attribution.json');
const shapeRules = readJson<ShapeRulesFile>('signs/shape-rules.json');
const hooksFile = readJson<HooksFile>('signs/hooks.json');

/** The sign whose `image` ends with `/<file>` (a file name, e.g.
 * "no-entry.svg"), matching how content/uk/signs/hooks.json's `caption`
 * cites and content/uk/signs/shape-rules.json's decoderPairs examples name
 * a sign. Throws (failing the calling test) rather than returning
 * `undefined`, since every file named by either JSON file must exist. */
function signByImageFile(file: string): Sign {
  const sign = signsFile.signs.find((candidate) => candidate.image.endsWith(`/${file}`));
  if (!sign) throw new Error(`no sign has an image ending in /${file}`);
  return sign;
}

/** Every `.svg` file under `dir`, returned as a path relative to `public/`
 * (e.g. "signs/warning/crossroads.svg"), matching `signs.json`'s `image`
 * and `attribution.json`'s `file` fields exactly. */
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

describe('content/uk/signs/signs.json', () => {
  it('parses against SignsFileSchema', () => {
    expect(() => SignsFileSchema.parse(signsFile)).not.toThrow();
  });

  it('has exactly 195 signs with unique ids', () => {
    expect(signsFile.signs.length).toBe(195);
    expect(new Set(signsFile.signs.map((sign) => sign.id)).size).toBe(195);
  });

  it('has family counts 66/54/22/25/12/16 (P7)', () => {
    const counts: Record<string, number> = {};
    for (const sign of signsFile.signs) {
      counts[sign.family] = (counts[sign.family] ?? 0) + 1;
    }
    expect(counts).toEqual({
      warning: 66,
      orders: 54,
      motorway: 22,
      direction: 25,
      information: 12,
      'road-works': 16,
    });
  });

  it('has name === meaning for every sign except the two R8 ids (P7)', () => {
    for (const sign of signsFile.signs) {
      if (R8_IDS.includes(sign.id)) {
        expect(sign.meaning.startsWith(`${sign.name}:`)).toBe(true);
      } else {
        expect(sign.meaning).toBe(sign.name);
      }
    }
  });

  it('has every image on disk under public/, at or under 150 KiB', () => {
    for (const sign of signsFile.signs) {
      const filePath = join(PUBLIC_ROOT, sign.image);
      expect(existsSync(filePath)).toBe(true);
      expect(statSync(filePath).size).toBeLessThanOrEqual(MAX_SVG_BYTES);
    }
  });

  it('has every ref slug present as a section in highway-code/index.json', () => {
    const index = readJson<{ sections: { slug: string }[] }>('highway-code/index.json');
    const sectionSlugs = new Set(index.sections.map((section) => section.slug));
    for (const sign of signsFile.signs) {
      for (const ref of sign.refs) {
        expect(sectionSlugs.has(ref.slug)).toBe(true);
      }
    }
  });
});

describe('content/uk/signs/attribution.json', () => {
  it('parses against AttributionManifestSchema', () => {
    expect(() => AttributionManifestSchema.parse(manifest)).not.toThrow();
  });

  it('lists every sign image exactly once, 195 entries total', () => {
    expect(manifest.entries.length).toBe(195);
    const fileCounts = new Map<string, number>();
    for (const entry of manifest.entries) {
      fileCounts.set(entry.file, (fileCounts.get(entry.file) ?? 0) + 1);
    }
    for (const sign of signsFile.signs) {
      expect(fileCounts.get(sign.image)).toBe(1);
    }
  });

  it('lists exactly the public/signs/**/*.svg files on disk', () => {
    const onDisk = listSvgFiles(join(PUBLIC_ROOT, 'signs'), 'signs').sort();
    const listed = manifest.entries.map((entry) => entry.file).sort();
    expect(onDisk).toEqual(listed);
  });

  it('has sha256 and byte length matching every file on disk', () => {
    for (const entry of manifest.entries) {
      const bytes = readFileSync(join(PUBLIC_ROOT, entry.file));
      expect(bytes.length).toBe(entry.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
  });
});

describe('re-classifying committed signs against shape-rules.json', () => {
  it('gives every sign its stored rule, shape and colours', () => {
    for (const sign of signsFile.signs) {
      const file = sign.image.split('/').pop() ?? '';
      const result = classifySign(
        { family: sign.family, file, caption: sign.name, subHeading: sign.source.subHeading },
        shapeRules,
      );
      expect(result.rule).toBe(sign.rule);
      expect(result.shape).toBe(sign.shape);
      expect(result.colours).toEqual(sign.colours);
    }
  });

  it('has the fixed per-rule counts from § Shape and colour rules (P7)', () => {
    const counts: Record<string, Record<string, number>> = {};
    for (const sign of signsFile.signs) {
      counts[sign.family] ??= {};
      counts[sign.family][sign.rule] = (counts[sign.family][sign.rule] ?? 0) + 1;
    }
    expect(counts.warning).toEqual({ C2: 62, C1: 4 });
    expect(counts.orders).toEqual({ C3: 20, C4: 6, C1: 2, C9: 26 });
    expect(counts.motorway).toEqual({ C6: 14, C5: 4, C1: 4 });
    expect(counts.direction).toEqual({
      'C7-green': 2,
      'C7-white': 2,
      'C7-green-white': 2,
      C9: 19,
    });
    expect(counts.information).toEqual({ 'C7-green': 1, 'C7-white': 1, C8: 10 });
    expect(counts['road-works']).toEqual({ C9: 16 });
  });

  it('has every rule sentence and the exceptions sentence as a substring of signingSystemText', () => {
    const sentences: string[] = [shapeRules.exceptionsSentence];
    for (const rule of shapeRules.rules) {
      if (rule.sentences) sentences.push(...rule.sentences);
      if (rule.outcomes) {
        for (const outcome of Object.values(rule.outcomes)) sentences.push(...outcome.sentences);
      }
    }
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(signsFile.signingSystemText).toContain(sentence);
    }
  });

  it("has every Decoder example file matching its pair's shape and colour", () => {
    const pairsWithExamples = shapeRules.decoderPairs.filter((pair) => pair.examples.length > 0);
    expect(pairsWithExamples.length).toBe(6);
    for (const pair of pairsWithExamples) {
      for (const file of pair.examples) {
        const sign = signByImageFile(file);
        expect(sign.shape).toBe(pair.shape);
        expect(sign.colours).toContain(pair.colour);
      }
    }
  });
});

describe('content/uk/signs/hooks.json cites', () => {
  it('has every signing-system cite as a substring of signingSystemText', () => {
    for (const hook of hooksFile.hooks) {
      for (const cite of hook.cites) {
        if (cite.source === 'signing-system') {
          expect(signsFile.signingSystemText).toContain(cite.sentence);
        }
      }
    }
  });

  it("has every caption cite as a substring of the named sign's meaning", () => {
    for (const hook of hooksFile.hooks) {
      for (const cite of hook.cites) {
        if (cite.source === 'caption') {
          const sign = signByImageFile(cite.file);
          expect(sign.meaning).toContain(cite.sentence);
        }
      }
    }
  });

  it('has exactly 4 signs with a non-null hookId', () => {
    expect(signsFile.signs.filter((sign) => sign.hookId !== null).length).toBe(4);
  });
});
