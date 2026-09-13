// Content test: content/uk/pack.json parses against PackSchema, and every
// attribution entry's name appears in public/ATTRIBUTION.md — the
// human-readable file the Me tab renders — so the two never drift apart.
// Depends on: vitest, src/content/schemas, tests/content/helpers.ts,
// node:fs, node:path.
// Depended on by: `npm run validate:content` / `npm test`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PackSchema } from '../../src/content/schemas';
import { CONTENT_ROOT, readJson } from './helpers';

describe('content/uk/pack.json', () => {
  const pack = readJson('pack.json');

  it('parses against PackSchema', () => {
    const parsed = PackSchema.parse(pack);
    expect(parsed.region).toBe('GB');
  });

  it('has every attribution name in public/ATTRIBUTION.md', () => {
    const parsed = PackSchema.parse(pack);
    const attributionMd = readFileSync(
      join(CONTENT_ROOT, '..', '..', 'public', 'ATTRIBUTION.md'),
      'utf8',
    );
    for (const entry of parsed.attribution) {
      expect(attributionMd).toContain(entry.name);
    }
  });
});
