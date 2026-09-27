// The nine content checks for theory questions and lesson cards, plus the
// coverage-shortfall report (Phase 3 block 3a Step 9; plan.md Step 9 and
// amend-09 A41-A46), plus the provenance check (Step 10; amend-10 A52):
// `checkProvenance` flags a question or rule card whose `writtenFrom` names
// no unit listed on a `units:` line of one of its topic's prompts of the
// same `promptVersion`, or whose `model` is blank. `parseUnitsLine` reads a
// generated prompt's first line into its cited units. Pure: every input
// (the corpus, its flattened texts, facts.json's facts, the item's topic
// record, its distractor pool, the synonyms groups, the vocab queue's ids
// and the prompt index) is built by the caller; this module does no I/O,
// reads no env, clock or randomness. `checkQuestion` and `checkLesson` each
// return zero or more `TheoryProblem`s (a `ProblemCode` plus the id of the
// thing at fault); `checkNearDuplicates` compares every pair of questions;
// `checkVocabQueue` flags a queue entry whose item is gone or now passes;
// `coverageShortfalls` reports which topics, DVSA areas and National
// Standard elements fall short of their question-count minimum (Decision 7:
// 50 per topic, 50 per area, 3 per element), scoped to `'written'` topics
// only or to the `'full'` course.
// Depends on: ./theory-corpus, ../../src/content/schemas (types only).
// Depended on by: tests/unit/theory-checks.test.ts, tests/content/theory.test.ts,
// tests/content/coverage.test.ts, scripts/lib/theory-content.ts,
// tests/content/prompts.test.ts, tests/unit/theory-provenance.test.ts,
// scripts/draft-theory.ts.
import { unitTexts } from './theory-corpus';
import type { TheoryCorpus } from './theory-corpus';
import type {
  Question,
  Lesson,
  LessonCard,
  VocabQueueEntry,
  Topic,
  Fact,
  WrittenFrom,
} from '../../src/content/schemas';

export const PROBLEM_CODES = [
  'CITE-UNRESOLVED',
  'QUOTE-NOT-VERBATIM',
  'QUOTE-TOO-LONG',
  'NUMBER-UNSOURCED',
  'VOCAB-LOW',
  'DISTRACTOR-NOT-IN-POOL',
  'KEYPHRASE-NOT-IN-CORPUS',
  'TOPIC-MISMATCH',
  'SIGN-UNKNOWN',
  'NEAR-DUPLICATE',
  'CARD-CITE-UNRESOLVED',
  'CARD-QUOTE-NOT-VERBATIM',
  'CARD-QUOTE-TOO-LONG',
  'CARD-NUMBER-UNSOURCED',
  'CARD-VOCAB-LOW',
  'CADENCE',
  'CHECK-UNKNOWN-QUESTION',
  'CHECK-OFF-RUN',
  'CHECK-REUSED',
  'QUEUE-STALE',
  'PROVENANCE-MISSING',
] as const;

/** The phrases a prompt (template or generated) must never contain (Step 10, A52/A54). */
export const BANNED_PROMPT_PHRASES = [
  'DVSA',
  'official',
  'past paper',
  'theory test question',
] as const;

/** Every cite listed on a `units:` line of any prompt, keyed by `${promptVersion}/${topic}`. */
export type PromptIndex = ReadonlyMap<string, ReadonlySet<string>>;

/** The shape `checkProvenance` needs from a question or a rule card. */
export interface ProvenanceItem {
  id: string;
  topic: string;
  writtenFrom: WrittenFrom;
}

const UNITS_LINE = /^units: ([^\s,]+(?:, [^\s,]+)*)$/;

/** Reads a generated prompt's first line into its cited units, or null when it is not a units line. */
export function parseUnitsLine(line: string): string[] | null {
  const match = UNITS_LINE.exec(line.replace(/\r$/, ''));
  return match ? match[1].split(', ') : null;
}

/**
 * PROVENANCE-MISSING when `item.writtenFrom.model` is blank, or when no prompt of the item's
 * topic and `writtenFrom.promptVersion` lists `writtenFrom.unitId` on its `units:` line.
 */
export function checkProvenance(item: ProvenanceItem, prompts: PromptIndex): TheoryProblem[] {
  const key = `${item.writtenFrom.promptVersion}/${item.topic}`;
  const listed = prompts.get(key)?.has(item.writtenFrom.unitId) ?? false;
  if (item.writtenFrom.model.trim() === '' || !listed) {
    return [{ code: 'PROVENANCE-MISSING', id: item.id }];
  }
  return [];
}

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export interface TheoryProblem {
  code: ProblemCode;
  id: string;
}

export interface TheoryCheckContext {
  corpus: TheoryCorpus;
  corpusTexts: readonly string[];
  facts: readonly Pick<Fact, 'value' | 'statement'>[];
  topic: Pick<Topic, 'id' | 'areas' | 'nsElements'>;
  pool: readonly string[];
  synonyms: readonly (readonly string[])[];
  queuedIds: ReadonlySet<string>;
}

export interface CoverageInput {
  topics: readonly Pick<Topic, 'id' | 'areas' | 'nsElements'>[];
  areas: readonly string[];
  elements: readonly string[];
  written: ReadonlySet<string>;
  questions: readonly Pick<Question, 'topic' | 'area' | 'elements'>[];
}

const QUOTE_FOLD: [RegExp, string][] = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
];

/** Whitespace collapsed, typographic quotes folded to straight ones, trimmed. */
export function normalise(text: string): string {
  let out = text;
  for (const [re, rep] of QUOTE_FOLD) out = out.replace(re, rep);
  return out.replace(/\s+/g, ' ').trim();
}

/** The number of space-separated tokens of the normalised text (0 for an empty string). */
export function wordCount(text: string): number {
  const n = normalise(text);
  return n === '' ? 0 : n.split(' ').length;
}

/** Whole numbers, decimals and comma-grouped numbers found in the text, in order. */
export function numberTokens(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

function wordsOf(text: string): string[] {
  return (
    normalise(text)
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)*/g) ?? []
  );
}

export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'is',
  'are',
  'be',
  'you',
  'your',
  'it',
  'with',
]);

/** The text's words, lower-cased, stop words and digits dropped, each kept once, in first-occurrence order. */
export function contentWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of wordsOf(text)) {
    if (STOP_WORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/**
 * Every non-null `unitTexts` string of every rule, section, sign, element and
 * GOV.UK part of the corpus, each as `normalise(t).toLowerCase()` (A41).
 * Built by re-resolving every unit through `unitTexts` (never re-reading the
 * corpus's raw html directly), so the two never drift (A37).
 */
export function corpusTextsOf(corpus: TheoryCorpus): string[] {
  const ids = [
    ...[...corpus.rulesById.keys()].map((id) => `hc:${id}`),
    ...[...corpus.sectionsBySlug.keys()].map((slug) => `hc-section:${slug}`),
    ...[...corpus.signsById.keys()].map((id) => `sign:${id}`),
    ...[...corpus.elementsById.keys()].map((id) => `ns:${id}`),
    ...[...corpus.govukPartsByKey.keys()].map((key) => `govuk:${key}`),
  ];
  const out: string[] = [];
  for (const id of ids) {
    const texts = unitTexts(id, corpus);
    if (texts === null) continue;
    for (const t of texts) out.push(normalise(t).toLowerCase());
  }
  return out;
}

/**
 * The share of `answer`'s content words found — as-is or without a trailing
 * "s" — in `unitTexts`'s words, or through a synonyms group sharing a found
 * word. 1 when the answer has no content words.
 */
export function vocabRatio(
  answer: string,
  texts: readonly string[],
  synonyms: readonly (readonly string[])[],
): number {
  const universe = new Set<string>();
  for (const t of texts) for (const w of wordsOf(t)) universe.add(w);
  const found = (x: string): boolean =>
    universe.has(x) || (x.endsWith('s') && universe.has(x.slice(0, -1)));
  const groups = synonyms.map((g) => g.map((m) => m.toLowerCase()));
  const words = contentWords(answer);
  if (words.length === 0) return 1;
  let hit = 0;
  for (const w of words) {
    if (found(w)) {
      hit++;
      continue;
    }
    const wBare = w.endsWith('s') ? w.slice(0, -1) : w;
    const inGroup = groups.some((g) => {
      const members = g.includes(w) || g.includes(wBare);
      if (!members) return false;
      return g.some((m) => found(m));
    });
    if (inGroup) hit++;
  }
  return hit / words.length;
}

/** The intersection over the union of two token sets; 0 when both are empty. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function sourceNumberSet(
  texts: readonly string[],
  facts: readonly Pick<Fact, 'value' | 'statement'>[],
): Set<string> {
  const set = new Set<string>();
  for (const t of texts) for (const n of numberTokens(t)) set.add(n);
  for (const f of facts) {
    for (const n of numberTokens(String(f.value))) set.add(n);
    for (const n of numberTokens(f.statement)) set.add(n);
  }
  return set;
}

function unresolvedNumbers(tokens: readonly string[], source: ReadonlySet<string>): boolean {
  return tokens.some((n) => !source.has(n));
}

function unitTextsFor(cite: string, ctx: Pick<TheoryCheckContext, 'corpus'>): string[] | null {
  return unitTexts(cite, ctx.corpus);
}

/** The nine per-question checks (A43), suppressing the quote/number/vocab codes when the cite does not resolve (A44). */
export function checkQuestion(q: Question, ctx: TheoryCheckContext): TheoryProblem[] {
  const problems: TheoryProblem[] = [];
  const push = (code: ProblemCode) => problems.push({ code, id: q.id });

  const T = unitTextsFor(q.cite, ctx);
  const right = q.options.find((o) => o.id === q.answer)?.text ?? '';

  if (T === null) {
    push('CITE-UNRESOLVED');
  } else {
    const normT = T.map((t) => normalise(t));
    if (!normT.some((t) => t.includes(normalise(q.sourceQuote)))) push('QUOTE-NOT-VERBATIM');
    const source = sourceNumberSet(T, ctx.facts);
    const numbers = [...numberTokens(q.stem), ...numberTokens(right)];
    if (unresolvedNumbers(numbers, source)) push('NUMBER-UNSOURCED');
    if (vocabRatio(right, T, ctx.synonyms) < 0.8 && !ctx.queuedIds.has(q.id)) push('VOCAB-LOW');
  }
  if (wordCount(q.sourceQuote) > 40) push('QUOTE-TOO-LONG');

  if (q.answerKind === 'value') {
    const pool = new Set(ctx.pool.map((v) => normalise(v).toLowerCase()));
    const wrong = q.options.filter((o) => o.id !== q.answer);
    if (wrong.some((o) => !pool.has(normalise(o.text).toLowerCase())))
      push('DISTRACTOR-NOT-IN-POOL');
  } else if (q.answerKind === 'phrase') {
    const corpusTexts = ctx.corpusTexts;
    const wrong = q.options.filter((o) => o.id !== q.answer);
    const missing = wrong.some((o) => {
      const phrase = normalise(o.keyPhrase ?? '').toLowerCase();
      return !corpusTexts.some((t) => t.includes(phrase));
    });
    if (missing) push('KEYPHRASE-NOT-IN-CORPUS');
  }

  const topicMismatch =
    q.topic !== ctx.topic.id ||
    !ctx.topic.areas.includes(q.area) ||
    q.elements.some((e) => !ctx.topic.nsElements.includes(e));
  if (topicMismatch) push('TOPIC-MISMATCH');

  if (q.stemSign !== null && !ctx.corpus.signsById.has(q.stemSign)) push('SIGN-UNKNOWN');

  return problems;
}

function stemTokens(stem: string): Set<string> {
  return new Set(
    normalise(stem)
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [],
  );
}

/** NEAR-DUPLICATE for stem pairs at Jaccard >= 0.6, skipping two sign4 questions on different signs. */
export function checkNearDuplicates(questions: readonly Question[]): TheoryProblem[] {
  const problems: TheoryProblem[] = [];
  const tokens = questions.map((q) => stemTokens(q.stem));
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const a = questions[i];
      const b = questions[j];
      if (a.format === 'sign4' && b.format === 'sign4' && a.stemSign !== b.stemSign) continue;
      if (jaccard(tokens[i], tokens[j]) >= 0.6) {
        problems.push({ code: 'NEAR-DUPLICATE', id: `${a.id}|${b.id}` });
      }
    }
  }
  return problems;
}

function checkRuleCard(
  card: Extract<LessonCard, { kind: 'rule' }>,
  ctx: TheoryCheckContext,
): TheoryProblem[] {
  const problems: TheoryProblem[] = [];
  const push = (code: ProblemCode) => problems.push({ code, id: card.id });
  const T = unitTextsFor(card.cite, ctx);
  if (T === null) {
    push('CARD-CITE-UNRESOLVED');
    if (wordCount(card.quote) > 80) push('CARD-QUOTE-TOO-LONG');
    return problems;
  }
  const normT = T.map((t) => normalise(t));
  if (!normT.some((t) => t.includes(normalise(card.quote)))) push('CARD-QUOTE-NOT-VERBATIM');
  if (wordCount(card.quote) > 80) push('CARD-QUOTE-TOO-LONG');
  const source = sourceNumberSet(T, ctx.facts);
  const numbers = [...numberTokens(card.headline), ...numberTokens(card.inShort)];
  if (unresolvedNumbers(numbers, source)) push('CARD-NUMBER-UNSOURCED');
  if (vocabRatio(card.inShort, T, ctx.synonyms) < 0.8 && !ctx.queuedIds.has(card.id))
    push('CARD-VOCAB-LOW');
  return problems;
}

/** The lesson-level checks (cadence and the check cards) and the per-rule-card checks, suppressing on an unresolved cite (A44). */
export function checkLesson(
  lesson: Lesson,
  questionsById: ReadonlyMap<string, Question>,
  ctx: TheoryCheckContext,
): TheoryProblem[] {
  const problems: TheoryProblem[] = [];

  for (const card of lesson.cards) {
    if (card.kind === 'rule') problems.push(...checkRuleCard(card, ctx));
  }

  const kinds = lesson.cards.map((c) => (c.kind === 'rule' ? 'R' : 'C')).join('');
  const ruleCount = lesson.cards.filter((c) => c.kind === 'rule').length;
  const cadenceOk = /^(?:RRR?C)+$/.test(kinds) && ruleCount >= 4 && ruleCount <= 8;
  if (!cadenceOk) problems.push({ code: 'CADENCE', id: lesson.id });

  const usedQuestions = new Set<string>();
  let run: Extract<LessonCard, { kind: 'rule' }>[] = [];
  for (const card of lesson.cards) {
    if (card.kind === 'rule') {
      run.push(card);
      continue;
    }
    // card.kind === 'check'
    const unknown = !questionsById.has(card.question);
    const reused = usedQuestions.has(card.question);
    if (unknown) {
      problems.push({ code: 'CHECK-UNKNOWN-QUESTION', id: card.id });
    } else if (reused) {
      problems.push({ code: 'CHECK-REUSED', id: card.id });
    } else {
      const question = questionsById.get(card.question);
      const runCites = new Set(run.map((r) => r.cite));
      if (!question || !runCites.has(question.cite)) {
        problems.push({ code: 'CHECK-OFF-RUN', id: card.id });
      }
    }
    usedQuestions.add(card.question);
    run = [];
  }

  return problems;
}

/** QUEUE-STALE for a queue entry whose item is gone, or whose ratio is now >= 0.8; never for an unresolved cite. */
export function checkVocabQueue(
  entries: readonly VocabQueueEntry[],
  questions: readonly Question[],
  lessons: readonly Lesson[],
  ctx: Pick<TheoryCheckContext, 'corpus' | 'synonyms'>,
): TheoryProblem[] {
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const cardsById = new Map<string, Extract<LessonCard, { kind: 'rule' }>>();
  for (const lesson of lessons) {
    for (const card of lesson.cards) {
      if (card.kind === 'rule') cardsById.set(card.id, card);
    }
  }

  const problems: TheoryProblem[] = [];
  for (const entry of entries) {
    const question = questionsById.get(entry.id);
    const card = cardsById.get(entry.id);
    if (!question && !card) {
      problems.push({ code: 'QUEUE-STALE', id: entry.id });
      continue;
    }
    const cite = question ? question.cite : card!.cite;
    const T = unitTextsFor(cite, ctx);
    if (T === null) continue;
    const answer = question
      ? (question.options.find((o) => o.id === question.answer)?.text ?? '')
      : card!.inShort;
    const ratio = vocabRatio(answer, T, ctx.synonyms);
    if (ratio >= 0.8) problems.push({ code: 'QUEUE-STALE', id: entry.id });
  }
  return problems;
}

function shortfallLine(
  kind: 'topic' | 'area' | 'element',
  name: string,
  count: number,
  min: number,
): string {
  return `${kind} ${name}: ${count} questions, needs ${min}`;
}

/** The coverage-shortfall report: topics, then areas, then elements below their minimum, each in input order. */
export function coverageShortfalls(input: CoverageInput, scope: 'written' | 'full'): string[] {
  const { topics, areas, elements, written, questions } = input;
  const lines: string[] = [];

  const topicCount = (id: string) => questions.filter((q) => q.topic === id).length;
  const areaCount = (name: string) => questions.filter((q) => q.area === name).length;
  const elementCount = (id: string) => questions.filter((q) => q.elements.includes(id)).length;

  const scopedTopics = scope === 'full' ? topics : topics.filter((t) => written.has(t.id));
  for (const t of scopedTopics) {
    const n = topicCount(t.id);
    if (n < 50) lines.push(shortfallLine('topic', t.id, n, 50));
  }

  const areaFullyWritten = (name: string): boolean => {
    const covering = topics.filter((t) => t.areas.includes(name));
    return covering.length > 0 && covering.every((t) => written.has(t.id));
  };
  const scopedAreas = scope === 'full' ? areas : areas.filter((a) => areaFullyWritten(a));
  for (const a of scopedAreas) {
    const n = areaCount(a);
    if (n < 50) lines.push(shortfallLine('area', a, n, 50));
  }

  const elementFullyWritten = (id: string): boolean => {
    const covering = topics.filter((t) => t.nsElements.includes(id));
    return covering.length > 0 && covering.every((t) => written.has(t.id));
  };
  const scopedElements =
    scope === 'full' ? elements : elements.filter((e) => elementFullyWritten(e));
  for (const e of scopedElements) {
    const n = elementCount(e);
    if (n < 3) lines.push(shortfallLine('element', e, n, 3));
  }

  return lines;
}
