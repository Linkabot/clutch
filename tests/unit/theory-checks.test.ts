// Unit tests for the nine content checks and the coverage-shortfall report
// (scripts/lib/theory-checks.ts, Phase 3 block 3a Step 9; plan.md Step 9 and
// amend-09 A41-A46). One fixture per problem code, each the matching good
// fixture (a value question, a phrase question, a sign4 question, a lesson)
// with one field changed (A44), driven against a real context built from the
// committed corpus, facts.json and the `vulnerable-road-users` topic record.
// Depends on: vitest, node:fs, node:url, node:path, ../../scripts/lib/theory-checks,
// ../../scripts/lib/theory-corpus, ../../src/content/schemas.
// Depended on by: `npm test` (Vitest run).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  normalise,
  wordCount,
  numberTokens,
  contentWords,
  STOP_WORDS,
  vocabRatio,
  jaccard,
  corpusTextsOf,
  checkQuestion,
  checkNearDuplicates,
  checkLesson,
  checkVocabQueue,
  coverageShortfalls,
} from '../../scripts/lib/theory-checks';
import type { TheoryCheckContext, CoverageInput } from '../../scripts/lib/theory-checks';
import { loadCorpus } from '../../scripts/lib/theory-corpus';
import { QuestionSchema, LessonSchema } from '../../src/content/schemas';
import type {
  Question,
  Lesson,
  LessonCard,
  VocabQueueEntry,
  Topic,
} from '../../src/content/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function readJson<T = unknown>(relPath: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8')) as T;
}

const corpus = loadCorpus(REPO_ROOT);
const corpusTexts = corpusTextsOf(corpus);
const facts = readJson<{ facts: unknown[] }>('content/uk/facts.json')
  .facts as TheoryCheckContext['facts'];
const topicsFile = readJson<{ topics: Topic[] }>('content/uk/topics.json');
const VRU = topicsFile.topics.find((t) => t.id === 'vulnerable-road-users')!;
const POOL = ['20 mph', '30 mph', '50 mph', '60 mph'];

const baseCtx: TheoryCheckContext = {
  corpus,
  corpusTexts,
  facts,
  topic: { id: VRU.id, areas: VRU.areas, nsElements: VRU.nsElements },
  pool: POOL,
  synonyms: [],
  queuedIds: new Set(),
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const wf = (unitId: string) => ({ unitId, promptVersion: 'v1', model: 'test' });

const GV: Question = {
  id: 'vulnerable-road-users-q001',
  topic: 'vulnerable-road-users',
  area: 'Vulnerable road users',
  elements: ['4.1.2'],
  format: 'choice4',
  stem: 'At what speed will your vehicle probably kill any pedestrians it hits?',
  stemSign: null,
  options: [
    { id: 'a', text: '20 mph', keyPhrase: null },
    { id: 'b', text: '30 mph', keyPhrase: null },
    { id: 'c', text: '40 mph', keyPhrase: null },
    { id: 'd', text: '50 mph', keyPhrase: null },
  ],
  answer: 'c',
  answerKind: 'value',
  cite: 'hc:207',
  sourceQuote: 'At 40 mph (64 km/h) your vehicle will probably kill any pedestrians it hits.',
  writtenFrom: wf('hc:207'),
};

const GP: Question = {
  id: 'vulnerable-road-users-q002',
  topic: 'vulnerable-road-users',
  area: 'Vulnerable road users',
  elements: [],
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
  writtenFrom: wf('hc:204'),
};

const GS: Question = {
  id: 'vulnerable-road-users-q003',
  topic: 'vulnerable-road-users',
  area: 'Vulnerable road users',
  elements: [],
  format: 'sign4',
  stem: 'What does this sign mean?',
  stemSign: 'warning-school',
  options: [
    { id: 'a', text: 'Ice cream vans ahead', keyPhrase: 'Ice cream vans' },
    { id: 'b', text: 'Children going to or from school', keyPhrase: null },
    { id: 'c', text: 'Residential areas ahead', keyPhrase: 'Residential areas' },
    { id: 'd', text: 'Emergency vehicles ahead', keyPhrase: 'Emergency vehicles' },
  ],
  answer: 'b',
  answerKind: 'phrase',
  cite: 'sign:warning-school',
  sourceQuote: 'Children going to or from school.',
  writtenFrom: wf('sign:warning-school'),
};

const WORDS_207 = (
  'Particularly vulnerable pedestrians. These include: children and older pedestrians who may not be ' +
  'able to judge your speed and could step into the road in front of you. At 40 mph (64 km/h) your ' +
  'vehicle will probably kill any pedestrians it hits. At 20 mph (32 km/h) there is only a 1 in 20 chance ' +
  'of the pedestrian being killed. So kill your speed older pedestrians who may need more time to cross ' +
  'the road. Be patient and allow them to cross in their own time. Do not hurry them by revving your ' +
  'engine or edging forward people with disabilities. People with hearing impairments may not be aware ' +
  'of your vehicle approaching. Those with walking difficulties require more time blind or partially ' +
  'sighted people, who may be carrying a white cane using a guide dog. They may not be able to see you ' +
  'approaching deafblind people who may be carrying a white cane with a red band or using a dog with a ' +
  'red and white harness. They may not see or hear instructions or signals.'
).split(' ');
const prefix207 = (n: number) => WORDS_207.slice(0, n).join(' ');

const q = (base: Question, patch: (x: Question) => void): Question => {
  const x = clone(base);
  patch(x);
  return x;
};

const allFixtures: unknown[] = [GV, GP, GS];
const trackQ = (x: Question): Question => {
  allFixtures.push(x);
  return x;
};
const trackL = (x: Lesson): Lesson => {
  allFixtures.push(x);
  return x;
};

const codesOf = (ps: { code: string; id: string }[]) => ps.map((p) => p.code).sort();

describe('the helpers', () => {
  it('NEW S9: normalise collapses whitespace and folds typographic quotes', () => {
    expect(normalise('  a’b ‘c‚ “d” „e‟‛\n\t f  ')).toBe(`a'b 'c' "d" "e"' f`);
    expect(normalise('')).toBe('');
  });

  it('NEW S9: wordCount counts the words of the normalised text', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount(' \n\t ')).toBe(0);
    expect(wordCount(' one  two\nthree\t')).toBe(3);
  });

  it('NEW S9: numberTokens finds whole numbers, decimals and comma groups', () => {
    expect(numberTokens('at 30 mph, 1,000 or 2.5 m and 40.')).toEqual(['30', '1,000', '2.5', '40']);
    expect(numberTokens('no digits')).toEqual([]);
  });

  it('NEW S9: contentWords lower-cases, drops stop words and numbers and keeps each word once', () => {
    expect(contentWords('The Cyclist and the cyclist at 30 PEDESTRIANS')).toEqual([
      'cyclist',
      'pedestrians',
    ]);
    expect(contentWords(`The driver’s mirror`)).toEqual(["driver's", 'mirror']);
    expect(contentWords('the 30 of 40')).toEqual([]);
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('cyclist')).toBe(false);
  });

  it('NEW S9: vocabRatio counts a word found as-is or without a trailing s', () => {
    expect(vocabRatio('cyclists', ['Look out for a cyclist'], [])).toBe(1);
    expect(vocabRatio('cyclist', ['Look out for cyclists'], [])).toBe(0);
  });

  it('NEW S9: vocabRatio counts a word through a synonyms group that shares a found word', () => {
    expect(vocabRatio('bike', ['Watch for cycles'], [['bike', 'cycles']])).toBe(1);
    expect(vocabRatio('bike', ['Watch for cycles'], [])).toBe(0);
    expect(vocabRatio('bike', ['Watch for cycles'], [['bike', 'scooter']])).toBe(0);
    expect(vocabRatio('bikes', ['Watch for cycles'], [['bike', 'cycles']])).toBe(1);
  });

  it('NEW S9: vocabRatio is 1 for an answer with no content words', () => {
    expect(vocabRatio('the 30', ['nothing here'], [])).toBe(1);
  });

  it('NEW S9: jaccard is the shared share of two token sets and 0 for two empty sets', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(0.5);
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(jaccard(new Set(['a']), new Set())).toBe(0);
  });
});

describe('checkQuestion', () => {
  it('NEW S9: CITE-UNRESOLVED for a cite that names no unit', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.cite = 'hc:999';
        v.writtenFrom.unitId = 'hc:999';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['CITE-UNRESOLVED']);
  });

  it('NEW S9: an unresolved cite suppresses QUOTE-NOT-VERBATIM, NUMBER-UNSOURCED and VOCAB-LOW', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.cite = 'hc:999';
        v.writtenFrom.unitId = 'hc:999';
        v.sourceQuote = 'Nothing like this';
        v.stem = 'What is 17?';
        v.options[2].text = 'purple elephants';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['CITE-UNRESOLVED']);
  });

  it('NEW S9: QUOTE-NOT-VERBATIM for a quote not in the unit text', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.sourceQuote = 'At 40 mph your car will kill pedestrians.';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['QUOTE-NOT-VERBATIM']);
  });

  it('NEW S9: QUOTE-TOO-LONG for a verbatim quote over 40 words', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.sourceQuote = prefix207(41);
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['QUOTE-TOO-LONG']);
    const y = trackQ(
      q(GV, (v) => {
        v.sourceQuote = prefix207(40);
      }),
    );
    expect(codesOf(checkQuestion(y, baseCtx))).toEqual([]);
  });

  it('NEW S9: NUMBER-UNSOURCED for a stem number in neither the unit nor facts.json', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.stem =
          'At what speed will your vehicle probably kill any pedestrians it hits on a 17 lane road?';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['NUMBER-UNSOURCED']);
    const y = trackQ(
      q(GV, (v) => {
        v.stem =
          'Compared with a 30 mph limit, at what speed will your vehicle probably kill any pedestrians it hits?';
      }),
    );
    expect(codesOf(checkQuestion(y, baseCtx))).toEqual([]);
  });

  it('NEW S9: VOCAB-LOW for a right answer below 0.8', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.options[2].text = 'purple elephants';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['VOCAB-LOW']);
  });

  it('NEW S9: a queued question below 0.8 yields no VOCAB-LOW', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.options[2].text = 'purple elephants';
      }),
    );
    expect(codesOf(checkQuestion(x, { ...baseCtx, queuedIds: new Set([x.id]) }))).toEqual([]);
  });

  it('NEW S9: DISTRACTOR-NOT-IN-POOL for a value wrong option outside the pool', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.options[0].text = '25 mph';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['DISTRACTOR-NOT-IN-POOL']);
    const y = trackQ(
      q(GV, (v) => {
        v.options[0].text = ' 20  MPH ';
      }),
    );
    expect(codesOf(checkQuestion(y, baseCtx))).toEqual([]);
  });

  it('NEW S9: KEYPHRASE-NOT-IN-CORPUS for a key phrase in no unit of the corpus', () => {
    const x = trackQ(
      q(GP, (v) => {
        v.options[3].text = 'Drivers of hovercraft taxis';
        v.options[3].keyPhrase = 'hovercraft taxis';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['KEYPHRASE-NOT-IN-CORPUS']);
  });

  it('NEW S9: TOPIC-MISMATCH for an area outside the topic areas', () => {
    const x = trackQ(
      q(GV, (v) => {
        v.area = 'Motorway rules';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['TOPIC-MISMATCH']);
  });

  it('NEW S9: SIGN-UNKNOWN for a stemSign that is not a known sign', () => {
    const x = trackQ(
      q(GS, (v) => {
        v.stemSign = 'warning-no-such-sign';
      }),
    );
    expect(codesOf(checkQuestion(x, baseCtx))).toEqual(['SIGN-UNKNOWN']);
    const y = trackQ(
      q(GS, (v) => {
        v.cite = 'sign:warning-no-such';
        v.writtenFrom.unitId = 'sign:warning-no-such';
      }),
    );
    expect(codesOf(checkQuestion(y, baseCtx))).toEqual(['CITE-UNRESOLVED']);
  });

  it('NEW S9: a good value question yields no problems', () => {
    expect(codesOf(checkQuestion(GV, baseCtx))).toEqual([]);
  });

  it('NEW S9: a good phrase question yields no problems', () => {
    expect(codesOf(checkQuestion(GP, baseCtx))).toEqual([]);
  });

  it('NEW S9: a good sign4 question yields no problems', () => {
    expect(codesOf(checkQuestion(GS, baseCtx))).toEqual([]);
  });
});

describe('checkNearDuplicates', () => {
  const stemQ = (
    id: number,
    stem: string,
    format: Question['format'] = 'choice4',
    stemSign: string | null = null,
  ): Question =>
    trackQ(
      q(format === 'sign4' ? GS : GV, (v) => {
        v.id = `vulnerable-road-users-q${String(900 + id).padStart(3, '0')}`;
        v.stem = stem;
        v.format = format;
        v.stemSign = stemSign;
      }),
    );

  it('NEW S9: NEAR-DUPLICATE for two stems at Jaccard 0.6 or more', () => {
    const a = stemQ(1, 'alpha bravo charlie delta');
    const b = stemQ(2, 'alpha bravo charlie echo');
    const ps = checkNearDuplicates([a, b]);
    expect(ps.map((p) => p.code)).toEqual(['NEAR-DUPLICATE']);
    expect(ps.map((p) => p.id)).toEqual([`${a.id}|${b.id}`]);
  });

  it('NEW S9: two sign4 questions on different signs are never near duplicates', () => {
    const a = stemQ(3, 'What does this sign mean?', 'sign4', 'warning-school');
    const b = stemQ(4, 'What does this sign mean?', 'sign4', 'warning-stop-100-yards');
    expect(checkNearDuplicates([a, b])).toEqual([]);
  });

  it('NEW S9: stems below the Jaccard line yield no near duplicates', () => {
    const a = stemQ(5, 'alpha bravo charlie delta');
    const b = stemQ(6, 'alpha bravo echo foxtrot');
    expect(checkNearDuplicates([a, b])).toEqual([]);
  });
});

describe('checkLesson', () => {
  const L1 = 'vulnerable-road-users-l1';
  const R = (
    n: number,
    cite: string,
    headline: string,
    quote: string,
    inShort: string,
  ): LessonCard => ({
    kind: 'rule',
    id: `${L1}-c${String(n).padStart(2, '0')}`,
    headline,
    cite,
    quote,
    inShort,
    writtenFrom: wf(cite),
  });
  const C = (n: number, question: string): LessonCard => ({
    kind: 'check',
    id: `${L1}-c${String(n).padStart(2, '0')}`,
    question,
  });
  const cid = (n: number) => `${L1}-c${String(n).padStart(2, '0')}`;

  const R1 = R(
    1,
    'hc:207',
    'Children may step out',
    'children and older pedestrians who may not be able to judge your speed and could step into the road in front of you',
    'Children and older pedestrians may not judge your speed.',
  );
  const R2 = R(
    2,
    'hc:207',
    'At 40 mph most pedestrians hit are killed',
    'At 40 mph (64 km/h) your vehicle will probably kill any pedestrians it hits.',
    'At 40 mph your vehicle will probably kill any pedestrians it hits.',
  );
  const R3 = R(
    4,
    'hc:204',
    'Who is most at risk',
    'The road users most at risk from road traffic are pedestrians',
    'Pedestrians, cyclists, horse riders and motorcyclists are most at risk.',
  );
  const R4 = R(
    5,
    'hc:204',
    'Greatest harm, greatest responsibility',
    'those who can cause the greatest harm have the greatest responsibility to reduce the danger or threat they pose to others',
    'Those who can cause the greatest harm have the greatest responsibility.',
  );
  const GL: Lesson = {
    id: L1,
    topic: 'vulnerable-road-users',
    number: 1,
    title: 'Looking out for pedestrians',
    minutes: 5,
    cards: [R1, R2, C(3, GV.id), R3, R4, C(6, GP.id)],
  };
  trackL(GL);
  const QBY = new Map<string, Question>([
    [GV.id, GV],
    [GP.id, GP],
    [GS.id, GS],
  ]);
  const clonedLesson = (patch: (x: Lesson) => void): Lesson => {
    const x = clone(GL);
    patch(x);
    trackL(x);
    return x;
  };

  it('NEW S9: CARD-CITE-UNRESOLVED for a rule card cite that names no unit', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], cite: 'hc:999', writtenFrom: wf('hc:999') } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CARD-CITE-UNRESOLVED ${cid(1)}`]);
  });

  it('NEW S9: an unresolved card cite suppresses CARD-QUOTE-NOT-VERBATIM, CARD-NUMBER-UNSOURCED and CARD-VOCAB-LOW', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = {
        ...x.cards[0],
        cite: 'hc:999',
        writtenFrom: wf('hc:999'),
        quote: 'nothing at all here',
        headline: 'Step out 17 times suddenly',
        inShort: 'Purple elephants dance gracefully.',
      } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CARD-CITE-UNRESOLVED ${cid(1)}`]);
  });

  it('NEW S9: CARD-QUOTE-NOT-VERBATIM for a card quote not in the unit text', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], quote: 'Children cannot judge speed at all' } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([
      `CARD-QUOTE-NOT-VERBATIM ${cid(1)}`,
    ]);
  });

  it('NEW S9: CARD-QUOTE-TOO-LONG for a verbatim card quote over 80 words', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], quote: prefix207(81) } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CARD-QUOTE-TOO-LONG ${cid(1)}`]);
    const l80 = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], quote: prefix207(80) } as LessonCard;
    });
    expect(checkLesson(l80, QBY, baseCtx)).toEqual([]);
  });

  it('NEW S9: CARD-NUMBER-UNSOURCED for a headline number in neither the unit nor facts.json', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], headline: 'Children may step out 17 times' } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CARD-NUMBER-UNSOURCED ${cid(1)}`]);
    const l30 = clonedLesson((x) => {
      x.cards[1] = { ...x.cards[1], headline: 'Slower than the 30 mph limit' } as LessonCard;
    });
    expect(checkLesson(l30, QBY, baseCtx)).toEqual([]);
  });

  it('NEW S9: CARD-VOCAB-LOW for an in-short line below 0.8', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], inShort: 'Purple elephants dance gracefully.' } as LessonCard;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CARD-VOCAB-LOW ${cid(1)}`]);
  });

  it('NEW S9: a queued card below 0.8 yields no CARD-VOCAB-LOW', () => {
    const l = clonedLesson((x) => {
      x.cards[0] = { ...x.cards[0], inShort: 'Purple elephants dance gracefully.' } as LessonCard;
    });
    expect(checkLesson(l, QBY, { ...baseCtx, queuedIds: new Set([cid(1)]) })).toEqual([]);
  });

  it('NEW S9: CADENCE for a lesson that does not end on a check', () => {
    const l = clonedLesson((x) => {
      x.cards = x.cards.slice(0, -1);
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CADENCE ${L1}`]);
  });

  it('NEW S9: CHECK-UNKNOWN-QUESTION for a check naming no question', () => {
    const l = clonedLesson((x) => {
      (x.cards[2] as { question: string }).question = 'vulnerable-road-users-q999';
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CHECK-UNKNOWN-QUESTION ${cid(3)}`]);
  });

  it('NEW S9: CHECK-OFF-RUN for a check citing no rule card of its run', () => {
    const l = clonedLesson((x) => {
      (x.cards[5] as { question: string }).question = GS.id;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CHECK-OFF-RUN ${cid(6)}`]);
  });

  it('NEW S9: CHECK-REUSED for a question used by two checks in one lesson', () => {
    const l = clonedLesson((x) => {
      (x.cards[5] as { question: string }).question = GV.id;
    });
    const ps = checkLesson(l, QBY, baseCtx);
    expect(ps.map((p) => `${p.code} ${p.id}`).sort()).toEqual([`CHECK-REUSED ${cid(6)}`]);
  });

  it('NEW S9: a good lesson yields no problems', () => {
    expect(checkLesson(GL, QBY, baseCtx)).toEqual([]);
  });
});

describe('checkVocabQueue', () => {
  const L1 = 'vulnerable-road-users-l1';
  const cid1 = `${L1}-c01`;
  const R1: LessonCard = {
    kind: 'rule',
    id: cid1,
    headline: 'Children may step out',
    cite: 'hc:207',
    quote:
      'children and older pedestrians who may not be able to judge your speed and could step into the road in front of you',
    inShort: 'Children and older pedestrians may not judge your speed.',
    writtenFrom: wf('hc:207'),
  };
  const C1: LessonCard = { kind: 'check', id: `${L1}-c02`, question: GV.id };
  const GL: Lesson = {
    id: L1,
    topic: 'vulnerable-road-users',
    number: 1,
    title: 'Looking out for pedestrians',
    minutes: 2,
    cards: [R1, R1, C1],
  };
  const entry = (id: string): VocabQueueEntry => ({
    id,
    ratio: 0.5,
    reason: 'test',
    acceptedBy: null,
  });
  const LOWQ = trackQ(
    q(GV, (v) => {
      v.id = 'vulnerable-road-users-q900';
      v.options[2].text = 'purple elephants';
    }),
  );
  const qvCtx = { corpus, synonyms: baseCtx.synonyms };

  it('NEW S9: QUEUE-STALE for an entry whose item is gone', () => {
    const ps = checkVocabQueue([entry('vulnerable-road-users-q777')], [GV], [GL], qvCtx);
    expect(ps.map((p) => p.code)).toEqual(['QUEUE-STALE']);
    expect(ps.map((p) => p.id)).toEqual(['vulnerable-road-users-q777']);
  });

  it('NEW S9: QUEUE-STALE for an entry whose item now passes', () => {
    const ps = checkVocabQueue([entry(GV.id)], [GV], [GL], qvCtx);
    expect(ps.map((p) => p.id)).toEqual([GV.id]);
  });

  it('NEW S9: a queue entry for an item still below 0.8 is not stale', () => {
    const ps = checkVocabQueue([entry(LOWQ.id)], [LOWQ], [], qvCtx);
    expect(ps).toEqual([]);
  });
});

describe('coverageShortfalls', () => {
  it('NEW S9: coverageShortfalls full lists every topic, area and element below its minimum in input order', () => {
    const TOP = [
      { id: 't1', areas: ['A1'], nsElements: ['1.1.1'] },
      { id: 't2', areas: ['A2'], nsElements: ['2.2.2'] },
    ];
    const input: CoverageInput = {
      topics: TOP,
      areas: ['A1', 'A2'],
      elements: ['1.1.1', '2.2.2'],
      written: new Set(),
      questions: [],
    };
    expect(coverageShortfalls(input, 'full')).toEqual([
      'topic t1: 0 questions, needs 50',
      'topic t2: 0 questions, needs 50',
      'area A1: 0 questions, needs 50',
      'area A2: 0 questions, needs 50',
      'element 1.1.1: 0 questions, needs 3',
      'element 2.2.2: 0 questions, needs 3',
    ]);
    const reversed: CoverageInput = {
      ...input,
      topics: [...TOP].reverse(),
      areas: ['A2', 'A1'],
      elements: ['2.2.2', '1.1.1'],
    };
    expect(coverageShortfalls(reversed, 'full')).toEqual([
      'topic t2: 0 questions, needs 50',
      'topic t1: 0 questions, needs 50',
      'area A2: 0 questions, needs 50',
      'area A1: 0 questions, needs 50',
      'element 2.2.2: 0 questions, needs 3',
      'element 1.1.1: 0 questions, needs 3',
    ]);
  });

  it('NEW S9: coverageShortfalls written holds only written topics and fully written areas and elements', () => {
    const TOP = [
      { id: 't1', areas: ['A1'], nsElements: ['1.1.1'] },
      { id: 't2', areas: ['A1'], nsElements: ['1.1.1'] },
    ];
    const cq = (topic: string, area: string, elements: string[], n: number) =>
      Array.from({ length: n }, () => ({ topic, area, elements }));
    const input: CoverageInput = {
      topics: TOP,
      areas: ['A1'],
      elements: ['1.1.1'],
      written: new Set(['t1']),
      questions: cq('t1', 'A1', ['1.1.1'], 49),
    };
    expect(coverageShortfalls(input, 'written')).toEqual(['topic t1: 49 questions, needs 50']);
    const bothWritten: CoverageInput = { ...input, written: new Set(['t1', 't2']) };
    expect(coverageShortfalls(bothWritten, 'written')).toEqual([
      'topic t1: 49 questions, needs 50',
      'topic t2: 0 questions, needs 50',
      'area A1: 49 questions, needs 50',
    ]);
  });

  it('NEW S9: coverageShortfalls is empty when every minimum is met', () => {
    const TOP = [{ id: 't1', areas: ['A1'], nsElements: ['1.1.1'] }];
    const cq = (topic: string, area: string, elements: string[], n: number) =>
      Array.from({ length: n }, () => ({ topic, area, elements }));
    const input: CoverageInput = {
      topics: TOP,
      areas: ['A1'],
      elements: ['1.1.1'],
      written: new Set(['t1']),
      questions: cq('t1', 'A1', ['1.1.1'], 50),
    };
    expect(coverageShortfalls(input, 'full')).toEqual([]);
    expect(coverageShortfalls(input, 'written')).toEqual([]);
  });
});

describe('schema validity', () => {
  it('NEW S9: every question and lesson fixture in this file parses under its schema', () => {
    for (const fixture of allFixtures) {
      const asQuestion = fixture as Question;
      const isLesson = Array.isArray((fixture as Lesson).cards);
      const result = isLesson
        ? LessonSchema.safeParse(fixture)
        : QuestionSchema.safeParse(asQuestion);
      expect(result.success, JSON.stringify(!result.success ? result.error.issues : [])).toBe(true);
    }
  });
});
