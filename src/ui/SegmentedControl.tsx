// Segmented control primitive (Q15): a `role="tablist"` of equal-width
// options in a light grey rounded track, the selected option a raised
// white pill with ink text (Lincoln's chosen mockup, option C,
// hub.png). Reused by the Highway Code hub's Rules / Signs & signals /
// Annexes tabs; Step 10 reuses it for Sign Sprint's length picker.
// Purely presentational: no state, no side effects — the caller owns
// `value` and reacts to `onChange`.
// Depends on: react (JSX only); class names are styled by
// src/ui/primitives.css (imported once from src/main.tsx, after theme.css).
// Depended on by: src/features/code/HighwayCodeSectionsScreen.tsx,
// src/features/interactives/sign-sprint/SprintStart.tsx,
// tests/unit/segmented-control.test.tsx.
interface SegmentedOption {
  id: string;
  label: string;
}

interface SegmentedControlProps {
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
}

function SegmentedControl({ label, options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          className="segmented__option"
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
