// Unit tests for the interactives registry: every entry's id and route
// must be unique, since Steps 24-26 use the id to build both a route
// (src/app/routes.tsx) and a manifest lookup key
// (scripts/check-interactive-size.mjs) -- a duplicate would silently
// shadow another entry in one or the other.
// Depends on: vitest, src/features/interactives/registry.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { INTERACTIVES } from '../../src/features/interactives/registry';

describe('INTERACTIVES', () => {
  it('has unique ids', () => {
    const ids = INTERACTIVES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique routes', () => {
    const routes = INTERACTIVES.map((entry) => entry.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
