// Content test for content/uk/theory/ (Phase 3 block 3a Step 9; plan.md Step
// 9 and amend-09 A45/A47): synonyms.json and vocab-queue.json parse; every
// lessons, questions and pools file under content/uk/theory/{lessons,
// questions,pools}/ parses, its `topic` matches its file name and a
// topics.json id, question ids are unique across files, lesson numbers run
// 1..n per file; every question and lesson has no problems under
// scripts/lib/theory-checks.ts; no two questions are near duplicates; no
// vocab-queue entry is stale; and (Step 10; amend-10 A53) every question and
// rule card has its provenance under scripts/lib/theory-content.ts's shared
// loader. A missing folder is an empty file list, never a throw (A47), so
// this file is green with no theory content yet.
// Depends on: vitest, node:fs, node:path, ../../src/content/schemas,
// ../../scripts/lib/theory-corpus, ../../scripts/lib/theory-checks,
// ../../scripts/lib/theory-content, ./helpers.
// Depended on by: `npm run validate:content` / `npm test`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SynonymsFileSchema,
  QuestionsFileSchema,
  LessonsFileSchema,
  VocabQueueFileSchema,
  DistractorPoolSchema,
} from '../../src/content/schemas';
import type { Question, Lesson, Topic, VocabQueueEntry } from '../../src/content/schemas';
import { loadCorpus } from '../../scripts/lib/theory-corpus';
import {
  checkQuestion,
  checkNearDuplicates,
  checkLesson,
  checkVocabQueue,
  checkProvenance,
} from '../../scripts/lib/theory-checks';
import type { TheoryCheckContext } from '../../scripts/lib/theory-checks';
import { loadTheoryContent, checkContextFor } from '../../scripts/lib/theory-content';
import { CONTENT_ROOT, readJson } from './helpers';

const THEORY_ROOT = join(CONTENT_ROOT, 'theory');
const REPO_ROOT = join(CONTENT_ROOT, '..', '..');

function listJsonFiles(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.json'))
        .sort()
    : [];
}

const lessonsDir = join(THEORY_ROOT, 'lessons');
const questionsDir = join(THEORY_ROOT, 'questions');
const poolsDir = join(THEORY_ROOT, 'pools');
const lessonFiles = listJsonFiles(lessonsDir);
const questionFiles = listJsonFiles(questionsDir);
const poolFiles = listJsonFiles(poolsDir);

const synonymsFile = readJson<unknown>('theory/synonyms.json');
const vocabQueueFile = readJson<{ entries: VocabQueueEntry[] }>('theory/vocab-queue.json');
const topics = readJson<{ topics: Topic[] }>('topics.json').topics;
const topicsById = new Map(topics.map((t) => [t.id, t]));

const lessonsFileByTopic = new Map<string, { topic: string; lessons: Lesson[] }>();
for (const name of lessonFiles) {
  const file = readJson<{ topic: string; lessons: Lesson[] }>(`theory/lessons/${name}`);
  lessonsFileByTopic.set(name.replace(/\.json$/, ''), file);
}
const questionsFileByTopic = new Map<string, { topic: string; questions: Question[] }>();
for (const name of questionFiles) {
  const file = readJson<{ topic: string; questions: Question[] }>(`theory/questions/${name}`);
  questionsFileByTopic.set(name.replace(/\.json$/, ''), file);
}
const allQuestions: Question[] = [...questionsFileByTopic.values()].flatMap((f) => f.questions);
const allLessons: Lesson[] = [...lessonsFileByTopic.values()].flatMap((f) => f.lessons);
const questionsById = new Map(allQuestions.map((q) => [q.id, q]));

const corpus = loadCorpus(REPO_ROOT);
const synonymGroups = (synonymsFile as { groups: string[][] }).groups;

// The shared loader (scripts/lib/theory-content.ts, A53) reads the same files this test already
// reads above; ctxFor now delegates to it so accept and this test can never drift apart.
const content = loadTheoryContent(REPO_ROOT);

function ctxFor(fileTopic: string): TheoryCheckContext {
  return checkContextFor(content, fileTopic);
}

describe('content/uk/theory/', () => {
  it('NEW S9: synonyms.json and vocab-queue.json parse', () => {
    expect(() => SynonymsFileSchema.parse(synonymsFile)).not.toThrow();
    expect(() => VocabQueueFileSchema.parse(vocabQueueFile)).not.toThrow();
  });

  it('NEW S9: every lessons, questions and pools file parses', () => {
    for (const name of lessonFiles) {
      expect(() => LessonsFileSchema.parse(readJson(`theory/lessons/${name}`))).not.toThrow();
    }
    for (const name of questionFiles) {
      expect(() => QuestionsFileSchema.parse(readJson(`theory/questions/${name}`))).not.toThrow();
    }
    for (const name of poolFiles) {
      expect(() => DistractorPoolSchema.parse(readJson(`theory/pools/${name}`))).not.toThrow();
    }
  });

  it('NEW S9: each file topic equals its file name and is a topic in topics.json', () => {
    for (const [name, file] of lessonsFileByTopic) {
      expect(file.topic).toBe(name);
      expect(topicsById.has(file.topic)).toBe(true);
      for (const l of file.lessons) expect(l.topic).toBe(file.topic);
    }
    for (const [name, file] of questionsFileByTopic) {
      expect(file.topic).toBe(name);
      expect(topicsById.has(file.topic)).toBe(true);
    }
    for (const name of poolFiles) {
      const base = name.replace(/\.json$/, '');
      const file = readJson<{ topic: string; values: string[] }>(`theory/pools/${name}`);
      expect(file.topic).toBe(base);
      expect(topicsById.has(file.topic)).toBe(true);
    }
  });

  it('NEW S9: question ids are unique across files', () => {
    const ids = allQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('NEW S9: lesson numbers run 1 to n in each lessons file', () => {
    for (const file of lessonsFileByTopic.values()) {
      expect(file.lessons.map((l) => l.number)).toEqual(file.lessons.map((_, i) => i + 1));
    }
  });

  it('NEW S9: every question has no problems', () => {
    for (const [topic, file] of questionsFileByTopic) {
      const ctx = ctxFor(topic);
      for (const question of file.questions) {
        const problems = checkQuestion(question, ctx);
        expect(problems, JSON.stringify(problems)).toEqual([]);
      }
    }
  });

  it('NEW S9: no two questions are near duplicates', () => {
    const problems = checkNearDuplicates(allQuestions);
    expect(problems, JSON.stringify(problems)).toEqual([]);
  });

  it('NEW S9: every lesson has no problems', () => {
    for (const [topic, file] of lessonsFileByTopic) {
      const ctx = ctxFor(topic);
      for (const lesson of file.lessons) {
        const problems = checkLesson(lesson, questionsById, ctx);
        expect(problems, JSON.stringify(problems)).toEqual([]);
      }
    }
  });

  it('NEW S9: no vocab-queue entry is stale', () => {
    const problems = checkVocabQueue(vocabQueueFile.entries, allQuestions, allLessons, {
      corpus,
      synonyms: synonymGroups,
    });
    expect(problems, JSON.stringify(problems)).toEqual([]);
  });

  it('NEW S10: every question has its provenance', () => {
    for (const [topic, file] of questionsFileByTopic) {
      for (const question of file.questions) {
        const problems = checkProvenance(
          { id: question.id, topic, writtenFrom: question.writtenFrom },
          content.prompts,
        );
        expect(problems, JSON.stringify(problems)).toEqual([]);
      }
    }
  });

  it('NEW S10: every rule card has its provenance', () => {
    for (const [topic, file] of lessonsFileByTopic) {
      for (const lesson of file.lessons) {
        for (const card of lesson.cards) {
          if (card.kind !== 'rule') continue;
          const problems = checkProvenance(
            { id: card.id, topic, writtenFrom: card.writtenFrom },
            content.prompts,
          );
          expect(problems, JSON.stringify(problems)).toEqual([]);
        }
      }
    }
  });
});
