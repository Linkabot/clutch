// Root layout: shows the full-screen Add to Home Screen panel in place of
// the shell (iOS Safari, not yet installed, not dismissed); otherwise
// renders the sticky sign-panel header (a back button appears on the left
// whenever the current route is not one of the five tab roots), the active
// tab screen (via Outlet), and the bottom TabBar.
// Depends on: react, react-router-dom, ./TabBar, ./AddToHomeScreen,
// ./platform, ./tabs (to detect tab-root routes), lucide-react (back-button
// icon), ../ui (SignPanel), ./theme.css (design tokens).
// Depended on by: src/app/routes.tsx.
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TabBar from './TabBar';
import AddToHomeScreen from './AddToHomeScreen';
import { readPlatform, shouldShowAddToHomeScreen } from './platform';
import { TABS } from './tabs';
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

  const isTabRoot = TABS.some((tab) => tab.path === location.pathname);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-page)',
        color: 'var(--color-ink)',
        minHeight: '100dvh',
      }}
    >
      <header
        className="safe-top"
        style={{
          position: 'sticky',
          top: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        {!isTabRoot && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              minWidth: '44px',
              background: 'none',
              border: 'none',
              color: 'var(--color-ink)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={26} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <SignPanel colour="blue" size="small">
          <span className="sign-label">CLUTCH</span>
        </SignPanel>
      </header>
      <main
        style={{
          paddingBottom: 'calc(var(--tab-bar-height) + 44px)',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export default App;
