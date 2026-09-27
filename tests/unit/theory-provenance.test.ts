// Unit tests for scripts/lib/theory-checks.ts's Step 10 additions (plan.md
// Step 10, amend-10 A52): `parseUnitsLine` reads a generated prompt's first
// line into its cited units, or returns null for anything else;
// `checkProvenance` flags PROVENANCE-MISSING when a question or rule card's
// `writtenFrom.model` is blank, or when no prompt of its topic and
// `promptVersion` lists `writtenFrom.unitId` on a `units:` line; and
// `PROBLEM_CODES` still ends with `PROVENANCE-MISSING` as its 21st and last
// entry, after the 20 Step 9 codes.
// Depends on: vitest, ../../scripts/lib/theory-checks.
// Depended on by: `npm test`.
import { describe, it, expect } from 'vitest';
import { PROBLEM_CODES, checkProvenance, parseUnitsLine } from '../../scripts/lib/theory-checks';
import type { PromptIndex } from '../../scripts/lib/theory-checks';

const STEP_9_CODES = [
  'CITE-UNRESOLVED',
  'QUOTE-NOT-VERBATIM',
  'QUOTE-TOO-LONG',
  'NUMBER-UNSOURCED',
  'VOCAB-LOW',
  'DISTRACTOR-NOT-IN-POOL',
  'KEYPHRASE-NOT-IN-CORPUS',
  'TOPIC-MISMATCH',
  'SIGN-UNKNOWN',
  'NEAR-DUPLICATE',
  'CARD-CITE-UNRESOLVED',
  'CARD-QUOTE-NOT-VERBATIM',
  'CARD-QUOTE-TOO-LONG',
  'CARD-NUMBER-UNSOURCED',
  'CARD-VOCAB-LOW',
  'CADENCE',
  'CHECK-UNKNOWN-QUESTION',
  'CHECK-OFF-RUN',
  'CHECK-REUSED',
  'QUEUE-STALE',
];

function writtenFrom(unitId: string, model = 'test-model', promptVersion = 'v1') {
  return { unitId, promptVersion, model };
}

describe('scripts/lib/theory-checks.ts: provenance', () => {
  it('NEW S10: parseUnitsLine reads the cites of a units line in order', () => {
    expect(parseUnitsLine('units: hc:207')).toEqual(['hc:207']);
    expect(parseUnitsLine('units: hc:207, ns:1.1.3\r')).toEqual(['hc:207', 'ns:1.1.3']);
    expect(parseUnitsLine('units: hc:204, hc:207, ns:2.1.1')).toEqual([
      'hc:204',
      'hc:207',
      'ns:2.1.1',
    ]);
  });

  it('NEW S10: parseUnitsLine returns null for a line that is not a units line', () => {
    expect(parseUnitsLine('units: hc:207,ns:1.1.3')).toBeNull();
    expect(parseUnitsLine('unit: hc:207')).toBeNull();
    expect(parseUnitsLine('units: ')).toBeNull();
    expect(parseUnitsLine('some other text')).toBeNull();
  });

  it('NEW S10: checkProvenance passes an item whose unit is on a units line of its topic and version', () => {
    const prompts: PromptIndex = new Map([['v1/vulnerable-road-users', new Set(['hc:207'])]]);
    const problems = checkProvenance(
      {
        id: 'vulnerable-road-users-q001',
        topic: 'vulnerable-road-users',
        writtenFrom: writtenFrom('hc:207'),
      },
      prompts,
    );
    expect(problems).toEqual([]);
  });

  it('NEW S10: PROVENANCE-MISSING when no prompt of the topic and version lists the unit', () => {
    const prompts: PromptIndex = new Map([
      ['v1/vulnerable-road-users', new Set(['hc:204'])],
      ['v2/vulnerable-road-users', new Set(['hc:207'])],
      ['v1/another-topic', new Set(['hc:207'])],
    ]);
    // Unlisted anywhere.
    expect(
      checkProvenance(
        { id: 'x', topic: 'vulnerable-road-users', writtenFrom: writtenFrom('hc:999') },
        prompts,
      ),
    ).toEqual([{ code: 'PROVENANCE-MISSING', id: 'x' }]);
    // Listed only under another topic.
    expect(
      checkProvenance(
        { id: 'x', topic: 'vulnerable-road-users', writtenFrom: writtenFrom('hc:207') },
        prompts,
      ),
    ).toEqual([{ code: 'PROVENANCE-MISSING', id: 'x' }]);
    // Listed only under another prompt version.
    expect(
      checkProvenance(
        {
          id: 'x',
          topic: 'vulnerable-road-users',
          writtenFrom: writtenFrom('hc:207', 'test-model', 'v1'),
        },
        prompts,
      ),
    ).toEqual([{ code: 'PROVENANCE-MISSING', id: 'x' }]);
  });

  it('NEW S10: PROVENANCE-MISSING when the model is blank', () => {
    const prompts: PromptIndex = new Map([['v1/vulnerable-road-users', new Set(['hc:207'])]]);
    expect(
      checkProvenance(
        { id: 'x', topic: 'vulnerable-road-users', writtenFrom: writtenFrom('hc:207', ' ') },
        prompts,
      ),
    ).toEqual([{ code: 'PROVENANCE-MISSING', id: 'x' }]);
  });

  it('NEW S10: PROBLEM_CODES ends with PROVENANCE-MISSING after the 20 Step 9 codes', () => {
    expect(PROBLEM_CODES.length).toBe(21);
    expect(PROBLEM_CODES.slice(0, 20)).toEqual(STEP_9_CODES);
    expect(PROBLEM_CODES[20]).toBe('PROVENANCE-MISSING');
  });
});
