// Tap the sign's pure round builder, rule-sentence lookup and sheet-content
// builder (plan.md Step 23 and amendments E25-E26): buildTapRound() picks
// 10 distinct answers from the signs catalogue (the first is firstSignId's
// sign when it names one; an unknown firstSignId is ignored), each paired
// with 3 same-family distractors whose captions are distinct from each
// other and from the answer's, the 4 options shuffled so the answer never
// sits in one fixed slot. firstRuleSentence() reads the first sentence of a
// sign's shape rule using the Step 20 note's lookup (C7 signs read
// outcomes[sign.rule]; every other rule reads sentences directly), or null
// when the rule has none (C1, C9's `other` signs). sheetContent() (E26)
// is the single source of QuizSheet's props for one answer: outcome and
// xpGained come from comparing `chosenId` to the question's answer, but the
// name, rule sentence and hook always come from the ANSWER, never the
// tapped sign, so a wrong tap still teaches the right one. Every random
// choice is driven by the caller's Rng, so one seed always builds the same
// round.
// Depends on: ../../../content/schemas (Sign), ../../../content/signs
// (getShapeRules, hookFor), ../../interactives/shared/random (Rng, shuffle),
// ../../interactives/shared/distractors (pickDistractors).
// Depended on by: ./TapTheSignScreen.tsx, tests/unit/tap-round.test.ts.

import type { Sign } from '../../../content/schemas';
import { getShapeRules, hookFor } from '../../../content/signs';
import type { Rng } from '../../interactives/shared/random';
import { shuffle } from '../../interactives/shared/random';
import { pickDistractors } from '../../interactives/shared/distractors';

const QUESTIONS_PER_ROUND = 10;
const OPTIONS_PER_QUESTION = 4;
const DISTRACTORS_PER_QUESTION = OPTIONS_PER_QUESTION - 1;

export interface TapQuestion {
  answer: Sign;
  options: Sign[];
}

/**
 * Builds one Tap the sign round: 10 questions with distinct answers, each
 * with the answer plus 3 same-family distractors (distinct captions, any
 * length), 4 options shuffled per question. When `firstSignId` names one of
 * `signs`, its sign answers question 1; otherwise (including an unknown
 * id) the answers are simply the first 10 of a full shuffle.
 */
export function buildTapRound(
  signs: readonly Sign[],
  rng: Rng,
  firstSignId?: string,
): TapQuestion[] {
  const shuffledSigns = shuffle(signs, rng);
  const first = firstSignId ? shuffledSigns.find((sign) => sign.id === firstSignId) : undefined;
  const orderedAnswers = first
    ? [first, ...shuffledSigns.filter((sign) => sign.id !== first.id)]
    : shuffledSigns;

  return orderedAnswers.slice(0, QUESTIONS_PER_ROUND).map((answer) => {
    const distractors = pickDistractors(signs, answer, DISTRACTORS_PER_QUESTION, rng);
    const options = shuffle([answer, ...distractors], rng);
    return { answer, options };
  });
}

/**
 * The first sentence of `sign`'s shape/colour rule (the Step 20 note's
 * lookup), or null when the matching rule has no sentences (C1, C9).
 */
export function firstRuleSentence(sign: Sign): string | null {
  const { rules } = getShapeRules();
  const ruleId = sign.rule.startsWith('C7-') ? 'C7' : sign.rule;
  const rule = rules.find((r) => r.id === ruleId);
  const sentences = sign.rule.startsWith('C7-')
    ? rule?.outcomes?.[sign.rule]?.sentences
    : rule?.sentences;
  return sentences?.[0] ?? null;
}

export interface SheetContent {
  outcome: 'correct' | 'wrong';
  xpGained: number;
  answerName: string;
  ruleSentence: string | null;
  hook: string | null;
}

/**
 * QuizSheet's props for one answer to `question`: `outcome`/`xpGained`
 * compare `chosenId` to the question's answer, but `answerName`,
 * `ruleSentence` and `hook` always read the ANSWER (via firstRuleSentence
 * and hookFor(answer, 'sheet')), never the tapped sign -- a wrong tap still
 * shows the right sign's name, rule sentence and hook.
 */
export function sheetContent(question: TapQuestion, chosenId: string): SheetContent {
  const { answer } = question;
  const correct = chosenId === answer.id;
  return {
    outcome: correct ? 'correct' : 'wrong',
    xpGained: correct ? 10 : 0,
    answerName: answer.name,
    ruleSentence: firstRuleSentence(answer),
    hook: hookFor(answer, 'sheet')?.text ?? null,
  };
}
