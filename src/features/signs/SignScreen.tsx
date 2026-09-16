// Sign page: /learn/signs/:id (added to src/app/routes.tsx). A picture card
// (the sign's own SignImage plus its 0-3 collection dots, or a COLLECTED
// badge at 3 -- both reusing SignsScreen's .signs-tile__dot/--empty and
// .signs-tile__badge classes), the family pill (familyMeta(sign.family).pill
// plus a small shape/colour glyph the app draws itself, never a second real
// sign picture), the caption as the page's only <h1> (a shorter, larger
// style for captions that fit isShortCaption, a smaller one otherwise so a
// long caption doesn't push the buttons off the first screen), an info card
// with a "Shape & colour" row (the matching shape-rule sentences, absent for
// rule C1/C9's `other` signs, which have none) and a "Memory hook" row
// (hookFor(sign, 'page'), absent for the many signs with no hook of their
// own -- the card itself is absent when both rows are), a full-width primary
// Button ("Play with this sign", navigating to /practice/tap?sign=<id> --
// that route ships in Step 23) and a secondary button-styled Link to the
// sign's Highway Code section, then the KYTS attribution line. While signs
// are still loading, the screen renders no sign content; for an id that
// matches no sign it renders "Sign not found." and a link back to the
// browser.
// Depends on: react, react-router-dom, lucide-react (BookOpen),
// ../../content/signs (loadSigns, getShapeRules, hookFor),
// ../../content/schemas (Sign type), ../../engine/progress-state
// (useProgressStore), ../../engine/progress (isCollected), ../../ui
// (Button), ../interactives/shared/SignImage, ../interactives/shared/
// distractors (isShortCaption), ./families (familyMeta), ./signs.css.
// Depended on by: src/app/routes.tsx.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { loadSigns, getShapeRules, hookFor } from '../../content/signs';
import type { Sign } from '../../content/schemas';
import { useProgressStore } from '../../engine/progress-state';
import { isCollected } from '../../engine/progress';
import { Button } from '../../ui';
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
  }, []);

  if (status === 'loading') {
    return null;
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
            <span className="sign-page__progress-text">{correct} of 3 correct to collect</span>
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
        {sign.name}
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
              <div className="sign-page__info-label">Memory hook</div>
              <div className="sign-page__info-value sign-page__info-value--hook">{hook.text}</div>
            </div>
          )}
        </div>
      )}

      <Button
        variant="primary"
        className="sign-page__full-width sign-page__play"
        onClick={() => navigate(`/practice/tap?sign=${sign.id}`)}
      >
        Play with this sign
      </Button>

      <Link
        to={`/learn/code/${sign.refs[0].slug}`}
        className="button button--secondary sign-page__full-width sign-page__code-link"
      >
        <BookOpen size={20} aria-hidden="true" />
        <span>Traffic signs in The Highway Code</span>
      </Link>

      {/* Kept as one JS string (not raw JSX text) so Prettier's fill-wrap
          never splits the sentence the plan's check greps as one line. */}
      <p className="sign-page__attribution">
        {
          'Sign image and wording: Know Your Traffic Signs, © Crown copyright 2023, Open Government Licence v3.0.'
        }
      </p>
    </div>
  );
}

export default SignScreen;
