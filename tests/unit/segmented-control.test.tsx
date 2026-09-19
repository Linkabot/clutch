/** @vitest-environment jsdom */
// Component tests for the SegmentedControl primitive (Q15): one
// role="tab" per option inside a role="tablist", the current `value`
// option marked aria-selected, and a click on another option calling
// onChange with its id. Renders with @testing-library/react and reads the
// DOM directly (no jest-dom matchers).
// Depends on: vitest, @testing-library/react, src/ui/SegmentedControl.tsx.
// Depended on by: `npm test` (Vitest run).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SegmentedControl from '../../src/ui/SegmentedControl';

afterEach(cleanup);

const OPTIONS = [
  { id: 'rules', label: 'Rules' },
  { id: 'signs', label: 'Signs & signals' },
  { id: 'annexes', label: 'Annexes' },
];

describe('SegmentedControl', () => {
  it('renders one tab per option, inside a tablist labelled with `label`', () => {
    render(
      <SegmentedControl
        label="Highway Code parts"
        options={OPTIONS}
        value="rules"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('tablist', { name: 'Highway Code parts' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Rules', 'Signs & signals', 'Annexes']);
  });

  it('marks only the current `value` option aria-selected', () => {
    render(
      <SegmentedControl
        label="Highway Code parts"
        options={OPTIONS}
        value="signs"
        onChange={() => {}}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe('Signs & signals');
  });

  it('calls onChange with the clicked option id, not with the current value', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Highway Code parts"
        options={OPTIONS}
        value="rules"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Annexes' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('annexes');
  });

  it('renders every option as a type="button" element, never a submit button', () => {
    render(
      <SegmentedControl
        label="Highway Code parts"
        options={OPTIONS}
        value="rules"
        onChange={() => {}}
      />,
    );
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.getAttribute('type')).toBe('button');
    }
  });
});
