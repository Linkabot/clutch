// Offline drafting tools for theory content (Phase 3 block 3a Step 10; plan.md
// Step 10, amend-10 A54-A56, A61, A63): `prompt` assembles a Clutch-owned
// drafting prompt (template + verbatim unit texts + cited facts + the
// topic's areas/elements/pool) for one topic/kind/unit set and writes it
// under content/prompts/theory/; `accept` reads a model's batch of drafted
// questions or one lesson, numbers and stamps them, runs every content
// check (Steps 9 and 10's provenance check included) and writes only the
// problem-free items. Never fetches: `prompt` refuses unless
// `CLUTCH_OFFLINE=1` is set, and neither command imports a network module
// (checked by tests/unit/draft-theory.test.ts's transitive scan). Every
// read and every write without `--out` stays under `--root` (default: the
// repo this file lives in), never the process's own cwd, so a test root is
// a throwaway copy of content/. Both writers format their output through
// Prettier's own API with the repo's `.prettierrc` before writing (A56).
// Depends on: node:fs, node:path, node:url, prettier, ./lib/theory-corpus,
// ./lib/theory-checks, ./lib/theory-content, ../src/content/schemas.
// Depended on by: package.json (`draft:prompt`, `draft:accept`),
// tests/unit/draft-theory.test.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { loadCorpus, unitTexts } from './lib/theory-corpus';
import {
  BANNED_PROMPT_PHRASES,
  checkLesson,
  checkNearDuplicates,
  checkProvenance,
  checkQuestion,
  checkVocabQueue,
} from './lib/theory-checks';
import { checkContextFor, loadTheoryContent } from './lib/theory-content';
import type { TheoryContent } from './lib/theory-content';
import {
  LessonSchema,
  QuestionSchema,
  type Fact,
  type Lesson,
  type Question,
  type Topic,
} from '../src/content/schemas';

function defaultRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readOptionalJson<T>(path: string): T | null {
  return existsSync(path) ? readJsonFile<T>(path) : null;
}

function toForwardSlash(path: string): string {
  return path.replace(/\\/g, '/');
}

function fileSlug(cite: string): string {
  return cite.replace(/[:/]/g, '_');
}

function containsBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PROMPT_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

async function formatMarkdown(text: string): Promise<string> {
  const config = await prettier.resolveConfig(fileURLToPath(import.meta.url));
  return prettier.format(text, { ...config, parser: 'markdown' });
}

async function formatJson(text: string): Promise<string> {
  const config = await prettier.resolveConfig(fileURLToPath(import.meta.url));
  return prettier.format(text, { ...config, parser: 'json' });
}

/**
 * The rule id or section slug a cite names, for matching facts.json's
 * `source.rule` / `source.section` (A54). Deliberately narrow: draft-theory.ts
 * never imports src/content/cite.ts directly (A61); `unitTexts` above already
 * proved the cite resolves before this is used.
 */
function citeRuleOrSection(cite: string): { rule: string | null; section: string | null } {
  if (cite.startsWith('hc-section:'))
    return { rule: null, section: cite.slice('hc-section:'.length) };
  if (cite.startsWith('hc:')) return { rule: cite.slice('hc:'.length), section: null };
  return { rule: null, section: null };
}

function factsForUnits(units: readonly string[], facts: readonly Fact[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const cite of units) {
    const { rule, section } = citeRuleOrSection(cite);
    if (rule === null && section === null) continue;
    for (const fact of facts) {
      const matches = rule !== null ? fact.source.rule === rule : fact.source.section === section;
      if (!matches || seen.has(fact.id)) continue;
      seen.add(fact.id);
      lines.push(`${fact.id}: ${fact.statement}`);
    }
  }
  return lines;
}

// =====================================================================================
// prompt
// =====================================================================================

interface ParsedPromptArgs {
  topic: string;
  kind: 'questions' | 'lesson';
  units: string[];
  root: string;
  out: string | null;
}

const PROMPT_FLAGS = new Set(['--topic', '--kind', '--unit', '--root', '--out']);

function parsePromptArgs(args: string[]): ParsedPromptArgs | null {
  let topic: string | null = null;
  let kind: string | null = null;
  const units: string[] = [];
  let root: string | null = null;
  let out: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!PROMPT_FLAGS.has(flag)) {
      console.error(`draft: unknown flag ${flag}`);
      return null;
    }
    const value = args[i + 1];
    if (value === undefined) {
      console.error(`draft: ${flag} needs a value`);
      return null;
    }
    i++;
    if (flag === '--topic') topic = value;
    else if (flag === '--kind') kind = value;
    else if (flag === '--unit') {
      if (!units.includes(value)) units.push(value);
    } else if (flag === '--root') root = value;
    else if (flag === '--out') out = value;
  }

  if (!topic) {
    console.error('draft: --topic is required');
    return null;
  }
  if (kind !== 'questions' && kind !== 'lesson') {
    console.error('draft: --kind must be questions or lesson');
    return null;
  }
  if (units.length === 0) {
    console.error('draft: at least one --unit is required');
    return null;
  }
  return { topic, kind, units, root: root ?? defaultRoot(), out };
}

function assemblePrompt(input: {
  units: readonly string[];
  unitTextsByCite: ReadonlyMap<string, string[]>;
  template: string;
  factLines: readonly string[];
  topic: Pick<Topic, 'id' | 'areas' | 'nsElements'>;
  poolLine: string;
}): string {
  const parts: string[] = [`units: ${input.units.join(', ')}`, '', input.template, '', '# Units'];
  for (const cite of input.units) {
    parts.push('', `## ${cite}`);
    for (const text of input.unitTextsByCite.get(cite) ?? []) {
      parts.push('', '```text', text, '```');
    }
  }
  parts.push(
    '',
    '# Facts',
    '',
    '```text',
    input.factLines.length > 0 ? input.factLines.join('\n') : '(none)',
    '```',
  );
  parts.push(
    '',
    '# Topic',
    '',
    '```text',
    `id: ${input.topic.id}`,
    `areas: ${input.topic.areas.join('; ')}`,
    `elements: ${input.topic.nsElements.join(', ')}`,
    `pool: ${input.poolLine}`,
    '```',
  );
  return parts.join('\n');
}

export async function runPrompt(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<number> {
  if (env.CLUTCH_OFFLINE !== '1') {
    console.error('draft: set CLUTCH_OFFLINE=1 to run offline drafting');
    return 1;
  }
  const parsed = parsePromptArgs(args);
  if (!parsed) return 1;
  const { topic, kind, units, root, out } = parsed;

  const topicsFile = readJsonFile<{ topics: Topic[] }>(join(root, 'content/uk/topics.json'));
  const topicRecord = topicsFile.topics.find((t) => t.id === topic);
  if (!topicRecord) {
    console.error(`draft: unknown topic ${topic}`);
    return 1;
  }

  const corpus = loadCorpus(root);
  const unitTextsByCite = new Map<string, string[]>();
  for (const cite of units) {
    const texts = unitTexts(cite, corpus);
    if (texts === null) {
      console.error(`draft: unit ${cite} does not resolve`);
      return 1;
    }
    unitTextsByCite.set(cite, texts);
  }

  const templateName = kind === 'questions' ? 'template-questions.md' : 'template-lesson.md';
  const template = readFileSync(
    join(root, 'content/prompts/theory/v1', templateName),
    'utf8',
  ).trim();

  const factsFile = readJsonFile<{ facts: Fact[] }>(join(root, 'content/uk/facts.json'));
  const factLines = factsForUnits(units, factsFile.facts);

  const poolFile = readOptionalJson<{ values: string[] }>(
    join(root, `content/uk/theory/pools/${topic}.json`),
  );
  const poolLine = poolFile ? poolFile.values.join('; ') : '(none)';

  const assembled = assemblePrompt({
    units,
    unitTextsByCite,
    template,
    factLines,
    topic: topicRecord,
    poolLine,
  });

  if (containsBannedPhrase(assembled)) {
    console.error('draft: the assembled prompt contains a banned phrase');
    return 1;
  }

  const formatted = await formatMarkdown(assembled);
  const fileName = `${kind}-${fileSlug(units[0])}.md`;
  const dir = out ?? join(root, 'content/prompts/theory/v1', topic);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);
  writeFileSync(filePath, formatted);
  console.log(toForwardSlash(resolve(filePath)));
  return 0;
}

// =====================================================================================
// accept
// =====================================================================================

interface ParsedAcceptArgs {
  topic: string;
  kind: 'questions' | 'lesson';
  model: string;
  root: string;
  batchPath: string;
}

const ACCEPT_VALUE_FLAGS = new Set(['--topic', '--kind', '--model', '--root']);

function parseAcceptArgs(args: string[]): ParsedAcceptArgs | null {
  let topic: string | null = null;
  let kind: string | null = null;
  let model: string | null = null;
  let root: string | null = null;
  let batchPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (ACCEPT_VALUE_FLAGS.has(token)) {
      const value = args[i + 1];
      if (value === undefined) {
        console.error(`draft: ${token} needs a value`);
        return null;
      }
      i++;
      if (token === '--topic') topic = value;
      else if (token === '--kind') kind = value;
      else if (token === '--model') model = value;
      else if (token === '--root') root = value;
      continue;
    }
    if (token.startsWith('--')) {
      console.error(`draft: unknown flag ${token}`);
      return null;
    }
    if (batchPath !== null) {
      console.error('draft: only one batch file may be given');
      return null;
    }
    batchPath = token;
  }

  if (!topic) {
    console.error('draft: --topic is required');
    return null;
  }
  if (kind !== 'questions' && kind !== 'lesson') {
    console.error('draft: --kind must be questions or lesson');
    return null;
  }
  if (!model) {
    console.error('draft: --model is required');
    return null;
  }
  if (!batchPath) {
    console.error('draft: a batch file path is required');
    return null;
  }
  return { topic, kind, model, root: root ?? defaultRoot(), batchPath };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextQuestionNumber(existing: readonly { id: string }[], topic: string): number {
  const re = new RegExp(`^${escapeRegExp(topic)}-q(\\d{3})$`);
  let max = 0;
  for (const q of existing) {
    const match = re.exec(q.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

async function writeQuestionsFile(
  root: string,
  topic: string,
  questions: readonly Question[],
): Promise<void> {
  const path = join(root, `content/uk/theory/questions/${topic}.json`);
  mkdirSync(dirname(path), { recursive: true });
  const formatted = await formatJson(JSON.stringify({ topic, questions }));
  writeFileSync(path, formatted);
}

async function writeLessonsFile(
  root: string,
  topic: string,
  lessons: readonly Lesson[],
): Promise<void> {
  const path = join(root, `content/uk/theory/lessons/${topic}.json`);
  mkdirSync(dirname(path), { recursive: true });
  const formatted = await formatJson(JSON.stringify({ topic, lessons }));
  writeFileSync(path, formatted);
}

async function runAcceptQuestions(
  batchJson: unknown,
  topic: string,
  model: string,
  root: string,
  content: TheoryContent,
): Promise<number> {
  const batch = batchJson as { questions?: unknown };
  if (typeof batchJson !== 'object' || batchJson === null || !Array.isArray(batch.questions)) {
    console.error('draft: batch is not a questions batch { questions: [...] }');
    return 1;
  }
  const rawItems = batch.questions as Record<string, unknown>[];
  const existing = content.questionsFiles.get(topic)?.questions ?? [];
  const startNumber = nextQuestionNumber(existing, topic);
  const ctx = checkContextFor(content, topic);

  const ids: string[] = [];
  const stamped: Record<string, unknown>[] = rawItems.map((raw, i) => {
    const id = `${topic}-q${String(startNumber + i).padStart(3, '0')}`;
    ids.push(id);
    return {
      ...raw,
      id,
      topic,
      writtenFrom: { unitId: raw.cite, promptVersion: 'v1', model },
    };
  });

  const problemsById = new Map<string, Set<string>>();
  const addProblem = (id: string, code: string): void => {
    if (!problemsById.has(id)) problemsById.set(id, new Set());
    problemsById.get(id)!.add(code);
  };

  const parsed: (Question | null)[] = stamped.map((raw, i) => {
    const result = QuestionSchema.safeParse(raw);
    if (!result.success) {
      addProblem(ids[i], 'SCHEMA');
      return null;
    }
    return result.data;
  });

  const validBatch = parsed.filter((q): q is Question => q !== null);
  const allForDupCheck = [...existing, ...validBatch];
  for (const q of validBatch) {
    for (const problem of checkQuestion(q, ctx)) addProblem(problem.id, problem.code);
    for (const problem of checkProvenance(
      { id: q.id, topic, writtenFrom: q.writtenFrom },
      content.prompts,
    )) {
      addProblem(problem.id, problem.code);
    }
  }
  for (const problem of checkNearDuplicates(allForDupCheck)) {
    const [a, b] = problem.id.split('|');
    const target = ids.includes(b) ? b : a;
    if (ids.includes(target)) addProblem(target, problem.code);
  }
  const allLessons = [...content.lessonsFiles.values()].flatMap((f) => f.lessons);
  for (const problem of checkVocabQueue(content.queue, allForDupCheck, allLessons, ctx)) {
    if (ids.includes(problem.id)) addProblem(problem.id, problem.code);
  }

  const accepted: Question[] = [];
  const rejectedLines: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const codes = problemsById.get(id);
    if (codes && codes.size > 0) {
      rejectedLines.push(`rejected ${id} ${[...codes].sort().join(',')}`);
    } else if (parsed[i]) {
      accepted.push(parsed[i] as Question);
    }
  }

  console.log(`accept: added=${accepted.length} rejected=${rejectedLines.length}`);
  for (const line of rejectedLines) console.log(line);

  if (accepted.length > 0) {
    await writeQuestionsFile(root, topic, [...existing, ...accepted]);
  }
  return rejectedLines.length > 0 ? 1 : 0;
}

async function runAcceptLesson(
  batchJson: unknown,
  topic: string,
  model: string,
  root: string,
  content: TheoryContent,
): Promise<number> {
  const batch = batchJson as { lesson?: unknown };
  if (
    typeof batchJson !== 'object' ||
    batchJson === null ||
    typeof batch.lesson !== 'object' ||
    batch.lesson === null
  ) {
    console.error('draft: batch is not a lesson batch { lesson: {...} }');
    return 1;
  }
  const lessonRaw = batch.lesson as { title?: unknown; minutes?: unknown; cards?: unknown };
  if (!Array.isArray(lessonRaw.cards)) {
    console.error('draft: lesson batch has no cards array');
    return 1;
  }

  const existingQuestions = content.questionsFiles.get(topic)?.questions ?? [];
  const existingLessons = content.lessonsFiles.get(topic)?.lessons ?? [];
  const lessonNumber = existingLessons.length + 1;
  const lessonId = `${topic}-l${lessonNumber}`;

  let nextQNum = nextQuestionNumber(existingQuestions, topic);
  const inlineQuestions: Question[] = [];
  const stampedCards: unknown[] = [];

  for (let i = 0; i < lessonRaw.cards.length; i++) {
    const cardRaw = lessonRaw.cards[i] as Record<string, unknown>;
    const cardId = `${lessonId}-c${String(i + 1).padStart(2, '0')}`;
    if (cardRaw.kind === 'rule') {
      stampedCards.push({
        ...cardRaw,
        id: cardId,
        writtenFrom: { unitId: cardRaw.cite, promptVersion: 'v1', model },
      });
    } else if (cardRaw.kind === 'check') {
      const qRaw = cardRaw.question as Record<string, unknown>;
      const qId = `${topic}-q${String(nextQNum).padStart(3, '0')}`;
      nextQNum++;
      const stampedQ = {
        ...qRaw,
        id: qId,
        topic,
        writtenFrom: { unitId: qRaw.cite, promptVersion: 'v1', model },
      };
      inlineQuestions.push(stampedQ as unknown as Question);
      stampedCards.push({ kind: 'check', id: cardId, question: qId });
    } else {
      stampedCards.push({ ...cardRaw, id: cardId });
    }
  }

  const lessonCandidate = {
    id: lessonId,
    topic,
    number: lessonNumber,
    title: lessonRaw.title,
    minutes: lessonRaw.minutes,
    cards: stampedCards,
  };

  const problems = new Set<string>();

  const questionParses = inlineQuestions.map((q) => QuestionSchema.safeParse(q));
  for (const result of questionParses) if (!result.success) problems.add('SCHEMA');

  const lessonParse = LessonSchema.safeParse(lessonCandidate);
  if (!lessonParse.success) problems.add('SCHEMA');

  const parsedQuestions = questionParses.map((r) => (r.success ? r.data : null));
  const ctx = checkContextFor(content, topic);

  if (lessonParse.success) {
    const validInline = parsedQuestions.filter((q): q is Question => q !== null);
    const allQuestions = [...existingQuestions, ...validInline];
    const allLessons = [...existingLessons, lessonParse.data];
    const questionsById = new Map(allQuestions.map((q) => [q.id, q]));

    for (const problem of checkLesson(lessonParse.data, questionsById, ctx))
      problems.add(problem.code);
    for (const q of validInline) {
      for (const problem of checkQuestion(q, ctx)) problems.add(problem.code);
      for (const problem of checkProvenance(
        { id: q.id, topic, writtenFrom: q.writtenFrom },
        content.prompts,
      )) {
        problems.add(problem.code);
      }
    }
    for (const card of lessonParse.data.cards) {
      if (card.kind !== 'rule') continue;
      for (const problem of checkProvenance(
        { id: card.id, topic, writtenFrom: card.writtenFrom },
        content.prompts,
      )) {
        problems.add(problem.code);
      }
    }
    for (const problem of checkNearDuplicates([...existingQuestions, ...validInline])) {
      problems.add(problem.code);
    }
    for (const problem of checkVocabQueue(content.queue, allQuestions, allLessons, ctx)) {
      problems.add(problem.code);
    }
  }

  const rejected = problems.size > 0;
  console.log(`accept: added=${rejected ? 0 : 1} rejected=${rejected ? 1 : 0}`);
  if (rejected) {
    console.log(`rejected ${lessonId} ${[...problems].sort().join(',')}`);
    return 1;
  }

  const validInline = parsedQuestions.filter((q): q is Question => q !== null);
  await writeQuestionsFile(root, topic, [...existingQuestions, ...validInline]);
  await writeLessonsFile(root, topic, [...existingLessons, lessonParse.data as Lesson]);
  return 0;
}

// `env` is accepted (not just `args`) so its call shape matches `runPrompt`'s, per A54; `accept`
// itself needs no environment variable (A55 — it does not need CLUTCH_OFFLINE).
export async function runAccept(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<number> {
  void env;
  const parsed = parseAcceptArgs(args);
  if (!parsed) return 1;
  const { topic, kind, model, root, batchPath } = parsed;

  let batchRaw: string;
  try {
    batchRaw = readFileSync(batchPath, 'utf8');
  } catch {
    console.error(`draft: could not read batch file ${batchPath}`);
    return 1;
  }
  let batchJson: unknown;
  try {
    batchJson = JSON.parse(batchRaw);
  } catch {
    console.error('draft: batch file is not valid JSON');
    return 1;
  }

  let content: TheoryContent;
  try {
    content = loadTheoryContent(root);
  } catch (error) {
    console.error(`draft: ${(error as Error).message}`);
    return 1;
  }
  if (!content.topics.some((t) => t.id === topic)) {
    console.error(`draft: unknown topic ${topic}`);
    return 1;
  }

  try {
    if (kind === 'questions')
      return await runAcceptQuestions(batchJson, topic, model, root, content);
    return await runAcceptLesson(batchJson, topic, model, root, content);
  } catch (error) {
    console.error(`draft: ${(error as Error).message}`);
    return 1;
  }
}

// =====================================================================================
// CLI entry
// =====================================================================================

async function main(): Promise<void> {
  const [sub, ...rest] = process.argv.slice(2);
  if (sub === 'prompt') {
    process.exitCode = await runPrompt(rest, process.env);
    return;
  }
  if (sub === 'accept') {
    process.exitCode = await runAccept(rest, process.env);
    return;
  }
  console.error('draft: usage: draft-theory.ts prompt|accept ...');
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main();
}
