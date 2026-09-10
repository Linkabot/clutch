// Placeholder screen for the Me tab; also hosts the offline-ready indicator.
// Depends on: ./OfflineReady.
// Depended on by: src/app/routes.tsx.
import OfflineReady from './OfflineReady';

function MeScreen() {
  return (
    <div>
      <h1>Me</h1>
      <p>Coming in a later phase.</p>
      <OfflineReady />
    </div>
  );
}

export default MeScreen;
