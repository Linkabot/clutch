// Small pill label for a Highway Code rule's status (law vs advice), or a
// neutral tag. Background and text stay neutral — only the ring colour
// encodes the tone (amendment P1, handoffs/phase-1-highway-code/plan.md).
// Depends on: react (JSX only); styled by src/ui/primitives.css.
// Depended on by: src/ui/index.ts; tests/unit/ui.test.ts.
import type { ReactNode } from 'react';

interface ChipProps {
  tone: 'law' | 'advice' | 'neutral';
  children: ReactNode;
}

function Chip({ tone, children }: ChipProps) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export default Chip;
