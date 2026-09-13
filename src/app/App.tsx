// Root layout: shows the full-screen Add to Home Screen panel in place of
// the shell (iOS Safari, not yet installed, not dismissed), otherwise
// renders the app header, the active tab screen (via Outlet), and the
// bottom TabBar.
// Depends on: react, react-router-dom, ./TabBar, ./AddToHomeScreen,
// ./platform, ./theme.css (design tokens).
// Depended on by: src/app/routes.tsx.
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import AddToHomeScreen from './AddToHomeScreen';
import { readPlatform, shouldShowAddToHomeScreen } from './platform';

function App() {
  const [showAddToHomeScreen, setShowAddToHomeScreen] = useState(() =>
    shouldShowAddToHomeScreen(readPlatform()),
  );

  if (showAddToHomeScreen) {
    return <AddToHomeScreen onDismiss={() => setShowAddToHomeScreen(false)} />;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-page)',
        color: 'var(--color-ink)',
        minHeight: '100dvh',
      }}
    >
      <header className="safe-top">
        <span style={{ color: 'var(--color-sign-blue)', fontWeight: 'bold' }}>Clutch</span>
      </header>
      <main style={{ paddingBottom: 'calc(var(--tab-bar-height) + 44px)' }}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export default App;
