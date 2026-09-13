// Unit test proving src/ui/index.ts compiles and re-exports the five UI
// primitives as functions. Node environment, no DOM: this only checks the
// module graph, it never renders a component.
// Depends on: vitest, src/ui/index.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { SignPanel, SignPlate, Roundel, Button, Chip } from '../../src/ui';

describe('src/ui', () => {
  it('re-exports every primitive as a function', () => {
    for (const primitive of [SignPanel, SignPlate, Roundel, Button, Chip]) {
      expect(typeof primitive).toBe('function');
    }
  });
});
