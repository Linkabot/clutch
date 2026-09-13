// Fetches public/ATTRIBUTION.md (self-hosted, precached since Step 3) and
// renders it on the Me tab in a surface card, above the fixed "not an
// official app" disclaimer and the OGL licence sentence — both of which stay
// visible even before any Highway Code content ships.
// Depends on: react.
// Depended on by: src/features/me/MeScreen.tsx.
import { useEffect, useState } from 'react';

type AttributionState =
  { status: 'loading' } | { status: 'loaded'; text: string } | { status: 'error' };

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
    <div>
      <p data-testid="not-official" style={{ color: 'var(--color-muted)' }}>
        Not an official DVSA or government app.
      </p>
      <p style={{ color: 'var(--color-muted)' }}>
        Contains public sector information licensed under the Open Government Licence v3.0.
      </p>
      <h2>Attribution</h2>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {state.status === 'loading' && 'Loading attribution…'}
        {state.status === 'error' && 'Attribution file unavailable'}
        {state.status === 'loaded' && state.text}
      </div>
    </div>
  );
}

export default Attribution;
