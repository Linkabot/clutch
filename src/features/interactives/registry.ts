// Interactives registry: the single source of truth for which games and
// decoders exist. Later steps mount each entry's route lazily
// (src/app/routes.tsx) and check its built size against its sizeBudgetKiB
// (scripts/check-interactive-size.mjs, npm run check:interactives). Empty
// for now -- Steps 24-26 add entries for sign-sprint, match-pairs and
// shape-colour-decoder, each with a lessonRefs of ['code:traffic-signs']
// and a size budget of 40 KiB.
// Depends on: react (ComponentType, as a type only).
// Depended on by: tests/unit/registry.test.ts (later:
// src/app/routes.tsx, scripts/check-interactive-size.mjs, Steps 24-26).

import type { ComponentType } from 'react';

export interface InteractiveEntry {
  id: string;
  title: string;
  phase: 2;
  lessonRefs: string[];
  route: string;
  load: () => Promise<{ default: ComponentType }>;
  sizeBudgetKiB: number;
}

export const INTERACTIVES: InteractiveEntry[] = [];
