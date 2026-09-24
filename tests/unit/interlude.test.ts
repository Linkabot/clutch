// Unit tests for interludeHtml (plan.md Step 8 amendment E4): a fixed
// two-blank-line example, the general-rules "127" interlude read from the
// committed JSON (a heading followed by a <p>), and every interlude in
// every committed Highway Code section — proving the transform only ever
// removes whitespace and never touches tags or text.
// Depends on: vitest, node:fs, node:url, node:path,
// src/features/code/interlude.ts, src/content/schemas/index.ts (types),
// content/uk/highway-code/sections/*.json.
// Depended on by: `npm test` (Vitest run).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { interludeHtml } from '../../src/features/code/interlude';
import type { Section } from '../../src/content/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECTIONS_DIR = join(__dirname, '..', '..', 'content', 'uk', 'highway-code', 'sections');

function loadSections(): Section[] {
  return readdirSync(SECTIONS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(SECTIONS_DIR, file), 'utf8')) as Section);
}

describe('interludeHtml', () => {
  it('collapses a heading, a blank line, a sub-heading and a trailing blank line', () => {
    expect(interludeHtml('Control of the vehicle (rules 117 to 126)\n\nBraking\n\n')).toBe(
      'Control of the vehicle (rules 117 to 126)\nBraking',
    );
  });

  it('removes the blank line before a following block tag (general-rules "127")', () => {
    const sections = loadSections();
    const generalRules = sections.find(
      (section) =>
        section.slug ===
        'general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158',
    );
    expect(generalRules).toBeDefined();
    const interlude = generalRules?.interludes.find((entry) => entry.beforeRuleId === '127');
    expect(interlude).toBeDefined();
    expect(interludeHtml(interlude!.html)).toBe(
      'Lines and lane markings on the road (rules 127 to 132)<p>See ‘<a href="/learn/code/road-markings">Road markings</a>’ to see diagrams of all lines.</p>',
    );
  });

  it('changes only whitespace, for every interlude in every committed section', () => {
    const sections = loadSections();
    for (const section of sections) {
      for (const interlude of section.interludes) {
        const output = interludeHtml(interlude.html);
        expect(output).not.toContain('\n\n');
        expect(output).toBe(output.trim());
        expect(output.replace(/\s+/g, '')).toBe(interlude.html.replace(/\s+/g, ''));
      }
    }
  });
});
