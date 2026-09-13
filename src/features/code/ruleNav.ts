// Pure helper for the rule page's previous/next navigation: given a
// section's ordered rule ids and the current rule's id, finds its
// immediate neighbours within that same order. No React, no I/O — plain
// array lookups, testable on hand-built string arrays.
// Depends on: nothing.
// Depended on by: src/features/code/RuleScreen.tsx, tests/unit/rule-nav.test.ts.

export interface RuleNeighbours {
  prev: string | null;
  next: string | null;
}

/**
 * Finds the rule immediately before and after `id` within `ruleIds`'s own
 * order. Both come back null when `id` is first/last in the list, when
 * `ruleIds` holds only one id, or when `id` is not present at all — there
 * is no wraparound from the last rule back to the first.
 */
export function neighbours(ruleIds: string[], id: string): RuleNeighbours {
  const index = ruleIds.indexOf(id);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? ruleIds[index - 1] : null,
    next: index < ruleIds.length - 1 ? ruleIds[index + 1] : null,
  };
}
