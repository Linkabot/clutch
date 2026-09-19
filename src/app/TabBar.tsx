// Bottom tab bar: renders one Link per entry in TABS, fixed to the viewport
// bottom with safe-area padding and a minimum 44px tap target. Active state
// is computed from the current pathname (rather than relying on NavLink's
// own matching) so a tab can also light up for the extra route prefixes
// declared in its alsoActiveFor list (e.g. the Highway Code deep link under
// /code highlights Learn, from Step 16 onward); the active colour comes
// from the aria-current="page" attribute this sets, read by the
// .tab-bar__link[aria-current='page'] rule in theme.css.
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
    <nav aria-label="Main" className="tab-bar safe-bottom">
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.path, tab.alsoActiveFor);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            aria-current={active ? 'page' : undefined}
            className="tab-bar__link"
          >
            <Icon size={26} strokeWidth={2} aria-hidden="true" />
            <span className="tab-bar__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default TabBar;
