// Full-screen "Add to Home Screen" instructional panel, shown by App.tsx in
// place of the tab shell to iOS Safari visitors who have not installed
// Clutch and have not dismissed the panel before ("Not now" persists the
// dismissal to localStorage via platform.DISMISSED_KEY).
// Depends on: react, ./platform.
// Depended on by: src/app/App.tsx.
import { DISMISSED_KEY } from './platform';

interface AddToHomeScreenProps {
  onDismiss: () => void;
}

function AddToHomeScreen({ onDismiss }: AddToHomeScreenProps) {
  const handleNotNow = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    onDismiss();
  };

  return (
    <div
      className="safe-top safe-bottom"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      <h1>Add to Home Screen</h1>
      <ol>
        <li>Tap the Share button</li>
        <li>Tap &quot;Add to Home Screen&quot;</li>
        <li>Tap Add</li>
      </ol>
      <button type="button" onClick={handleNotNow}>
        Not now
      </button>
    </div>
  );
}

export default AddToHomeScreen;
