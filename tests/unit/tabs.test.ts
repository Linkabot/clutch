// Unit tests for the TABS source of truth: five entries, unique ids, root
// path first, every other path is absolute, labels match exactly, and every
// tab has a renderable icon. lucide-react icons are React.forwardRef
// objects (typeof 'object', with a $$typeof symbol set), not plain
// functions, so the icon check accepts either shape rather than asserting
// typeof 'function'.
// Depends on: vitest, src/app/tabs.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { TABS } from '../../src/app/tabs';

describe('TABS', () => {
  it('has exactly five entries', () => {
    expect(TABS).toHaveLength(5);
  });

  it('has unique ids', () => {
    const ids = TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the root path as the first entry', () => {
    expect(TABS[0]?.path).toBe('/');
  });

  it('has every other path starting with /', () => {
    for (const tab of TABS.slice(1)) {
      expect(tab.path.startsWith('/')).toBe(true);
    }
  });

  it('has exactly the five expected labels, in order', () => {
    const labels = TABS.map((tab) => tab.label);
    expect(labels).toEqual(['Journey', 'Learn', 'Practice', 'My Car', 'Me']);
  });

  it('has a renderable icon for every tab', () => {
    for (const tab of TABS) {
      const icon: unknown = tab.icon;
      const isRenderable =
        typeof icon === 'function' ||
        (typeof icon === 'object' && icon !== null && '$$typeof' in icon);
      expect(isRenderable).toBe(true);
    }
  });
});
