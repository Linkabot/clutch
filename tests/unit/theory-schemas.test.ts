// Unit tests for the lesson and question schemas (src/content/schemas/theory.ts,
// reached through the barrel): a valid fixture of each of the seven schemas
// parses, and for each refinement the plan and amend-08 A38/A39 pin, the
// valid fixture of the matching kind with exactly one change fails (Phase 3
// block 3a Step 8).
// Depends on: vitest, ../../src/content/schemas (QuestionSchema, LessonSchema,
// QuestionsFileSchema, LessonsFileSchema, DistractorPoolSchema,
// SynonymsFileSchema, VocabQueueFileSchema).
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect } from 'vitest';
import {
  QuestionSchema,
  LessonSchema,
  QuestionsFileSchema,
  LessonsFileSchema,
  DistractorPoolSchema,
  SynonymsFileSchema,
  VocabQueueFileSchema,
} from '../../src/content/schemas';

const clone = <T>(value: T): T => structuredClone(value);

const opt = (id: string, text: string, keyPhrase: string | null = null) => ({
  id,
  text,
  keyPhrase,
});

const WF = { unitId: 'hc:207', promptVersion: 'v1', model: 'claude-sonnet-5' };

const Q = {
  id: 'vulnerable-road-users-q001',
  topic: 'vulnerable-road-users',
  area: 'Vulnerable road users',
  elements: ['4.1.2'],
  format: 'choice4',
  stem: 'Why might an older pedestrian step into the road in front of you?',
  stemSign: null,
  options: [
    opt('a', 'They may not be able to judge your speed'),
    opt('b', 'They always have right of way'),
    opt('c', 'They cannot hear any engines'),
    opt('d', 'They prefer to walk in the road'),
  ],
  answer: 'a',
  answerKind: 'value',
  cite: 'hc:207',
  sourceQuote: 'may not be able to judge your speed',
  writtenFrom: WF,
};

const q = (patch: Record<string, unknown>) => ({ ...clone(Q), ...patch });

const Q2 = q({ format: 'choice2', options: [opt('a', 'True'), opt('b', 'False')] });

const Q4 = q({
  format: 'sign4',
  stemSign: 'warning-school',
  stem: 'What does this sign warn you about?',
  cite: 'sign:warning-school',
  sourceQuote: 'Children going to or from school.',
  writtenFrom: { ...WF, unitId: 'sign:warning-school' },
  options: [
    opt('a', 'Children going to or from school'),
    opt('b', 'A playground ahead'),
    opt('c', 'A pedestrian crossing ahead'),
    opt('d', 'Older people crossing'),
  ],
});

const QP = q({
  answerKind: 'phrase',
  stem: 'An older pedestrian is slow to cross in front of you. What should you do?',
  options: [
    opt('a', 'Be patient and let them cross in their own time'),
    opt('b', 'Rev your engine so they know you are waiting', 'Rev your engine'),
    opt('c', 'Edge forward to show them you want to go', 'Edge forward'),
    opt('d', 'Sound your horn to hurry them', 'Sound your horn'),
  ],
  sourceQuote: 'Be patient and allow them to cross in their own time.',
});

const QN = q({
  cite: 'ns:4.1.2',
  writtenFrom: { ...WF, unitId: 'ns:4.1.2' },
  sourceQuote: 'Co-operate with other road users',
});

const setOpt = (v: typeof Q, i: number, patch: Record<string, unknown>) => {
  const c = clone(v);
  c.options[i] = { ...c.options[i], ...patch };
  return c;
};

const RULE_CARD = {
  kind: 'rule',
  id: 'vulnerable-road-users-l1-c01',
  headline: 'Children and older people may misjudge your speed',
  cite: 'hc:207',
  quote: 'children and older pedestrians who may not be able to judge your speed',
  inShort: 'Slow down near children and older people.',
  writtenFrom: WF,
};
const CHECK_CARD = {
  kind: 'check',
  id: 'vulnerable-road-users-l1-c02',
  question: 'vulnerable-road-users-q001',
};
const L = {
  id: 'vulnerable-road-users-l1',
  topic: 'vulnerable-road-users',
  number: 1,
  title: 'People who need extra care',
  minutes: 4,
  cards: [RULE_CARD, CHECK_CARD],
};
const l = (patch: Record<string, unknown>) => ({ ...clone(L), ...patch });

describe('QuestionSchema and LessonSchema: valid fixtures', () => {
  it('NEW S8: a valid question parses', () => {
    expect(QuestionSchema.safeParse(Q).success).toBe(true);
    expect(QuestionSchema.safeParse(Q2).success).toBe(true);
    expect(QuestionSchema.safeParse(Q4).success).toBe(true);
    expect(QuestionSchema.safeParse(QP).success).toBe(true);
    expect(QuestionSchema.safeParse(QN).success).toBe(true);
  });

  it('NEW S8: a valid lesson parses', () => {
    expect(LessonSchema.safeParse(L).success).toBe(true);
  });

  it('NEW S8: a valid questions file parses', () => {
    expect(
      QuestionsFileSchema.safeParse({ topic: 'vulnerable-road-users', questions: [Q, QP, Q4] })
        .success,
    ).toBe(true);
  });

  it('NEW S8: a valid lessons file parses', () => {
    expect(
      LessonsFileSchema.safeParse({ topic: 'vulnerable-road-users', lessons: [L] }).success,
    ).toBe(true);
  });

  it('NEW S8: a valid distractor pool parses', () => {
    expect(
      DistractorPoolSchema.safeParse({
        topic: 'vulnerable-road-users',
        values: ['20 mph', '40 mph'],
      }).success,
    ).toBe(true);
  });

  it('NEW S8: a valid synonyms file parses', () => {
    expect(SynonymsFileSchema.safeParse({ groups: [] }).success).toBe(true);
    expect(SynonymsFileSchema.safeParse({ groups: [['car', 'vehicle']] }).success).toBe(true);
  });

  it('NEW S8: a valid vocab queue parses', () => {
    expect(VocabQueueFileSchema.safeParse({ entries: [] }).success).toBe(true);
    expect(
      VocabQueueFileSchema.safeParse({
        entries: [
          {
            id: 'vulnerable-road-users-q001',
            ratio: 0.5,
            reason: 'kill your speed is a figure of speech',
            acceptedBy: null,
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('QuestionSchema: refinements', () => {
  it('NEW S8: a choice4 question without four options fails', () => {
    expect(QuestionSchema.safeParse(q({ options: Q.options.slice(0, 2) })).success).toBe(false);
  });

  it('NEW S8: a sign4 question without four options fails', () => {
    expect(
      QuestionSchema.safeParse({ ...clone(Q4), options: Q4.options.slice(0, 2) }).success,
    ).toBe(false);
  });

  it('NEW S8: a choice2 question without two options fails', () => {
    expect(
      QuestionSchema.safeParse({ ...clone(Q2), options: Q2.options.slice(0, 1) }).success,
    ).toBe(false);
  });

  it('NEW S8: options not in a, b, c, d order fail', () => {
    const bad = q({ options: Q.options.map((o, i) => ({ ...o, id: ['a', 'c', 'b', 'd'][i] })) });
    expect(QuestionSchema.safeParse(bad).success).toBe(false);
  });

  it('NEW S8: an answer that is not one of the options fails', () => {
    expect(QuestionSchema.safeParse({ ...clone(Q2), answer: 'c' }).success).toBe(false);
  });

  it('NEW S8: a sign4 question without a stemSign fails', () => {
    expect(QuestionSchema.safeParse({ ...clone(Q4), stemSign: null }).success).toBe(false);
  });

  it('NEW S8: a stemSign on a question that is not sign4 fails', () => {
    expect(QuestionSchema.safeParse(q({ stemSign: 'warning-school' })).success).toBe(false);
  });

  it('NEW S8: a cite that does not parse fails', () => {
    expect(
      QuestionSchema.safeParse(q({ cite: 'foo:1', writtenFrom: { ...WF, unitId: 'foo:1' } }))
        .success,
    ).toBe(false);
  });

  it('NEW S8: a writtenFrom unitId that differs from the cite fails', () => {
    expect(QuestionSchema.safeParse(q({ writtenFrom: { ...WF, unitId: 'hc:208' } })).success).toBe(
      false,
    );
  });

  it('NEW S8: an ns cite whose element is not in elements fails', () => {
    expect(QuestionSchema.safeParse({ ...clone(QN), elements: ['4.1.1'] }).success).toBe(false);
  });

  it('NEW S8: a phrase question with a wrong option lacking a keyPhrase fails', () => {
    expect(QuestionSchema.safeParse(setOpt(QP, 1, { keyPhrase: null })).success).toBe(false);
  });

  it('NEW S8: a phrase question whose keyPhrase is not in its option text fails', () => {
    expect(
      QuestionSchema.safeParse(setOpt(QP, 3, { keyPhrase: 'flash your lights' })).success,
    ).toBe(false);
  });

  it('NEW S8: a value question with a keyPhrase fails', () => {
    expect(QuestionSchema.safeParse(setOpt(Q, 0, { keyPhrase: 'judge your speed' })).success).toBe(
      false,
    );
  });

  it('NEW S8: a question id not ending in -q and three digits fails', () => {
    expect(QuestionSchema.safeParse(q({ id: 'vulnerable-road-users-q01' })).success).toBe(false);
  });
});

describe('LessonSchema: refinements', () => {
  it('NEW S8: a lesson id not ending in -l and a number fails', () => {
    expect(LessonSchema.safeParse(l({ id: 'vulnerable-road-users-lesson1' })).success).toBe(false);
  });

  it('NEW S8: a lesson whose minutes are not a whole number from 2 to 8 fails', () => {
    expect(LessonSchema.safeParse(l({ minutes: 1 })).success).toBe(false);
    expect(LessonSchema.safeParse(l({ minutes: 9 })).success).toBe(false);
    expect(LessonSchema.safeParse(l({ minutes: 2.5 })).success).toBe(false);
  });
});
