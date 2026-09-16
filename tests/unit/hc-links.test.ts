// Unit tests for src/features/code/hc-links.ts: prefixInternalHrefs and
// routerPathFromHref rewriting an internal href to and from its
// base-prefixed form (S5), and shouldIntercept's per-modifier/button/
// target decisions (C-S2).
// Depends on: vitest, src/features/code/hc-links.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import {
  prefixInternalHrefs,
  routerPathFromHref,
  shouldIntercept,
} from '../../src/features/code/hc-links';

const BASE = '/clutch/';

function clickEvent(overrides: Partial<Parameters<typeof shouldIntercept>[0]> = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe('prefixInternalHrefs', () => {
  it('prefixes a rule href with the base, without a double slash', () => {
    expect(prefixInternalHrefs('<a href="/code/rule/126">x</a>', BASE)).toBe(
      '<a href="/clutch/code/rule/126">x</a>',
    );
  });

  it('prefixes a learn/code href with the base', () => {
    expect(prefixInternalHrefs('<a href="/learn/code/index">x</a>', BASE)).toBe(
      '<a href="/clutch/learn/code/index">x</a>',
    );
  });

  it('leaves a protocol-relative href untouched', () => {
    const html = '<img src="x" href="//cdn.example.com/a">';
    expect(prefixInternalHrefs(html, BASE)).toBe(html);
  });

  it('leaves an absolute https:// href untouched', () => {
    const html = '<a href="https://www.gov.uk/highway-code">x</a>';
    expect(prefixInternalHrefs(html, BASE)).toBe(html);
  });

  it('leaves a same-page hash link untouched', () => {
    const html = '<a href="#rule283">x</a>';
    expect(prefixInternalHrefs(html, BASE)).toBe(html);
  });

  it('leaves a mailto: link untouched', () => {
    const html = '<a href="mailto:someone@example.com">x</a>';
    expect(prefixInternalHrefs(html, BASE)).toBe(html);
  });
});

describe('routerPathFromHref', () => {
  it('maps a base-prefixed rule href back to its router path', () => {
    expect(routerPathFromHref('/clutch/code/rule/126', BASE)).toBe('/code/rule/126');
  });

  it('maps a base-prefixed learn/code href back to its router path', () => {
    expect(routerPathFromHref('/clutch/learn/code/index', BASE)).toBe('/learn/code/index');
  });

  it('returns null for a base-prefixed href that is not an internal prefix', () => {
    expect(routerPathFromHref('/clutch/other/page', BASE)).toBeNull();
  });

  it('returns null for an href that does not start with the base', () => {
    expect(routerPathFromHref('https://www.gov.uk/highway-code', BASE)).toBeNull();
  });

  it('returns null for a same-page hash link', () => {
    expect(routerPathFromHref('#rule283', BASE)).toBeNull();
  });
});

describe('shouldIntercept', () => {
  it('is true for a plain primary-button click with no modifiers', () => {
    expect(shouldIntercept(clickEvent(), null)).toBe(true);
  });

  it('is false for a non-primary button', () => {
    expect(shouldIntercept(clickEvent({ button: 1 }), null)).toBe(false);
  });

  it('is false when metaKey is held', () => {
    expect(shouldIntercept(clickEvent({ metaKey: true }), null)).toBe(false);
  });

  it('is false when ctrlKey is held', () => {
    expect(shouldIntercept(clickEvent({ ctrlKey: true }), null)).toBe(false);
  });

  it('is false when shiftKey is held', () => {
    expect(shouldIntercept(clickEvent({ shiftKey: true }), null)).toBe(false);
  });

  it('is false when altKey is held', () => {
    expect(shouldIntercept(clickEvent({ altKey: true }), null)).toBe(false);
  });

  it('is false when the event is already prevented', () => {
    expect(shouldIntercept(clickEvent({ defaultPrevented: true }), null)).toBe(false);
  });

  it('is false for an anchor with target="_blank"', () => {
    expect(shouldIntercept(clickEvent(), '_blank')).toBe(false);
  });
});
