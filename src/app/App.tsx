// Root layout: renders the app header, the active tab screen (via Outlet),
// and the bottom TabBar.
// Depends on: react-router-dom, ./TabBar, ./theme.css (design tokens).
// Depended on by: src/app/routes.tsx.
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';

function App() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100dvh',
      }}
    >
      <header className="safe-top">
        <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>Clutch</span>
      </header>
      <main style={{ paddingBottom: 'calc(var(--tab-bar-height) + 44px)' }}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export default App;
