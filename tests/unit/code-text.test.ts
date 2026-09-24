// Unit tests for the pure helpers behind the Highway Code's rule-context
// line and section-preamble bands (amendment E6): truncateAtWord
// (src/content/text.ts, M08/PS25), and lastHeadingLine, ruleContextHeading
// and preambleBlocks (src/features/code/interlude.ts). The
// ruleContextHeading and preambleBlocks cases read real committed section
// JSON directly (the same way tests/e2e/highway-code.spec.ts and
// tests/unit/interlude.test.ts do), so they prove behaviour against the
// actual ingested Highway Code, not just a hand-built fixture.
// Depends on: vitest, node:fs, node:path, node:url, src/content/text.ts,
// src/features/code/interlude.ts, src/content/schemas/index.ts (types),
// content/uk/highway-code/sections/*.json.
// Depended on by: `npm test` (Vitest run).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { truncateAtWord } from '../../src/content/text';
import {
  lastHeadingLine,
  ruleContextHeading,
  preambleBlocks,
} from '../../src/features/code/interlude';
import type { Section } from '../../src/content/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECTIONS_DIR = join(__dirname, '..', '..', 'content', 'uk', 'highway-code', 'sections');

function loadSection(slug: string): Section {
  return JSON.parse(readFileSync(join(SECTIONS_DIR, `${slug}.json`), 'utf8')) as Section;
}

describe('truncateAtWord', () => {
  it('returns text of max characters or fewer unchanged', () => {
    expect(truncateAtWord('Short text', 90)).toBe('Short text');
    expect(truncateAtWord('A'.repeat(90), 90)).toBe('A'.repeat(90));
  });

  it('cuts at the last word boundary at or before max, appending an ellipsis', () => {
    const text = `${'A'.repeat(85)} ${'B'.repeat(20)}`;
    const result = truncateAtWord(text, 90);
    expect(result).toBe(`${'A'.repeat(85)}…`);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(90);
  });

  it('cuts hard, to max - 1 characters, when the first max characters hold no space', () => {
    const text = 'A'.repeat(100);
    const result = truncateAtWord(text, 90);
    expect(result).toBe(`${'A'.repeat(89)}…`);
    expect(result.length).toBe(90);
  });

  it('drops a trailing comma (and the space after it) left by the cut', () => {
    const text = `${'A'.repeat(40)}, ${'B'.repeat(60)}`;
    const result = truncateAtWord(text, 90);
    expect(result).toBe(`${'A'.repeat(40)}…`);
  });

  it('drops a dangling opening quote or bracket and the diagram arrow left by the cut', () => {
    // Amendment E7: rule 105's summary used to end "(see ‘…" and rule
    // 256's "↗…".
    const quote = truncateAtWord(`${'A'.repeat(40)} (see ‘ ${'B'.repeat(60)}`, 90);
    expect(quote).toBe(`${'A'.repeat(40)} (see…`);
    const bracket = truncateAtWord(`${'A'.repeat(40)} [ ${'B'.repeat(60)}`, 90);
    expect(bracket).toBe(`${'A'.repeat(40)}…`);
    const arrow = truncateAtWord(`${'A'.repeat(40)}. ↗ ${'B'.repeat(60)}`, 90);
    expect(arrow).toBe(`${'A'.repeat(40)}.…`);
  });

  it('never ends mid-word', () => {
    const text = `${'A'.repeat(85)} ${'B'.repeat(20)}`;
    const result = truncateAtWord(text, 90);
    const withoutEllipsis = result.slice(0, -1);
    // The character right after the returned prefix, in the original text,
    // is a space (the boundary the cut was made at) — never a letter that
    // would mean a word was cut in half.
    expect(text[withoutEllipsis.length]).toBe(' ');
  });
});

describe('lastHeadingLine', () => {
  it('returns undefined for html with no bare line', () => {
    expect(lastHeadingLine('<p>Only a paragraph, no bare heading line.</p>')).toBeUndefined();
  });

  it('returns undefined when the last bare line is over 80 characters', () => {
    const longLine = 'A'.repeat(81);
    expect(lastHeadingLine(`<p>Body.</p>\n\n${longLine}\n\n`)).toBeUndefined();
  });

  it('returns the last bare line, converted to plain text, when it is a plausible heading', () => {
    expect(lastHeadingLine('Control of the vehicle (rules 117 to 126)\n\nBraking\n\n')).toBe(
      'Braking',
    );
  });
});

const GENERAL_RULES_SLUG =
  'general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158';

describe('ruleContextHeading (general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158)', () => {
  const section = loadSection(GENERAL_RULES_SLUG);

  it('reads the nearest interlude heading at or before the rule (117, 126 -> Braking)', () => {
    expect(ruleContextHeading(section, '117')).toBe('Braking');
    expect(ruleContextHeading(section, '126')).toBe('Braking');
  });

  it("falls back to the section's own preamble heading for a rule before the first interlude (103)", () => {
    expect(ruleContextHeading(section, '103')).toBe('Signals (rules 103 to 106)');
  });

  it("skips an interlude's prose paragraph and reads its bare heading line (127)", () => {
    expect(ruleContextHeading(section, '127')).toBe(
      'Lines and lane markings on the road (rules 127 to 132)',
    );
  });

  it('returns undefined for a rule id the section does not hold', () => {
    expect(ruleContextHeading(section, '999')).toBeUndefined();
  });
});

describe('preambleBlocks', () => {
  it('gives one heading block for a heading-only preamble', () => {
    const pedestrians = loadSection('rules-for-pedestrians-1-to-35');
    const blocks = preambleBlocks(pedestrians.preambleHtml, pedestrians.title);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('heading');
    expect(blocks[0].html).toBe('General guidance (rules 1 to 6)');
  });

  it('gives a body block then a heading block for a <p> line followed by a bare line', () => {
    const generalRules = loadSection(GENERAL_RULES_SLUG);
    const blocks = preambleBlocks(generalRules.preambleHtml, generalRules.title);
    expect(blocks.map((block) => block.kind)).toEqual(['body', 'heading']);
    expect(blocks[0].html).toContain('This section should be read by all drivers');
    expect(blocks[1].html).toBe('Signals (rules 103 to 106)');
  });

  it("drops the Introduction's own repeated title line and bands its four inner headings, in order", () => {
    const introduction = loadSection('introduction');
    const blocks = preambleBlocks(introduction.preambleHtml, introduction.title);
    expect(blocks[0].kind).toBe('body');
    expect(blocks[0].html.startsWith('Introduction')).toBe(false);

    const headings = blocks.filter((block) => block.kind === 'heading').map((block) => block.html);
    expect(headings).toEqual([
      'Wording of The Highway Code',
      'Knowing and applying the rules',
      'Self-driving vehicles',
      'Hierarchy of Road Users',
    ]);
  });
});
