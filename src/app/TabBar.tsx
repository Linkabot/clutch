// Bottom tab bar: renders one NavLink per entry in TABS, fixed to the
// viewport bottom with safe-area padding and a minimum 44px tap target.
// Depends on: react-router-dom, ./tabs.
// Depended on by: src/app/App.tsx.
import { NavLink } from 'react-router-dom';
import { TABS } from './tabs';

function TabBar() {
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
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-muted)',
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          end={tab.path === '/'}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '44px',
            color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
            textDecoration: 'none',
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default TabBar;
