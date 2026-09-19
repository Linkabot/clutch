// Coloured road-sign panel (blue or green fill) with a white inner border,
// used to frame short sign-style content such as the app's header
// wordmark, and (with the `block` prop, M12) full-width content such as a
// Learn tab card or a rule-badge list row. Purely presentational: no
// state, no side effects.
// Depends on: react (JSX only); class names are styled by
// src/ui/primitives.css (imported once from src/main.tsx, after theme.css).
// Depended on by: src/ui/index.ts; tests/unit/ui.test.ts;
// tests/unit/list-row.test.tsx (the `block` prop; later steps add screen
// consumers of `block`).
import type { ReactNode } from 'react';

interface SignPanelProps {
  colour: 'blue' | 'green';
  size?: 'normal' | 'small';
  block?: boolean;
  children: ReactNode;
}

function SignPanel({ colour, size = 'normal', block = false, children }: SignPanelProps) {
  const outerClassName = [
    'sign-panel',
    `sign-panel--${colour}`,
    size === 'small' ? 'sign-panel--small' : null,
    block ? 'sign-panel--block' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={outerClassName}>
      <div className="sign-panel__inner">{children}</div>
    </div>
  );
}

export default SignPanel;
