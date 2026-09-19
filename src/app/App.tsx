// Root layout: shows the full-screen Add to Home Screen panel in place of
// the shell (iOS Safari, not yet installed, not dismissed); otherwise
// renders the sticky header band (a three-column grid, Q1: the Back button
// and CLUTCH wordmark on the left; on tab roots only, the tab's title
// centred; an empty spacer column so the title is truly centred -- inner
// pages show no title in the band, since their own <h1> is the big title
// under it), the active tab screen (via Outlet), scroll restoration on
// navigation, and the bottom TabBar.
// Depends on: react, react-router-dom, ./TabBar, ./AddToHomeScreen,
// ./platform, ./tabs (to detect tab-root routes and read the tab's title),
// ./back (A-S3: Back never leaves the app), lucide-react (back-button
// icon), ../ui (SignPanel), ./theme.css (design tokens and the
// .app-shell/.app-header*/.app-main classes).
// Depended on by: src/app/routes.tsx.
import { useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TabBar from './TabBar';
import AddToHomeScreen from './AddToHomeScreen';
import { readPlatform, shouldShowAddToHomeScreen } from './platform';
import { TABS } from './tabs';
import { backTarget } from './back';
import { SignPanel } from '../ui';

function App() {
  const [showAddToHomeScreen, setShowAddToHomeScreen] = useState(() =>
    shouldShowAddToHomeScreen(readPlatform()),
  );
  const location = useLocation();
  const navigate = useNavigate();

  if (showAddToHomeScreen) {
    return <AddToHomeScreen onDismiss={() => setShowAddToHomeScreen(false)} />;
  }

  const tab = TABS.find((t) => t.path === location.pathname);

  return (
    <div className="app-shell">
      <header className="app-header safe-top">
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
