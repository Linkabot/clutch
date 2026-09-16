// Rule page: /code/rule/:id — a single Highway Code rule, deep-linkable
// on its own (from search results, a shared link, or the section list).
// Loads the rule and its owning section via loadRule, then renders: a
// rule-number badge, a muted link back to the owning section, a
// law/advice Chip (a MUST/MUST NOT rule is "Law", everything else is
// "Advice" — Decision 13's wording), the owning section's interludes
// whose beforeRuleId equals this rule's id (Step 5, S3), each normalised
// by interludeHtml (amendment E4) and rendered through its own HcHtml
// inside a .hc-interlude wrapper above the rule body (Step 8, S3 on
// screen), the rule's lead sentence (or its title, when it has no lead) as
// the page heading, its sanitised HTML body, the Rule 126
// stopping-distance table when this is Rule 126, previous/next navigation
// within the owning section, and a footer with the OGL licence statement
// and an external link to the same rule on GOV.UK.
// Depends on: react, react-router-dom, ../../content/loaders (loadRule,
// getHighwayCodeIndex), ../../content/schemas (Rule, Section types),
// ../../ui (SignPanel, Chip, Button), ./HcHtml, ./ruleNav (neighbours),
// ./StoppingDistanceTable, ./interlude (interludeHtml).
// Depended on by: src/app/routes.tsx.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadRule, getHighwayCodeIndex } from '../../content/loaders';
import type { Rule, Section } from '../../content/schemas';
import { SignPanel, Chip, Button } from '../../ui';
import HcHtml from './HcHtml';
import { interludeHtml } from './interlude';
import { neighbours } from './ruleNav';
import StoppingDistanceTable from './StoppingDistanceTable';

type RuleState =
  | { status: 'loading'; id: string }
  | { status: 'loaded'; id: string; rule: Rule; section: Section }
  | { status: 'not-found'; id: string };

function RuleScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RuleState>({ status: 'loading', id });

  useEffect(() => {
    let cancelled = false;
    loadRule(id)
      .then((result) => {
        if (cancelled) return;
        setState(
          result
            ? { status: 'loaded', id, rule: result.rule, section: result.section }
            : { status: 'not-found', id },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'not-found', id });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (state.status === 'loaded') {
      document.title = `Rule ${state.rule.id} · Clutch`;
    }
  }, [state]);

  // loadRule is keyed by id, but the state update above lands one render
  // after the route param changes; while state still belongs to a
  // different id than the one currently routed to, derive "loading"
  // rather than flashing the previous rule's stale content.
  const current: RuleState = state.id === id ? state : { status: 'loading', id };

  if (current.status === 'loading') {
    return <p>Loading…</p>;
  }

  if (current.status === 'not-found') {
    return (
      <div>
        <h1>Rule not found</h1>
        <Link to="/learn/code">Back to The Highway Code</Link>
      </div>
    );
  }

  const { rule, section } = current;
  const ruleIds = section.rules.map((sectionRule) => sectionRule.id);
  const { prev, next } = neighbours(ruleIds, rule.id);
  const govUkHref = `${section.sourceUrl}#rule${rule.id.toLowerCase()}`;
  const interludes = section.interludes.filter((interlude) => interlude.beforeRuleId === rule.id);

  return (
    <div>
      <div data-testid="rule-badge">
        <SignPanel colour="blue" size="small">
          <span className="sign-label">Rule {rule.id}</span>
        </SignPanel>
      </div>
      <p>
        <Link to={`/learn/code/${section.slug}`} style={{ color: 'var(--color-muted)' }}>
          Back to {section.title}
        </Link>
      </p>
      {rule.law ? (
        <Chip tone="law">Law · says MUST</Chip>
      ) : (
        <Chip tone="advice">Advice · says 'should'</Chip>
      )}
      <h1 className="lead">{rule.lead ?? rule.title}</h1>
      {interludes.map((interlude, index) => (
        <div key={`${rule.id}-${index}`} className="hc-interlude">
          <HcHtml html={interludeHtml(interlude.html)} />
        </div>
      ))}
      <div data-testid="rule-body">
        <HcHtml html={rule.html} />
      </div>
      {rule.id === '126' && <StoppingDistanceTable />}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', margin: '16px 0' }}
      >
        {prev ? (
          <Button variant="secondary" onClick={() => navigate(`/code/rule/${prev}`)}>
            Previous · Rule {prev}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="secondary" onClick={() => navigate(`/code/rule/${next}`)}>
            Next · Rule {next}
          </Button>
        ) : (
          <span />
        )}
      </div>
      <footer style={{ color: 'var(--color-muted)' }}>
        <p>{getHighwayCodeIndex().licence.statement}</p>
        <a href={govUkHref} rel="external noopener" target="_blank">
          View on GOV.UK (online)
        </a>
      </footer>
    </div>
  );
}

export default RuleScreen;
