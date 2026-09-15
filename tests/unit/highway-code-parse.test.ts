// Unit tests for the pure Highway Code parser: rule boundaries, HTML
// sanitisation, link rewriting and MUST/MUST NOT law detection against the
// fixture (tests/fixtures/highway-code-section.html), every kindOf
// precedence case named in plan.md amendment P3, and `rewriteHref`'s
// `repairHrefs` flag against the five malformed hrefs found in the
// committed corpus (plan.md D13 S12, amended P2).
// Depends on: vitest, node:fs, node:url, node:path,
// scripts/lib/highway-code-parse.ts, src/content/schemas/highwayCode.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseSection, kindOf, rewriteHref } from '../../scripts/lib/highway-code-parse';
import { SectionSchema } from '../../src/content/schemas/highwayCode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'highway-code-section.html'),
  'utf8',
);

const meta = {
  slug: 'example-rules-for-fixture-testing',
  title: '  Example rules for fixture testing  ',
  basePath: '/guidance/the-highway-code/example-rules-for-fixture-testing',
  sourceUrl: 'https://www.gov.uk/guidance/the-highway-code/example-rules-for-fixture-testing',
  order: 5,
};

describe('parseSection', () => {
  const section = parseSection(fixtureHtml, meta);

  it('parses cleanly against SectionSchema', () => {
    expect(() => SectionSchema.parse(section)).not.toThrow();
  });

  it('trims and whitespace-normalises the section title', () => {
    expect(section.title).toBe('Example rules for fixture testing');
  });

  it('finds rules 124, 125, 126 and H1 in order', () => {
    expect(section.rules.map((rule) => rule.id)).toEqual(['124', '125', '126', 'H1']);
  });

  it('has an empty bodyHtml for a section with rules', () => {
    expect(section.bodyHtml).toBe('');
  });

  it('keeps the h2 heading text and both preamble paragraphs in preambleHtml (a stray <h2> before the first rule stays in the preamble)', () => {
    expect(section.preambleHtml).toContain('Introduction');
    expect(section.preambleHtml).toContain('This fixture section covers example speed-limit');
    expect(section.preambleHtml).toContain('It exists only to exercise rule boundaries');
  });

  it('never lets a script tag survive in any rule', () => {
    for (const rule of section.rules) {
      expect(rule.html).not.toContain('<script');
    }
  });

  describe('Rule 124', () => {
    const rule = section.rules[0];

    it('is flagged as law from one MUST NOT and no bare MUST', () => {
      expect(rule.mustNotCount).toBe(1);
      expect(rule.mustCount).toBe(0);
      expect(rule.law).toBe(true);
    });

    it('keeps its table', () => {
      expect(rule.html).toContain('<table');
    });
  });

  describe('Rule 125', () => {
    const rule = section.rules[1];

    it('rewrites the cross-link to Rule 98 and records the cross-reference', () => {
      expect(rule.crossRefs).toEqual(['98']);
      expect(rule.html).toContain('href="/code/rule/98"');
    });
  });

  describe('Rule 126', () => {
    const rule = section.rules[2];

    it('is advice, not law', () => {
      expect(rule.law).toBe(false);
    });

    it('takes its lead from the leading strong in the first paragraph', () => {
      expect(rule.lead).toBe('Stopping distances.');
    });

    it('records the diagram image and replaces it with an hc-image link', () => {
      expect(rule.images).toHaveLength(1);
      expect(rule.images[0].src).toBe(
        'https://assets.publishing.service.gov.uk/media/65f828c3fc7fcf0011c647f9/the-highway-code-stopping-distance.jpg',
      );
      expect(rule.html).not.toContain('<img');
      expect(rule.html).toContain('hc-image');
    });

    it('keeps the external law citation marked rel="external noopener"', () => {
      expect(rule.html).toContain('rel="external noopener"');
    });
  });

  describe('Rule H1', () => {
    const rule = section.rules[3];

    it('has no number (a heading with no id, matched by its text)', () => {
      expect(rule.number).toBeNull();
    });
  });
});

// plan.md M4 (review-b.md finding B2 + suggestion B-S1) and its
// pre-dispatch refinement. Every payload below is copied verbatim from
// Primary's throwaway probes (b2-probe.ts raw-text elements, b2-probe2.ts
// malformed tags, b2-probe3.ts link schemes) so this block covers every
// case they check; each builds its own section HTML, no fixture change.
describe('sanitiser hardening (M4)', () => {
  const HARDENING_META = {
    slug: 'sanitiser-hardening-probe',
    title: 'Sanitiser hardening probe (1 to 1)',
    basePath: '/guidance/the-highway-code/sanitiser-hardening-probe',
    sourceUrl: 'https://www.gov.uk/guidance/the-highway-code/sanitiser-hardening-probe',
    order: 0,
  };

  function ruleHtmlFor(payload: string): string {
    const body = `<h3 id="rule1">Rule 1</h3><p>You <strong>MUST</strong> test.</p>${payload}`;
    return parseSection(body, HARDENING_META).rules[0]?.html ?? '';
  }

  const ON_ATTR = /<[^>]*\son[a-z]+\s*=/i;
  const DANGEROUS_TAGS = /<(img|svg|script|style|iframe|noscript|object|embed|template)\b/i;
  const HREF_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
  const ALLOWED_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

  /** No tag carrying an on…= attribute, none of the tags this step drops
   * or intercepts, and every emitted href is scheme-less (a relative
   * path, a fragment, or a bare token like this fixture's `src="x"`) or
   * uses one of the four schemes this app ever links to (plan.md M4
   * refinement item 4 — only a URL *scheme* can execute script, so a
   * scheme-less value is never rejected here). */
  function expectNeutralised(html: string): void {
    expect(html).not.toMatch(ON_ATTR);
    expect(html).not.toMatch(DANGEROUS_TAGS);
    for (const match of html.matchAll(/href="([^"]*)"/g)) {
      const scheme = HREF_SCHEME.exec(match[1]);
      if (scheme) {
        expect(ALLOWED_HREF_SCHEMES.has(scheme[0].toLowerCase()), match[1]).toBe(true);
      }
    }
  }

  describe('raw-text elements (probe b2-probe.ts)', () => {
    const payloads: Record<string, string> = {
      script: '<script>var t = "<img src=x onerror=alert(1)>";</script>',
      style: '<style>a{} </style><img src=x onerror=alert(2)><style></style>',
      styleInner: '<style>x{}<img src=x onerror=alert(22)></style>',
      pre: '<pre><img src=x onerror=alert(3)></pre>',
      noscript: '<noscript><img src=x onerror=alert(4)></noscript>',
      iframe: '<iframe><img src=x onerror=alert(5)></iframe>',
      jsHref: '<p><a href="javascript:alert(6)">j</a></p>',
      dataHref: '<p><a href="data:text/html,<script>alert(7)</script>">d</a></p>',
      entityText: '<p>&lt;img src=x onerror=alert(8)&gt;</p>',
    };

    for (const [name, payload] of Object.entries(payloads)) {
      it(`neutralises ${name}`, () => {
        expectNeutralised(ruleHtmlFor(payload));
      });
    }
  });

  describe('malformed tags — parser differential (probe b2-probe2.ts)', () => {
    const payloads: Record<string, string> = {
      slashAttr: '<p>x<img/src=x onerror=alert(9)>y</p>',
      svgSlash: '<p><svg/onload=alert(10)></p>',
      doubleLt: '<p><<img src=x onerror=alert(12)>></p>',
      unclosed: '<p><img src="x" onerror="alert(14)"</p>',
      divSlash: '<p><div/onmouseover=alert(15)>x</div></p>',
      splitScript: '<p><scr<script>x</script>ipt>alert(16)</p>',
      commentish: '<p><!--<img src=x onerror=alert(17)>--></p>',
      cdata: '<p><![CDATA[<img src=x onerror=alert(18)>]]></p>',
    };

    for (const [name, payload] of Object.entries(payloads)) {
      it(`neutralises ${name}`, () => {
        expectNeutralised(ruleHtmlFor(payload));
      });
    }

    it('keeps a benign lone "<" unescaped when not followed by a letter, "/", "!" or "?": "a < b and 3<4"', () => {
      expect(ruleHtmlFor('<p>a < b and 3<4</p>')).toContain('a < b and 3<4');
    });
  });

  describe('link schemes (probe b2-probe3.ts)', () => {
    const payloads: Record<string, string> = {
      mixedCase: '<p><a href="JaVaScRiPt:alert(1)">a</a></p>',
      leadSpace: '<p><a href=" javascript:alert(2)">b</a></p>',
      leadTab: '<p><a href="\tjavascript:alert(3)">c</a></p>',
      innerTab: '<p><a href="java\tscript:alert(4)">d</a></p>',
      entityJ: '<p><a href="&#x6A;avascript:alert(5)">e</a></p>',
      entityTab: '<p><a href="jav&#x09;ascript:alert(6)">f</a></p>',
      vbscript: '<p><a href="vbscript:msgbox(7)">g</a></p>',
      dataHtml: '<p><a href="data:text/html;base64,PHNjcmlwdD5hbGVydCg4KTwvc2NyaXB0Pg==">h</a></p>',
      imgJs: '<p><img src="javascript:alert(9)" alt="x"></p>',
    };

    for (const [name, payload] of Object.entries(payloads)) {
      it(`unwraps or drops the link for ${name}`, () => {
        expectNeutralised(ruleHtmlFor(payload));
      });
    }

    it('keeps safe https, mailto and fragment links untouched (no false positives)', () => {
      const html = ruleHtmlFor(
        '<p><a href="https://www.gov.uk/x">ok1</a> <a href="mailto:a@b.c">ok2</a> <a href="#frag">ok3</a></p>',
      );
      expect(html).toContain('href="https://www.gov.uk/x"');
      expect(html).toContain('href="mailto:a@b.c"');
      expect(html).toContain('href="#frag"');
    });
  });

  it('keeps benign markup and text untouched inside a former raw-text element: <pre><b>bold</b> x &amp; y</pre>', () => {
    const html = ruleHtmlFor('<pre><b>bold</b> x &amp; y</pre>');
    expect(html).toContain('bold');
    expect(html).toContain('x &amp; y');
  });
});

describe('kindOf', () => {
  it('is introduction when the slug is introduction', () => {
    expect(kindOf({ slug: 'introduction', title: 'Introduction', rules: [] })).toBe('introduction');
  });

  it('is introduction even when the title/rules would otherwise say something else', () => {
    expect(
      kindOf({
        slug: 'introduction',
        title: 'Annex 9. Signals, signs and markings',
        rules: [{ id: '1' }],
      }),
    ).toBe('introduction');
  });

  it('is rules when the section has at least one numeric rule id', () => {
    expect(
      kindOf({
        slug: 'general-rules-all-drivers-riders-103-to-158',
        title: 'General rules (103 to 158)',
        rules: [{ id: '103' }, { id: '104' }],
      }),
    ).toBe('rules');
  });

  it('trims a trailing-space title before classifying (8 of 31 live titles have one)', () => {
    expect(
      kindOf({
        slug: 'rules-about-animals-47-to-58',
        title: 'Rules about animals (47 to 58) ',
        rules: [{ id: '47' }, { id: '48' }],
      }),
    ).toBe('rules');
  });

  it('classes a section "rules" even when its slug range disagrees with its content', () => {
    expect(
      kindOf({
        slug: 'motorways-253-to-273',
        title: 'Motorways',
        rules: [{ id: '274' }],
      }),
    ).toBe('rules');
  });

  it('is annex when the trimmed title matches "Annex N."', () => {
    expect(
      kindOf({
        slug: 'annex-6-vehicle-maintenance-safety-and-security',
        title: 'Annex 6. Vehicle maintenance, safety and security',
        rules: [],
      }),
    ).toBe('annex');
  });

  it('is signals when the title mentions signals, signs or markings', () => {
    expect(
      kindOf({ slug: 'light-signals', title: 'Light signals controlling traffic', rules: [] }),
    ).toBe('signals');
    expect(kindOf({ slug: 'road-signs', title: 'Traffic signs', rules: [] })).toBe('signals');
    expect(kindOf({ slug: 'road-markings', title: 'Road markings', rules: [] })).toBe('signals');
  });

  it('is other when nothing else matches', () => {
    expect(kindOf({ slug: 'index', title: 'Index', rules: [] })).toBe('other');
  });
});

// plan.md D13 S12, amended P2 (fact-check against the committed corpus).
// The five malformed hrefs found in content/uk/highway-code/: a bare
// "www.gov.uk/…", a doubled zero-width space (percent-encoded, and the same
// again as two literal U+200B characters) ahead of an absolute rule link, a
// "guidance/the-highway-code/…" rule link missing its leading slash, and
// "#rule%20" standing in for "#rule" ahead of a rule number.
describe('rewriteHref (repairHrefs)', () => {
  const ZWSP = '\u200B';
  const CLEAN_269 = '/guidance/the-highway-code/motorways-253-to-273#rule269';
  const CLEAN_264 = '/guidance/the-highway-code/motorways-253-to-273#rule264';
  const CLEAN_97 =
    '/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102#rule97';

  it('flag on: "www.gov.uk/…" gains an "https://" scheme', () => {
    expect(rewriteHref('www.gov.uk/health-and-social-care/smoking', new Set(), true)).toBe(
      'https://www.gov.uk/health-and-social-care/smoking',
    );
  });

  it("flag on: a doubled percent-encoded zero-width space ahead of an absolute rule link gives exactly what today's rule gives for the clean link", () => {
    const malformed = `%E2%80%8B%E2%80%8B${CLEAN_269}`;
    const today = rewriteHref(CLEAN_269, new Set(), true);
    expect(rewriteHref(malformed, new Set(), true)).toBe(today);
    expect(rewriteHref(malformed, new Set(), true)).toBe('/code/rule/269');
  });

  it('flag on: the same with two literal U+200B characters instead gives the same result', () => {
    const malformed = `${ZWSP}${ZWSP}${CLEAN_269}`;
    const today = rewriteHref(CLEAN_269, new Set(), true);
    expect(rewriteHref(malformed, new Set(), true)).toBe(today);
    expect(rewriteHref(malformed, new Set(), true)).toBe('/code/rule/269');
  });

  it('flag on: a missing leading slash on "guidance/the-highway-code/…" gives exactly what today\'s rule gives for the slash-prefixed form', () => {
    const malformed = 'guidance/the-highway-code/motorways-253-to-273#rule264';
    const today = rewriteHref(CLEAN_264, new Set(), true);
    expect(rewriteHref(malformed, new Set(), true)).toBe(today);
    expect(rewriteHref(malformed, new Set(), true)).toBe('/code/rule/264');
  });

  it('flag on: "#rule%20" ahead of the rule number is treated as "#rule" (plan.md amendment P2)', () => {
    const malformed =
      'guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102#rule%2097';
    const today = rewriteHref(CLEAN_97, new Set(), true);
    expect(rewriteHref(malformed, new Set(), true)).toBe(today);
    expect(rewriteHref(malformed, new Set(), true)).toBe('/code/rule/97');
  });

  it('flag on: records the repaired rule id as a cross-reference', () => {
    const crossRefs = new Set<string>();
    rewriteHref('guidance/the-highway-code/motorways-253-to-273#rule264', crossRefs, true);
    expect(crossRefs).toEqual(new Set(['264']));
  });

  it('flag off: all five malformed inputs behave as before (pass through unchanged)', () => {
    const inputs = [
      'www.gov.uk/health-and-social-care/smoking',
      `%E2%80%8B%E2%80%8B${CLEAN_269}`,
      `${ZWSP}${ZWSP}${CLEAN_269}`,
      'guidance/the-highway-code/motorways-253-to-273#rule264',
      'guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102#rule%2097',
    ];
    for (const input of inputs) {
      expect(rewriteHref(input, new Set(), false)).toBe(input);
    }
  });

  it('flag on leaves an already well-formed href unchanged (no false positives)', () => {
    expect(rewriteHref(CLEAN_264, new Set(), true)).toBe('/code/rule/264');
    expect(
      rewriteHref('https://www.legislation.gov.uk/ukpga/1988/52/section/163', new Set(), true),
    ).toBe('https://www.legislation.gov.uk/ukpga/1988/52/section/163');
  });
});

describe('parseSection repairHrefs default', () => {
  const META = {
    slug: 'repair-hrefs-default-probe',
    title: 'Repair hrefs default probe',
    basePath: '/guidance/the-highway-code/repair-hrefs-default-probe',
    sourceUrl: 'https://www.gov.uk/guidance/the-highway-code/repair-hrefs-default-probe',
    order: 0,
  };

  function bodyWithMalformedHref(): string {
    return `<h3 id="rule1">Rule 1</h3><p><a href="www.gov.uk/health-and-social-care/smoking">smoking</a></p>`;
  }

  it('defaults to on (repaired) when the caller passes no third argument at all', () => {
    const section = parseSection(bodyWithMalformedHref(), META);
    expect(section.rules[0]?.html).toContain(
      'href="https://www.gov.uk/health-and-social-care/smoking"',
    );
  });

  it('defaults to on (repaired) when the caller passes an options object with no repairHrefs key', () => {
    const section = parseSection(bodyWithMalformedHref(), META, {});
    expect(section.rules[0]?.html).toContain(
      'href="https://www.gov.uk/health-and-social-care/smoking"',
    );
  });

  it('turns off with an explicit repairHrefs: false', () => {
    const section = parseSection(bodyWithMalformedHref(), META, { repairHrefs: false });
    expect(section.rules[0]?.html).toContain('href="www.gov.uk/health-and-social-care/smoking"');
  });
});
