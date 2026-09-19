/** @vitest-environment jsdom */
// Component tests for SectionScreen.tsx's preamble bands (amendment E6c,
// replacing item 6/P4): a rule section's preamble, split into blocks by
// preambleBlocks (src/features/code/interlude.ts), renders a one-line bare
// heading inside its own .hc-interlude band — like the section's other
// interludes — while multi-line or paragraph prose stays plain body text.
// Renders the real SectionScreen against real committed section JSON
// (loadSection resolves through Vite's import.meta.glob, which works under
// Vitest — src/content/loaders.ts's own header comment), so this proves
// actual content, not a hand-built fixture.
// Depends on: vitest, @testing-library/react, react-router-dom,
// src/features/code/SectionScreen.tsx.
// Depended on by: `npm test` (Vitest run).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SectionScreen from '../../src/features/code/SectionScreen';

afterEach(cleanup);

function renderSection(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/learn/code/${slug}`]}>
      <Routes>
        <Route path="/learn/code/:slug" element={<SectionScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SectionScreen preamble bands', () => {
  it('bands a heading-only preamble inside .hc-interlude (rules-for-pedestrians)', async () => {
    renderSection('rules-for-pedestrians-1-to-35');
    const heading = await screen.findByText('General guidance (rules 1 to 6)');
    expect(heading.closest('.hc-interlude')).not.toBeNull();
  });

  it('keeps prose as body text and bands its own inner sub-heading (general-rules-103-to-158)', async () => {
    renderSection('general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158');
    const body = await screen.findByText(/This section should be read by all drivers/);
    expect(body.closest('.hc-interlude')).toBeNull();
    const heading = await screen.findByText('Signals (rules 103 to 106)');
    expect(heading.closest('.hc-interlude')).not.toBeNull();
  });

  it("drops the Introduction's own repeated title line and bands its four inner headings, in order", async () => {
    renderSection('introduction');
    const body = await screen.findByText(
      /This Highway Code applies to England, Scotland and Wales/,
    );
    expect(body.closest('.hc-interlude')).toBeNull();

    const headingTexts = [
      'Wording of The Highway Code',
      'Knowing and applying the rules',
      'Self-driving vehicles',
      'Hierarchy of Road Users',
    ];
    for (const text of headingTexts) {
      const heading = await screen.findByText(text);
      expect(heading.closest('.hc-interlude')).not.toBeNull();
    }

    const htmlTexts = Array.from(document.querySelectorAll('.hc-html')).map(
      (el) => el.textContent?.trim() ?? '',
    );
    expect(htmlTexts.some((text) => text.startsWith('Introduction'))).toBe(false);
  });
});
