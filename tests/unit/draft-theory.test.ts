// Unit tests for scripts/draft-theory.ts (Phase 3 block 3a Step 10; plan.md
// Step 10, amend-10 A54-A56, A59): check 8 (the offline-writer scan) plus
// `runPrompt`/`runAccept`'s own behaviour. The scan starts at
// scripts/draft-theory.ts and follows every relative import transitively,
// failing on a `fetch(` call or a network-module specifier anywhere in the
// visited set, and proving the scan is transitive by requiring
// scripts/lib/theory-corpus.ts, scripts/lib/theory-content.ts and
// src/content/cite.ts to be in it. `runPrompt`/`runAccept` are driven
// against a throwaway temp copy of content/, never the repo's own tree.
// Depends on: vitest, node:child_process, node:fs, node:os, node:path,
// node:url, ../../scripts/draft-theory.
// Depended on by: `npm test`.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect, it } from 'vitest';
import { runAccept, runPrompt } from '../../scripts/draft-theory';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// =====================================================================================
// Check 8: the transitive import scan (A59)
// =====================================================================================

function stripComments(text: string): string {
  return text.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const SPECIFIER_RES = [
  /\bimport\b[^;'"`]*?\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
];

function specifiersOf(text: string): string[] {
  const specs: string[] = [];
  for (const re of SPECIFIER_RES) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) specs.push(match[2]);
  }
  return specs;
}

function isRelative(spec: string): boolean {
  return spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../');
}

function isResolvableFile(relPath: string): boolean {
  const absPath = path.join(REPO_ROOT, ...relPath.split('/'));
  return existsSync(absPath) && statSync(absPath).isFile();
}

function resolveRelative(fromRel: string, spec: string): string | null {
  const fromDir = path.posix.dirname(fromRel);
  const joined = path.posix.normalize(path.posix.join(fromDir, spec)).replace(/\/$/, '');
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = joined + suffix;
    if (isResolvableFile(candidate)) return candidate;
  }
  return null;
}

function transitiveImports(entryRel: string): { visited: string[]; unresolved: string[] } {
  const visited = new Set<string>();
  const unresolved: string[] = [];
  const queue = [entryRel];
  while (queue.length > 0) {
    const rel = queue.shift() as string;
    if (visited.has(rel)) continue;
    visited.add(rel);
    const text = stripComments(readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8'));
    for (const spec of specifiersOf(text)) {
      if (!isRelative(spec)) continue;
      const resolved = resolveRelative(rel, spec);
      if (!resolved) {
        unresolved.push(`${rel} -> ${spec}`);
        continue;
      }
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  return { visited: [...visited], unresolved };
}

const NETWORK_SPECIFIERS = ['node:http', 'node:https', 'node:net', 'http', 'https', 'undici'];

it('NEW S10: draft-theory.ts and every local module it imports never call fetch or import a network module', () => {
  const { visited, unresolved } = transitiveImports('scripts/draft-theory.ts');
  expect(unresolved).toEqual([]);
  expect(visited).toEqual(
    expect.arrayContaining([
      'scripts/lib/theory-corpus.ts',
      'scripts/lib/theory-content.ts',
      'src/content/cite.ts',
    ]),
  );
  expect(visited.includes('scripts/lib/govuk.ts')).toBe(false);
  for (const rel of visited) {
    const text = stripComments(readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8'));
    expect(text.includes('fetch('), `${rel} calls fetch(`).toBe(false);
    for (const spec of specifiersOf(text)) {
      expect(NETWORK_SPECIFIERS.includes(spec), `${rel} imports ${spec}`).toBe(false);
    }
  }
});

// =====================================================================================
// runPrompt / runAccept behaviour
// =====================================================================================

function makeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'draft-theory-test-'));
  cpSync(path.join(REPO_ROOT, 'content'), path.join(root, 'content'), { recursive: true });
  return root;
}

const tempRoots: string[] = [];
const writtenFiles: string[] = [];

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

function captureLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (s: unknown) => logs.push(String(s));
  return {
    logs,
    restore: () => {
      console.log = orig;
    },
  };
}

it('NEW S10: runPrompt returns 1 without CLUTCH_OFFLINE and writes nothing', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  const outDir = path.join(root, 'out-no-offline');
  const code = await runPrompt(
    [
      '--topic',
      'vulnerable-road-users',
      '--kind',
      'questions',
      '--unit',
      'hc:207',
      '--root',
      root,
      '--out',
      outDir,
    ],
    {},
  );
  expect(code).toBe(1);
  expect(existsSync(outDir)).toBe(false);
});

it('NEW S10: runPrompt writes a prompt that embeds rule 207 offline', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  const outDir = path.join(root, 'out-207');
  const { logs, restore } = captureLog();
  let code: number;
  try {
    code = await runPrompt(
      [
        '--topic',
        'vulnerable-road-users',
        '--kind',
        'questions',
        '--unit',
        'hc:207',
        '--root',
        root,
        '--out',
        outDir,
      ],
      { CLUTCH_OFFLINE: '1' },
    );
  } finally {
    restore();
  }
  expect(code).toBe(0);
  expect(logs.length).toBe(1);
  const filePath = logs[0];
  expect(existsSync(filePath)).toBe(true);
  writtenFiles.push(filePath);
  const text = readFileSync(filePath, 'utf8');
  expect(text.includes('judge your speed')).toBe(true);
});

it('NEW S10: runPrompt returns 1 for a unit that does not resolve', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  const outDir = path.join(root, 'out-999');
  const code = await runPrompt(
    [
      '--topic',
      'vulnerable-road-users',
      '--kind',
      'questions',
      '--unit',
      'hc:999',
      '--root',
      root,
      '--out',
      outDir,
    ],
    { CLUTCH_OFFLINE: '1' },
  );
  expect(code).toBe(1);
  expect(existsSync(outDir)).toBe(false);
});

const GOOD = {
  area: 'Vulnerable road users',
  elements: [] as string[],
  format: 'choice4',
  stem: 'Which road users are most at risk from road traffic?',
  stemSign: null,
  options: [
    { id: 'a', text: 'Drivers of ice cream vans', keyPhrase: 'ice cream vans' },
    { id: 'b', text: 'Pedestrians, cyclists, horse riders and motorcyclists', keyPhrase: null },
    { id: 'c', text: 'People in residential areas', keyPhrase: 'residential areas' },
    { id: 'd', text: 'Drivers of emergency vehicles', keyPhrase: 'emergency vehicles' },
  ],
  answer: 'b',
  answerKind: 'phrase',
  cite: 'hc:204',
  sourceQuote: 'The road users most at risk from road traffic are pedestrians',
};
const BAD_QUOTE = {
  ...GOOD,
  stem: 'Which groups are most vulnerable to danger from traffic on the road?',
  sourceQuote: 'This sentence never appears anywhere in rule 204.',
};

it('NEW S10: runAccept numbers new questions after the highest existing id and stamps writtenFrom', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  await runPrompt(
    ['--topic', 'vulnerable-road-users', '--kind', 'questions', '--unit', 'hc:204', '--root', root],
    { CLUTCH_OFFLINE: '1' },
  );
  mkdirSync(path.join(root, 'content/uk/theory/questions'), { recursive: true });
  writeFileSync(
    path.join(root, 'content/uk/theory/questions/vulnerable-road-users.json'),
    JSON.stringify({
      topic: 'vulnerable-road-users',
      questions: [
        {
          ...GOOD,
          id: 'vulnerable-road-users-q001',
          topic: 'vulnerable-road-users',
          writtenFrom: { unitId: 'hc:204', promptVersion: 'v1', model: 'seed' },
        },
        {
          ...GOOD,
          id: 'vulnerable-road-users-q003',
          topic: 'vulnerable-road-users',
          writtenFrom: { unitId: 'hc:204', promptVersion: 'v1', model: 'seed' },
        },
      ],
    }),
  );
  const batchPath = path.join(root, 'batch.json');
  const freshGood = {
    ...GOOD,
    stem: 'Overall, which road users carry the greatest risk from traffic?',
  };
  writeFileSync(batchPath, JSON.stringify({ questions: [freshGood] }));
  const { logs, restore } = captureLog();
  let code: number;
  try {
    code = await runAccept(
      [
        '--topic',
        'vulnerable-road-users',
        '--kind',
        'questions',
        '--model',
        'test-model',
        '--root',
        root,
        batchPath,
      ],
      {},
    );
  } finally {
    restore();
  }
  expect(logs[0]).toBe('accept: added=1 rejected=0');
  expect(code).toBe(0);
  const filePath = path.join(root, 'content/uk/theory/questions/vulnerable-road-users.json');
  writtenFiles.push(filePath);
  const file = JSON.parse(readFileSync(filePath, 'utf8')) as {
    questions: { id: string; writtenFrom: unknown }[];
  };
  const last = file.questions.at(-1);
  expect(last?.id).toBe('vulnerable-road-users-q004');
  expect(last?.writtenFrom).toEqual({ unitId: 'hc:204', promptVersion: 'v1', model: 'test-model' });
});

it('NEW S10: runAccept writes only problem-free questions and exits 1 when one is rejected', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  await runPrompt(
    ['--topic', 'vulnerable-road-users', '--kind', 'questions', '--unit', 'hc:204', '--root', root],
    { CLUTCH_OFFLINE: '1' },
  );
  const batchPath = path.join(root, 'batch.json');
  writeFileSync(batchPath, JSON.stringify({ questions: [GOOD, BAD_QUOTE] }));
  const { logs, restore } = captureLog();
  let code: number;
  try {
    code = await runAccept(
      [
        '--topic',
        'vulnerable-road-users',
        '--kind',
        'questions',
        '--model',
        'test-model',
        '--root',
        root,
        batchPath,
      ],
      {},
    );
  } finally {
    restore();
  }
  expect(code).toBe(1);
  expect(logs[0]).toBe('accept: added=1 rejected=1');
  expect(logs.some((l) => l.startsWith('rejected vulnerable-road-users-q002 '))).toBe(true);
  const filePath = path.join(root, 'content/uk/theory/questions/vulnerable-road-users.json');
  writtenFiles.push(filePath);
  const file = JSON.parse(readFileSync(filePath, 'utf8')) as { questions: { id: string }[] };
  expect(file.questions.map((q) => q.id)).toEqual(['vulnerable-road-users-q001']);
});

it('NEW S10: runAccept rejects a whole lesson when one of its cards has a problem', async () => {
  const root = makeRoot();
  tempRoots.push(root);
  await runPrompt(
    [
      '--topic',
      'vulnerable-road-users',
      '--kind',
      'lesson',
      '--unit',
      'hc:207',
      '--unit',
      'hc:204',
      '--root',
      root,
    ],
    { CLUTCH_OFFLINE: '1' },
  );
  const lessonBatch = {
    lesson: {
      title: 'Looking out for pedestrians',
      minutes: 5,
      cards: [
        {
          kind: 'rule',
          headline: 'Children may step out',
          cite: 'hc:207',
          quote:
            'children and older pedestrians who may not be able to judge your speed and could step into the road in front of you',
          inShort: 'Children and older pedestrians may not judge your speed.',
        },
        {
          kind: 'rule',
          headline: 'Bad quote here',
          cite: 'hc:204',
          quote: 'this text is not verbatim in rule 204 at all',
          inShort: 'Pedestrians, cyclists, horse riders and motorcyclists are most at risk.',
        },
        { kind: 'check', question: GOOD },
      ],
    },
  };
  const batchPath = path.join(root, 'lesson-batch.json');
  writeFileSync(batchPath, JSON.stringify(lessonBatch));
  const { logs, restore } = captureLog();
  let code: number;
  try {
    code = await runAccept(
      [
        '--topic',
        'vulnerable-road-users',
        '--kind',
        'lesson',
        '--model',
        'test-model',
        '--root',
        root,
        batchPath,
      ],
      {},
    );
  } finally {
    restore();
  }
  expect(code).toBe(1);
  expect(logs[0]).toBe('accept: added=0 rejected=1');
  expect(existsSync(path.join(root, 'content/uk/theory/lessons/vulnerable-road-users.json'))).toBe(
    false,
  );
  expect(
    existsSync(path.join(root, 'content/uk/theory/questions/vulnerable-road-users.json')),
  ).toBe(false);
});

it('NEW S10: runAccept and runPrompt write files that Prettier leaves unchanged', () => {
  expect(writtenFiles.length).toBeGreaterThanOrEqual(3);
  for (const filePath of writtenFiles) {
    const winPath = filePath.replace(/\\/g, '/');
    const result = spawnSync(`npx prettier --check --config .prettierrc "${winPath}"`, {
      shell: true,
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status, `${filePath}: ${result.stdout}${result.stderr}`).toBe(0);
    const text = readFileSync(filePath, 'utf8');
    expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true);
  }
});
