// Unit tests for src/app/back.ts's backTarget (A-S3): proves the Back
// button's navigation target directly, without needing a real browser
// history object.
// Depends on: vitest, src/app/back.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { backTarget } from '../../src/app/back';

describe('backTarget', () => {
  it('goes back in the browser history when a prior in-app entry exists', () => {
    expect(backTarget('/code/rule/126', 2)).toBe(-1);
  });

  it('falls back to the owning tab on a cold deep link (idx 0)', () => {
    expect(backTarget('/code/rule/126', 0)).toBe('/learn');
  });

  it('falls back to the owning tab when idx is undefined', () => {
    expect(backTarget('/learn/code/traffic-signs', undefined)).toBe('/learn');
  });

  it('falls back to Journey for a path no tab owns', () => {
    expect(backTarget('/some/unmatched/path', 0)).toBe('/');
  });
});
