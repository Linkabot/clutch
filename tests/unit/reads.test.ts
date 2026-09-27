// Unit tests for scripts/reads.ts (Phase 3 block 3a Step 10; plan.md Step
// 10, amend-10 A57): `canonicalJson`/`itemHash` (a key-sorted-at-every-depth
// hash), `runReads sample`'s order (every rule card, then every queued
// item, then every lane `fix` item, then a seeded share of the remaining
// questions) and its seeded determinism, and `runReads check`'s lane
// (ok/fix/drop) and lincoln (keep/reject, plus the vocab-queue `acceptedBy`
// gate and the question-review quota) resolution rules — one unresolved
// case per pinned title, each breaking exactly one rule, plus the matching
// happy paths. Every fixture lives under a throwaway temp root, never the
// repo's own content/.
// Depends on: vitest, node:fs, node:os, node:path, ../../scripts/reads.
// Depended on by: `npm test`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalJson, itemHash, runReads } from '../../scripts/reads';

const TOPIC = 'vulnerable-road-users';

function rq(id: string, stem: string) {
  return {
    id,
    topic: TOPIC,
    area: 'Vulnerable road users',
    elements: [] as string[],
    format: 'choice4',
    stem,
    stemSign: null,
    options: [
      { id: 'a', text: 'Alpha text', keyPhrase: 'Alpha text' },
      { id: 'b', text: 'Bravo text', keyPhrase: 'Bravo text' },
      { id: 'c', text: 'Charlie text', keyPhrase: 'Charlie text' },
      { id: 'd', text: 'Delta text', keyPhrase: 'Delta text' },
    ],
    answer: 'a',
    answerKind: 'phrase',
    cite: 'hc:204',
    sourceQuote: 'x',
    writtenFrom: { unitId: 'hc:204', promptVersion: 'v1', model: 'm' },
  };
}
function rcard(id: string, headline: string) {
  return {
    kind: 'rule' as const,
    id,
    headline,
    cite: 'hc:207',
    quote: 'q',
    inShort: 'short',
    writtenFrom: { unitId: 'hc:207', promptVersion: 'v1', model: 'm' },
  };
}

const cardA = rcard(`${TOPIC}-l1-c01`, 'Headline A');
const cardB = rcard(`${TOPIC}-l1-c02`, 'Headline B');
const questions = Array.from({ length: 10 }, (_, i) =>
  rq(
    `${TOPIC}-q${String(i + 1).padStart(3, '0')}`,
    `Stem number ${i + 1} about pedestrians and cyclists`,
  ),
);
const lesson = {
  id: `${TOPIC}-l1`,
  topic: TOPIC,
  number: 1,
  title: 'L1',
  minutes: 5,
  cards: [cardA, cardB, { kind: 'check', id: `${TOPIC}-l1-c03`, question: `${TOPIC}-q001` }],
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function makeRoot(
  queueEntries: { id: string; ratio: number; reason: string; acceptedBy: string | null }[],
): string {
  const root = mkdtempSync(path.join(tmpdir(), 'reads-test-'));
  roots.push(root);
  mkdirSync(path.join(root, 'content/uk/theory/questions'), { recursive: true });
  mkdirSync(path.join(root, 'content/uk/theory/lessons'), { recursive: true });
  writeFileSync(
    path.join(root, 'content/uk/topics.json'),
    JSON.stringify({ topics: [{ id: TOPIC }] }),
  );
  writeFileSync(
    path.join(root, 'content/uk/theory/questions', `${TOPIC}.json`),
    JSON.stringify({ topic: TOPIC, questions }),
  );
  writeFileSync(
    path.join(root, 'content/uk/theory/lessons', `${TOPIC}.json`),
    JSON.stringify({ topic: TOPIC, lessons: [lesson] }),
  );
  writeFileSync(
    path.join(root, 'content/uk/theory/vocab-queue.json'),
    JSON.stringify({ entries: queueEntries }),
  );
  return root;
}

function captureSync(fn: () => number): { code: number; logs: string[] } {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (s: unknown) => logs.push(String(s));
  let code: number;
  try {
    code = fn();
  } finally {
    console.log = orig;
  }
  return { code, logs };
}

function verdictsFile(root: string, name: string, verdicts: unknown[]): string {
  const p = path.join(root, name);
  writeFileSync(p, `\`\`\`json\n${JSON.stringify({ verdicts })}\n\`\`\`\n`);
  return p;
}

describe('scripts/reads.ts', () => {
  it('NEW S10: an item hash is the first 16 hex of sha256 of its key-sorted JSON', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    const hash = itemHash({ b: 1, a: 2 });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).toBe(itemHash({ a: 2, b: 1 }));
  });

  it('NEW S10: sample holds every rule card, every queued item, every lane fix and the seeded share of the other questions', () => {
    const root = makeRoot([{ id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: null }]);
    const laneFile = verdictsFile(root, 'lane.md', [
      { id: `${TOPIC}-q008`, hash: 'x', verdict: 'fix', note: '' },
    ]);
    const { code, logs } = captureSync(() =>
      runReads([
        'sample',
        '--topic',
        TOPIC,
        '--share',
        '0',
        '--seed',
        '1',
        '--root',
        root,
        '--also',
        laneFile,
      ]),
    );
    expect(code).toBe(0);
    const out = JSON.parse(logs.join('\n')) as { items: { id: string; kind: string }[] };
    expect(out.items.map((i) => i.id)).toEqual([
      `${TOPIC}-l1-c01`,
      `${TOPIC}-l1-c02`,
      `${TOPIC}-q005`,
      `${TOPIC}-q008`,
    ]);
    expect(out.items[0].kind).toBe('card');
    expect(out.items[3].kind).toBe('question');
  });

  it('NEW S10: the same seed gives the same sample', () => {
    const root = makeRoot([]);
    const a = captureSync(() =>
      runReads(['sample', '--topic', TOPIC, '--share', '0.3', '--seed', '42', '--root', root]),
    );
    const b = captureSync(() =>
      runReads(['sample', '--topic', TOPIC, '--share', '0.3', '--seed', '42', '--root', root]),
    );
    expect(a.logs.join('\n')).toBe(b.logs.join('\n'));
  });

  it('NEW S10: lane mode resolves ok, fix and drop verdicts', () => {
    const root = makeRoot([]);
    // cardB is genuinely removed from the lessons file, so a "drop" verdict on it resolves cleanly.
    const lessonWithoutB = {
      ...lesson,
      cards: [cardA, { kind: 'check', id: `${TOPIC}-l1-c03`, question: `${TOPIC}-q001` }],
    };
    writeFileSync(
      path.join(root, 'content/uk/theory/lessons', `${TOPIC}.json`),
      JSON.stringify({ topic: TOPIC, lessons: [lessonWithoutB] }),
    );
    const fixedQuestions = questions.filter((q) => q.id !== `${TOPIC}-q010`);
    writeFileSync(
      path.join(root, 'content/uk/theory/questions', `${TOPIC}.json`),
      JSON.stringify({ topic: TOPIC, questions: fixedQuestions }),
    );
    const laneVerdicts = fixedQuestions
      .map((q) => ({ id: q.id, hash: itemHash(q), verdict: 'ok', note: '' }))
      .concat([
        { id: cardA.id, hash: itemHash(cardA), verdict: 'ok', note: '' },
        { id: cardB.id, hash: 'irrelevant', verdict: 'drop', note: '' },
        { id: `${TOPIC}-q010`, hash: 'irrelevant', verdict: 'fix', note: '' },
      ]);
    const verdictsPath = verdictsFile(root, 'lane-verdicts.md', laneVerdicts);
    const { code, logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lane',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    const summary = logs.at(-1) ?? '';
    expect(code).toBe(0);
    expect(summary).toMatch(/dropped=1\b/);
    expect(summary).toMatch(/changed=1\b/);
    expect(summary).toMatch(/unresolved=0\b/);
  });

  it('NEW S10: lane mode leaves an ok whose hash changed unresolved', () => {
    const root = makeRoot([]);
    const verdicts = questions.map((q) => ({
      id: q.id,
      hash: q.id === `${TOPIC}-q001` ? 'deliberately-wrong' : itemHash(q),
      verdict: 'ok',
      note: '',
    }));
    verdicts.push({ id: cardA.id, hash: itemHash(cardA), verdict: 'ok', note: '' });
    verdicts.push({ id: cardB.id, hash: itemHash(cardB), verdict: 'ok', note: '' });
    const verdictsPath = verdictsFile(root, 'lane-verdicts.md', verdicts);
    const { code, logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lane',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(code).toBe(1);
    expect(logs.some((l) => l.startsWith(`unresolved ${TOPIC}-q001`))).toBe(true);
  });

  it('NEW S10: lane mode leaves a fix whose hash did not change unresolved', () => {
    const root = makeRoot([]);
    const verdicts = questions.map((q) => ({
      id: q.id,
      hash: q.id === `${TOPIC}-q002` ? itemHash(q) : itemHash(q),
      verdict: q.id === `${TOPIC}-q002` ? 'fix' : 'ok',
      note: '',
    }));
    verdicts.push({ id: cardA.id, hash: itemHash(cardA), verdict: 'ok', note: '' });
    verdicts.push({ id: cardB.id, hash: itemHash(cardB), verdict: 'ok', note: '' });
    const verdictsPath = verdictsFile(root, 'lane-verdicts.md', verdicts);
    const { code, logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lane',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(code).toBe(1);
    expect(logs.some((l) => l.startsWith(`unresolved ${TOPIC}-q002`))).toBe(true);
  });

  it('NEW S10: lincoln mode resolves a keep on the current hash and a reject whose id is gone', () => {
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'lincoln' },
    ]);
    const remainingQuestions = questions.filter((q) => q.id !== `${TOPIC}-q002`);
    writeFileSync(
      path.join(root, 'content/uk/theory/questions', `${TOPIC}.json`),
      JSON.stringify({ topic: TOPIC, questions: remainingQuestions }),
    );
    const verdicts = remainingQuestions.map((q) => ({
      id: q.id,
      hash: itemHash(q),
      verdict: 'keep',
      note: '',
    }));
    verdicts.push({ id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' });
    verdicts.push({ id: cardB.id, hash: itemHash(cardB), verdict: 'keep', note: '' });
    verdicts.push({ id: `${TOPIC}-q002`, hash: 'gone-now', verdict: 'reject', note: '' });
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { code, logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    const summary = logs.at(-1) ?? '';
    expect(summary).toMatch(/changed=0\b/);
    expect(summary).toMatch(/dropped=1\b/);
    expect(summary).toMatch(/unresolved=0\b/);
    expect(code).toBe(0);
  });

  it('NEW S10: lincoln mode leaves a keep with a stale hash unresolved', () => {
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'lincoln' },
    ]);
    const verdicts = [
      { id: `${TOPIC}-q001`, hash: 'stale-hash', verdict: 'keep', note: '' },
      { id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' },
      { id: cardB.id, hash: itemHash(cardB), verdict: 'keep', note: '' },
      { id: `${TOPIC}-q005`, hash: itemHash(questions[4]), verdict: 'keep', note: '' },
    ];
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(logs.some((l) => l.startsWith(`unresolved ${TOPIC}-q001`))).toBe(true);
  });

  it('NEW S10: lincoln mode leaves a final reject whose id is present unresolved', () => {
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'lincoln' },
    ]);
    const verdicts = [
      { id: `${TOPIC}-q001`, hash: 'irrelevant', verdict: 'reject', note: '' },
      { id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' },
      { id: cardB.id, hash: itemHash(cardB), verdict: 'keep', note: '' },
      { id: `${TOPIC}-q005`, hash: itemHash(questions[4]), verdict: 'keep', note: '' },
    ];
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(logs.some((l) => l.startsWith(`unresolved ${TOPIC}-q001`))).toBe(true);
  });

  it('NEW S10: lincoln mode leaves fewer than a fifth of the questions unresolved', () => {
    // 10 questions need ceil(0.2*10)=2 reviewed; only 1 is given a final verdict here.
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'lincoln' },
    ]);
    const verdicts = [
      { id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' },
      { id: cardB.id, hash: itemHash(cardB), verdict: 'keep', note: '' },
      { id: `${TOPIC}-q005`, hash: itemHash(questions[4]), verdict: 'keep', note: '' },
    ];
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { code, logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(code).toBe(1);
    expect(logs.some((l) => l.includes('quota'))).toBe(true);
  });

  it('NEW S10: lincoln mode leaves a missing rule card unresolved', () => {
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'lincoln' },
    ]);
    // cardB gets no verdict entry at all, so it is required (a current card) but unresolved.
    const verdicts = [
      { id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' },
      { id: `${TOPIC}-q005`, hash: itemHash(questions[4]), verdict: 'keep', note: '' },
    ];
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(logs.some((l) => l.startsWith(`unresolved ${cardB.id}`))).toBe(true);
  });

  it('NEW S10: lincoln mode leaves a queue entry not accepted by lincoln unresolved', () => {
    const root = makeRoot([
      { id: `${TOPIC}-q005`, ratio: 0.5, reason: 'r', acceptedBy: 'someone-else' },
    ]);
    const verdicts = [
      { id: cardA.id, hash: itemHash(cardA), verdict: 'keep', note: '' },
      { id: cardB.id, hash: itemHash(cardB), verdict: 'keep', note: '' },
      { id: `${TOPIC}-q005`, hash: itemHash(questions[4]), verdict: 'keep', note: '' },
    ];
    const verdictsPath = verdictsFile(root, 'lincoln-verdicts.md', verdicts);
    const { logs } = captureSync(() =>
      runReads([
        'check',
        '--mode',
        'lincoln',
        '--topic',
        TOPIC,
        '--verdicts',
        verdictsPath,
        '--root',
        root,
      ]),
    );
    expect(logs.some((l) => l.includes('not accepted by lincoln'))).toBe(true);
  });
});
