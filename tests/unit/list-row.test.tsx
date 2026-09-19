/**
 * @vitest-environment jsdom
 *
 * Render tests for ListRow (src/ui/ListRow, a full-width tappable list-row
 * primitive, M05) and for SignPanel's `block` prop (src/ui/SignPanel, M12
 * -- Step 3a, amendment P1). No @testing-library/jest-dom matchers are
 * available (only @testing-library/react and jsdom were added -- see
 * tests/unit/practice-header.test.tsx's header), so assertions read the
 * DOM directly. ListRow renders a react-router <Link>, so every render is
 * wrapped in a <MemoryRouter>.
 * Depends on: vitest, @testing-library/react, jsdom (test environment),
 * react-router-dom (MemoryRouter), src/ui/ListRow, src/ui/SignPanel.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListRow from '../../src/ui/ListRow';
import SignPanel from '../../src/ui/SignPanel';

afterEach(() => {
  cleanup();
});

describe('ListRow', () => {
  it('renders a link with its title, its subtitle and the right href', () => {
    render(
      <MemoryRouter>
        <ListRow to="/learn/code" title="The Highway Code" subtitle="Rules 1-307" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /The Highway Code/ });
    expect(link.getAttribute('href')).toBe('/learn/code');
    expect(screen.getByText('The Highway Code')).toBeTruthy();
    expect(screen.getByText('Rules 1-307')).toBeTruthy();
  });

  it('shows the default chevron when no trailing is given', () => {
    render(
      <MemoryRouter>
        <ListRow to="/learn/code" title="The Highway Code" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /The Highway Code/ });
    const chevron = link.querySelector('.list-row__trailing svg[aria-hidden="true"]');
    expect(chevron).not.toBeNull();
  });

  it('renders a custom trailing node instead of the chevron', () => {
    render(
      <MemoryRouter>
        <ListRow to="/learn/code" title="The Highway Code" trailing={<span>H1-H3</span>} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /The Highway Code/ });
    expect(link.querySelector('.list-row__trailing svg')).toBeNull();
    expect(screen.getByText('H1-H3')).toBeTruthy();
  });
});

describe('SignPanel block prop', () => {
  it('adds sign-panel--block only when block is set', () => {
    const { container, rerender } = render(
      <SignPanel colour="blue" block>
        CLUTCH
      </SignPanel>,
    );
    const blockPanel = container.querySelector('.sign-panel');
    expect(blockPanel?.classList.contains('sign-panel--block')).toBe(true);

    rerender(<SignPanel colour="blue">CLUTCH</SignPanel>);
    const inlinePanel = container.querySelector('.sign-panel');
    expect(inlinePanel?.classList.contains('sign-panel--block')).toBe(false);
  });
});
