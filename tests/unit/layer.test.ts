// Unit tests for isFullScreenLayer (src/app/layer.ts, M40, amendment A1):
// true for exactly the three game routes that render as a fixed layer over
// the app shell, false for every other route named in amendment A1 --
// including the Shape & Colour Decoder, which renders inside <main> with
// the header and tab bar still reachable, and the app's other shell
// screens.
// Depends on: vitest, src/app/layer.ts.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import { isFullScreenLayer } from '../../src/app/layer';

describe('isFullScreenLayer', () => {
  it('NEW M40: isFullScreenLayer is true for the three game routes', () => {
    expect(isFullScreenLayer('/practice/tap')).toBe(true);
    expect(isFullScreenLayer('/practice/sprint')).toBe(true);
    expect(isFullScreenLayer('/practice/pairs')).toBe(true);
  });

  it('NEW M40: isFullScreenLayer is false for the Decoder and the shell screens', () => {
    expect(isFullScreenLayer('/learn/signs/decoder')).toBe(false);
    expect(isFullScreenLayer('/')).toBe(false);
    expect(isFullScreenLayer('/learn')).toBe(false);
    expect(isFullScreenLayer('/practice')).toBe(false);
    expect(isFullScreenLayer('/learn/signs')).toBe(false);
    expect(isFullScreenLayer('/code/rule/126')).toBe(false);
  });
});
