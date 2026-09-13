// Unit tests for src/features/code/ruleNav.ts: neighbours() computed on
// hand-built string arrays — no real content needed.
// Depends on: vitest, src/features/code/ruleNav.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { neighbours } from '../../src/features/code/ruleNav';

describe('neighbours', () => {
  it('finds both neighbours for a rule in the middle of the list', () => {
    expect(neighbours(['124', '125', '126', '127'], '125')).toEqual({ prev: '124', next: '126' });
  });

  it('returns a null prev for the first rule in the list', () => {
    expect(neighbours(['124', '125', '126'], '124')).toEqual({ prev: null, next: '125' });
  });

  it('returns a null next for the last rule in the list', () => {
    expect(neighbours(['124', '125', '126'], '126')).toEqual({ prev: '125', next: null });
  });

  it('returns both null for a single-rule list', () => {
    expect(neighbours(['H1'], 'H1')).toEqual({ prev: null, next: null });
  });

  it('returns both null for an id the list does not contain', () => {
    expect(neighbours(['124', '125'], '999')).toEqual({ prev: null, next: null });
  });

  it('works across the introduction hierarchy rules H1–H3', () => {
    expect(neighbours(['H1', 'H2', 'H3'], 'H2')).toEqual({ prev: 'H1', next: 'H3' });
  });
});
