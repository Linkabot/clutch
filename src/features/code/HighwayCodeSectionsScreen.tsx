// Highway Code hub: /learn/code. Shows a search box (Q15: replaces the old
// search icon-link with a real "Search the Highway Code" text box, which
// navigates to /learn/code/search?q=<text> on submit), the OGL licence
// statement, and a three-tab SegmentedControl (Rules / Signs & signals /
// Annexes, CODE_TABS in ./sections) splitting the whole Highway Code —
// Lincoln's chosen mockup, option C, hub.png (Q15). The chosen tab lives in
// the URL as ?tab=rules|signs|annexes (missing or unknown reads as
// 'rules'), updated with history.replaceState (react-router's { replace:
// true }) so Back from a section returns to the tab it was opened from
// without an extra history entry. Every section in the chosen tab renders
// as a ListRow: a section that holds rules (ruleIds.length > 0, e.g. the
// Introduction's H1–H3, which sits in the Rules tab but is not classified
// under the "rules" kind label; review finding C1,
// handoffs/phase-1-highway-code/plan.md Step 15b) shows its rule-range
// badge (ruleRange, from ./sections) as the row's trailing element; a
// section with no rules shows ListRow's default chevron instead.
// Depends on: react, react-router-dom, ../../ui (SignPanel),
// ../../ui/ListRow (imported by path — not re-exported from ../../ui),
// ../../ui/SegmentedControl (imported by path, same reason),
// ../../content/loaders (getHighwayCodeIndex), ./sections (CODE_TABS,
// groupSections, ruleRange), ./code.css.
// Depended on by: src/app/routes.tsx.
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SignPanel } from '../../ui';
import ListRow from '../../ui/ListRow';
import SegmentedControl from '../../ui/SegmentedControl';
import { getHighwayCodeIndex } from '../../content/loaders';
import { CODE_TABS, groupSections, ruleRange } from './sections';
import './code.css';

/** Reads ?tab=<id> from the URL; a missing or unknown value means the first tab (Rules). */
function tabIdFromParams(searchParams: URLSearchParams): string {
  const requested = searchParams.get('tab');
  const match = CODE_TABS.find((tab) => tab.id === requested);
  return match ? match.id : CODE_TABS[0].id;
}

function HighwayCodeSectionsScreen() {
  const index = getHighwayCodeIndex();
  const groups = groupSections(index);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const activeTabId = tabIdFromParams(searchParams);
  const activeGroup = groups.find((group) => group.id === activeTabId) ?? groups[0];

  function handleTabChange(id: string): void {
    const params = new URLSearchParams(searchParams);
    params.set('tab', id);
    setSearchParams(params, { replace: true });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    navigate(`/learn/code/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div>
      <h1>The Highway Code</h1>
      <form role="search" className="code-search" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the Highway Code"
          aria-label="Search the Highway Code"
          className="code-search__input"
        />
      </form>
      <p className="code-ogl">
        Contains public sector information licensed under the Open Government Licence v3.0.
      </p>
      <SegmentedControl
        label="Highway Code parts"
        options={CODE_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeGroup.id}
        onChange={handleTabChange}
      />
      <div className="code-sections">
        {activeGroup.sections.map((section) => (
          <ListRow
            key={section.slug}
            to={`/learn/code/${section.slug}`}
            title={section.title}
            trailing={
              section.ruleIds.length > 0 ? (
                <span className="rule-badge--list">
                  <SignPanel colour="blue" size="small" block>
                    <span className="sign-label">{ruleRange(section.ruleIds)}</span>
                  </SignPanel>
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export default HighwayCodeSectionsScreen;
