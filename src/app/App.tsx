// Root application component: renders the top-level Clutch shell heading.
// Depends on: react, ./theme.css (for the design tokens referenced below).
// Depended on by: src/main.tsx.
function App() {
  return (
    <div
      className="safe-top safe-bottom"
      style={{
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100dvh',
      }}
    >
      <h1 style={{ color: 'var(--color-accent)' }}>Clutch</h1>
    </div>
  );
}

export default App;
