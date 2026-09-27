// The shared context builder for theory content (Phase 3 block 3a Step 10;
// amend-10 A53): reads the corpus, facts.json, topics.json, the synonyms and
// vocab-queue files, every lessons/questions/pools file under
// content/uk/theory/, and every generated prompt under
// content/prompts/theory/, from a given repo root (never the process's own
// cwd), and builds the `TheoryCheckContext` `scripts/lib/theory-checks.ts`'s
// `checkQuestion`/`checkLesson` need for one file topic — the same shape
// tests/content/theory.test.ts's own `ctxFor` built before this module
// existed. Does I/O; every value is a `JSON.parse` result cast, never
// schema-parsed, so a malformed file fails its own parse test rather than
// this module's load. `scripts/draft-theory.ts`'s `accept` and
// `tests/content/theory.test.ts`'s `ctxFor` both call `loadTheoryContent`
// and `checkContextFor` so the two can never drift apart.
// Depends on: ./theory-corpus, ./theory-checks, ../../src/content/schemas
// (types only), node:fs, node:path.
// Depended on by: tests/content/theory.test.ts, tests/content/prompts.test.ts,
// scripts/draft-theory.ts.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus } from './theory-corpus';
import { corpusTextsOf, parseUnitsLine } from './theory-checks';
import type { TheoryCorpus } from './theory-corpus';
import type { PromptIndex, TheoryCheckContext } from './theory-checks';
import type {
  Fact,
  Topic,
  VocabQueueEntry,
  QuestionsFile,
  LessonsFile,
} from '../../src/content/schemas';

export interface TheoryContent {
  corpus: TheoryCorpus;
  corpusTexts: string[];
  facts: Fact[];
  topics: Topic[];
  synonyms: string[][];
  queue: VocabQueueEntry[];
  questionsFiles: Map<string, QuestionsFile>;
  lessonsFiles: Map<string, LessonsFile>;
  pools: Map<string, string[]>;
  prompts: PromptIndex;
}

/** The sorted `*.json` file names of `dir`, or `[]` when `dir` does not exist. */
export function listJsonFiles(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];
}

/** Every `.md` file under `<root>/content/prompts/theory/`, recursive, as sorted root-relative posix paths, or `[]` when that folder does not exist. */
export function listPromptFiles(root: string): string[] {
  const base = join(root, 'content', 'prompts', 'theory');
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (absDir: string, relDir: string): void => {
    for (const entry of readdirSync(absDir)) {
      const absPath = join(absDir, entry);
      const relPath = relDir === '' ? entry : `${relDir}/${entry}`;
      if (statSync(absPath).isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.endsWith('.md')) {
        out.push(`content/prompts/theory/${relPath}`);
      }
    }
  };
  walk(base, '');
  return out.sort();
}

/**
 * Every `.md` exactly two levels down (`<version>/<topic>/*.md`) under
 * `content/prompts/theory/`, keyed by `${version}/${topic}`, its value the
 * union of every such file's `units:` line cites. Templates directly under
 * `<version>/` are skipped.
 */
export function loadPromptIndex(root: string): PromptIndex {
  const prefix = 'content/prompts/theory/';
  const map = new Map<string, Set<string>>();
  for (const file of listPromptFiles(root)) {
    const rel = file.slice(prefix.length);
    const parts = rel.split('/');
    if (parts.length !== 3) continue;
    const [version, topic] = parts;
    const text = readFileSync(join(root, ...file.split('/')), 'utf8');
    const firstLine = text.split('\n')[0] ?? '';
    const cites = parseUnitsLine(firstLine);
    if (!cites) continue;
    const key = `${version}/${topic}`;
    const set = map.get(key) ?? new Set<string>();
    for (const cite of cites) set.add(cite);
    map.set(key, set);
  }
  return map;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Reads every committed theory file once from `root` and indexes it for `checkContextFor`. */
export function loadTheoryContent(root: string): TheoryContent {
  const corpus = loadCorpus(root);
  const corpusTexts = corpusTextsOf(corpus);
  const facts = readJson<{ facts: Fact[] }>(join(root, 'content/uk/facts.json')).facts;
  const topics = readJson<{ topics: Topic[] }>(join(root, 'content/uk/topics.json')).topics;
  const synonyms = readJson<{ groups: string[][] }>(
    join(root, 'content/uk/theory/synonyms.json'),
  ).groups;
  const queue = readJson<{ entries: VocabQueueEntry[] }>(
    join(root, 'content/uk/theory/vocab-queue.json'),
  ).entries;

  const questionsDir = join(root, 'content/uk/theory/questions');
  const lessonsDir = join(root, 'content/uk/theory/lessons');
  const poolsDir = join(root, 'content/uk/theory/pools');

  const questionsFiles = new Map<string, QuestionsFile>();
  for (const name of listJsonFiles(questionsDir)) {
    questionsFiles.set(name.replace(/\.json$/, ''), readJson(join(questionsDir, name)));
  }
  const lessonsFiles = new Map<string, LessonsFile>();
  for (const name of listJsonFiles(lessonsDir)) {
    lessonsFiles.set(name.replace(/\.json$/, ''), readJson(join(lessonsDir, name)));
  }
  const pools = new Map<string, string[]>();
  for (const name of listJsonFiles(poolsDir)) {
    const file = readJson<{ topic: string; values: string[] }>(join(poolsDir, name));
    pools.set(name.replace(/\.json$/, ''), file.values);
  }

  const prompts = loadPromptIndex(root);

  return {
    corpus,
    corpusTexts,
    facts,
    topics,
    synonyms,
    queue,
    questionsFiles,
    lessonsFiles,
    pools,
    prompts,
  };
}

/** Today's `ctxFor`: the `TheoryCheckContext` for one file topic, built from already-loaded content. */
export function checkContextFor(content: TheoryContent, fileTopic: string): TheoryCheckContext {
  const topic = content.topics.find((t) => t.id === fileTopic);
  return {
    corpus: content.corpus,
    corpusTexts: content.corpusTexts,
    facts: content.facts,
    topic: topic
      ? { id: topic.id, areas: topic.areas, nsElements: topic.nsElements }
      : { id: fileTopic, areas: [], nsElements: [] },
    pool: content.pools.get(fileTopic) ?? [],
    synonyms: content.synonyms,
    queuedIds: new Set(content.queue.map((entry) => entry.id)),
  };
}
