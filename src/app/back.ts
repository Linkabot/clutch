// A-S3: computes where the header's Back button should navigate. Returns -1
// (go back one entry in the browser's own history) only when there is a
// prior in-app history entry to go back to; otherwise Back would leave the
// app (a cold deep link, e.g. opening /code/rule/126 directly, or a page
// reload, both start a fresh history stack at idx 0/undefined), so it
// instead returns the path of the tab that owns the current route — the
// same path-segment-boundary prefix matching TabBar.tsx's isTabActive uses
// against TABS' own path and alsoActiveFor list — falling back to Journey's
// '/' when no tab claims the path.
// Depends on: ./tabs (TABS).
// Depended on by: src/app/App.tsx, tests/unit/back.test.ts.
import { TABS } from './tabs';

/** True when `pathname` is `prefix` itself or a path nested under it. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function backTarget(pathname: string, historyIdx: number | undefined): -1 | string {
  if (typeof historyIdx === 'number' && historyIdx > 0) {
    return -1;
  }
  for (const tab of TABS) {
    if (tab.path === '/') continue;
    if (matchesPrefix(pathname, tab.path)) return tab.path;
    if ((tab.alsoActiveFor ?? []).some((prefix) => matchesPrefix(pathname, prefix))) {
      return tab.path;
    }
  }
  return '/';
}
