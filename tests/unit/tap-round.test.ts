// Unit tests for Tap the sign's pure round builder, rule-sentence lookup
// and sheet-content builder (plan.md Step 23 and amendments E25-E26):
// buildTapRound gives 10 distinct answers (firstSignId first when it names
// a sign, otherwise ignored), each with 4 options -- the answer plus 3
// same-family distractors with distinct captions -- shuffled so the answer
// does not always land in one slot; the same seed always builds the same
// round, and two seeds differ. firstRuleSentence reads the first
// shape-rule sentence, including the C7 outcomes split, and null for
// C1/C9. sheetContent (E26) proves its outcome/XP come from comparing the
// chosen id to the answer, while its name, rule sentence and hook always
// come from the answer -- even when the chosen sign is a different sign
// entirely (warning-ford, C1: no rule sentence, only the family hook).
// Runs over the real signs catalogue (await loadSigns() works under
// Vitest -- src/content/signs.ts).
// Depends on: vitest, src/content/signs (loadSigns), src/content/schemas
// (Sign type), src/features/interactives/shared/random (mulberry32),
// src/features/practice/tap/round (buildTapRound, firstRuleSentence,
// sheetContent, TapQuestion).
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect, beforeAll } from 'vitest';
import { loadSigns } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';
import { mulberry32 } from '../../src/features/interactives/shared/random';
import {
  buildTapRound,
  firstRuleSentence,
  sheetContent,
  type TapQuestion,
} from '../../src/features/practice/tap/round';

let signs: Sign[];

beforeAll(async () => {
  signs = await loadSigns();
});

function findSign(id: string): Sign {
  const sign = signs.find((s) => s.id === id);
  if (!sign) throw new Error(`${id} missing from signs.json`);
  return sign;
}

describe('firstRuleSentence', () => {
  it('returns the first shape-rule sentence for warning-slippery-road', () => {
    expect(firstRuleSentence(findSign('warning-slippery-road'))).toBe('Triangles warn.');
  });

  it('returns the first outcome sentence for the C7 sign direction-london-a2', () => {
    expect(firstRuleSentence(findSign('direction-london-a2'))).toBe('Rectangles inform.');
  });

  it('returns null for the C9 sign road-works-roadworks', () => {
    expect(firstRuleSentence(findSign('road-works-roadworks'))).toBeNull();
  });

  it('returns null for the C1 sign orders-stop-sign-and-road-marking', () => {
    expect(firstRuleSentence(findSign('orders-stop-sign-and-road-marking'))).toBeNull();
  });
});

describe('buildTapRound', () => {
  it('gives 10 questions with distinct answers', () => {
    const round = buildTapRound(signs, mulberry32(1));
    expect(round).toHaveLength(10);
    expect(new Set(round.map((q) => q.answer.id)).size).toBe(10);
  });

  it('puts firstSignId first when it names a sign, answers still distinct', () => {
    const round = buildTapRound(signs, mulberry32(2), 'warning-slippery-road');
    expect(round[0].answer.id).toBe('warning-slippery-road');
    expect(new Set(round.map((q) => q.answer.id)).size).toBe(10);
  });

  it('ignores an unknown firstSignId, still giving 10 distinct answers', () => {
    const round = buildTapRound(signs, mulberry32(3), 'not-a-real-sign-id');
    expect(round).toHaveLength(10);
    expect(new Set(round.map((q) => q.answer.id)).size).toBe(10);
  });

  it('gives every question 4 options with exactly one matching the answer', () => {
    const round = buildTapRound(signs, mulberry32(4));
    for (const question of round) {
      expect(question.options).toHaveLength(4);
      expect(question.options.filter((option) => option.id === question.answer.id)).toHaveLength(1);
    }
  });

  it('gives every question 4 distinct captions', () => {
    const round = buildTapRound(signs, mulberry32(4));
    for (const question of round) {
      expect(new Set(question.options.map((option) => option.name)).size).toBe(4);
    }
  });

  it("gives every distractor the answer's family", () => {
    const round = buildTapRound(signs, mulberry32(5));
    for (const question of round) {
      for (const option of question.options) {
        expect(option.family).toBe(question.answer.family);
      }
    }
  });

  it('is repeatable for one seed', () => {
    const a = buildTapRound(signs, mulberry32(6)).map((q) => q.answer.id);
    const b = buildTapRound(signs, mulberry32(6)).map((q) => q.answer.id);
    expect(a).toEqual(b);
  });

  it('gives different answer lists for two different seeds', () => {
    const a = buildTapRound(signs, mulberry32(7)).map((q) => q.answer.id);
    const b = buildTapRound(signs, mulberry32(8)).map((q) => q.answer.id);
    expect(a).not.toEqual(b);
  });

  it('gives 10 answer ids that differ from the first 10 ids in signs.json', () => {
    const firstTen = signs.slice(0, 10).map((s) => s.id);
    const round = buildTapRound(signs, mulberry32(9));
    expect(round.map((q) => q.answer.id)).not.toEqual(firstTen);
  });

  it("places the answer's index among the 4 options in at least 2 different slots across the 10 questions", () => {
    const round = buildTapRound(signs, mulberry32(10));
    const positions = new Set(
      round.map((q) => q.options.findIndex((option) => option.id === q.answer.id)),
    );
    expect(positions.size).toBeGreaterThanOrEqual(2);
  });
});

describe('sheetContent', () => {
  // warning-ford (C1): no rule sentence, no own hook, so its sheet content
  // falls back to the family hook -- and its caption is long, so it is
  // read from the loaded sign rather than retyped here. Looked up in
  // beforeAll (not at describe-definition time), since `signs` is only
  // populated once the outer beforeAll's loadSigns() has resolved.
  let slipperyRoad: Sign;
  let ford: Sign;
  let question: TapQuestion;

  beforeAll(() => {
    slipperyRoad = findSign('warning-slippery-road');
    ford = findSign('warning-ford');
    question = { answer: slipperyRoad, options: [slipperyRoad, ford] };
  });

  it('is correct with 10 XP and the answer name/sentence/hook when chosenId matches the answer', () => {
    expect(sheetContent(question, slipperyRoad.id)).toEqual({
      outcome: 'correct',
      xpGained: 10,
      answerName: 'Slippery road.',
      ruleSentence: 'Triangles warn.',
      hook: 'Three sides, one message: watch out ahead.',
    });
  });

  it('is wrong with 0 XP but still the answer name/sentence/hook when chosenId is a different sign', () => {
    expect(sheetContent(question, ford.id)).toEqual({
      outcome: 'wrong',
      xpGained: 0,
      answerName: 'Slippery road.',
      ruleSentence: 'Triangles warn.',
      hook: 'Three sides, one message: watch out ahead.',
    });
  });

  it('reads warning-ford as the answer: no rule sentence, the family hook', () => {
    const fordQuestion: TapQuestion = { answer: ford, options: [slipperyRoad, ford] };
    expect(sheetContent(fordQuestion, slipperyRoad.id)).toEqual({
      outcome: 'wrong',
      xpGained: 0,
      answerName: ford.name,
      ruleSentence: null,
      hook: 'Warning signs: something ahead needs care.',
    });
  });
});
