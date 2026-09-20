// Tap the sign's pure round builder, rule-sentence lookup and sheet-content
// builder (plan.md Step 23 and amendments E25-E26, extended by Step 6's Q7
// two-sign questions): optionsFor() gives a question's 4 options -- for the
// two LOOK_ALIKE_PAIR signs (STOP and GIVE WAY), exactly the pair in
// shuffled order with no distractor pick, since the point is telling them
// apart; for every other answer, the answer plus 3 distractors from
// pickDistractors (same family or look-alike tiers), shuffled so the
// answer never sits in one fixed slot. buildTapRound() picks 10 distinct
// answers from `pool` -- the whole catalogue, or one family's signs when
// Q12's ?family= names one -- while its options are always drawn from
// `allSigns`, so a family round keeps pickDistractors' tier 2 (other
// families with the same look) rather than silently emptying it
// (amendment E16 (d)). firstRuleSentence() reads the first sentence of a sign's shape rule
// using the Step 20 note's lookup (C7 signs read outcomes[sign.rule];
// every other rule reads sentences directly), or null when the rule has
// none (C1, C9's `other` signs). sheetContent() (E26) is the single source
// of QuizSheet's props for one answer: outcome and xpGained come from
// comparing `chosenId` to the question's answer, but the name (via
// gameName(), the Highway Code short name for STOP/GIVE WAY), rule
// sentence and hook always come from the ANSWER, never the tapped sign, so
// a wrong tap still teaches the right one. Every random choice is driven by
// the caller's Rng, so one seed always builds the same round.
// Depends on: ../../../content/schemas (Sign), ../../../content/signs
// (getShapeRules, hookFor, gameName, LOOK_ALIKE_PAIR),
// ../../interactives/shared/random (Rng, shuffle),
// ../../interactives/shared/distractors (pickDistractors).
// Depended on by: ./TapTheSignScreen.tsx, tests/unit/tap-round.test.ts.

import type { Sign } from '../../../content/schemas';
import { getShapeRules, hookFor, gameName, LOOK_ALIKE_PAIR } from '../../../content/signs';
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
 * A question's options for `answer`: when `answer.id` is one of
 * LOOK_ALIKE_PAIR (STOP and GIVE WAY, Q7), exactly the two pair signs in
 * shuffled order -- no distractor pick. Otherwise the answer plus 3
 * distractors from pickDistractors, shuffled so the answer never sits in
 * one fixed slot.
 */
export function optionsFor(signs: readonly Sign[], answer: Sign, rng: Rng): Sign[] {
  if ((LOOK_ALIKE_PAIR as readonly string[]).includes(answer.id)) {
    const pairSigns = LOOK_ALIKE_PAIR.map((id) => signs.find((sign) => sign.id === id)).filter(
      (sign): sign is Sign => sign !== undefined,
    );
    return shuffle(pairSigns, rng);
  }
  const distractors = pickDistractors(signs, answer, DISTRACTORS_PER_QUESTION, rng);
  return shuffle([answer, ...distractors], rng);
}

/**
 * Builds one Tap the sign round: 10 questions whose distinct answers are
 * the first 10 of a full shuffle of `pool`, each built by optionsFor()
 * over `allSigns` -- 4 options for an ordinary answer, exactly 2 for the
 * LOOK_ALIKE_PAIR answer. The two lists differ only for Q12's family
 * rounds, where `pool` is one family and `allSigns` is still the whole
 * catalogue, so the distractor tiers keep every candidate they had
 * (amendment E16 (d)); an unfiltered round passes the same list twice.
 */
export function buildTapRound(
  pool: readonly Sign[],
  allSigns: readonly Sign[],
  rng: Rng,
): TapQuestion[] {
  return shuffle(pool, rng)
    .slice(0, QUESTIONS_PER_ROUND)
    .map((answer) => {
      const options = optionsFor(allSigns, answer, rng);
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
 * compare `chosenId` to the question's answer, but `answerName` (via
 * gameName(), the Highway Code short name for STOP/GIVE WAY, displayName
 * otherwise), `ruleSentence` and `hook` always read the ANSWER (via
 * firstRuleSentence and hookFor(answer, 'sheet')), never the tapped sign --
 * a wrong tap still shows the right sign's name, rule sentence and hook.
 */
export function sheetContent(question: TapQuestion, chosenId: string): SheetContent {
  const { answer } = question;
  const correct = chosenId === answer.id;
  return {
    outcome: correct ? 'correct' : 'wrong',
    xpGained: correct ? 10 : 0,
    answerName: gameName(answer),
    ruleSentence: firstRuleSentence(answer),
    hook: hookFor(answer, 'sheet')?.text ?? null,
  };
}
