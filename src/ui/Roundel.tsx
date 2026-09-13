// Circular sign-style badge (white with a red ring) showing a short value
// such as a number. Renders an interactive <button> when onClick is given,
// otherwise a non-interactive <span>. The number's colour is
// --color-sign-ink, not --color-ink (amendment P1,
// handoffs/phase-1-highway-code/plan.md), so it stays dark in dark mode.
// Depends on: react (JSX only); styled by src/ui/primitives.css.
// Depended on by: src/ui/index.ts; tests/unit/ui.test.ts.
interface RoundelProps {
  value: string | number;
  selected?: boolean;
  onClick?: () => void;
}

function Roundel({ value, selected = false, onClick }: RoundelProps) {
  const className = ['roundel', selected ? 'roundel--selected' : null].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {value}
      </button>
    );
  }

  return <span className={className}>{value}</span>;
}

export default Roundel;
