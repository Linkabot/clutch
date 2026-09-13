// Coloured road-sign panel (blue or green fill) with a white inner border,
// used to frame short sign-style content such as the app's header
// wordmark. Purely presentational: no state, no side effects.
// Depends on: react (JSX only); class names are styled by
// src/ui/primitives.css (imported once from src/main.tsx, after theme.css).
// Depended on by: src/ui/index.ts; tests/unit/ui.test.ts.
import type { ReactNode } from 'react';

interface SignPanelProps {
  colour: 'blue' | 'green';
  size?: 'normal' | 'small';
  children: ReactNode;
}

function SignPanel({ colour, size = 'normal', children }: SignPanelProps) {
  const outerClassName = [
    'sign-panel',
    `sign-panel--${colour}`,
    size === 'small' ? 'sign-panel--small' : null,
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
