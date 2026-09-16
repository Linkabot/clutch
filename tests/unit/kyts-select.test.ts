// Unit tests for KYTS picture selection and classification: every rule
// R1-R8 (§ Chosen signs, amended P7) against small synthetic
// `KytsPicture`/`KytsChapter` data built directly in this file (not parsed
// from a fixture — selectSigns/candidateFiles take already-parsed chapters,
// exactly what a test can construct by hand for full control over every
// rule combination), plus every C1-C9 classification (§ Shape and colour
// rules), including C7's four route-colour outcomes on the captions
// "Primary route.", "Non-primary route.", "Sign on a primary route
// indicating a non-primary route." and "Castle.". The tests named
// `E11: …` (plan.md amendment E11) additionally cover the R6 exact-size
// boundary, R8 with no preceding paragraph at all, R4's per-family caption
// scope, `hookId` resolution from a passed-in `HooksFile`, the exported
// `classifySign` called directly (Step 16's own use), and — reading
// tests/fixtures/kyts-chapter.html through `parseChapter` — an end-to-end
// run proving the fixture's R8 sign and its dropped pictures.
// Depends on: vitest, node:fs, node:url, node:path, scripts/lib/kyts-select.ts,
// scripts/lib/kyts-parse.ts (parseChapter, KytsPicture),
// src/content/schemas/signs.ts (SignSelectionFile, ShapeRulesFile,
// HooksFile, Sign types).
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  candidateFiles,
  classifySign,
  selectSigns,
  svgIsSafe,
} from '../../scripts/lib/kyts-select';
import type { KytsChapter } from '../../scripts/lib/kyts-select';
import { parseChapter } from '../../scripts/lib/kyts-parse';
import type { KytsPicture } from '../../scripts/lib/kyts-parse';
import type {
  HooksFile,
  Sign,
  ShapeRulesFile,
  SignSelectionFile,
} from '../../src/content/schemas/signs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, '..', 'fixtures', 'kyts-chapter.html'), 'utf8');

function pic(file: string, caption: string, overrides: Partial<KytsPicture> = {}): KytsPicture {
  return {
    index: 0,
    url: `https://assets.publishing.service.gov.uk/media/deadbeef/${file}`,
    mediaId: 'deadbeef',
    file,
    caption,
    subHeading: '',
    precedingParagraphText: null,
    ...overrides,
  };
}

function chapter(slug: string, pictures: KytsPicture[]): KytsChapter {
  return { slug, pictures };
}

function bytesFor(
  files: string[],
  content = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  for (const file of files) map.set(file, Buffer.from(content, 'utf8'));
  return map;
}

function findSign(signs: Sign[], id: string): Sign {
  const sign = signs.find((s) => s.id === id);
  if (!sign) throw new Error(`test setup error: no sign with id ${id}`);
  return sign;
}

// No sign has its own hook by default; a test that needs one builds its
// own small `HooksFile` instead (E11(f) below).
const HOOKS_EMPTY: HooksFile = { hooks: [] };

const R8_ENTRIES: SignSelectionFile['r8NamedParagraphCaptions'] = [
  {
    chapter: 'regulatory-signs',
    family: 'orders',
    file: 'stop-sign-and-road-marking.svg',
    paragraphPrefix: "The 'STOP' sign and road markings:",
  },
  {
    chapter: 'regulatory-signs',
    family: 'orders',
    file: 'give-way-road-marking.svg',
    paragraphPrefix: "The 'GIVE WAY' sign and road markings:",
  },
];

function makeSelection(overrides: Partial<SignSelectionFile> = {}): SignSelectionFile {
  return {
    chapters: [
      { slug: 'warning-signs', family: 'warning' },
      { slug: 'regulatory-signs', family: 'orders' },
      { slug: 'speed-limit-signs', family: 'orders' },
      { slug: 'motorway-signs', family: 'motorway' },
      { slug: 'direction-signs', family: 'direction' },
      { slug: 'information-signs', family: 'information' },
      { slug: 'road-works-signs', family: 'road-works' },
    ],
    families: ['warning', 'orders', 'motorway', 'direction', 'information', 'road-works'],
    r2CaptionPrefixes: ['(', 'Plate ', 'Plates '],
    r3PlateFiles: [],
    r5SubHeadingPrefixes: ['Motorway signals and variable signs'],
    // Empty by default so a test that merely happens to use the
    // 'regulatory-signs' slug (for its orders family) isn't forced to also
    // supply the STOP/GIVE WAY pictures; the R8 describe block below opts
    // in explicitly with R8_ENTRIES.
    r8NamedParagraphCaptions: [],
    allowLists: { motorway: [], direction: [], information: [], 'road-works': [] },
    expectedCounts: {
      warning: 0,
      orders: 0,
      motorway: 0,
      direction: 0,
      information: 0,
      'road-works': 0,
    },
    expectedTotal: 0,
    ...overrides,
  };
}

function makeShapeRules(): ShapeRulesFile {
  return {
    rules: [
      {
        id: 'C1',
        match: {
          files: [
            { family: 'warning', file: 'exception.svg' },
            // E11(g): a file C1 names directly, even though its caption
            // would otherwise match C3's "No " prefix — C1 is tried first.
            { family: 'orders', file: 'no-entry-c1-exception.svg' },
          ],
        },
        shape: 'other',
        colours: [],
        sentences: [],
      },
      {
        id: 'C2',
        match: { family: 'warning' },
        shape: 'triangle',
        colours: ['red'],
        sentences: [],
      },
      {
        id: 'C3',
        match: { family: 'orders', captionStartsWith: ['No '] },
        shape: 'circle',
        colours: ['red'],
        sentences: [],
      },
      {
        id: 'C4',
        match: { family: 'orders', captionStartsWith: ['Turn '] },
        shape: 'circle',
        colours: ['blue'],
        sentences: [],
      },
      {
        id: 'C5',
        match: { family: 'motorway', subHeadingContains: 'exit slip roads' },
        shape: 'rectangle',
        colours: ['green', 'white'],
        sentences: [],
      },
      {
        id: 'C6',
        match: { family: 'motorway' },
        shape: 'rectangle',
        colours: ['blue'],
        sentences: [],
      },
      {
        id: 'C7',
        match: {
          families: ['direction', 'information'],
          routeColourTest: { containsToken: 'non-primary route', remainderToken: 'primary route' },
        },
        outcomes: {
          'C7-green-white': { shape: 'rectangle', colours: ['green', 'white'], sentences: [] },
          'C7-green': { shape: 'rectangle', colours: ['green'], sentences: [] },
          'C7-white': { shape: 'rectangle', colours: ['white'], sentences: [] },
        },
      },
      {
        id: 'C8',
        match: { family: 'information' },
        shape: 'rectangle',
        colours: ['blue'],
        sentences: [],
      },
      { id: 'C9', match: {}, shape: 'other', colours: [], sentences: [] },
    ],
    shapeSentences: { circle: '', triangle: '', rectangle: '' },
    exceptionsSentence: '',
    decoderPairs: [],
  };
}

describe('selectSigns: R1-R6', () => {
  it('R1 drops a picture with an empty caption', () => {
    const chapters = [chapter('warning-signs', [pic('empty.svg', '')])];
    const { signs, dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['empty.svg']),
      HOOKS_EMPTY,
    );
    expect(signs).toHaveLength(0);
    expect(dropped).toEqual([{ file: 'empty.svg', family: 'warning', reason: 'R1-empty-caption' }]);
  });

  it('R2 drops a picture whose caption starts with an annotation prefix', () => {
    const chapters = [chapter('warning-signs', [pic('annotation.svg', '(alternative version)')])];
    const { dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['annotation.svg']),
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([
      { file: 'annotation.svg', family: 'warning', reason: 'R2-annotation-caption' },
    ]);
  });

  it('R3 drops a named plate file regardless of its caption', () => {
    const selection = makeSelection({
      r3PlateFiles: [{ family: 'warning', file: 'plate-only.svg' }],
    });
    const chapters = [
      chapter('warning-signs', [pic('plate-only.svg', 'A perfectly normal caption.')]),
    ];
    const { dropped } = selectSigns(
      chapters,
      selection,
      makeShapeRules(),
      bytesFor(['plate-only.svg']),
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([
      { file: 'plate-only.svg', family: 'warning', reason: 'R3-plate-file' },
    ]);
  });

  it('R4 drops a later picture with a file name already selected', () => {
    const chapters = [
      chapter('warning-signs', [
        pic('repeat.svg', 'First caption.'),
        pic('repeat.svg', 'Second caption.'),
      ]),
    ];
    const { signs, dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['repeat.svg']),
      HOOKS_EMPTY,
    );
    expect(signs).toHaveLength(1);
    expect(signs[0].name).toBe('First caption.');
    expect(dropped).toEqual([
      { file: 'repeat.svg', family: 'warning', reason: 'R4-duplicate-file' },
    ]);
  });

  it('R4 drops a picture whose caption repeats an earlier one in the same family, across chapters', () => {
    const chapters = [
      chapter('regulatory-signs', [pic('first.svg', 'No stopping at any time.')]),
      chapter('speed-limit-signs', [pic('second.svg', 'No stopping at any time.')]),
    ];
    const { signs, dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['first.svg', 'second.svg']),
      HOOKS_EMPTY,
    );
    expect(signs).toHaveLength(1);
    expect(signs[0].id).toBe('orders-first');
    expect(dropped).toEqual([
      { file: 'second.svg', family: 'orders', reason: 'R4-duplicate-caption' },
    ]);
  });

  it('E11: (e) the same caption in two different families is kept in both', () => {
    const chapters = [
      chapter('warning-signs', [pic('warn-x.svg', 'Shared caption text.')]),
      chapter('regulatory-signs', [pic('order-x.svg', 'Shared caption text.')]),
    ];
    const { signs, dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['warn-x.svg', 'order-x.svg']),
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([]);
    expect(signs.map((s) => s.id).sort()).toEqual(['orders-order-x', 'warning-warn-x']);
  });

  it('R5 fails the whole run when an allow-listed motorway file sits under an excluded sub-heading', () => {
    const selection = makeSelection({
      allowLists: { motorway: ['excluded.svg'], direction: [], information: [], 'road-works': [] },
    });
    const chapters = [
      chapter('motorway-signs', [
        pic('excluded.svg', 'A motorway sign.', {
          subHeading: 'Motorway signals and variable signs',
        }),
      ]),
    ];
    expect(() =>
      selectSigns(chapters, selection, makeShapeRules(), bytesFor(['excluded.svg']), HOOKS_EMPTY),
    ).toThrow(/R5/);
  });

  it('R6 drops a file over the 150 KiB size limit', () => {
    const chapters = [chapter('warning-signs', [pic('big.svg', 'A big sign.')])];
    const bigBytes = new Map([['big.svg', Buffer.alloc(153_601, 'a')]]);
    const { dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bigBytes,
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([{ file: 'big.svg', family: 'warning', reason: 'R6-size' }]);
  });

  it('E11: (a) R6 keeps a file of exactly the 153,600-byte size limit', () => {
    const chapters = [chapter('warning-signs', [pic('exact.svg', 'Exactly at the limit.')])];
    const exactBytes = new Map([['exact.svg', Buffer.alloc(153_600, 'a')]]);
    const { signs, dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      exactBytes,
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([]);
    expect(signs).toHaveLength(1);
  });

  it('R6 drops a file whose SVG source is unsafe', () => {
    const chapters = [chapter('warning-signs', [pic('unsafe.svg', 'An unsafe sign.')])];
    const unsafeBytes = bytesFor(['unsafe.svg'], '<svg><script>alert(1)</script></svg>');
    const { dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      unsafeBytes,
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([{ file: 'unsafe.svg', family: 'warning', reason: 'R6-unsafe' }]);
  });

  it('R6 drops a picture with no fetched bytes at all', () => {
    const chapters = [
      chapter('warning-signs', [pic('missing-bytes.svg', 'A sign with no bytes.')]),
    ];
    const { dropped } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      new Map(),
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([
      { file: 'missing-bytes.svg', family: 'warning', reason: 'R6-missing-bytes' },
    ]);
  });
});

describe('selectSigns: R7 allow-list families', () => {
  it('fails the whole run when an allow-listed file is missing from its chapter', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: [], information: ['missing.svg'], 'road-works': [] },
    });
    const chapters = [chapter('information-signs', [pic('present.svg', 'A caption.')])];
    expect(() =>
      selectSigns(chapters, selection, makeShapeRules(), bytesFor(['present.svg']), HOOKS_EMPTY),
    ).toThrow(/R7/);
    expect(() => candidateFiles(chapters, selection)).toThrow(/R7/);
  });
});

describe('selectSigns: R8 named paragraph captions', () => {
  const selection = makeSelection({ r8NamedParagraphCaptions: R8_ENTRIES });

  it('overrides the caption, name and meaning for the STOP and GIVE WAY pictures', () => {
    const chapters = [
      chapter('regulatory-signs', [
        pic('stop-sign-and-road-marking.svg', '', {
          precedingParagraphText: "The 'STOP' sign and road markings: you must stop at the line.",
        }),
        pic('give-way-road-marking.svg', '(alternative in Wales)', {
          precedingParagraphText:
            "The 'GIVE WAY' sign and road markings: you must give way to traffic.",
        }),
      ]),
    ];
    const { signs, dropped } = selectSigns(
      chapters,
      selection,
      makeShapeRules(),
      bytesFor(['stop-sign-and-road-marking.svg', 'give-way-road-marking.svg']),
      HOOKS_EMPTY,
    );
    expect(dropped).toEqual([]);
    expect(signs).toHaveLength(2);

    const stop = findSign(signs, 'orders-stop-sign-and-road-marking');
    expect(stop.name).toBe("The 'STOP' sign and road markings");
    expect(stop.meaning).toBe("The 'STOP' sign and road markings: you must stop at the line.");

    const giveWay = findSign(signs, 'orders-give-way-road-marking');
    expect(giveWay.name).toBe("The 'GIVE WAY' sign and road markings");
    expect(giveWay.meaning).toBe(
      "The 'GIVE WAY' sign and road markings: you must give way to traffic.",
    );
  });

  it('fails the whole run when the STOP picture is missing entirely', () => {
    const chapters = [
      chapter('regulatory-signs', [
        pic('give-way-road-marking.svg', '(alternative in Wales)', {
          precedingParagraphText: "The 'GIVE WAY' sign and road markings: you must give way.",
        }),
      ]),
    ];
    expect(() =>
      selectSigns(
        chapters,
        selection,
        makeShapeRules(),
        bytesFor(['give-way-road-marking.svg']),
        HOOKS_EMPTY,
      ),
    ).toThrow(/R8/);
  });

  it('fails the whole run when the preceding paragraph does not start with the expected prefix', () => {
    const chapters = [
      chapter('regulatory-signs', [
        pic('stop-sign-and-road-marking.svg', '', {
          precedingParagraphText: 'Some unrelated paragraph.',
        }),
        pic('give-way-road-marking.svg', '(alternative in Wales)', {
          precedingParagraphText: "The 'GIVE WAY' sign and road markings: you must give way.",
        }),
      ]),
    ];
    expect(() =>
      selectSigns(
        chapters,
        selection,
        makeShapeRules(),
        bytesFor(['stop-sign-and-road-marking.svg', 'give-way-road-marking.svg']),
        HOOKS_EMPTY,
      ),
    ).toThrow(/R8/);
  });

  it('E11: (d) fails the whole run when the named file has no preceding <p> at all', () => {
    const chapters = [
      chapter('regulatory-signs', [
        pic('stop-sign-and-road-marking.svg', '', { precedingParagraphText: null }),
        pic('give-way-road-marking.svg', '(alternative in Wales)', {
          precedingParagraphText: "The 'GIVE WAY' sign and road markings: you must give way.",
        }),
      ]),
    ];
    expect(() =>
      selectSigns(
        chapters,
        selection,
        makeShapeRules(),
        bytesFor(['stop-sign-and-road-marking.svg', 'give-way-road-marking.svg']),
        HOOKS_EMPTY,
      ),
    ).toThrow(/R8/);
  });
});

describe('selectSigns: C1-C9 classification', () => {
  const shapeRules = makeShapeRules();

  it('C1 matches a named exception file directly, ignoring its caption', () => {
    const chapters = [chapter('warning-signs', [pic('exception.svg', 'Any caption at all.')])];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      shapeRules,
      bytesFor(['exception.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C1');
    expect(signs[0].shape).toBe('other');
    expect(signs[0].colours).toEqual([]);
  });

  it('C2 classifies every other warning sign as a red triangle', () => {
    const chapters = [chapter('warning-signs', [pic('bend.svg', 'Bend ahead.')])];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      shapeRules,
      bytesFor(['bend.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C2');
    expect(signs[0].shape).toBe('triangle');
    expect(signs[0].colours).toEqual(['red']);
  });

  it('C3 classifies a "No " order sign as a red circle', () => {
    const chapters = [
      chapter('regulatory-signs', [pic('no-entry.svg', 'No entry for vehicular traffic.')]),
    ];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      shapeRules,
      bytesFor(['no-entry.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C3');
    expect(signs[0].shape).toBe('circle');
    expect(signs[0].colours).toEqual(['red']);
  });

  it('C4 classifies a "Turn " order sign as a blue circle', () => {
    const chapters = [chapter('regulatory-signs', [pic('turn-left.svg', 'Turn left ahead.')])];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      shapeRules,
      bytesFor(['turn-left.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C4');
    expect(signs[0].shape).toBe('circle');
    expect(signs[0].colours).toEqual(['blue']);
  });

  it('C9 classifies an order sign that matches neither C3 nor C4', () => {
    const chapters = [
      chapter('regulatory-signs', [pic('give-priority.svg', 'Give priority to oncoming traffic.')]),
    ];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      shapeRules,
      bytesFor(['give-priority.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C9');
    expect(signs[0].shape).toBe('other');
  });

  it('C5 classifies a motorway exit-slip-road sign as a green-and-white rectangle', () => {
    const selection = makeSelection({
      allowLists: { motorway: ['exit-slip.svg'], direction: [], information: [], 'road-works': [] },
    });
    const chapters = [
      chapter('motorway-signs', [
        pic('exit-slip.svg', 'Exit ahead.', { subHeading: 'Direction signs on exit slip roads' }),
      ]),
    ];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['exit-slip.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C5');
    expect(signs[0].colours).toEqual(['green', 'white']);
  });

  it('C6 classifies every other motorway sign as a blue rectangle', () => {
    const selection = makeSelection({
      allowLists: {
        motorway: ['plain-motorway.svg'],
        direction: [],
        information: [],
        'road-works': [],
      },
    });
    const chapters = [chapter('motorway-signs', [pic('plain-motorway.svg', 'Services 2 miles.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['plain-motorway.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C6');
    expect(signs[0].colours).toEqual(['blue']);
  });

  it('C7 classifies a primary-route direction sign as green only', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: ['primary.svg'], information: [], 'road-works': [] },
    });
    const chapters = [chapter('direction-signs', [pic('primary.svg', 'Primary route.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['primary.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C7-green');
    expect(signs[0].colours).toEqual(['green']);
  });

  it('C7 classifies a non-primary-route direction sign as white only', () => {
    const selection = makeSelection({
      allowLists: {
        motorway: [],
        direction: ['non-primary.svg'],
        information: [],
        'road-works': [],
      },
    });
    const chapters = [chapter('direction-signs', [pic('non-primary.svg', 'Non-primary route.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['non-primary.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C7-white');
    expect(signs[0].colours).toEqual(['white']);
  });

  it('C7 classifies a sign mentioning both route kinds as green and white', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: ['both.svg'], information: [], 'road-works': [] },
    });
    const chapters = [
      chapter('direction-signs', [
        pic('both.svg', 'Sign on a primary route indicating a non-primary route.'),
      ]),
    ];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['both.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C7-green-white');
    expect(signs[0].colours).toEqual(['green', 'white']);
  });

  it('C7 does not match a direction sign mentioning neither route kind, falling through to C9', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: ['castle.svg'], information: [], 'road-works': [] },
    });
    const chapters = [chapter('direction-signs', [pic('castle.svg', 'Castle.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['castle.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C9');
    expect(signs[0].shape).toBe('other');
  });

  it('C8 classifies an information sign mentioning neither route kind as a blue rectangle', () => {
    const selection = makeSelection({
      allowLists: {
        motorway: [],
        direction: [],
        information: ['castle-info.svg'],
        'road-works': [],
      },
    });
    const chapters = [chapter('information-signs', [pic('castle-info.svg', 'Castle.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['castle-info.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C8');
    expect(signs[0].colours).toEqual(['blue']);
  });

  it('C9 classifies every road-works sign', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: [], information: [], 'road-works': ['cone.svg'] },
    });
    const chapters = [chapter('road-works-signs', [pic('cone.svg', 'Traffic cone.')])];
    const { signs } = selectSigns(
      chapters,
      selection,
      shapeRules,
      bytesFor(['cone.svg']),
      HOOKS_EMPTY,
    );
    expect(signs[0].rule).toBe('C9');
  });
});

describe('classifySign', () => {
  it('E11: (g) classifies C5 by sub-heading, C7-green-white, and lets C1 take precedence over a C3 caption prefix', () => {
    const shapeRules = makeShapeRules();

    expect(
      classifySign(
        {
          family: 'motorway',
          file: 'exit-slip.svg',
          caption: 'Exit ahead.',
          subHeading: 'Direction signs on exit slip roads',
        },
        shapeRules,
      ).rule,
    ).toBe('C5');

    expect(
      classifySign(
        {
          family: 'direction',
          file: 'both.svg',
          caption: 'Sign on a primary route indicating a non-primary route.',
          subHeading: '',
        },
        shapeRules,
      ).rule,
    ).toBe('C7-green-white');

    // Caption starts "No ", which would otherwise match C3 — but this file
    // is named in C1's match.files, and C1 is tried first.
    expect(
      classifySign(
        {
          family: 'orders',
          file: 'no-entry-c1-exception.svg',
          caption: 'No entry at all.',
          subHeading: '',
        },
        shapeRules,
      ).rule,
    ).toBe('C1');
  });
});

describe('selectSigns: hookId (E11(2))', () => {
  it('E11: (f) hookId comes from appliesTo.signIds of the hooks passed in, and is null for a sign no hook names', () => {
    const hooks: HooksFile = {
      hooks: [
        {
          id: 'test-hook',
          text: 'Test hook text.',
          appliesTo: { signIds: ['orders-min-30-mph'] },
          cites: [{ source: 'signing-system', sentence: 'Minimum speed permitted.' }],
        },
      ],
    };
    const chapters = [
      chapter('regulatory-signs', [
        pic('min-30-mph.svg', 'Minimum speed permitted, in miles per hour.'),
        pic('ordinary.svg', 'Give priority to oncoming traffic.'),
      ]),
    ];
    const { signs } = selectSigns(
      chapters,
      makeSelection(),
      makeShapeRules(),
      bytesFor(['min-30-mph.svg', 'ordinary.svg']),
      hooks,
    );
    expect(findSign(signs, 'orders-min-30-mph').hookId).toBe('test-hook');
    expect(findSign(signs, 'orders-ordinary').hookId).toBeNull();
  });
});

describe('candidateFiles', () => {
  it('includes a picture that passes R1-R5 without needing its bytes yet, with its own url and mediaId', () => {
    const chapters = [chapter('warning-signs', [pic('plain.svg', 'A plain sign.')])];
    expect(candidateFiles(chapters, makeSelection())).toEqual([
      {
        family: 'warning',
        file: 'plain.svg',
        url: 'https://assets.publishing.service.gov.uk/media/deadbeef/plain.svg',
        mediaId: 'deadbeef',
      },
    ]);
  });

  it('excludes a picture R1 would drop', () => {
    const chapters = [chapter('warning-signs', [pic('empty.svg', '')])];
    expect(candidateFiles(chapters, makeSelection())).toEqual([]);
  });

  it('includes every allow-listed file for an allow-list family', () => {
    const selection = makeSelection({
      allowLists: { motorway: [], direction: [], information: ['listed.svg'], 'road-works': [] },
    });
    const chapters = [chapter('information-signs', [pic('listed.svg', 'An information sign.')])];
    expect(candidateFiles(chapters, selection)).toEqual([
      {
        family: 'information',
        file: 'listed.svg',
        url: 'https://assets.publishing.service.gov.uk/media/deadbeef/listed.svg',
        mediaId: 'deadbeef',
      },
    ]);
  });
});

describe('svgIsSafe', () => {
  it('is true for an ordinary SVG', () => {
    expect(svgIsSafe('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')).toBe(true);
  });

  it('is false for a script tag', () => {
    expect(svgIsSafe('<svg><script>alert(1)</script></svg>')).toBe(false);
  });

  it('is false for an event-handler attribute', () => {
    expect(svgIsSafe('<svg onload="alert(1)"><rect/></svg>')).toBe(false);
  });

  it('is false for a remote href', () => {
    expect(svgIsSafe('<svg><a href="http://evil.example/x"><rect/></a></svg>')).toBe(false);
  });

  it('is false for a remote xlink:href', () => {
    expect(svgIsSafe('<svg><use xlink:href="https://evil.example/x"/></svg>')).toBe(false);
  });
});

describe('E11: (l) integration — parseChapter then selectSigns on the fixture', () => {
  it("finds the fixture's R8 sign and drops its uncaptioned, annotation- and duplicate-caption pictures", () => {
    const pictures = parseChapter(fixtureHtml);
    const chapters = [chapter('regulatory-signs', pictures)];
    const selection = makeSelection({ r8NamedParagraphCaptions: R8_ENTRIES });
    const { signs, dropped } = selectSigns(
      chapters,
      selection,
      makeShapeRules(),
      bytesFor(pictures.map((p) => p.file)),
      HOOKS_EMPTY,
    );

    const stop = findSign(signs, 'orders-stop-sign-and-road-marking');
    expect(stop.name).toBe("The 'STOP' sign and road markings");
    expect(stop.meaning).toBe(
      "The 'STOP' sign and road markings: another example paragraph used only to exercise R8 in the fixture.",
    );
    const giveWay = findSign(signs, 'orders-give-way-road-marking');
    expect(giveWay.name).toBe("The 'GIVE WAY' sign and road markings");

    expect(signs.some((s) => s.id === 'orders-uncaptioned-example')).toBe(false);
    expect(signs.some((s) => s.id === 'orders-bracket-example')).toBe(false);
    expect(signs.some((s) => s.id === 'orders-no-entry-duplicate-example')).toBe(false);

    expect(dropped).toContainEqual({
      file: 'uncaptioned-example.svg',
      family: 'orders',
      reason: 'R1-empty-caption',
    });
    expect(dropped).toContainEqual({
      file: 'bracket-example.svg',
      family: 'orders',
      reason: 'R2-annotation-caption',
    });
    expect(dropped).toContainEqual({
      file: 'no-entry-duplicate-example.svg',
      family: 'orders',
      reason: 'R4-duplicate-caption',
    });
  });
});
