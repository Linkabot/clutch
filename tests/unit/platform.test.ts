// Unit tests for the pure platform-detection helpers. Every input is
// injected data (a fake matchMedia function, plain booleans/strings) — this
// file never calls readPlatform() and never touches a real window,
// localStorage, or matchMedia, because the Vitest environment is 'node'.
// Depends on: vitest, src/app/platform.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { isStandalone, isIos, shouldShowAddToHomeScreen } from '../../src/app/platform';

describe('isStandalone', () => {
  it('is true when the display-mode media query matches', () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: true }),
        navigatorStandalone: undefined,
      }),
    ).toBe(true);
  });

  it('is true when navigator.standalone is true, even if the media query does not match', () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigatorStandalone: true,
      }),
    ).toBe(true);
  });

  it('is false when neither the media query matches nor navigator.standalone is true', () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigatorStandalone: false,
      }),
    ).toBe(false);
  });

  it('is false when navigator.standalone is undefined and the media query does not match', () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigatorStandalone: undefined,
      }),
    ).toBe(false);
  });
});

describe('isIos', () => {
  it('is true for an iPhone user agent', () => {
    expect(
      isIos(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('is true for an iPad user agent', () => {
    expect(
      isIos(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('is true for an iPod user agent', () => {
    expect(isIos('Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('is false for an Android user agent', () => {
    expect(
      isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)'),
    ).toBe(false);
  });

  it('is false for a desktop Chrome user agent', () => {
    expect(
      isIos(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ),
    ).toBe(false);
  });
});

describe('shouldShowAddToHomeScreen', () => {
  // Full 2x2x2 matrix over { ios, standalone, dismissed }: the panel shows
  // in exactly one case — iOS, not standalone, not dismissed.
  const cases: [boolean, boolean, boolean, boolean][] = [
    [false, false, false, false],
    [false, false, true, false],
    [false, true, false, false],
    [false, true, true, false],
    [true, false, false, true],
    [true, false, true, false],
    [true, true, false, false],
    [true, true, true, false],
  ];

  it.each(cases)(
    'ios=%s standalone=%s dismissed=%s -> %s',
    (ios, standalone, dismissed, expected) => {
      expect(shouldShowAddToHomeScreen({ ios, standalone, dismissed })).toBe(expected);
    },
  );
});
