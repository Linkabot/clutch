// Learn tab hub: entry point into the Highway Code section browser and its
// search screen (Step 17), plus placeholder rows for the traffic-signs and
// lessons features that ship in later phases. The Highway Code card's rule
// count comes from the ingested index (getHighwayCodeIndex), counted at
// render time — no network call, no effect needed, since the index is
// bundled and parsed eagerly.
// Depends on: react-router-dom, ../../ui (SignPanel), ../../content/loaders
// (getHighwayCodeIndex).
// Depended on by: src/app/routes.tsx.
import { Link } from 'react-router-dom';
import { SignPanel } from '../../ui';
import { getHighwayCodeIndex } from '../../content/loaders';

function countNumericRules(): number {
  const index = getHighwayCodeIndex();
  return index.sections.reduce(
    (total, section) => total + section.ruleIds.filter((id) => /^\d+$/.test(id)).length,
    0,
  );
}

function LearnScreen() {
  const ruleCount = countNumericRules();

  return (
    <div>
      <h1>Learn</h1>
      <Link to="/learn/code" style={{ display: 'block', textDecoration: 'none' }}>
        <SignPanel colour="blue">
          <span className="font-display">The Highway Code</span>
          <div>{ruleCount} rules, offline</div>
        </SignPanel>
      </Link>
      {/* A Link styled with Button's own classes: satisfies "secondary
          Button" and "Link" at once without nesting a <button> inside an
          <a> (invalid HTML — Button.tsx renders a native <button>). */}
      <Link
        to="/learn/code/search"
        className="button button--secondary"
        style={{ marginTop: '12px', textDecoration: 'none' }}
      >
        Search The Highway Code
      </Link>
      <p style={{ color: 'var(--color-muted)' }}>Traffic signs — later phase</p>
      <p style={{ color: 'var(--color-muted)' }}>Lessons — later phase</p>
    </div>
  );
}

export default LearnScreen;
