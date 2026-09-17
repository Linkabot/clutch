// Unit tests for SignSchema (src/content/schemas/signs.ts): a valid sample
// sign parses, and each of a bad id, a bad image path and a missing licence
// is rejected; a sign with thirdPartyMark: true parses and thirdPartyMark:
// false is rejected (Step 28a).
// Depends on: vitest, src/content/schemas.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import { SignSchema } from '../../src/content/schemas';

function validSign(): Record<string, unknown> {
  return {
    id: 'warning-crossroads',
    name: 'Crossroads',
    meaning: 'Crossroads.',
    family: 'warning',
    shape: 'triangle',
    colours: ['red'],
    rule: 'C2',
    hookId: null,
    image: 'signs/warning/crossroads.svg',
    refs: [{ kind: 'section', slug: 'traffic-signs' }],
    licence: 'Open Government Licence v3.0',
    source: {
      chapterSlug: 'warning-signs',
      chapterUrl:
        'https://www.gov.uk/government/publications/know-your-traffic-signs/warning-signs',
      imageUrl: 'https://assets.publishing.service.gov.uk/media/x/crossroads.svg',
      subHeading: '',
    },
  };
}

describe('SignSchema', () => {
  it('parses a valid sample sign', () => {
    expect(() => SignSchema.parse(validSign())).not.toThrow();
  });

  it('rejects a bad id: no family prefix at all, and a well-formed but unknown family', () => {
    const noPrefix = { ...validSign(), id: 'crossroads' };
    expect(SignSchema.safeParse(noPrefix).success).toBe(false);

    const unknownFamily = { ...validSign(), id: 'hazard-crossroads' };
    expect(SignSchema.safeParse(unknownFamily).success).toBe(false);
  });

  it('rejects a bad image path (wrong extension)', () => {
    const sign = { ...validSign(), image: 'signs/warning/crossroads.png' };
    expect(SignSchema.safeParse(sign).success).toBe(false);
  });

  it('rejects a sign missing its licence', () => {
    const sign = validSign();
    delete sign.licence;
    expect(SignSchema.safeParse(sign).success).toBe(false);
  });

  it('parses with thirdPartyMark: true, and rejects thirdPartyMark: false', () => {
    const marked = { ...validSign(), thirdPartyMark: true };
    expect(SignSchema.safeParse(marked).success).toBe(true);

    const badMark = { ...validSign(), thirdPartyMark: false };
    expect(SignSchema.safeParse(badMark).success).toBe(false);
  });
});
