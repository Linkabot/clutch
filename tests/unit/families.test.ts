// Unit tests for knownFamilyIds (src/features/signs/families.ts, U8): a
// stored family id FAMILIES no longer recognises is dropped, an
// all-unknown list collapses to [] (which means All), and the ids that
// are kept come back in FAMILIES order regardless of the order they were
// given in.
// Depends on: vitest, src/features/signs/families.ts.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import { knownFamilyIds } from '../../src/features/signs/families';

describe('knownFamilyIds', () => {
  it('NEW U8: knownFamilyIds keeps known ids and drops unknown ones', () => {
    expect(knownFamilyIds(['warning', 'bogus'])).toEqual(['warning']);
  });

  it('NEW U8: knownFamilyIds of only unknown ids is empty, which means All', () => {
    expect(knownFamilyIds(['bogus'])).toEqual([]);
  });

  it('NEW U8: knownFamilyIds returns known ids in FAMILIES order', () => {
    expect(knownFamilyIds(['road-works', 'warning'])).toEqual(['warning', 'road-works']);
  });
});
