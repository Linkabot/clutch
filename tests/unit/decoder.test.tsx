/**
 * @vitest-environment jsdom
 *
 * Unit and render tests for the Shape & Colour Decoder (plan.md Step 26 and
 * amendments E33 and E34). The pure logic: SHAPES and COLOURS in order, nextShape
 * and nextColour wrapping, and pairLabel's middle dot. Over the real
 * shape-rules.json, hooks.json and signs.json: each of the six valid pairs
 * gives its row's title and body, the exact rule hook id and text, and three
 * example files that exampleSigns maps to the exact sign ids, in order, each
 * with the pair's shape and colour; each of the six other pairs gives its
 * shape's sentence, the app line, no hook and no examples; exampleSigns
 * throws for a file with no sign or two, and pairContent throws when a
 * valid pair's hook is missing. The screen (jsdom, real timers, a
 * MemoryRouter, a stubbed matchMedia): the Circle · Red start with the
 * animated root, the label's polite live region, no ghost and three example
 * links; a walk through all 12 pairs by tapping, each pinning the drawn
 * art exactly (the svg's size, view box and paint class, then every child
 * shape in DOM order: its tag, decoder__shape plus its one paint class,
 * and every geometry and stroke attribute as rendered); a shape tap and a
 * colour tap each keep the SAME button node (focus stays put) while the
 * popping sign, the text block, the examples grid and the ghost are
 * re-keyed, the ghost showing the previous pair; Triangle · Blue shows the
 * app line with no hook and no examples; the shape and colour cycles wrap
 * on screen (through Circle · White back to Circle · Red); and reduced
 * motion gives the static root, no animated class anywhere and no ghost.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom (test
 * environment), src/content/signs (getShapeRules, getHooks, loadSigns),
 * src/content/schemas (Sign type),
 * src/features/interactives/shape-colour-decoder/decoder,
 * src/features/interactives/shape-colour-decoder/Decoder.tsx.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getHooks, getShapeRules, loadSigns } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';
import {
  COLOURS,
  SHAPES,
  exampleSigns,
  nextColour,
  nextShape,
  pairContent,
  pairLabel,
  type DecoderColour,
  type DecoderShape,
} from '../../src/features/interactives/shape-colour-decoder/decoder';
// With its extension: on a case-insensitive file system an extensionless
// path would first match the pure module decoder.ts beside it.
import Decoder from '../../src/features/interactives/shape-colour-decoder/Decoder.tsx';

let signs: Sign[];

beforeAll(async () => {
  signs = await loadSigns();
});

// --- Expected content (plan.md § Shape and colour rules, § Memory hooks) ------

const APP_LINE = "The signing-system rules don't use this pair. Try another colour.";

const C3_BODY =
  'Red rings or circles tell you what you must not do, e.g. you must not exceed 30 mph, no vehicles over the height shown may proceed.';

const C4_BODY =
  'Blue circles generally give a mandatory instruction, such as ‘turn left’, or indicate a route available only to particular classes of traffic, e.g. buses and cycles only.';

const EXCEPTIONS =
  'There are a few exceptions to the shape and colour rules, to give certain signs greater prominence. Examples are the ‘STOP’ and ‘GIVE WAY’ signs.';

const NO_ENTRY_CAPTION =
  'No entry for vehicular traffic. Where there is an exception for buses or cycles, the sign may be used with a supplementary plate (shown below).';

const SHAPE_SENTENCES: Record<DecoderShape, string> = {
  circle: 'Circles give orders.',
  triangle: 'Triangles warn.',
  rectangle: 'Rectangles inform.',
};

interface ValidPair {
  shape: DecoderShape;
  colour: DecoderColour;
  title: string;
  body: string;
  hookId: string;
  hookText: string;
  ids: string[];
}

const VALID_PAIRS: ValidPair[] = [
  {
    shape: 'circle',
    colour: 'red',
    title: 'Circles give orders.',
    body: C3_BODY,
    hookId: 'rule-circle-red',
    hookText: 'A red ring says no.',
    ids: ['orders-no-entry', 'orders-no-right-turn', 'orders-no-overtaking'],
  },
  {
    shape: 'circle',
    colour: 'blue',
    title: 'Circles give orders.',
    body: C4_BODY,
    hookId: 'rule-circle-blue',
    hookText: 'A blue circle says do.',
    ids: ['orders-turn-left', 'orders-keep-left', 'orders-mini-roundabout'],
  },
  {
    shape: 'triangle',
    colour: 'red',
    title: 'Triangles warn.',
    body: 'All triangular signs are red.',
    hookId: 'rule-triangle-red',
    hookText: 'Three sides, one message: watch out ahead.',
    ids: ['warning-crossroads', 'warning-roundabout', 'warning-slippery-road'],
  },
  {
    shape: 'rectangle',
    colour: 'blue',
    title: 'Rectangles inform.',
    body: 'Blue rectangles are used for information signs except on motorways, where blue is used for direction signs.',
    hookId: 'rule-rectangle-blue',
    hookText: 'Blue box: information, or directions on a motorway.',
    ids: [
      'motorway-start-of-motorway-regulations',
      'information-no-through-road',
      'information-hospital-no-a-and-e',
    ],
  },
  {
    shape: 'rectangle',
    colour: 'green',
    title: 'Rectangles inform.',
    body: 'Green rectangles are used for direction signs on primary routes.',
    hookId: 'rule-rectangle-green',
    hookText: 'Green guides you along primary routes.',
    ids: [
      'direction-london-a2',
      'direction-map-type-roundabout-ahead',
      'information-road-ahead-primary-route',
    ],
  },
  {
    shape: 'rectangle',
    colour: 'white',
    title: 'Rectangles inform.',
    body: 'White rectangles are used for direction signs on non-primary routes, or for plates used in combination with warning and regulatory signs.',
    hookId: 'rule-rectangle-white',
    hookText: 'White guides you along non-primary routes.',
    ids: [
      'direction-junction-ahead-two-non-primary-routes',
      'direction-flag-type-sign-non-primary',
      'information-road-ahead-non-primary-route',
    ],
  },
];

const INVALID_PAIRS: { shape: DecoderShape; colour: DecoderColour }[] = [
  { shape: 'circle', colour: 'green' },
  { shape: 'circle', colour: 'white' },
  { shape: 'triangle', colour: 'blue' },
  { shape: 'triangle', colour: 'green' },
  { shape: 'triangle', colour: 'white' },
  { shape: 'rectangle', colour: 'red' },
];

// --- Pure logic ----------------------------------------------------------------

describe('decoder cycles and labels', () => {
  it('lists SHAPES and COLOURS in cycle order', () => {
    expect(SHAPES).toEqual(['circle', 'triangle', 'rectangle']);
    expect(COLOURS).toEqual(['red', 'blue', 'green', 'white']);
  });

  it('nextShape wraps from rectangle back to circle', () => {
    const seen: DecoderShape[] = [];
    let shape: DecoderShape = 'circle';
    for (let i = 0; i < 3; i++) {
      shape = nextShape(shape);
      seen.push(shape);
    }
    expect(seen).toEqual(['triangle', 'rectangle', 'circle']);
  });

  it('nextColour wraps from white back to red', () => {
    const seen: DecoderColour[] = [];
    let colour: DecoderColour = 'red';
    for (let i = 0; i < 4; i++) {
      colour = nextColour(colour);
      seen.push(colour);
    }
    expect(seen).toEqual(['blue', 'green', 'white', 'red']);
  });

  it('pairLabel joins the shape and colour labels with a middle dot', () => {
    expect(pairLabel('rectangle', 'white')).toBe('Rectangle · White');
    expect(pairLabel('circle', 'red')).toBe('Circle · Red');
  });
});

describe('pairContent and exampleSigns over the content files', () => {
  it('covers all 12 pairs between the valid and invalid lists', () => {
    const keys = [...VALID_PAIRS, ...INVALID_PAIRS].map((pair) => `${pair.shape}+${pair.colour}`);
    expect(new Set(keys).size).toBe(SHAPES.length * COLOURS.length);
  });

  it.each(VALID_PAIRS)(
    '$shape + $colour: its row, hook $hookId and three examples',
    ({ shape, colour, title, body, hookId, hookText, ids }) => {
      const content = pairContent(shape, colour, getShapeRules(), getHooks());
      expect(content.valid).toBe(true);
      expect(content.title).toBe(title);
      expect(content.body).toBe(body);
      expect(content.hookId).toBe(hookId);
      expect(content.hookText).toBe(hookText);
      expect(content.exampleFiles).toHaveLength(3);

      const examples = exampleSigns(content.exampleFiles, signs);
      expect(examples.map((sign) => sign.id)).toEqual(ids);
      for (const sign of examples) {
        expect(sign.shape).toBe(shape);
        expect(sign.colours).toContain(colour);
      }
    },
  );

  it.each(INVALID_PAIRS)(
    '$shape + $colour: the shape sentence, the app line, no hook, no examples',
    ({ shape, colour }) => {
      const content = pairContent(shape, colour, getShapeRules(), getHooks());
      expect(content.valid).toBe(false);
      expect(content.title).toBe(SHAPE_SENTENCES[shape]);
      expect(content.body).toBe(APP_LINE);
      expect(content.hookId).toBeNull();
      expect(content.hookText).toBeNull();
      expect(content.exampleFiles).toEqual([]);
    },
  );

  it('exampleSigns throws for a file that matches no sign, or more than one', () => {
    expect(() => exampleSigns(['nope.svg'], signs)).toThrow(/nope\.svg/);
    const noEntry = signs.find((sign) => sign.id === 'orders-no-entry');
    if (!noEntry) throw new Error('orders-no-entry missing from signs.json');
    expect(() => exampleSigns(['no-entry.svg'], [noEntry, noEntry])).toThrow(/no-entry\.svg/);
  });

  it("pairContent throws when a valid pair's rule hook is missing", () => {
    expect(() => pairContent('circle', 'red', getShapeRules(), [])).toThrow(/rule-circle-red/);
  });
});

// --- Screen ----------------------------------------------------------------------

function stubMatchMedia(matches: boolean) {
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));
}

function renderDecoder(): HTMLElement {
  const view = render(
    <MemoryRouter initialEntries={['/learn/signs/decoder']}>
      <Routes>
        <Route path="/learn/signs/decoder" element={<Decoder />} />
      </Routes>
    </MemoryRouter>,
  );
  return view.container;
}

function one(container: HTMLElement, selector: string): Element {
  const node = container.querySelector(selector);
  if (!node) throw new Error(`no element matches ${selector}`);
  return node;
}

function textOf(container: HTMLElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function exampleHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a.decoder__example')).map(
    (link) => link.getAttribute('href') ?? '',
  );
}

function artOf(container: HTMLElement, selector: string): [string | null, string | null] {
  const art = one(container, `${selector} .decoder__art`);
  return [art.getAttribute('data-shape'), art.getAttribute('data-colour')];
}

// --- The drawn art's exact shapes (amendment E34) --------------------------------

const PAINT_CLASSES = ['decoder__face', 'decoder__edge', 'decoder__solid', 'decoder__outline'];

const SHAPE_NAMES: Record<DecoderShape, string> = {
  circle: 'Circle',
  triangle: 'Triangle',
  rectangle: 'Rectangle',
};

const COLOUR_NAMES: Record<DecoderColour, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  white: 'White',
};

const CIRCLE_CENTRE = { cx: '82', cy: '78' };
const TRIANGLE_D = 'M82 14 L152 138 H12 Z';
const RECT_BOX = { x: '10', y: '36', width: '144', height: '104', rx: '10' };

/** One art child as a string: its tag, its paint class, then its attributes sorted by name. */
function artPart(tag: string, paint: string, attributes: Record<string, string>): string {
  const pairs = Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`);
  return [tag, paint, ...pairs].join(' ');
}

/** The exact children E34 lists for a pair, in DOM order. */
function expectedArt(shape: DecoderShape, colour: DecoderColour): string[] {
  if (shape === 'circle') {
    const face = artPart('circle', 'decoder__face', { ...CIRCLE_CENTRE, r: '76' });
    const edge = artPart('circle', 'decoder__edge', {
      ...CIRCLE_CENTRE,
      r: '64',
      'stroke-width': '18',
    });
    if (colour === 'blue') {
      return [face, artPart('circle', 'decoder__solid', { ...CIRCLE_CENTRE, r: '73' })];
    }
    if (colour === 'white') {
      const outline = artPart('circle', 'decoder__outline', {
        ...CIRCLE_CENTRE,
        r: '64',
        'stroke-width': '22',
      });
      return [face, outline, edge];
    }
    return [face, edge];
  }

  if (shape === 'triangle') {
    const face = artPart('path', 'decoder__face', { d: TRIANGLE_D });
    const edge = artPart('path', 'decoder__edge', {
      d: TRIANGLE_D,
      'stroke-width': '14',
      'stroke-linejoin': 'round',
    });
    if (colour === 'white') {
      const outline = artPart('path', 'decoder__outline', {
        d: TRIANGLE_D,
        'stroke-width': '18',
        'stroke-linejoin': 'round',
      });
      return [face, outline, edge];
    }
    return [face, edge];
  }

  const solid = artPart('rect', 'decoder__solid', RECT_BOX);
  if (colour === 'white') {
    return [solid, artPart('rect', 'decoder__outline', { ...RECT_BOX, 'stroke-width': '3' })];
  }
  return [solid];
}

/**
 * The current sign's drawn art: asserts the svg's size, view box and paint
 * class, and that every child carries decoder__shape plus exactly one paint
 * class, then returns each child as an artPart string with every attribute
 * but class, in DOM order.
 */
function drawnArt(container: HTMLElement, colour: DecoderColour): string[] {
  const svg = one(container, '.decoder__pop .decoder__art');
  expect(svg.tagName.toLowerCase()).toBe('svg');
  expect(svg.getAttribute('width')).toBe('164');
  expect(svg.getAttribute('height')).toBe('156');
  expect(svg.getAttribute('viewBox')).toBe('0 0 164 156');
  expect(svg.classList.contains(`decoder__paint--${colour}`)).toBe(true);

  return Array.from(svg.children).map((child) => {
    const classes = Array.from(child.classList);
    const paints = classes.filter((name) => PAINT_CLASSES.includes(name));
    expect(classes).toContain('decoder__shape');
    expect(paints).toHaveLength(1);
    expect(classes).toHaveLength(2);
    const attributes = Object.fromEntries(
      Array.from(child.attributes)
        .filter((attribute) => attribute.name !== 'class')
        .map((attribute) => [attribute.name, attribute.value]),
    );
    return artPart(child.tagName.toLowerCase(), paints[0], attributes);
  });
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Decoder screen', () => {
  it('starts at Circle · Red with the animated root, its rule text and three example links', async () => {
    const container = renderDecoder();

    expect(one(container, '.decoder').classList.contains('decoder--animated')).toBe(true);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shape & Colour Decoder');
    expect(textOf(container, '.decoder__label')).toBe('Circle · Red');
    expect(one(container, '.decoder__label').getAttribute('aria-live')).toBe('polite');
    expect(textOf(container, '.decoder__title')).toBe('Circles give orders.');
    expect(textOf(container, '.decoder__body')).toBe(C3_BODY);
    expect(textOf(container, '.decoder__hook')).toBe('A red ring says no.');
    expect(screen.getByRole('button', { name: 'Change colour' }).textContent).toBe('Red ▸');
    expect(artOf(container, '.decoder__pop')).toEqual(['circle', 'red']);
    expect(container.querySelector('.decoder__ghost')).toBeNull();
    expect(textOf(container, '.decoder__exceptions')).toBe(EXCEPTIONS);

    await waitFor(() =>
      expect(container.querySelectorAll('.decoder__examples img')).toHaveLength(3),
    );
    for (const image of Array.from(container.querySelectorAll('.decoder__examples img'))) {
      expect(image.getAttribute('alt')).toBe('');
    }
    expect(exampleHrefs(container)).toEqual([
      '/learn/signs/orders-no-entry',
      '/learn/signs/orders-no-right-turn',
      '/learn/signs/orders-no-overtaking',
    ]);
    expect(NO_ENTRY_CAPTION).toHaveLength(143);
    expect(textOf(container, 'a.decoder__example')).toBe(NO_ENTRY_CAPTION);
  });

  it('keeps both buttons while re-keying the animated parts, and cycles shapes and colours', async () => {
    const container = renderDecoder();
    await waitFor(() => expect(exampleHrefs(container)).toHaveLength(3));

    // A shape tap: Triangle · Red.
    const shapeButton = screen.getByRole('button', { name: 'Change shape' });
    const pop0 = one(container, '.decoder__pop');
    const text0 = one(container, '.decoder__text');
    const examples0 = one(container, '.decoder__examples');
    fireEvent.click(shapeButton);
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Triangle · Red'));
    expect(textOf(container, '.decoder__title')).toBe('Triangles warn.');
    expect(textOf(container, '.decoder__body')).toBe('All triangular signs are red.');
    expect(textOf(container, '.decoder__hook')).toBe('Three sides, one message: watch out ahead.');
    await waitFor(() =>
      expect(exampleHrefs(container)).toEqual([
        '/learn/signs/warning-crossroads',
        '/learn/signs/warning-roundabout',
        '/learn/signs/warning-slippery-road',
      ]),
    );
    expect(screen.getByRole('button', { name: 'Change shape' })).toBe(shapeButton);
    expect(one(container, '.decoder__pop')).not.toBe(pop0);
    expect(one(container, '.decoder__text')).not.toBe(text0);
    expect(one(container, '.decoder__examples')).not.toBe(examples0);
    expect(artOf(container, '.decoder__pop')).toEqual(['triangle', 'red']);
    expect(artOf(container, '.decoder__ghost')).toEqual(['circle', 'red']);

    // A colour tap: Triangle · Blue, an invalid pair.
    const colourButton = screen.getByRole('button', { name: 'Change colour' });
    const pop1 = one(container, '.decoder__pop');
    const text1 = one(container, '.decoder__text');
    const ghost1 = one(container, '.decoder__ghost');
    fireEvent.click(colourButton);
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Triangle · Blue'));
    expect(textOf(container, '.decoder__title')).toBe('Triangles warn.');
    expect(textOf(container, '.decoder__body')).toBe(APP_LINE);
    expect(container.querySelector('.decoder__hook')).toBeNull();
    expect(container.querySelectorAll('a.decoder__example')).toHaveLength(0);
    expect(container.querySelector('.decoder__examples')).toBeNull();
    expect(colourButton.textContent).toBe('Blue ▸');
    expect(screen.getByRole('button', { name: 'Change colour' })).toBe(colourButton);
    expect(one(container, '.decoder__pop')).not.toBe(pop1);
    expect(one(container, '.decoder__text')).not.toBe(text1);
    expect(one(container, '.decoder__ghost')).not.toBe(ghost1);
    expect(artOf(container, '.decoder__pop')).toEqual(['triangle', 'blue']);
    expect(artOf(container, '.decoder__ghost')).toEqual(['triangle', 'red']);

    // Two shape taps: Rectangle · Blue, then Circle · Blue (the shape wraps).
    fireEvent.click(shapeButton);
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Rectangle · Blue'));
    fireEvent.click(shapeButton);
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Circle · Blue'));
    expect(textOf(container, '.decoder__title')).toBe('Circles give orders.');
    expect(textOf(container, '.decoder__body')).toBe(C4_BODY);
    expect(textOf(container, '.decoder__hook')).toBe('A blue circle says do.');
    await waitFor(() => expect(exampleHrefs(container)).toHaveLength(3));
    expect(exampleHrefs(container)[0]).toBe('/learn/signs/orders-turn-left');
    expect(artOf(container, '.decoder__ghost')).toEqual(['rectangle', 'blue']);

    // Three colour taps: the colour wraps and the shape never changes.
    for (const [label, colour] of [
      ['Circle · Green', 'green'],
      ['Circle · White', 'white'],
      ['Circle · Red', 'red'],
    ] as const) {
      fireEvent.click(colourButton);
      await waitFor(() => expect(textOf(container, '.decoder__label')).toBe(label));
      expect(artOf(container, '.decoder__pop')).toEqual(['circle', colour]);
    }
    expect(textOf(container, '.decoder__hook')).toBe('A red ring says no.');
    expect(screen.getByRole('button', { name: 'Change shape' })).toBe(shapeButton);
    expect(screen.getByRole('button', { name: 'Change colour' })).toBe(colourButton);
  });

  it('draws the exact art for all 12 pairs, walked by tapping', async () => {
    const container = renderDecoder();
    const shapeButton = screen.getByRole('button', { name: 'Change shape' });
    const colourButton = screen.getByRole('button', { name: 'Change colour' });
    const walked: string[] = [];

    for (const shape of SHAPES) {
      for (const colour of COLOURS) {
        const label = `${SHAPE_NAMES[shape]} · ${COLOUR_NAMES[colour]}`;
        await waitFor(() => expect(textOf(container, '.decoder__label')).toBe(label));
        expect(artOf(container, '.decoder__pop')).toEqual([shape, colour]);
        expect(drawnArt(container, colour)).toEqual(expectedArt(shape, colour));
        walked.push(label);
        // The fourth colour tap wraps back to Red.
        fireEvent.click(colourButton);
      }
      await waitFor(() =>
        expect(textOf(container, '.decoder__label')).toBe(`${SHAPE_NAMES[shape]} · Red`),
      );
      fireEvent.click(shapeButton);
    }

    expect(new Set(walked).size).toBe(12);
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Circle · Red'));
  });

  it('under reduced motion renders decoder--static, no animated class and no ghost', async () => {
    stubMatchMedia(true);
    const container = renderDecoder();

    const root = one(container, '.decoder');
    expect(root.classList.contains('decoder--static')).toBe(true);
    expect(root.classList.contains('decoder--animated')).toBe(false);
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Change shape' }));
    await waitFor(() => expect(textOf(container, '.decoder__label')).toBe('Triangle · Red'));
    await waitFor(() => expect(exampleHrefs(container)).toHaveLength(3));
    expect(container.querySelector('.decoder__ghost')).toBeNull();
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
    expect(one(container, '.decoder').classList.contains('decoder--static')).toBe(true);
  });
});
