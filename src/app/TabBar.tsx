// Bottom tab bar: renders one Link per entry in TABS, fixed to the viewport
// bottom with safe-area padding and a minimum 44px tap target. Active state
// is computed from the current pathname (rather than relying on NavLink's
// own matching) so a tab can also light up for the extra route prefixes
// declared in its alsoActiveFor list (e.g. the Highway Code deep link under
// /code highlights Learn, from Step 16 onward); the active colour comes
// from the aria-current="page" attribute this sets, read by the
// .tab-bar__link[aria-current='page'] rule in theme.css. While the current
// route is one of ./layer's full-screen game layers, this nav takes the
// inert attribute (setAttribute/removeAttribute, never the HTMLElement
// property -- QuestionScreen.tsx 92-97's pattern) so it drops out of the
// accessibility tree and tab order while the layer visually covers it
// (M40); App.tsx does the same for the header band on its own ref, and
// never looks this nav up in the DOM.
// Depends on: react, react-router-dom, ./tabs, ./layer (isFullScreenLayer, M40).
// Depended on by: src/app/App.tsx.
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TABS } from './tabs';
import { isFullScreenLayer } from './layer';

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
  const navRef = useRef<HTMLElement>(null);
  const isLayer = isFullScreenLayer(pathname);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    if (isLayer) nav.setAttribute('inert', '');
    else nav.removeAttribute('inert');
  }, [isLayer]);

  return (
    <nav ref={navRef} aria-label="Main" className="tab-bar safe-bottom">
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
