// Search screen: /learn/code/search. Offline full-text search across the
// whole ingested Highway Code (every rule and every non-rule section),
// powered by getSearchIndex()/search() in ./search.ts, which build their
// MiniSearch index from content chunks the service worker already
// precached — nothing here reaches the network. The input is seeded from
// the ?q= query parameter (e.g. arriving from HighwayCodeSectionsScreen's
// search box) and keeps its text in the URL as the learner types (Q15;
// history.replaceState via { replace: true }, so a later Back does not
// step through every keystroke). The placeholder reads "Preparing
// search…" until the index has resolved, then "Search the Highway Code";
// input is debounced by 150ms; an empty query renders no list, a query
// with no matches renders "No results for "<query>"". Result rows render
// through ListRow: a rule result leads with its rule badge, as the section
// screen's rule rows do (amendment E7), and a section result ends with a
// "Section" chip.
// Depends on: react, react-router-dom, minisearch (SearchResult type, for
// the shape ./search.ts's stored fields produce), ./search (search,
// resultHref, getSearchIndex), ../../ui (SignPanel, Chip), ../../ui/ListRow
// (imported by path — not re-exported from ../../ui), ./code.css.
// Depended on by: src/app/routes.tsx.
import { useEffect, useState, type ChangeEvent } from 'react';
import type { SearchResult } from 'minisearch';
import { useSearchParams } from 'react-router-dom';
import { getSearchIndex, search, resultHref } from './search';
import { SignPanel, Chip } from '../../ui';
import ListRow from '../../ui/ListRow';
import './code.css';

const DEBOUNCE_MS = 150;

type CompletedSearch = { query: string; results: SearchResult[] };

function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [indexReady, setIndexReady] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
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

  // Keeps the URL's ?q= in step with the input, from the change handler
  // itself (never from an effect body — eslint-plugin-react-hooks 7 errors
  // on a setState call synchronous inside an effect, and setSearchParams is
  // one).
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    setQuery(value);
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  }

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
        onChange={handleChange}
        placeholder={indexReady ? 'Search the Highway Code' : 'Preparing search…'}
        className="code-search__input"
      />
      {trimmedQuery !== '' && rows.length > 0 && (
        <ul data-testid="search-results" className="code-search-results">
          {rows.map((result) => (
            <li key={String(result.id)}>
              <ListRow
                to={resultHref(result)}
                title={result.kind === 'rule' ? result.lead || result.title : result.title}
                subtitle={result.kind === 'rule' ? result.sectionTitle : undefined}
                leading={
                  result.kind === 'rule' ? (
                    <span className="rule-badge--list">
                      <SignPanel colour="blue" size="small" block>
                        <span className="sign-label">Rule {result.ruleId}</span>
                      </SignPanel>
                    </span>
                  ) : undefined
                }
                trailing={result.kind === 'rule' ? undefined : <Chip tone="neutral">Section</Chip>}
              />
            </li>
          ))}
        </ul>
      )}
      {showNoResults && <p>No results for &quot;{trimmedQuery}&quot;</p>}
    </div>
  );
}

export default SearchScreen;
