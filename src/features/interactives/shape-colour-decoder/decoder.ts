// Shape & Colour Decoder's pure logic (plan.md Step 26, amendment E33, and
// Step 7/amendment E12's Q5), with no React: the shape and colour cycles
// the two stage buttons step through (both wrap), the plate label for a
// pair, the content a pair shows and the signs its example files name. A
// valid pair is a decoderPairs row of shape-rules.json whose shape and
// colour both match: it shows that row's title and body, its rule hook
// from hooks.json (rule-<shape>-<colour>) and its three example files, in
// order -- every piece of that teaching text comes from the content files
// passed in. Any other pair shows the app's own strings (Q5): the title
// `${colour} ${shape plural} aren't used` (SHAPE_PLURALS, not
// shapeSentences) and the body "UK signs don't use this pair.", no hook and
// no examples -- shape-rules.json's catch-all decoderPairs row (shape:
// null) is no longer read.
// Depends on: src/content/schemas (ShapeRulesFile, Hook and Sign types only).
// Depended on by: ./Decoder.tsx, tests/unit/decoder.test.tsx.

import type { Hook, ShapeRulesFile, Sign } from '../../../content/schemas';

export const SHAPES = ['circle', 'triangle', 'rectangle'] as const;
export const COLOURS = ['red', 'blue', 'green', 'white'] as const;

export type DecoderShape = (typeof SHAPES)[number];
export type DecoderColour = (typeof COLOURS)[number];

export const SHAPE_LABELS: Record<DecoderShape, string> = {
  circle: 'Circle',
  triangle: 'Triangle',
  rectangle: 'Rectangle',
};

/** Plural nouns for an unused pair's title (Q5), e.g. "Blue triangles aren't used". */
export const SHAPE_PLURALS: Record<DecoderShape, string> = {
  circle: 'circles',
  triangle: 'triangles',
  rectangle: 'rectangles',
};

export const COLOUR_LABELS: Record<DecoderColour, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  white: 'White',
};

/** The shape after `shape` in SHAPES, wrapping from the last back to the first. */
export function nextShape(shape: DecoderShape): DecoderShape {
  return SHAPES[(SHAPES.indexOf(shape) + 1) % SHAPES.length];
}

/** The colour after `colour` in COLOURS, wrapping from the last back to the first. */
export function nextColour(colour: DecoderColour): DecoderColour {
  return COLOURS[(COLOURS.indexOf(colour) + 1) % COLOURS.length];
}

/** The stage plate's label for a pair: the shape label, a middle dot, the colour label. */
export function pairLabel(shape: DecoderShape, colour: DecoderColour): string {
  return `${SHAPE_LABELS[shape]} · ${COLOUR_LABELS[colour]}`;
}

export interface PairContent {
  valid: boolean;
  title: string;
  body: string;
  hookId: string | null;
  hookText: string | null;
  exampleFiles: string[];
}

/**
 * What the Decoder shows for a pair. A valid pair (a decoderPairs row of
 * shape-rules.json whose shape and colour both match) reads that row's
 * title and body and its rule hook from hooks.json. Any other pair gets
 * the app's own "aren't used" title and body (Q5) -- shape-rules.json's
 * catch-all row is never read. Throws only when a valid pair's row has no
 * title or its rule hook is missing.
 */
export function pairContent(
  shape: DecoderShape,
  colour: DecoderColour,
  shapeRules: ShapeRulesFile,
  hooks: readonly Hook[],
): PairContent {
  const row = shapeRules.decoderPairs.find(
    (pair) => pair.shape === shape && pair.colour === colour,
  );
  if (row) {
    if (row.title === null) {
      throw new Error(`decoder pair ${shape}/${colour} has no title`);
    }
    const hookId = `rule-${shape}-${colour}`;
    const hook = hooks.find((candidate) => candidate.id === hookId);
    if (!hook) {
      throw new Error(`no memory hook with id ${hookId}`);
    }
    return {
      valid: true,
      title: row.title,
      body: row.body,
      hookId,
      hookText: hook.text,
      exampleFiles: [...row.examples],
    };
  }

  return {
    valid: false,
    title: `${COLOUR_LABELS[colour]} ${SHAPE_PLURALS[shape]} aren't used`,
    body: "UK signs don't use this pair.",
    hookId: null,
    hookText: null,
    exampleFiles: [],
  };
}

/**
 * The sign for each example file, in the files' order, matched by the file
 * name at the end of sign.image. Throws naming the file when it matches no
 * sign or more than one.
 */
export function exampleSigns(files: readonly string[], signs: readonly Sign[]): Sign[] {
  return files.map((file) => {
    const matches = signs.filter((sign) => sign.image.split('/').pop() === file);
    if (matches.length !== 1) {
      throw new Error(`expected exactly one sign for ${file}, found ${matches.length}`);
    }
    return matches[0];
  });
}
