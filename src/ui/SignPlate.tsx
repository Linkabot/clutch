// White road-plate label (e.g. a short tag such as a rule number), with an
// optional "current" tone that inverts to a filled blue plate. Purely
// presentational. Text and border use --color-sign-ink, not --color-ink,
// so the plate reads the same in light and dark mode (amendment P1,
// handoffs/phase-1-highway-code/plan.md).
// Depends on: react (JSX only); styled by src/ui/primitives.css.
// Depended on by: src/ui/index.ts; tests/unit/ui.test.ts.
import type { ReactNode } from 'react';

interface SignPlateProps {
  tone?: 'default' | 'current';
  children: ReactNode;
}

function SignPlate({ tone = 'default', children }: SignPlateProps) {
  const className = ['sign-plate', tone === 'current' ? 'sign-plate--current' : null]
    .filter(Boolean)
    .join(' ');

  return <span className={className}>{children}</span>;
}

export default SignPlate;
