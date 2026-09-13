// Highway Code sections list: /learn/code. Shows the OGL licence statement
// and every ingested section, grouped by kind (Rules, Introduction,
// Signals, Annexes, Other) via groupSections, with a rule-range badge on
// each rules section computed by ruleRange from its ruleIds — never from
// its slug or title (amendment P3, handoffs/phase-1-highway-code/plan.md).
// The heading row also carries a Link to the search screen (Step 17).
// Depends on: react-router-dom, lucide-react (Search icon), ../../ui
// (SignPanel), ../../content/loaders (getHighwayCodeIndex), ./sections
// (groupSections, ruleRange).
// Depended on by: src/app/routes.tsx.
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SignPanel } from '../../ui';
import { getHighwayCodeIndex } from '../../content/loaders';
import { groupSections, ruleRange } from './sections';

function HighwayCodeSectionsScreen() {
  const index = getHighwayCodeIndex();
  const groups = groupSections(index);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>The Highway Code</h1>
        <Link
          to="/learn/code/search"
          aria-label="Search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '44px',
            color: 'var(--color-ink)',
          }}
        >
          <Search size={24} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <p style={{ color: 'var(--color-muted)' }}>
        Contains public sector information licensed under the Open Government Licence v3.0.
      </p>
      {groups.map(
        (group) =>
          group.sections.length > 0 && (
            <section key={group.kind}>
              <h2>{group.label}</h2>
              {group.sections.map((section) => (
                <Link
                  key={section.slug}
                  to={`/learn/code/${section.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    minHeight: '44px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-hairline)',
                    textDecoration: 'none',
                    color: 'var(--color-ink)',
                  }}
                >
                  <span>{section.title}</span>
                  {section.kind === 'rules' && (
                    <SignPanel colour="blue" size="small">
                      <span className="sign-label">{ruleRange(section.ruleIds)}</span>
                    </SignPanel>
                  )}
                </Link>
              ))}
            </section>
          ),
      )}
    </div>
  );
}

export default HighwayCodeSectionsScreen;
