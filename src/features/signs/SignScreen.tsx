// Sign page: /learn/signs/:id (added to src/app/routes.tsx). A picture card
// (the sign's own SignImage plus its 0-3 collection dots, or a COLLECTED
// badge at 3 -- both reusing SignsScreen's .signs-tile__dot/--empty and
// .signs-tile__badge classes), the family pill (familyMeta(sign.family).pill
// plus a small shape/colour glyph the app draws itself, never a second real
// sign picture), the caption as the page's only <h1> (displayName(sign),
// Q2 -- a shorter, larger style for captions that fit isShortCaption(sign.
// name), a smaller one otherwise so a long caption doesn't push the buttons
// off the first screen), an info card with a "Shape & colour" row (the
// matching shape-rule sentences, absent for rule C1/C9's `other` signs,
// which have none) and a "Memory tip" row (hookFor(sign, 'page'), which
// Step 6 made fall back to the rule's or family's hook -- absent only for
// the few signs (C9 direction signs) that resolve none -- the card itself
// is absent when both rows are), a full-width primary Button ("Practise
// signs like this", starting a family round at /practice/tap?family=<sign.
// family> -- Step 9 makes Tap read that param; until then it plays a
// normal round) and a secondary button-styled Link to the sign's Highway
// Code section, then the KYTS attribution line (with the OGL words a real
// link, PS13), and, for a sign marked `thirdPartyMark`, a third-party
// emblem notice under it. While signs are loading the screen renders no
// sign content; if loadSigns() rejects it shows <LoadFailed>, whose Retry
// (an attempt counter set from the click handler, never from the effect
// body -- eslint-plugin-react-hooks 7) loads again; for an id that matches
// no sign it renders "Sign not found." and a link back to the browser.
// Depends on: react, react-router-dom, lucide-react (BookOpen),
// ../../content/signs (loadSigns, getShapeRules, hookFor, displayName),
// ../../content/schemas (Sign type), ../../engine/progress-state
// (useProgressStore), ../../engine/progress (isCollected), ../../ui
// (Button), ../../ui/LoadFailed (default export, straight from its file
// like ../../ui/ListRow), ../interactives/shared/SignImage,
// ../interactives/shared/distractors (isShortCaption), ./families
// (familyMeta), ./signs.css.
// Depended on by: src/app/routes.tsx.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { loadSigns, getShapeRules, hookFor, displayName } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { useProgressStore } from '../../engine/progress-state';
import { isCollected } from '../../engine/progress';
import { Button } from '../../ui';
import LoadFailed from '../../ui/LoadFailed';
import SignImage from '../interactives/shared/SignImage';
import { isShortCaption } from '../interactives/shared/distractors';
import { familyMeta } from './families';
import './signs.css';

type LoadStatus = 'loading' | 'ready' | 'error';

/** The "Shape & colour" row's text: the matching rule's sentences, joined by one space, or '' for a shape with no rule (C1, C9). */
function shapeColourText(sign: Sign): string {
  const { rules } = getShapeRules();
  const ruleId = sign.rule.startsWith('C7-') ? 'C7' : sign.rule;
  const rule = rules.find((r) => r.id === ruleId);
  const sentences = sign.rule.startsWith('C7-')
    ? rule?.outcomes?.[sign.rule]?.sentences
    : rule?.sentences;
  return (sentences ?? []).join(' ');
}

/** The collecting line (Q3) for `correct` 0, 1 or 2 right answers; 3 shows the COLLECTED badge instead. */
function collectingLine(correct: number): string {
  if (correct === 0) return 'Get it right 3 times to collect it';
  if (correct === 1) return 'Get it right 2 more times to collect it';
  return 'Get it right 1 more time to collect it';
}

/** The family pill's small glyph, drawn from the sign's own shape and first colour -- never a second real sign picture. `other` shapes (C1, C9) show no glyph. */
function renderFamilyGlyph(sign: Sign) {
  if (sign.shape === 'triangle') {
    return (
      <svg width="14" height="13" viewBox="0 0 22 20" aria-hidden="true">
        <path
          d="M11 2.5 19.5 17.5H2.5Z"
          strokeLinejoin="round"
          className="sign-page__glyph--triangle"
        />
      </svg>
    );
  }
  const colour = sign.colours[0];
  if (sign.shape === 'circle') {
    const glyphClass =
      colour === 'blue' ? 'sign-page__glyph--circle-blue' : 'sign-page__glyph--circle-red';
    return (
      <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" className={glyphClass} />
      </svg>
    );
  }
  if (sign.shape === 'rectangle') {
    const rectClass =
      colour === 'green'
        ? 'sign-page__glyph--rectangle-green'
        : colour === 'white'
          ? 'sign-page__glyph--rectangle-white'
          : 'sign-page__glyph--rectangle-blue';
    return (
      <svg width="16" height="12" viewBox="0 0 24 18" aria-hidden="true">
        <rect x="1.5" y="1.5" width="21" height="15" rx="2" className={rectClass} />
      </svg>
    );
  }
  return null;
}

function SignScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [signs, setSigns] = useState<Sign[]>([]);
  const [attempt, setAttempt] = useState(0);
  const signProgress = useProgressStore((s) => s.signProgress);
  const progressStatus = useProgressStore((s) => s.status);
  const load = useProgressStore((s) => s.load);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    loadSigns()
      .then((loaded) => {
        if (cancelled) return;
        setSigns(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function handleRetry(): void {
    setStatus('loading');
    setAttempt((a) => a + 1);
  }

  if (status === 'loading') {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="sign-page">
        <LoadFailed onRetry={handleRetry} />
      </div>
    );
  }

  const sign = signs.find((s) => s.id === id);

  if (!sign) {
    return (
      <div className="sign-page">
        <h1>Sign not found.</h1>
        <Link to="/learn/signs" style={{ marginTop: '12px', display: 'inline-block' }}>
          All traffic signs
        </Link>
      </div>
    );
  }

  const progress = progressStatus === 'ready' ? signProgress : new Map<string, number>();
  const correct = progress.get(sign.id) ?? 0;
  const collected = isCollected(correct);
  const shapeColour = shapeColourText(sign);
  const hook = hookFor(sign, 'page');

  return (
    <div className="sign-page">
      <div className="sign-page__picture-card">
        <span className="sign-page__picture">
          <SignImage sign={sign} alt="" />
        </span>
        {collected ? (
          <span className="signs-tile__badge">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            COLLECTED
          </span>
        ) : (
          <div className="sign-page__progress-row">
            <span className="signs-tile__status">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={
                    index < correct ? 'signs-tile__dot' : 'signs-tile__dot signs-tile__dot--empty'
                  }
                />
              ))}
            </span>
            <span className="sign-page__progress-text">{collectingLine(correct)}</span>
          </div>
        )}
      </div>

      <div className="sign-page__pill-row">
        <span className="sign-page__pill">
          {renderFamilyGlyph(sign)}
          <span>{familyMeta(sign.family).pill}</span>
        </span>
      </div>

      <h1
        className={
          isShortCaption(sign.name) ? 'sign-page__title' : 'sign-page__title sign-page__title--long'
        }
      >
        {displayName(sign)}
      </h1>

      {(shapeColour !== '' || hook) && (
        <div className="sign-page__info">
          {shapeColour !== '' && (
            <div className="sign-page__info-row">
              <div className="sign-page__info-label">Shape & colour</div>
              <div className="sign-page__info-value">{shapeColour}</div>
            </div>
          )}
          {shapeColour !== '' && hook && <div className="sign-page__info-divider" />}
          {hook && (
            <div className="sign-page__info-row">
              <div className="sign-page__info-label">Memory tip</div>
              <div className="sign-page__info-value sign-page__info-value--hook">{hook.text}</div>
            </div>
          )}
        </div>
      )}

      <Button
        variant="primary"
        className="sign-page__full-width sign-page__play"
        onClick={() => navigate(`/practice/tap?family=${sign.family}`)}
      >
        Practise signs like this
      </Button>

      <Link
        to={`/learn/code/${sign.refs[0].slug}`}
        className="button button--secondary sign-page__full-width sign-page__code-link"
      >
        <BookOpen size={20} aria-hidden="true" />
        <span>Traffic signs in The Highway Code</span>
      </Link>

      {/* Kept as JS strings around the link (not raw JSX text) so Prettier
          never reflows the whitespace around it, and the visible sentence
          stays exactly as it was before the OGL words became a link
          (PS13). */}
      <p className="sign-page__attribution">
        {'Sign image and wording: Know Your Traffic Signs, © Crown copyright 2023, '}
        <a
          className="text-link"
          href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
          rel="external noopener"
          target="_blank"
        >
          Open Government Licence v3.0
        </a>
        {'.'}
      </p>

      {/* Step 28a: a third-party emblem notice, shown only for a sign
          flagged thirdPartyMark, kept as one JS string like the line
          above it. */}
      {sign.thirdPartyMark ? (
        <p className="sign-page__attribution">
          {
            'The emblem on this sign belongs to a third party. The Open Government Licence does not cover third-party rights or trade marks, so reusing this picture may need permission from the owner of the emblem.'
          }
        </p>
      ) : null}
    </div>
  );
}

export default SignScreen;
