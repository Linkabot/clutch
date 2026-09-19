// Pure helpers for the Highway Code hub (/learn/code): turning a section's
// ruleIds into a human-readable range, and CODE_TABS/groupSections
// (Q15, amendment E6d), which split the index's sections into the three
// tabs HighwayCodeSectionsScreen renders — Rules (the index's `rules`
// sections, in published order, then the `introduction` section LAST, per
// Lincoln's own choice at the gate), Signs & signals (`signals`) and
// Annexes (`annex` sections, then `other`). No React, no I/O — testable on
// a hand-built index object.
// Depends on: ../../content/schemas (HighwayCodeIndex type only).
// Depended on by: src/features/code/HighwayCodeSectionsScreen.tsx,
// tests/unit/sections.test.ts.
import type { HighwayCodeIndex } from '../../content/schemas';

type IndexSection = HighwayCodeIndex['sections'][number];

export interface CodeTab {
  id: string;
  label: string;
  kinds: readonly IndexSection['kind'][];
}

export interface SectionGroup {
  id: string;
  label: string;
  sections: IndexSection[];
}

export const CODE_TABS: readonly CodeTab[] = [
  { id: 'rules', label: 'Rules', kinds: ['rules', 'introduction'] },
  { id: 'signs', label: 'Signs & signals', kinds: ['signals'] },
  { id: 'annexes', label: 'Annexes', kinds: ['annex', 'other'] },
];

/**
 * Renders a section's rule ids as a human-readable range: "1–35" for
 * numeric rule ids, "H1–H3" for the introduction's hierarchy rules, ""
 * for a section with no rules. Always derived from ruleIds — never from
 * the section's slug or title, both of which can disagree with the rules
 * it actually holds (amendment P3, handoffs/phase-1-highway-code/plan.md:
 * e.g. the "motorways-253-to-273" slug holds rules 253–274).
 */
export function ruleRange(ruleIds: string[]): string {
  if (ruleIds.length === 0) return '';

  const isNumeric = ruleIds.every((id) => /^\d+$/.test(id));
  if (isNumeric) {
    const numbers = ruleIds.map(Number);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return min === max ? `${min}` : `${min}–${max}`;
  }

  const first = ruleIds[0];
  const last = ruleIds[ruleIds.length - 1];
  return first === last ? first : `${first}–${last}`;
}

/**
 * Groups the index's sections into CODE_TABS's three tabs, in that order.
 * Each tab lists its sections kind by kind, in the order its own `kinds`
 * lists them, and within a kind in the index's published order — so the
 * Rules tab holds the 14 `rules` sections first and the one `introduction`
 * section last, even though the index itself publishes Introduction first
 * (amendment E6d, Lincoln's choice at the gate).
 */
export function groupSections(index: HighwayCodeIndex): SectionGroup[] {
  return CODE_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    sections: tab.kinds.flatMap((kind) =>
      index.sections.filter((section) => section.kind === kind),
    ),
  }));
}
