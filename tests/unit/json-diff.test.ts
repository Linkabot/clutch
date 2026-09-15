// Unit tests for the structural JSON differ: equal input returns no paths,
// and a changed leaf, an added object key and a removed array item each
// return exactly their own path.
// Depends on: vitest, scripts/lib/json-diff.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { diffJson } from '../../scripts/lib/json-diff';

describe('diffJson', () => {
  it('returns an empty array for equal objects', () => {
    const a = { title: 'Introduction', rules: [{ id: '1', text: 'Stop' }] };
    const b = { title: 'Introduction', rules: [{ id: '1', text: 'Stop' }] };
    expect(diffJson(a, b)).toEqual([]);
  });

  it('reports the path of a changed leaf value', () => {
    const a = { section: { title: 'Introduction' } };
    const b = { section: { title: 'Changed' } };
    expect(diffJson(a, b)).toEqual(['section.title']);
  });

  it('reports the path of a key added on one side', () => {
    const a = { section: { title: 'Introduction' } };
    const b = { section: { title: 'Introduction', order: 0 } };
    expect(diffJson(a, b)).toEqual(['section.order']);
  });

  it('reports the path of a removed array item', () => {
    const a = { rules: [{ id: '1' }, { id: '2' }] };
    const b = { rules: [{ id: '1' }] };
    expect(diffJson(a, b)).toEqual(['rules[1]']);
  });
});
