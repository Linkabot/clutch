// Match Pairs' lazy entry point (the interactives contract, plan.md Step 25
// and amendment E31): default-exports the Match Pairs screen, rendered with
// no props. This file is the chunk src/app/routes.tsx loads through the
// registry entry's load(), and the manifest key
// scripts/check-interactive-size.mjs charges to the match-pairs size
// budget.
// Depends on: ./MatchPairs.
// Depended on by: src/features/interactives/registry.ts (load: dynamic
// import), scripts/check-interactive-size.mjs (manifest key, read as text).

import MatchPairs from './MatchPairs';

export default MatchPairs;
