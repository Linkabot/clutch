// Content test for content/prompts/theory/ (Phase 3 block 3a Step 10; plan.md
// Step 10, amend-10 A58): check 7 — the prompt lint. Both v1 templates exist;
// no `.md` under content/prompts/theory/ (templates included) contains a
// banned phrase ("DVSA", "official", "past paper", "theory test question",
// case-insensitive); every generated (non-template) prompt's first line is a
// `units:` line whose cites all resolve through the corpus; and every such
// prompt holds each of its cited units' text verbatim (normalised
// whitespace and quotes, case-sensitive). A missing content/prompts/theory/
// folder gives an empty file list, never a throw, so this file is green
// with no generated prompts yet.
// Depends on: vitest, node:fs, node:path, ../../scripts/lib/theory-corpus,
// ../../scripts/lib/theory-checks, ../../scripts/lib/theory-content,
// ./helpers.
// Depended on by: `npm run validate:content` / `npm test`.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadCorpus, unitTexts } from '../../scripts/lib/theory-corpus';
import { normalise, parseUnitsLine } from '../../scripts/lib/theory-checks';
import { listPromptFiles } from '../../scripts/lib/theory-content';
import { CONTENT_ROOT } from './helpers';

const REPO_ROOT = join(CONTENT_ROOT, '..', '..');

// The test's own literal list (A58), not scripts/lib/theory-checks.ts's BANNED_PROMPT_PHRASES,
// so a change to one drifts loudly against the other rather than silently agreeing with itself.
const BANNED_PHRASES = ['DVSA', 'official', 'past paper', 'theory test question'];

const files = listPromptFiles(REPO_ROOT);
const corpus = loadCorpus(REPO_ROOT);

function isTemplate(file: string): boolean {
  return basename(file).startsWith('template-');
}

function readPromptFile(file: string): string {
  return readFileSync(join(REPO_ROOT, ...file.split('/')), 'utf8');
}

describe('content/prompts/theory/', () => {
  it('NEW S10: both v1 prompt templates exist', () => {
    for (const name of ['template-questions.md', 'template-lesson.md']) {
      const text = readFileSync(join(REPO_ROOT, 'content/prompts/theory/v1', name), 'utf8');
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('NEW S10: no prompt file contains a banned phrase', () => {
    for (const file of files) {
      const lower = readPromptFile(file).toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        expect(lower.includes(phrase.toLowerCase()), `${file} contains "${phrase}"`).toBe(false);
      }
    }
  });

  it('NEW S10: every generated prompt starts with a units line whose cites all resolve', () => {
    for (const file of files) {
      if (isTemplate(file)) continue;
      const firstLine = readPromptFile(file).split('\n')[0] ?? '';
      const cites = parseUnitsLine(firstLine);
      expect(cites, `${file} has no valid units line`).not.toBeNull();
      for (const cite of cites ?? []) {
        expect(unitTexts(cite, corpus), `${file}: ${cite} does not resolve`).not.toBeNull();
      }
    }
  });

  it('NEW S10: every generated prompt holds each unit text verbatim', () => {
    for (const file of files) {
      if (isTemplate(file)) continue;
      const text = readPromptFile(file);
      const cites = parseUnitsLine(text.split('\n')[0] ?? '');
      if (!cites) continue;
      const normalisedText = normalise(text);
      for (const cite of cites) {
        const texts = unitTexts(cite, corpus);
        if (texts === null) continue;
        for (const unitText of texts) {
          expect(
            normalisedText.includes(normalise(unitText)),
            `${file}: ${cite}'s text is not verbatim`,
          ).toBe(true);
        }
      }
    }
  });
});
