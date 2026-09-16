// Search screen: /learn/code/search. Offline full-text search across the
// whole ingested Highway Code (every rule and every non-rule section),
// powered by getSearchIndex()/search() in ./search.ts, which build their
// MiniSearch index from content chunks the service worker already
// precached — nothing here reaches the network. The placeholder reads
// "Preparing search…" until that index has resolved, then switches to the
// real prompt; input is debounced by 150ms; an empty query renders no
// list, a query with no matches renders "No results for "<query>"".
// Depends on: react, react-router-dom, minisearch (SearchResult type, for
// the shape ./search.ts's stored fields produce), ./search (search,
// resultHref, getSearchIndex), ../../ui (SignPanel, Chip).
// Depended on by: src/app/routes.tsx.
import { useEffect, useState, type CSSProperties } from 'react';
import type { SearchResult } from 'minisearch';
import { Link } from 'react-router-dom';
import { getSearchIndex, search, resultHref } from './search';
import { SignPanel, Chip } from '../../ui';

const DEBOUNCE_MS = 150;

type CompletedSearch = { query: string; results: SearchResult[] };

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '44px',
  padding: '8px 0',
  borderBottom: '1px solid var(--color-hairline)',
  textDecoration: 'none',
  color: 'var(--color-ink)',
};

function SearchScreen() {
  const [indexReady, setIndexReady] = useState(false);
  const [query, setQuery] = useState('');
  const [completed, setCompleted] = useState<CompletedSearch>();

  // The index is built once, from content already precached by the service
  // worker; the placeholder only switches to the real prompt once this
  // promise resolves. setIndexReady runs inside the promise callback, never
  // synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    getSearchIndex().then(() => {
      if (!cancelled) setIndexReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search: waits DEBOUNCE_MS after the last keystroke, then
  // searches and records which query the results belong to, so a still-
  // pending newer query never shows an older query's stale results.
  // setCompleted runs inside the timer's promise callback, never
  // synchronously in the effect body. An empty query needs no state reset
  // here — "no list for an empty query" is derived below instead.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      search(trimmed).then((found) => {
        if (!cancelled) setCompleted({ query: trimmed, results: found });
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const trimmedQuery = query.trim();
  const rows = trimmedQuery && completed?.query === trimmedQuery ? completed.results : [];
  const showNoResults =
    trimmedQuery !== '' && completed?.query === trimmedQuery && rows.length === 0;

  return (
    <div>
      <h1>Search The Highway Code</h1>
      <input
        type="search"
        data-testid="hc-search"
        aria-label="Search The Highway Code"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={indexReady ? 'Search rules and annexes' : 'Preparing search…'}
        style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
      />
      {trimmedQuery !== '' && rows.length > 0 && (
        <ul data-testid="search-results" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((result) => (
            <li key={String(result.id)}>
              <Link to={resultHref(result)} style={rowStyle}>
                {result.kind === 'rule' ? (
                  <>
                    <span className="rule-badge--list">
                      <SignPanel colour="blue" size="small">
                        <span className="sign-label">Rule {result.ruleId}</span>
                      </SignPanel>
                    </span>
                    <span style={{ flex: 1 }}>
                      <span>{result.lead || result.title}</span>
                      <span style={{ display: 'block', color: 'var(--color-muted)' }}>
                        {result.sectionTitle}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{result.title}</span>
                    <Chip tone="neutral">Section</Chip>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {showNoResults && <p>No results for &quot;{trimmedQuery}&quot;</p>}
    </div>
  );
}

export default SearchScreen;
