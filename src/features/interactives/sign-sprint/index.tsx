// Sign Sprint's lazy entry point (the interactives contract, plan.md Step 24
// and amendment E27): default-exports the Sign Sprint screen, rendered with
// no props (it then reads the real clock). This file is the chunk
// src/app/routes.tsx loads through the registry entry's load(), and the
// manifest key scripts/check-interactive-size.mjs charges to the
// sign-sprint size budget.
// Depends on: ./SignSprint.
// Depended on by: src/features/interactives/registry.ts (load: dynamic
// import), scripts/check-interactive-size.mjs (manifest key, read as text).

import SignSprint from './SignSprint';

export default SignSprint;
