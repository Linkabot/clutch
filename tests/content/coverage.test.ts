// Content test: the coverage-shortfall report (Phase 3 block 3a Step 9;
// plan.md Step 9 and amend-09 A46) over the real committed content. WRITTEN
// and FULL are computed once at module scope, so a crash (a missing file, a
// bad shape) fails this whole file rather than silently passing the
// `it.fails` at the bottom. Three scoped assertions run now and stay green
// in block 3a (every WRITTEN topic/area/element line is empty, because no
// topic has both a lessons and a questions file yet); the `it.fails` lists
// every shortfall of the FULL course (Decision 7: 50 per topic, 50 per area,
// 3 per element) and stays green until 3b completes the content, at which
// point it turns red and its title is retitled to a plain `it`.
// Depends on: vitest, node:fs, node:path, ../../src/content/schemas,
// ../../scripts/lib/theory-checks, ./helpers, ./dvsa-areas.
// Depended on by: `npm run validate:content` / `npm test`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { Question, Topic } from '../../src/content/schemas';
import { coverageShortfalls } from '../../scripts/lib/theory-checks';
import type { CoverageInput } from '../../scripts/lib/theory-checks';
import { CONTENT_ROOT, readJson } from './helpers';
import { DVSA_AREAS } from './dvsa-areas';

function listJsonFiles(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.json'))
        .sort()
    : [];
}

const THEORY_ROOT = join(CONTENT_ROOT, 'theory');
const lessonFiles = listJsonFiles(join(THEORY_ROOT, 'lessons'));
const questionFiles = listJsonFiles(join(THEORY_ROOT, 'questions'));
const lessonTopics = new Set(lessonFiles.map((n) => n.replace(/\.json$/, '')));
const questionTopics = new Set(questionFiles.map((n) => n.replace(/\.json$/, '')));
const written = new Set([...lessonTopics].filter((t) => questionTopics.has(t)));

const topics = readJson<{ topics: Topic[] }>('topics.json').topics;
const syllabus = readJson<{ roles: { units: { elements: { id: string }[] }[] }[] }>(
  'syllabus.json',
);
const elementIds = syllabus.roles.flatMap((r) =>
  r.units.flatMap((u) => u.elements.map((e) => e.id)),
);

const allQuestions: Pick<Question, 'topic' | 'area' | 'elements'>[] = questionFiles.flatMap(
  (name) => readJson<{ questions: Question[] }>(`theory/questions/${name}`).questions,
);

const input: CoverageInput = {
  topics: topics.map((t) => ({ id: t.id, areas: t.areas, nsElements: t.nsElements })),
  areas: DVSA_AREAS,
  elements: elementIds,
  written,
  questions: allQuestions,
};

const WRITTEN = coverageShortfalls(input, 'written');
const FULL = coverageShortfalls(input, 'full');

describe('theory content coverage (Decision 7)', () => {
  it('NEW S9: every written topic has at least 50 questions', () => {
    const lines = WRITTEN.filter((l) => l.startsWith('topic '));
    expect(lines, lines.join('\n')).toEqual([]);
  });

  it('NEW S9: every area whose covering topics are all written has at least 50 questions', () => {
    const lines = WRITTEN.filter((l) => l.startsWith('area '));
    expect(lines, lines.join('\n')).toEqual([]);
  });

  it('NEW S9: every element whose mapping topics are all written has at least 3 questions', () => {
    const lines = WRITTEN.filter((l) => l.startsWith('element '));
    expect(lines, lines.join('\n')).toEqual([]);
  });

  it.fails(
    'NEW S9: FULL COURSE, block 3b: 50 per area, 50 per topic, 3 per element (Decision 7)',
    () => {
      expect(FULL, FULL.join('\n')).toEqual([]);
    },
  );
});
