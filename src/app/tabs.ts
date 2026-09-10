// Defines the five app tabs (id, route path, label) as a single typed source of truth.
// Depends on: nothing.
// Depended on by: src/app/TabBar.tsx, src/app/routes.tsx, tests/unit/tabs.test.ts.

export interface Tab {
  id: string;
  path: string;
  label: string;
}

export const TABS: readonly Tab[] = [
  { id: 'journey', path: '/', label: 'Journey' },
  { id: 'learn', path: '/learn', label: 'Learn' },
  { id: 'practice', path: '/practice', label: 'Practice' },
  { id: 'my-car', path: '/my-car', label: 'My Car' },
  { id: 'me', path: '/me', label: 'Me' },
];
