// Unit tests for hookFor() (src/content/signs.ts): the § Memory hooks
// display-rule fallback chain -- a sign's own hook, then, for a C9
// direction sign, null, otherwise the hook whose rules include the sign's
// rule, else its family's hook, with 'page' and 'sheet' resolving alike --
// checked against synthetic signs and, for the 176-of-195 count, the real
// committed content/uk/signs/{hooks,signs}.json (Vitest supports
// import.meta.glob, so no fixtures are needed here).
// Depends on: vitest, src/content/signs.ts, src/content/schemas.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import { hookFor, loadSigns } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';

function makeSign(overrides: Partial<Sign> = {}): Sign {
  return {
    id: 'orders-mini-roundabout',
    name: 'Mini-roundabout',
    meaning: 'Mini-roundabout (give way to traffic from the immediate right).',
    family: 'orders',
    shape: 'circle',
    colours: ['blue'],
    rule: 'C4',
    hookId: null,
    image: 'signs/orders/mini-roundabout.svg',
    refs: [{ kind: 'section', slug: 'traffic-signs' }],
    licence: 'Open Government Licence v3.0',
    source: {
      chapterSlug: 'regulatory-signs',
      chapterUrl:
        'https://www.gov.uk/government/publications/know-your-traffic-signs/regulatory-signs',
      imageUrl: 'https://assets.publishing.service.gov.uk/media/x/mini-roundabout.svg',
      subHeading: '',
    },
    ...overrides,
  };
}

describe('hookFor', () => {
  it("own hook wins on both the 'page' and 'sheet' contexts", () => {
    const sign = makeSign({ hookId: 'sign-mini-roundabout', rule: 'C4', family: 'orders' });
    expect(hookFor(sign, 'page')?.id).toBe('sign-mini-roundabout');
    expect(hookFor(sign, 'sheet')?.id).toBe('sign-mini-roundabout');
  });

  it("'page' falls back like 'sheet'", () => {
    const sign = makeSign({ hookId: null, rule: 'C2', family: 'warning' });
    expect(hookFor(sign, 'page')).not.toBeNull();
    expect(hookFor(sign, 'page')?.id).toBe(hookFor(sign, 'sheet')?.id);
  });

  it('a C9 direction sign without an own hook gets null in both contexts', () => {
    const sign = makeSign({ hookId: null, rule: 'C9', family: 'direction' });
    expect(hookFor(sign, 'page')).toBeNull();
    expect(hookFor(sign, 'sheet')).toBeNull();
  });

  it('resolves a tip for exactly 176 of 195 signs on the real catalogue', async () => {
    const signs = await loadSigns();
    expect(signs).toHaveLength(195);
    const withTip = signs.filter((sign) => hookFor(sign, 'page') !== null);
    expect(withTip).toHaveLength(176);
  });

  it("'sheet' context without an own hook falls back to the rule hook", () => {
    const sign = makeSign({ hookId: null, rule: 'C3', family: 'orders' });
    expect(hookFor(sign, 'sheet')?.id).toBe('rule-circle-red');
  });

  it("'sheet' context with no own or rule hook falls back to the family hook", () => {
    const sign = makeSign({ hookId: null, rule: 'C9', family: 'road-works' });
    expect(hookFor(sign, 'sheet')?.id).toBe('family-road-works');
  });
});
