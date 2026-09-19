// Highway Code section screen: /learn/code/:slug. Loads one section via
// loadSection and renders it — a "rule section" is one that holds at
// least one rule (section.rules.length > 0, e.g. the Introduction's
// H1–H3, which are not classified under the "rules" kind label; review
// finding C1, plan.md Step 15b): its preamble split into ordered
// body/heading blocks (preambleBlocks, ./interlude, amendment E6c) — a
// bare heading line (1–80 characters, e.g. "Signals (rules 103 to 106)")
// renders inside its own .hc-interlude band, exactly like the section's
// other interludes, instead of as body text; a first bare line repeating
// the section's own title (e.g. the Introduction's own "Introduction"
// line) is dropped — followed by one row per rule (Step 16's RuleScreen
// holds a single rule's full text, ListRow'd here as its own summary
// truncated at a word boundary, M08/PS25), with each section.interlude
// (Step 5, S3) normalised by interludeHtml and rendered through its own
// HcHtml inside a .hc-interlude wrapper immediately before the row of its
// beforeRuleId, and any beforeRuleId: null interludes after the last row
// (Step 8, S3 on screen). Every other section (no rules) gets its whole
// body, unchanged. Sets document.title while a section is loaded.
// Depends on: react, react-router-dom, ../../content/loaders (loadSection),
// ../../content/schemas (Section, Rule, Interlude types), ../../content/text
// (htmlToText, truncateAtWord), ../../ui (SignPanel, Chip), ../../ui/ListRow
// (imported by path — not re-exported from ../../ui), ./HcHtml, ./interlude
// (interludeHtml, preambleBlocks), ./code.css.
// Depended on by: src/app/routes.tsx, tests/unit/section-screen.test.tsx.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadSection } from '../../content/loaders';
import type { Section, Rule, Interlude } from '../../content/schemas';
import { htmlToText, truncateAtWord } from '../../content/text';
import { SignPanel, Chip } from '../../ui';
import ListRow from '../../ui/ListRow';
import HcHtml from './HcHtml';
import { interludeHtml, preambleBlocks } from './interlude';
import './code.css';

type SectionState =
  | { status: 'loading'; slug: string }
  | { status: 'loaded'; slug: string; section: Section }
  | { status: 'not-found'; slug: string };

function ruleSummary(rule: Rule): string {
  return rule.lead ?? truncateAtWord(htmlToText(rule.html), 90);
}

/** Groups a section's interludes by the rule id they precede, keeping the
 * beforeRuleId: null run(s) — rendered after the last rule row — separate. */
function groupInterludes(interludes: Interlude[]): {
  byRuleId: Map<string, Interlude[]>;
  trailing: Interlude[];
} {
  const byRuleId = new Map<string, Interlude[]>();
  const trailing: Interlude[] = [];
  for (const interlude of interludes) {
    if (interlude.beforeRuleId === null) {
      trailing.push(interlude);
      continue;
    }
    const existing = byRuleId.get(interlude.beforeRuleId);
    if (existing) {
      existing.push(interlude);
    } else {
      byRuleId.set(interlude.beforeRuleId, [interlude]);
    }
  }
  return { byRuleId, trailing };
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
  const { byRuleId: interludesByRuleId, trailing: trailingInterludes } = groupInterludes(
    section.interludes,
  );

  return (
    <div>
      <h1>{section.title}</h1>
      {isRuleSection ? (
        <>
          {preambleBlocks(section.preambleHtml, section.title).map((block, index) =>
            block.kind === 'heading' ? (
              <div key={`preamble-${index}`} className="hc-interlude">
                <HcHtml html={block.html} />
              </div>
            ) : (
              <HcHtml key={`preamble-${index}`} html={block.html} />
            ),
          )}
          {section.rules.map((rule) => (
            <div key={rule.id}>
              {(interludesByRuleId.get(rule.id) ?? []).map((interlude, index) => (
                <div key={`${rule.id}-${index}`} className="hc-interlude">
                  <HcHtml html={interludeHtml(interlude.html)} />
                </div>
              ))}
              <ListRow
                to={`/code/rule/${rule.id}`}
                leading={
                  <span className="rule-badge--list">
                    <SignPanel colour="blue" size="small" block>
                      <span className="sign-label">Rule {rule.id}</span>
                    </SignPanel>
                  </span>
                }
                title={ruleSummary(rule)}
                trailing={rule.law ? <Chip tone="law">Law</Chip> : undefined}
              />
            </div>
          ))}
          {trailingInterludes.map((interlude, index) => (
            <div key={`trailing-${index}`} className="hc-interlude">
              <HcHtml html={interludeHtml(interlude.html)} />
            </div>
          ))}
        </>
      ) : (
        <HcHtml html={section.bodyHtml} />
      )}
    </div>
  );
}

export default SectionScreen;
