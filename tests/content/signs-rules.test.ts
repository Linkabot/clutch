// Content test: the three road-signs JSON files committed in Step 13
// (shape-rules.json, hooks.json, selection.json) parse against their Zod
// schemas, and match the counts fixed by plan.md § Shape and colour rules,
// § Memory hooks and § Chosen signs -- including plan amendment P7 (STOP
// and GIVE WAY join the set: orders count 52 -> 54, C1 gains 2 files) and
// selection.json's thirdPartyMarks holding exactly the three emblem
// pictures, in order (Step 28a).
// Depends on: vitest, src/content/schemas, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { describe, it, expect } from 'vitest';
import {
  ShapeRulesFileSchema,
  HooksFileSchema,
  SignSelectionFileSchema,
  type ShapeRulesFile,
  type HooksFile,
  type SignSelectionFile,
} from '../../src/content/schemas';
import { readJson } from './helpers';

describe('content/uk/signs/shape-rules.json', () => {
  const shapeRules = readJson<ShapeRulesFile>('signs/shape-rules.json');

  it('parses against ShapeRulesFileSchema', () => {
    expect(() => ShapeRulesFileSchema.parse(shapeRules)).not.toThrow();
  });

  it('has 9 top-level rules (C1-C9), with C7 split into its 3 outcomes', () => {
    expect(shapeRules.rules.map((rule) => rule.id)).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
      'C8',
      'C9',
    ]);
    const c7 = shapeRules.rules.find((rule) => rule.id === 'C7');
    expect(Object.keys(c7?.outcomes ?? {}).sort()).toEqual(
      ['C7-green', 'C7-green-white', 'C7-white'].sort(),
    );
  });

  it('has 7 Decoder rows, 6 of them with 3 example files', () => {
    expect(shapeRules.decoderPairs.length).toBe(7);
    expect(shapeRules.decoderPairs.filter((pair) => pair.examples.length === 3).length).toBe(6);
    expect(shapeRules.decoderPairs.filter((pair) => pair.examples.length === 0).length).toBe(1);
  });

  it('C1 has 4 warning files, 2 orders files (P7) and 4 motorway files', () => {
    const c1 = shapeRules.rules.find((rule) => rule.id === 'C1');
    const files = (c1?.match as { files: { family: string; file: string }[] }).files;
    expect(files.filter((f) => f.family === 'warning').length).toBe(4);
    expect(files.filter((f) => f.family === 'motorway').length).toBe(4);
    const ordersFiles = files.filter((f) => f.family === 'orders');
    expect(ordersFiles.map((f) => f.file)).toEqual([
      'stop-sign-and-road-marking.svg',
      'give-way-road-marking.svg',
    ]);
  });
});

describe('content/uk/signs/hooks.json', () => {
  const hooksFile = readJson<HooksFile>('signs/hooks.json');

  it('parses against HooksFileSchema', () => {
    expect(() => HooksFileSchema.parse(hooksFile)).not.toThrow();
  });

  it('has 16 unique hook ids', () => {
    const ids = hooksFile.hooks.map((hook) => hook.id);
    expect(ids.length).toBe(16);
    expect(new Set(ids).size).toBe(16);
  });
});

describe('content/uk/signs/selection.json', () => {
  const selection = readJson<SignSelectionFile>('signs/selection.json');

  it('parses against SignSelectionFileSchema', () => {
    expect(() => SignSelectionFileSchema.parse(selection)).not.toThrow();
  });

  it('has the 8 R2 caption prefixes', () => {
    expect(selection.r2CaptionPrefixes.length).toBe(8);
  });

  it('has the 6 R3 plate files', () => {
    expect(selection.r3PlateFiles.length).toBe(6);
  });

  it('has 2 R8 named-paragraph-caption entries (P7)', () => {
    expect(selection.r8NamedParagraphCaptions.length).toBe(2);
    expect(selection.r8NamedParagraphCaptions.map((entry) => entry.file)).toEqual([
      'stop-sign-and-road-marking.svg',
      'give-way-road-marking.svg',
    ]);
  });

  it('has the allow-list lengths 22/25/12/16', () => {
    expect(selection.allowLists.motorway.length).toBe(22);
    expect(selection.allowLists.direction.length).toBe(25);
    expect(selection.allowLists.information.length).toBe(12);
    expect(selection.allowLists['road-works'].length).toBe(16);
  });

  it('has the expected per-family counts 66/54/22/25/12/16 and total 195 (P7)', () => {
    expect(selection.expectedCounts).toEqual({
      warning: 66,
      orders: 54,
      motorway: 22,
      direction: 25,
      information: 12,
      'road-works': 16,
    });
    expect(selection.expectedTotal).toBe(195);
  });

  it('has the 3 third-party marks, in order (Step 28a)', () => {
    expect(selection.thirdPartyMarks).toEqual([
      { family: 'direction', file: 'national-trust.svg' },
      { family: 'direction', file: 'english-heritage.svg' },
      { family: 'direction', file: 'england.svg' },
    ]);
  });
});
