// Zod schemas for the lesson and question content Steps 9+ write: a
// multiple-choice `QuestionSchema` (choice4/choice2/sign4, each citing one
// unit of the theory corpus), a `LessonSchema` (a run of rule and check
// cards), their file wrappers, and the three supporting writer-loop file
// schemas (distractor pools, synonym groups, the vocab review queue)
// (Phase 3 block 3a Step 8; plan.md and amend-08 A38/A39). "No value" is
// `.nullable()` and required, never `.optional()`. Imports only zod and
// ../cite, so this module can never cycle back through the schemas barrel
// (A38 (e)); every citation string is checked with `parseCite` from there,
// never re-parsed here.
// Depends on: zod, ../cite.
// Depended on by: src/content/schemas/index.ts, tests/unit/theory-schemas.test.ts.
import { z } from 'zod';
import { parseCite } from '../cite';

const QUESTION_ID = /^[a-z0-9-]+-q\d{3}$/;
const LESSON_ID = /-l\d+$/;

const OptionIdSchema = z.enum(['a', 'b', 'c', 'd']);

export const QuestionOptionSchema = z.object({
  id: OptionIdSchema,
  text: z.string().min(1),
  keyPhrase: z.string().min(1).nullable(),
});

export const WrittenFromSchema = z.object({
  unitId: z.string().min(1),
  promptVersion: z.string().min(1),
  model: z.string().min(1),
});

const OPTION_IDS_BY_FORMAT: Record<'choice4' | 'choice2' | 'sign4', ('a' | 'b' | 'c' | 'd')[]> = {
  choice4: ['a', 'b', 'c', 'd'],
  choice2: ['a', 'b'],
  sign4: ['a', 'b', 'c', 'd'],
};

export const QuestionSchema = z
  .object({
    id: z.string().regex(QUESTION_ID),
    topic: z.string().min(1),
    area: z.string().min(1),
    elements: z.array(z.string()),
    format: z.enum(['choice4', 'choice2', 'sign4']),
    stem: z.string().min(1),
    stemSign: z.string().min(1).nullable(),
    options: z.array(QuestionOptionSchema),
    answer: OptionIdSchema,
    answerKind: z.enum(['value', 'phrase']),
    cite: z.string().min(1),
    sourceQuote: z.string().min(1),
    writtenFrom: WrittenFromSchema,
  })
  .refine((q) => q.options.length === OPTION_IDS_BY_FORMAT[q.format].length, {
    message: 'choice4/sign4 need four options, choice2 needs two',
    path: ['options'],
  })
  .refine((q) => q.options.every((option, i) => option.id === OPTION_IDS_BY_FORMAT[q.format][i]), {
    message: 'option ids must be a, b, c, d in order (a, b for choice2)',
    path: ['options'],
  })
  .refine((q) => q.options.some((option) => option.id === q.answer), {
    message: 'answer must be one of this question’s option ids',
    path: ['answer'],
  })
  .refine((q) => (q.format === 'sign4') === (q.stemSign !== null), {
    message: 'stemSign is non-null exactly when format is sign4',
    path: ['stemSign'],
  })
  .refine((q) => parseCite(q.cite) !== null, {
    message: 'cite must parse',
    path: ['cite'],
  })
  .refine((q) => q.writtenFrom.unitId === q.cite, {
    message: 'writtenFrom.unitId must equal cite',
    path: ['writtenFrom', 'unitId'],
  })
  .refine(
    (q) => {
      const parsed = parseCite(q.cite);
      if (!parsed || parsed.kind !== 'ns') return true;
      return q.elements.includes(parsed.id);
    },
    { message: 'an ns: cite’s element must be in elements', path: ['elements'] },
  )
  .refine(
    (q) => {
      if (q.answerKind === 'value') return q.options.every((option) => option.keyPhrase === null);
      return q.options.every(
        (option) =>
          option.id === q.answer ||
          (option.keyPhrase !== null && option.text.includes(option.keyPhrase)),
      );
    },
    {
      message:
        'value answers have no key phrases; phrase answers need every wrong option’s key phrase to be a substring of its text',
      path: ['options'],
    },
  );

const RuleCardSchema = z.object({
  kind: z.literal('rule'),
  id: z.string().min(1),
  headline: z.string().min(1),
  cite: z.string().min(1),
  quote: z.string().min(1),
  inShort: z.string().min(1),
  writtenFrom: WrittenFromSchema,
});

const CheckCardSchema = z.object({
  kind: z.literal('check'),
  id: z.string().min(1),
  question: z.string().min(1),
});

export const LessonCardSchema = z.discriminatedUnion('kind', [RuleCardSchema, CheckCardSchema]);

export const LessonSchema = z.object({
  id: z.string().regex(LESSON_ID),
  topic: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  minutes: z.number().int().min(2).max(8),
  cards: z.array(LessonCardSchema),
});

export const QuestionsFileSchema = z.object({
  topic: z.string().min(1),
  questions: z.array(QuestionSchema),
});

export const LessonsFileSchema = z.object({
  topic: z.string().min(1),
  lessons: z.array(LessonSchema),
});

export const DistractorPoolSchema = z.object({
  topic: z.string().min(1),
  values: z.array(z.string()),
});

export const SynonymsFileSchema = z.object({
  groups: z.array(z.array(z.string())),
});

export const VocabQueueEntrySchema = z.object({
  id: z.string().min(1),
  ratio: z.number(),
  reason: z.string().min(1),
  acceptedBy: z.string().min(1).nullable(),
});

export const VocabQueueFileSchema = z.object({
  entries: z.array(VocabQueueEntrySchema),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type WrittenFrom = z.infer<typeof WrittenFromSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type LessonCard = z.infer<typeof LessonCardSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type QuestionsFile = z.infer<typeof QuestionsFileSchema>;
export type LessonsFile = z.infer<typeof LessonsFileSchema>;
export type DistractorPool = z.infer<typeof DistractorPoolSchema>;
export type SynonymsFile = z.infer<typeof SynonymsFileSchema>;
export type VocabQueueEntry = z.infer<typeof VocabQueueEntrySchema>;
export type VocabQueueFile = z.infer<typeof VocabQueueFileSchema>;
