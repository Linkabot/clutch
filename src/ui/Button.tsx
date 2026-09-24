// Primary/secondary action button. Primary is the yellow marking-style
// call to action with a press-down shadow (Decision 13); secondary is a
// plain outlined surface button. Every native <button> attribute passes
// through. Primary text colour is --color-sign-ink, not --color-ink
// (amendment P1, handoffs/phase-1-highway-code/plan.md), so it stays
// legible on yellow in dark mode.
// Depends on: react; styled by src/ui/primitives.css.
// Depended on by: src/ui/index.ts, src/ui/LoadFailed.tsx; tests/unit/ui.test.ts.
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
}

function Button({ variant, className, ...rest }: ButtonProps) {
  const variantClassName = variant === 'primary' ? 'button--primary' : 'button--secondary';
  const fullClassName = ['button', variantClassName, className].filter(Boolean).join(' ');

  return <button type="button" {...rest} className={fullClassName} />;
}

export default Button;
