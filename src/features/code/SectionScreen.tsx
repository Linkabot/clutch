// Highway Code section screen: /learn/code/:slug. Loads one section via
// loadSection and renders it — a "rule section" is one that holds at
// least one rule (section.rules.length > 0, e.g. the Introduction's
// H1–H3, which are not classified under the "rules" kind label; review
// finding C1, plan.md Step 15b): its preamble followed by one row per
// rule (Step 16's RuleScreen holds a single rule's full text). Every
// other section (no rules) gets its whole body. Sets document.title
// while a section is loaded.
// Depends on: react, react-router-dom, ../../content/loaders (loadSection),
// ../../content/schemas (Section, Rule types), ../../content/text
// (htmlToText), ../../ui (SignPanel, Chip), ./HcHtml.
// Depended on by: src/app/routes.tsx.
import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadSection } from '../../content/loaders';
import type { Section, Rule } from '../../content/schemas';
import { htmlToText } from '../../content/text';
import { SignPanel, Chip } from '../../ui';
import HcHtml from './HcHtml';

type SectionState =
  | { status: 'loading'; slug: string }
  | { status: 'loaded'; slug: string; section: Section }
  | { status: 'not-found'; slug: string };

const ruleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '44px',
  padding: '8px 0',
  borderBottom: '1px solid var(--color-hairline)',
  textDecoration: 'none',
  color: 'var(--color-ink)',
};

function ruleSummary(rule: Rule): string {
  return rule.lead ?? htmlToText(rule.html).slice(0, 90);
}

function SectionScreen() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<SectionState>({ status: 'loading', slug });

  useEffect(() => {
    let cancelled = false;
    loadSection(slug)
      .then((section) => {
        if (!cancelled) setState({ status: 'loaded', slug, section });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'not-found', slug });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (state.status === 'loaded') {
      document.title = `${state.section.title} · Clutch`;
    }
  }, [state]);

  // loadSection is keyed by slug, but the state update above lands one
  // render after the route param changes; while state still belongs to a
  // different slug than the one currently routed to, derive "loading"
  // rather than flashing the previous section's stale content.
  const current: SectionState = state.slug === slug ? state : { status: 'loading', slug };

  if (current.status === 'loading') {
    return <p>Loading…</p>;
  }

  if (current.status === 'not-found') {
    return (
      <div>
        <h1>Section not found</h1>
        <Link to="/learn/code">Back to The Highway Code</Link>
      </div>
    );
  }

  const { section } = current;
  const isRuleSection = section.rules.length > 0;

  return (
    <div>
      <h1>{section.title}</h1>
      {isRuleSection ? (
        <>
          <HcHtml html={section.preambleHtml} />
          {section.rules.map((rule) => (
            <Link key={rule.id} to={`/code/rule/${rule.id}`} style={ruleRowStyle}>
              <SignPanel colour="blue" size="small">
                <span className="sign-label">Rule {rule.id}</span>
              </SignPanel>
              <span style={{ flex: 1 }}>{ruleSummary(rule)}</span>
              {rule.law && <Chip tone="law">Law</Chip>}
            </Link>
          ))}
        </>
      ) : (
        <HcHtml html={section.bodyHtml} />
      )}
    </div>
  );
}

export default SectionScreen;
