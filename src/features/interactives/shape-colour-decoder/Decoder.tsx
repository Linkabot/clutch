// Shape & Colour Decoder: /learn/signs/decoder (mounted lazily from
// ../registry by src/app/routes.tsx), rendered inside the app shell's
// <main> with its header Back button and tab bar (scout-e.md's CHOSEN 2B
// DecoderB artboard; plan.md Step 26, amendment E33, and Step 7/amendment
// E12's Q4/Q5/PS10). A roadside stage (ground, four round trees and a post)
// holds a big sign the app draws itself -- a circle, triangle or rectangle
// in red, blue, green or white, never a real sign picture (D7) -- as the
// Change shape button, with a plate naming the pair; a yellow callout hint
// beside it reads "Tap the sign to change its shape", and another beside
// the colour chip reads "Tap to change colour" -- both real text (not
// aria-hidden), shown only until the visit's first change (state.changes
// === 0) and with pointer-events: none, so a tap on the shape hint (which
// overlaps the sign button) still changes the shape. Under the stage, the
// Change colour chip shows a colour dot and the colour's name, and its
// accessible name includes the colour (PS10, "Change colour, Red") so
// repeated same-named lookups in tests resolve the button actually shown.
// Below: the pair's title and body sentence, its rule hook in bold (valid
// pairs) or the app's own "aren't used" strings (Q5, invalid pairs, whose
// shape draws as an unfilled dashed outline, decoder__dashed, instead of a
// filled shape -- the ghost of the previous pair gets the same treatment,
// so it must resolve that PREVIOUS pair's own validity, not the current
// one), three example sign pictures captioned with displayName(sign)
// linking to their sign pages (valid pairs only, once loadSigns resolves),
// and the exceptions sentence (valid pairs only). All teaching text besides
// Q5's own strings is read from getShapeRules() and getHooks() through
// ./decoder's pairContent. The two buttons are never remounted, so focus
// stays on the one just tapped; the popping sign, the text block, the
// examples grid and the fading ghost of the previous pair are keyed by the
// change count, so their CSS motion restarts on every tap. Under reduced
// motion the root carries the static modifier and no ghost is drawn.
// Depends on: react, react-router-dom (Link), ../../../content/signs
// (getShapeRules, getHooks, loadSigns, displayName), ../../../content/
// schemas (Sign type), ../../../ui (SignPlate), ../shared/SignImage,
// ../shared/useReducedMotion, ./decoder, ./decoder.css.
// Depended on by: ./index.tsx, tests/unit/decoder.test.tsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { displayName, getHooks, getShapeRules, loadSigns } from '../../../content/signs';
import type { Sign } from '../../../content/schemas';
import { SignPlate } from '../../../ui';
import SignImage from '../shared/SignImage';
import { useReducedMotion } from '../shared/useReducedMotion';
import {
  COLOUR_LABELS,
  exampleSigns,
  nextColour,
  nextShape,
  pairContent,
  pairLabel,
  type DecoderColour,
  type DecoderShape,
} from './decoder';
import './decoder.css';

interface DecoderPair {
  shape: DecoderShape;
  colour: DecoderColour;
}

interface DecoderState {
  shape: DecoderShape;
  colour: DecoderColour;
  previous: DecoderPair | null;
  changes: number;
}

const INITIAL_STATE: DecoderState = {
  shape: 'circle',
  colour: 'red',
  previous: null,
  changes: 0,
};

/** The circle: a face, then an edge ring (red, green), a solid disc (blue) or an ink-lined edge (white). */
function CircleArt({ colour }: { colour: DecoderColour }) {
  return (
    <>
      <circle className="decoder__shape decoder__face" cx="82" cy="78" r="76" />
      {colour === 'blue' && (
        <circle className="decoder__shape decoder__solid" cx="82" cy="78" r="73" />
      )}
      {colour === 'white' && (
        <circle
          className="decoder__shape decoder__outline"
          cx="82"
          cy="78"
          r="64"
          strokeWidth="22"
        />
      )}
      {colour !== 'blue' && (
        <circle className="decoder__shape decoder__edge" cx="82" cy="78" r="64" strokeWidth="18" />
      )}
    </>
  );
}

const TRIANGLE_PATH = 'M82 14 L152 138 H12 Z';

/** The triangle: a face, then its edge; white gets an ink outline just before the edge. */
function TriangleArt({ colour }: { colour: DecoderColour }) {
  return (
    <>
      <path className="decoder__shape decoder__face" d={TRIANGLE_PATH} />
      {colour === 'white' && (
        <path
          className="decoder__shape decoder__outline"
          d={TRIANGLE_PATH}
          strokeWidth="18"
          strokeLinejoin="round"
        />
      )}
      <path
        className="decoder__shape decoder__edge"
        d={TRIANGLE_PATH}
        strokeWidth="14"
        strokeLinejoin="round"
      />
    </>
  );
}

/** The rectangle: filled with the colour; white gets an ink outline on top. */
function RectangleArt({ colour }: { colour: DecoderColour }) {
  return (
    <>
      <rect
        className="decoder__shape decoder__solid"
        x="10"
        y="36"
        width="144"
        height="104"
        rx="10"
      />
      {colour === 'white' && (
        <rect
          className="decoder__shape decoder__outline"
          x="10"
          y="36"
          width="144"
          height="104"
          rx="10"
          strokeWidth="3"
        />
      )}
    </>
  );
}

/** An unused pair's shape (Q5): an unfilled dashed outline, not a filled shape. */
function DashedArt({ shape }: { shape: DecoderShape }) {
  if (shape === 'circle') {
    return (
      <circle className="decoder__shape decoder__dashed" cx="82" cy="78" r="72" strokeWidth="8" />
    );
  }
  if (shape === 'triangle') {
    return (
      <path
        className="decoder__shape decoder__dashed"
        d={TRIANGLE_PATH}
        strokeWidth="8"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <rect
      className="decoder__shape decoder__dashed"
      x="10"
      y="36"
      width="144"
      height="104"
      rx="10"
      strokeWidth="8"
    />
  );
}

/**
 * The app's own drawing of a pair; every paint comes from decoder.css
 * classes. `valid` draws the shape filled per its colour; an invalid pair
 * draws DashedArt instead -- the caller resolves `valid` for the PAIR being
 * drawn (the ghost resolves its own, previous, pair, not the current one).
 */
function DecoderArt({ shape, colour, valid }: DecoderPair & { valid: boolean }) {
  return (
    <svg
      className={`decoder__art decoder__paint--${colour}`}
      data-shape={shape}
      data-colour={colour}
      width="164"
      height="156"
      viewBox="0 0 164 156"
      aria-hidden="true"
    >
      {valid ? (
        <>
          {shape === 'circle' && <CircleArt colour={colour} />}
          {shape === 'triangle' && <TriangleArt colour={colour} />}
          {shape === 'rectangle' && <RectangleArt colour={colour} />}
        </>
      ) : (
        <DashedArt shape={shape} />
      )}
    </svg>
  );
}

function Decoder() {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<DecoderState>(INITIAL_STATE);
  const [signs, setSigns] = useState<Sign[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((loaded) => {
        if (cancelled) return;
        setSigns(loaded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shapeRules = getShapeRules();
  const hooks = getHooks();
  const content = pairContent(state.shape, state.colour, shapeRules, hooks);
  const examples = signs !== null && content.valid ? exampleSigns(content.exampleFiles, signs) : [];

  function handleShapeTap(): void {
    setState((current) => ({
      shape: nextShape(current.shape),
      colour: current.colour,
      previous: { shape: current.shape, colour: current.colour },
      changes: current.changes + 1,
    }));
  }

  function handleColourTap(): void {
    setState((current) => ({
      shape: current.shape,
      colour: nextColour(current.colour),
      previous: { shape: current.shape, colour: current.colour },
      changes: current.changes + 1,
    }));
  }

  const rootClassName = ['decoder', reducedMotion ? 'decoder--static' : 'decoder--animated'].join(
    ' ',
  );

  return (
    <div className={rootClassName}>
      <h1 className="decoder__heading">Shape & Colour Decoder</h1>

      <div className="decoder__stage">
        <div className="decoder__ground" />
        <div className="decoder__tree decoder__tree--1" />
        <div className="decoder__tree decoder__tree--2" />
        <div className="decoder__tree decoder__tree--3" />
        <div className="decoder__tree decoder__tree--4" />
        <div className="decoder__post" />
        {!reducedMotion && state.previous !== null && (
          <div key={`ghost-${state.changes}`} className="decoder__ghost" aria-hidden="true">
            <DecoderArt
              shape={state.previous.shape}
              colour={state.previous.colour}
              valid={
                pairContent(state.previous.shape, state.previous.colour, shapeRules, hooks).valid
              }
            />
          </div>
        )}
        <button
          type="button"
          className="decoder__sign"
          aria-label="Change shape"
          onClick={handleShapeTap}
        >
          <span key={`pop-${state.changes}`} className="decoder__pop">
            <DecoderArt shape={state.shape} colour={state.colour} valid={content.valid} />
          </span>
        </button>
        {state.changes === 0 && (
          <p className="decoder__hint decoder__hint--shape">Tap the sign to change its shape</p>
        )}
        <div className="decoder__label" aria-live="polite">
          <SignPlate>{pairLabel(state.shape, state.colour)}</SignPlate>
        </div>
      </div>

      <div className="decoder__controls">
        <div className="decoder__colour-wrap">
          <button
            type="button"
            className="decoder__colour"
            aria-label={`Change colour, ${COLOUR_LABELS[state.colour]}`}
            onClick={handleColourTap}
          >
            <span className={`decoder__dot decoder__paint--${state.colour}`} aria-hidden="true" />
            {`${COLOUR_LABELS[state.colour]} ▸`}
          </button>
          {state.changes === 0 && (
            <p className="decoder__hint decoder__hint--colour">Tap to change colour</p>
          )}
        </div>
      </div>

      <div key={`text-${state.changes}`} className="decoder__text">
        <h2 className="decoder__title">{content.title}</h2>
        <p className="decoder__body">{content.body}</p>
        {content.hookText !== null && <p className="decoder__hook">{content.hookText}</p>}
      </div>

      {examples.length > 0 && (
        <div key={`examples-${state.changes}`} className="decoder__examples">
          {examples.map((sign) => (
            <Link key={sign.id} to={`/learn/signs/${sign.id}`} className="decoder__example">
              <span className="decoder__picture">
                <SignImage sign={sign} alt="" />
              </span>
              <span className="decoder__caption">{displayName(sign)}</span>
            </Link>
          ))}
        </div>
      )}

      {content.valid && <p className="decoder__exceptions">{shapeRules.exceptionsSentence}</p>}
    </div>
  );
}

export default Decoder;
