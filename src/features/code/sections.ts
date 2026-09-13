// Pure helpers for the Highway Code sections list (/learn/code): turning a
// section's ruleIds into a human-readable range, and grouping the index's
// sections into the fixed display order used by
// HighwayCodeSectionsScreen. No React, no I/O — testable on a hand-built
// index object.
// Depends on: ../../content/schemas (HighwayCodeIndex type only).
// Depended on by: src/features/code/HighwayCodeSectionsScreen.tsx,
// tests/unit/sections.test.ts.
import type { HighwayCodeIndex } from '../../content/schemas';

type IndexSection = HighwayCodeIndex['sections'][number];

export interface SectionGroup {
  label: string;
  kind: IndexSection['kind'];
  sections: IndexSection[];
}

const GROUP_ORDER: ReadonlyArray<{ label: string; kind: IndexSection['kind'] }> = [
  { label: 'Rules', kind: 'rules' },
  { label: 'Introduction', kind: 'introduction' },
  { label: 'Signals, signs and markings', kind: 'signals' },
  { label: 'Annexes', kind: 'annex' },
  { label: 'Other', kind: 'other' },
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
 * Groups the index's sections into the five display groups, in a fixed
 * order (Rules, Introduction, Signals, Annexes, Other), each carrying its
 * own sections in the index's published order.
 */
export function groupSections(index: HighwayCodeIndex): SectionGroup[] {
  return GROUP_ORDER.map(({ label, kind }) => ({
    label,
    kind,
    sections: index.sections.filter((section) => section.kind === kind),
  }));
}
