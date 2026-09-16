// Pure sign-list filtering for the Signs browser: family ('all' or one
// SignFamily) plus a Collected-only toggle, keeping signs.json order
// (never re-sorted). No React, no content loading -- testable with small
// hand-built Sign[] fixtures (tests/unit/signs-filter.test.ts).
// Depends on: ../../content/schemas (Sign, SignFamily types),
// ../../engine/progress (isCollected).
// Depended on by: src/features/signs/SignsScreen.tsx, tests/unit/signs-filter.test.ts.

import type { Sign, SignFamily } from '../../content/schemas';
import { isCollected } from '../../engine/progress';

/** A Signs-browser family filter: one SignFamily, or 'all' for every family. */
export type SignFamilyFilter = SignFamily | 'all';

/**
 * Filters `signs` by family and, when `collectedOnly` is true, keeps only
 * signs whose progress (`progress.get(sign.id) ?? 0` correct answers) has
 * reached the collected threshold (isCollected). Signs with no entry in
 * `progress` are treated as 0 correct. Input order is preserved.
 */
export function filterSigns(
  signs: Sign[],
  family: SignFamilyFilter,
  collectedOnly: boolean,
  progress: Map<string, number>,
): Sign[] {
  return signs.filter((sign) => {
    if (family !== 'all' && sign.family !== family) {
      return false;
    }
    if (collectedOnly && !isCollected(progress.get(sign.id) ?? 0)) {
      return false;
    }
    return true;
  });
}
