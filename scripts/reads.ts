// Offline reading and reviewing tools for theory content (Phase 3 block 3a
// Step 10; plan.md Step 10, amend-10 A57): `sample` prints a seeded reading
// packet for one topic (every rule card, every vocab-queue item, every
// `fix` id of a lane file, and a seeded share of the remaining questions),
// each item carrying a `canonicalJson`+sha256 `hash` of the object exactly
// as stored; `check` reads back a verdicts block (lane mode: ok/fix/drop
// against the previous sample's hashes; lincoln mode: keep/reject, plus a
// vocab-queue acceptedBy gate and a question-review quota) and reports
// which ids are kept, changed, dropped or still unresolved. Every read
// stays under `--root` (default: the repo this file lives in), never the
// process's own cwd.
// Depends on: node:crypto, node:fs, node:path, node:url,
// ./lib/theory-corpus, ../src/features/interactives/shared/random.ts.
// Depended on by: package.json (`reads:sample`, `reads:check`),
// tests/unit/reads.test.ts.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus, unitTexts } from './lib/theory-corpus';
import type { TheoryCorpus } from './lib/theory-corpus';
import { mulberry32, shuffle } from '../src/features/interactives/shared/random';

function defaultRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readOptionalJson<T>(path: string): T | null {
  return existsSync(path) ? readJsonFile<T>(path) : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** `JSON.stringify` with object keys sorted at every depth, arrays kept in order, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/** The first 16 hex characters of `sha256(canonicalJson(item))`. */
export function itemHash(item: unknown): string {
  return createHash('sha256').update(canonicalJson(item), 'utf8').digest('hex').slice(0, 16);
}

interface Verdict {
  id: string;
  hash: string;
  verdict: string;
  note: string;
}

/** Reads the first fenced ```json block into `{ verdicts: [...] }`, or null when none is found or valid. */
export function parseVerdictsBlock(markdown: string): Verdict[] | null {
  const lines = markdown.split('\n');
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && /^```json\s*$/.test(lines[i])) {
      start = i;
      continue;
    }
    if (start !== -1 && /^```\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (start === -1 || end === -1) return null;
  const body = lines.slice(start + 1, end).join('\n');
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { verdicts?: unknown }).verdicts)
  ) {
    return null;
  }
  const verdicts = (parsed as { verdicts: unknown[] }).verdicts;
  for (const v of verdicts) {
    if (typeof v !== 'object' || v === null) return null;
    const record = v as Record<string, unknown>;
    for (const field of ['id', 'hash', 'verdict', 'note']) {
      if (typeof record[field] !== 'string') return null;
    }
  }
  return verdicts as Verdict[];
}

/** Folds a verdicts list forward: the last entry per id is final, but the id keeps its first position. */
function foldFinal(
  verdicts: readonly Verdict[],
): Map<string, { hash: string; verdict: string; note: string }> {
  const map = new Map<string, { hash: string; verdict: string; note: string }>();
  for (const v of verdicts) map.set(v.id, { hash: v.hash, verdict: v.verdict, note: v.note });
  return map;
}

// =====================================================================================
// Shared file shapes (read exactly as stored, never schema-parsed)
// =====================================================================================

interface RuleCard {
  kind: 'rule';
  id: string;
  headline: string;
  cite: string;
  quote: string;
  inShort: string;
}
interface CheckCard {
  kind: 'check';
  id: string;
  question: string;
}
type LessonCard = RuleCard | CheckCard;
interface StoredLesson {
  id: string;
  number: number;
  cards: LessonCard[];
}
interface StoredQuestion {
  id: string;
  format: string;
  stem: string;
  stemSign: string | null;
  options: unknown;
  answer: string;
  cite: string;
  sourceQuote: string;
}
interface QueueEntry {
  id: string;
  acceptedBy: string | null;
}

interface Item {
  id: string;
  kind: 'card' | 'question';
  hash: string;
  [key: string]: unknown;
}

function cardItem(card: RuleCard, lessonNumber: number, corpus: TheoryCorpus | null): Item {
  return {
    id: card.id,
    kind: 'card',
    hash: itemHash(card),
    lesson: lessonNumber,
    headline: card.headline,
    cite: card.cite,
    quote: card.quote,
    inShort: card.inShort,
    ...(corpus ? { units: unitTexts(card.cite, corpus) ?? [] } : {}),
  };
}

function questionItem(question: StoredQuestion, corpus: TheoryCorpus | null): Item {
  return {
    id: question.id,
    kind: 'question',
    hash: itemHash(question),
    format: question.format,
    stem: question.stem,
    stemSign: question.stemSign,
    options: question.options,
    answer: question.answer,
    cite: question.cite,
    sourceQuote: question.sourceQuote,
    ...(corpus ? { units: unitTexts(question.cite, corpus) ?? [] } : {}),
  };
}

function findCard(
  lessonsFile: { lessons: StoredLesson[] } | null,
  id: string,
): { card: RuleCard; lessonNumber: number } | null {
  for (const lesson of lessonsFile?.lessons ?? []) {
    for (const card of lesson.cards) {
      if (card.kind === 'rule' && card.id === id) return { card, lessonNumber: lesson.number };
    }
  }
  return null;
}

// =====================================================================================
// sample
// =====================================================================================

interface ParsedSampleArgs {
  topic: string;
  share: number;
  seed: number;
  root: string;
  also: string | null;
  withUnits: boolean;
}

function parseSampleArgs(args: string[]): ParsedSampleArgs | null {
  let topic: string | null = null;
  let shareStr: string | null = null;
  let seedStr: string | null = null;
  let root: string | null = null;
  let also: string | null = null;
  let withUnits = false;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--with-units') {
      withUnits = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined) {
      console.error(`reads: ${token} needs a value`);
      return null;
    }
    if (token === '--topic') {
      topic = value;
      i++;
    } else if (token === '--share') {
      shareStr = value;
      i++;
    } else if (token === '--seed') {
      seedStr = value;
      i++;
    } else if (token === '--root') {
      root = value;
      i++;
    } else if (token === '--also') {
      also = value;
      i++;
    } else {
      console.error(`reads: unknown flag ${token}`);
      return null;
    }
  }

  if (!topic) {
    console.error('reads: --topic is required');
    return null;
  }
  const share = Number(shareStr);
  if (shareStr === null || Number.isNaN(share) || share < 0 || share > 1) {
    console.error('reads: --share must be a number from 0 to 1');
    return null;
  }
  const seed = Number(seedStr);
  if (seedStr === null || !Number.isInteger(seed)) {
    console.error('reads: --seed must be an integer');
    return null;
  }
  return { topic, share, seed, root: root ?? defaultRoot(), also, withUnits };
}

function runSample(args: string[]): number {
  const parsed = parseSampleArgs(args);
  if (!parsed) return 1;
  const { topic, share, seed, root, also, withUnits } = parsed;

  let questionsFile: { topic: string; questions: StoredQuestion[] };
  let lessonsFile: { topic: string; lessons: StoredLesson[] } | null;
  let queueFile: { entries: QueueEntry[] };
  try {
    const topicsFile = readJsonFile<{ topics: { id: string }[] }>(
      join(root, 'content/uk/topics.json'),
    );
    if (!topicsFile.topics.some((t) => t.id === topic)) throw new Error(`unknown topic ${topic}`);
    questionsFile = readJsonFile(join(root, `content/uk/theory/questions/${topic}.json`));
    lessonsFile = readOptionalJson(join(root, `content/uk/theory/lessons/${topic}.json`));
    queueFile = readOptionalJson(join(root, 'content/uk/theory/vocab-queue.json')) ?? {
      entries: [],
    };
  } catch (error) {
    console.error(`reads: ${(error as Error).message}`);
    return 1;
  }

  const corpus = withUnits ? loadCorpus(root) : null;
  const seen = new Set<string>();
  const items: Item[] = [];
  const questionsById = new Map(questionsFile.questions.map((q) => [q.id, q]));

  for (const lesson of lessonsFile?.lessons ?? []) {
    for (const card of lesson.cards) {
      if (card.kind !== 'rule' || seen.has(card.id)) continue;
      seen.add(card.id);
      items.push(cardItem(card, lesson.number, corpus));
    }
  }

  for (const entry of queueFile.entries) {
    if (seen.has(entry.id)) continue;
    const q = questionsById.get(entry.id);
    if (q) {
      seen.add(entry.id);
      items.push(questionItem(q, corpus));
      continue;
    }
    const found = findCard(lessonsFile, entry.id);
    if (found) {
      seen.add(entry.id);
      items.push(cardItem(found.card, found.lessonNumber, corpus));
    }
  }

  if (also) {
    let alsoText: string;
    try {
      alsoText = readFileSync(also, 'utf8');
    } catch {
      alsoText = '';
    }
    const verdicts = parseVerdictsBlock(alsoText);
    if (verdicts) {
      for (const [id, v] of foldFinal(verdicts)) {
        if (v.verdict !== 'fix' || seen.has(id)) continue;
        const q = questionsById.get(id);
        if (q) {
          seen.add(id);
          items.push(questionItem(q, corpus));
          continue;
        }
        const found = findCard(lessonsFile, id);
        if (found) {
          seen.add(id);
          items.push(cardItem(found.card, found.lessonNumber, corpus));
        }
      }
    }
  }

  const remaining = questionsFile.questions.filter((q) => !seen.has(q.id));
  const rng = mulberry32(seed);
  const shuffled = shuffle(remaining, rng);
  const count = Math.ceil(share * questionsFile.questions.length);
  for (const q of shuffled.slice(0, count)) items.push(questionItem(q, corpus));

  console.log(JSON.stringify({ topic, seed, share, items }, null, 2));
  return 0;
}

// =====================================================================================
// check
// =====================================================================================

interface ParsedCheckArgs {
  mode: 'lincoln' | 'lane';
  topic: string;
  verdictsPath: string;
  root: string;
  alsoPath: string | null;
}

function parseCheckArgs(args: string[]): ParsedCheckArgs | null {
  let mode: string | null = null;
  let topic: string | null = null;
  let verdictsPath: string | null = null;
  let root: string | null = null;
  let alsoPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const value = args[i + 1];
    if (value === undefined) {
      console.error(`reads: ${token} needs a value`);
      return null;
    }
    if (token === '--mode') {
      mode = value;
      i++;
    } else if (token === '--topic') {
      topic = value;
      i++;
    } else if (token === '--verdicts') {
      verdictsPath = value;
      i++;
    } else if (token === '--root') {
      root = value;
      i++;
    } else if (token === '--also') {
      alsoPath = value;
      i++;
    } else {
      console.error(`reads: unknown flag ${token}`);
      return null;
    }
  }

  if (mode !== 'lincoln' && mode !== 'lane') {
    console.error('reads: --mode must be lincoln or lane');
    return null;
  }
  if (!topic) {
    console.error('reads: --topic is required');
    return null;
  }
  if (!verdictsPath) {
    console.error('reads: --verdicts is required');
    return null;
  }
  return { mode, topic, verdictsPath, root: root ?? defaultRoot(), alsoPath };
}

function runCheck(args: string[]): number {
  const parsed = parseCheckArgs(args);
  if (!parsed) return 1;
  const { mode, topic, verdictsPath, root, alsoPath } = parsed;

  let questionsFile: { topic: string; questions: StoredQuestion[] };
  let lessonsFile: { topic: string; lessons: StoredLesson[] } | null;
  let queueFile: { entries: QueueEntry[] };
  try {
    const topicsFile = readJsonFile<{ topics: { id: string }[] }>(
      join(root, 'content/uk/topics.json'),
    );
    if (!topicsFile.topics.some((t) => t.id === topic)) throw new Error(`unknown topic ${topic}`);
    questionsFile = readJsonFile(join(root, `content/uk/theory/questions/${topic}.json`));
    lessonsFile = readOptionalJson(join(root, `content/uk/theory/lessons/${topic}.json`));
    queueFile = readOptionalJson(join(root, 'content/uk/theory/vocab-queue.json')) ?? {
      entries: [],
    };
  } catch (error) {
    console.error(`reads: ${(error as Error).message}`);
    return 1;
  }

  let verdictsText: string;
  try {
    verdictsText = readFileSync(verdictsPath, 'utf8');
  } catch {
    console.error(`reads: could not read ${verdictsPath}`);
    return 1;
  }
  const verdicts = parseVerdictsBlock(verdictsText);
  if (!verdicts) {
    console.error('reads: verdicts file has no valid json block');
    return 1;
  }
  const finalMap = foldFinal(verdicts);

  const currentCards = new Map<string, RuleCard>();
  for (const lesson of lessonsFile?.lessons ?? []) {
    for (const card of lesson.cards) if (card.kind === 'rule') currentCards.set(card.id, card);
  }
  const currentQuestions = new Map(questionsFile.questions.map((q) => [q.id, q]));
  const isCurrent = (id: string): boolean => currentCards.has(id) || currentQuestions.has(id);
  const currentHash = (id: string): string | null => {
    const card = currentCards.get(id);
    if (card) return itemHash(card);
    const question = currentQuestions.get(id);
    return question ? itemHash(question) : null;
  };

  let alsoFixIds = new Set<string>();
  if (mode === 'lincoln' && alsoPath) {
    let alsoText: string | null = null;
    try {
      alsoText = readFileSync(alsoPath, 'utf8');
    } catch {
      // A missing or unreadable --also file simply contributes no extra required ids.
    }
    const alsoVerdicts = alsoText ? parseVerdictsBlock(alsoText) : null;
    if (alsoVerdicts) {
      alsoFixIds = new Set(
        [...foldFinal(alsoVerdicts)]
          .filter(([id, v]) => v.verdict === 'fix' && isCurrent(id))
          .map(([id]) => id),
      );
    }
  }

  const V = new Set(finalMap.keys());
  const R =
    mode === 'lane'
      ? new Set([...currentCards.keys(), ...currentQuestions.keys()])
      : new Set([
          ...currentCards.keys(),
          ...queueFile.entries.filter((e) => e.id.startsWith(`${topic}-`)).map((e) => e.id),
          ...alsoFixIds,
        ]);
  const allIds = new Set([...R, ...V]);

  let kept = 0;
  let changed = 0;
  let dropped = 0;
  let unresolved = 0;
  const unresolvedLines: string[] = [];
  const markUnresolved = (id: string, why: string): void => {
    unresolved++;
    unresolvedLines.push(`unresolved ${id}: ${why}`);
  };

  for (const id of allIds) {
    const entry = finalMap.get(id);
    if (!entry) {
      markUnresolved(id, 'no entry');
      continue;
    }
    const { verdict, hash } = entry;
    if (mode === 'lane') {
      if (verdict === 'ok') {
        if (isCurrent(id) && currentHash(id) === hash) kept++;
        else markUnresolved(id, 'ok but the hash changed or the item is gone');
      } else if (verdict === 'fix') {
        if (!isCurrent(id) || currentHash(id) !== hash) changed++;
        else markUnresolved(id, 'fix but the hash did not change');
      } else if (verdict === 'drop') {
        if (!isCurrent(id)) dropped++;
        else markUnresolved(id, 'drop but the item is still present');
      } else {
        markUnresolved(id, `verdict "${verdict}" is outside lane mode`);
      }
    } else {
      if (verdict === 'keep') {
        if (isCurrent(id) && currentHash(id) === hash) kept++;
        else markUnresolved(id, 'keep but the hash changed or the item is gone');
      } else if (verdict === 'reject') {
        if (!isCurrent(id)) dropped++;
        else markUnresolved(id, 'reject but the item is still present');
      } else {
        markUnresolved(id, `verdict "${verdict}" is outside lincoln mode`);
      }
    }
  }

  if (mode === 'lincoln') {
    for (const entry of queueFile.entries) {
      if (!entry.id.startsWith(`${topic}-`)) continue;
      if (entry.acceptedBy !== 'lincoln')
        markUnresolved(entry.id, 'queue entry not accepted by lincoln');
    }
    const need = Math.ceil(0.2 * questionsFile.questions.length);
    const questionRe = new RegExp(`^${escapeRegExp(topic)}-q\\d{3}$`);
    const reviewedQuestions = [...V].filter((id) => questionRe.test(id));
    if (reviewedQuestions.length < need) {
      const shortfall = need - reviewedQuestions.length;
      unresolved += shortfall;
      unresolvedLines.push(
        `unresolved quota: need ${need} reviewed questions, have ${reviewedQuestions.length}`,
      );
    }
  }

  for (const line of unresolvedLines) console.log(line);
  console.log(
    `reads: mode=${mode} items=${allIds.size} kept=${kept} changed=${changed} dropped=${dropped} unresolved=${unresolved}`,
  );
  return unresolved === 0 ? 0 : 1;
}

// =====================================================================================
// CLI entry
// =====================================================================================

export function runReads(args: string[]): number {
  const [sub, ...rest] = args;
  if (sub === 'sample') return runSample(rest);
  if (sub === 'check') return runCheck(rest);
  console.error('reads: usage: reads.ts sample|check ...');
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = runReads(process.argv.slice(2));
}
