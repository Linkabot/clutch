// Root layout: shows the full-screen Add to Home Screen panel in place of
// the shell (iOS Safari, not yet installed, not dismissed); otherwise
// renders the sticky header band (a three-column grid, Q1: the Back button
// and CLUTCH wordmark on the left; on tab roots only, the tab's title
// centred; an empty spacer column so the title is truly centred -- inner
// pages show no title in the band, since their own <h1> is the big title
// under it), the active tab screen (via Outlet), scroll restoration on
// navigation, and the bottom TabBar. While the current route is one of
// ./layer's full-screen game layers, the header band takes the inert
// attribute (setAttribute/removeAttribute, never the HTMLElement property:
// React 18's types have no inert prop -- the QuestionScreen.tsx 92-97
// pattern) so it and its Back button drop out of the accessibility tree and
// tab order while the layer visually covers them (M40); TabBar does the
// same for its own nav. The effect is keyed on both the layer boolean and
// showAddToHomeScreen, not the pathname alone, because the header is not in
// the DOM at all until the Add to Home Screen panel is dismissed, and a
// pathname-only effect would never re-run to attach it once it mounts.
// Depends on: react, react-router-dom, ./TabBar, ./AddToHomeScreen,
// ./platform, ./tabs (to detect tab-root routes and read the tab's title),
// ./back (A-S3: Back never leaves the app), ./layer (isFullScreenLayer, M40),
// lucide-react (back-button icon), ../ui (SignPanel), ./theme.css (design
// tokens and the .app-shell/.app-header*/.app-main classes).
// Depended on by: src/app/routes.tsx.
import { useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TabBar from './TabBar';
import AddToHomeScreen from './AddToHomeScreen';
import { readPlatform, shouldShowAddToHomeScreen } from './platform';
import { TABS } from './tabs';
import { backTarget } from './back';
import { isFullScreenLayer } from './layer';
import { SignPanel } from '../ui';

function App() {
  const [showAddToHomeScreen, setShowAddToHomeScreen] = useState(() =>
    shouldShowAddToHomeScreen(readPlatform()),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const isLayer = isFullScreenLayer(location.pathname);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    if (isLayer) header.setAttribute('inert', '');
    else header.removeAttribute('inert');
  }, [isLayer, showAddToHomeScreen]);

  if (showAddToHomeScreen) {
    return <AddToHomeScreen onDismiss={() => setShowAddToHomeScreen(false)} />;
  }

  const tab = TABS.find((t) => t.path === location.pathname);

  return (
    <div className="app-shell">
      <header ref={headerRef} className="app-header safe-top">
        <div className="app-header__start">
          {!tab && (
            <button
              type="button"
              aria-label="Back"
              className="app-header__back"
              onClick={() => {
                // A-S3: read the history index at click time (not during
                // render) so a page reload or a cold deep link — both of
                // which start a fresh history stack — is detected correctly.
                const target = backTarget(
                  location.pathname,
                  (window.history.state as { idx?: number } | null)?.idx,
                );
                // NavigateFunction has separate (-1-style) and (string-style)
                // overloads, so a `-1 | string` union value can't be passed
                // directly — branch on typeof instead.
                if (typeof target === 'number') {
                  navigate(target);
                } else {
                  navigate(target);
                }
              }}
            >
              <ChevronLeft size={26} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <SignPanel colour="blue" size="small">
            <span className="sign-label">CLUTCH</span>
          </SignPanel>
        </div>
        {tab && <h1 className="app-header__title">{tab.label}</h1>}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
      <ScrollRestoration />
    </div>
  );
}

export default App;
