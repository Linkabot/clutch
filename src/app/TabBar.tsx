// Bottom tab bar: renders one Link per entry in TABS, fixed to the viewport
// bottom with safe-area padding and a minimum 44px tap target. Active state
// is computed from the current pathname (rather than relying on NavLink's
// own matching) so a tab can also light up for the extra route prefixes
// declared in its alsoActiveFor list (e.g. the Highway Code deep link under
// /code highlights Learn, from Step 16 onward).
// Depends on: react-router-dom, ./tabs.
// Depended on by: src/app/App.tsx.
import { Link, useLocation } from 'react-router-dom';
import { TABS } from './tabs';

function isTabActive(pathname: string, path: string, alsoActiveFor?: string[]): boolean {
  if (path === '/') {
    return pathname === '/';
  }
  if (pathname === path || pathname.startsWith(`${path}/`)) {
    return true;
  }
  return (alsoActiveFor ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function TabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="safe-bottom"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        backgroundColor: 'var(--color-tab-bar)',
        borderTop: '1px solid var(--color-hairline)',
      }}
    >
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.path, tab.alsoActiveFor);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              minHeight: '44px',
              minWidth: '44px',
              padding: '6px 0',
              color: active ? 'var(--color-tab-active)' : 'var(--color-tab-inactive)',
              textDecoration: 'none',
            }}
          >
            <Icon size={26} strokeWidth={2} aria-hidden="true" />
            <span
              style={{
                fontFamily: "'Overpass', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '11px',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default TabBar;
