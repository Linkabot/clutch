// Interactives registry: the single source of truth for which games and
// decoders exist. src/app/routes.tsx mounts one lazily loaded child route
// per entry (its route without the leading slash), and
// scripts/check-interactive-size.mjs (npm run check:interactives) checks
// each entry's built size against its sizeBudgetKiB. The entries are Sign
// Sprint (/practice/sprint, Step 24) and Match Pairs (/practice/pairs,
// Step 25), each with a lessonRefs of ['code:traffic-signs'] and a size
// budget of 40 KiB; Step 26 adds shape-colour-decoder the same way.
// Depends on: react (ComponentType, as a type only), ./sign-sprint and
// ./match-pairs (each loaded only through its entry's dynamic import).
// Depended on by: tests/unit/registry.test.ts, src/app/routes.tsx,
// scripts/check-interactive-size.mjs (reads this file as text).

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

export const INTERACTIVES: InteractiveEntry[] = [
  {
    id: 'sign-sprint',
    title: 'Sign Sprint',
    phase: 2,
    lessonRefs: ['code:traffic-signs'],
    route: '/practice/sprint',
    load: () => import('./sign-sprint'),
    sizeBudgetKiB: 40,
  },
  {
    id: 'match-pairs',
    title: 'Match Pairs',
    phase: 2,
    lessonRefs: ['code:traffic-signs'],
    route: '/practice/pairs',
    load: () => import('./match-pairs'),
    sizeBudgetKiB: 40,
  },
];
