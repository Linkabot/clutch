// Fetches public/ATTRIBUTION.md (self-hosted, precached since Step 3) and
// renders it on the Me tab's About section: the fixed "not an official
// app" and OGL licence lines stay visible immediately, above a closed
// <details> disclosure whose body is the file rendered by ./markdown's
// renderMarkdown (headings, lists, paragraphs, links, strong and code)
// rather than dumped as raw text -- the source of the sideways scroll this
// replaces (plan.md PS11, M15, amendment E25 (f)). The file's own leading
// "# Attribution" heading line is dropped before rendering, since the
// disclosure's own summary label already repeats it; the renderer itself
// stays general, and its own test still counts every heading in the real,
// unmodified file.
// Depends on: react, lucide-react (ChevronRight), ./markdown (renderMarkdown).
// Depended on by: src/features/me/MeScreen.tsx.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { renderMarkdown } from './markdown';

type AttributionState =
  { status: 'loading' } | { status: 'loaded'; text: string } | { status: 'error' };

/** Drops a single leading "# " heading line -- the file's own title, already repeated by the disclosure's summary label. */
function dropLeadingHeading(source: string): string {
  const [firstLine, ...rest] = source.split('\n');
  return /^#\s/.test(firstLine) ? rest.join('\n') : source;
}

function Attribution() {
  const [state, setState] = useState<AttributionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(import.meta.env.BASE_URL + 'ATTRIBUTION.md')
      .then((response) => {
        if (!response.ok) throw new Error(`ATTRIBUTION.md responded ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setState({ status: 'loaded', text });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="me-card">
      <div className="me-about">
        <p data-testid="not-official">Not an official DVSA or government app.</p>
        <p>
          Contains public sector information licensed under the{' '}
          <a
            className="text-link"
            href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            rel="external noopener"
            target="_blank"
          >
            Open Government Licence v3.0
          </a>
          .
        </p>
      </div>
      <details className="attribution">
        <summary>
          <span className="attribution__label">Attribution</span>
          <ChevronRight size={20} className="attribution__chevron" aria-hidden="true" />
        </summary>
        <div className="attribution__body">
          {state.status === 'loading' && 'Loading attribution…'}
          {state.status === 'error' && 'Attribution file unavailable'}
          {state.status === 'loaded' && renderMarkdown(dropLeadingHeading(state.text))}
        </div>
      </details>
    </div>
  );
}

export default Attribution;
