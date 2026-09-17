// Defines the five app tabs (id, route path, label, tab-bar icon, and any
// extra route prefixes that should also count as "active" for that tab) as
// a single typed source of truth.
// Depends on: lucide-react (icon components and the LucideIcon type).
// Depended on by: src/app/App.tsx, src/app/TabBar.tsx, src/app/back.ts,
// tests/unit/tabs.test.ts, tests/e2e/shell.spec.ts.
import type { LucideIcon } from 'lucide-react';
import { Route, BookOpen, ClipboardCheck, Car, UserRound } from 'lucide-react';

export interface Tab {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this tab active, e.g. the
   * Highway Code deep link under /code highlights the Learn tab. */
  alsoActiveFor?: string[];
}

export const TABS: readonly Tab[] = [
  { id: 'journey', path: '/', label: 'Journey', icon: Route },
  { id: 'learn', path: '/learn', label: 'Learn', icon: BookOpen, alsoActiveFor: ['/code'] },
  { id: 'practice', path: '/practice', label: 'Practice', icon: ClipboardCheck },
  { id: 'my-car', path: '/my-car', label: 'My Car', icon: Car },
  { id: 'me', path: '/me', label: 'Me', icon: UserRound },
];
