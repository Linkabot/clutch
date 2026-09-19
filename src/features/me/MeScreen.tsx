// Me tab: heading, the offline-ready indicator, and the attribution card
// (attribution text plus the "not an official app" and OGL licence lines).
// Depends on: ./OfflineReady, ./Attribution.
// Depended on by: src/app/routes.tsx.
import OfflineReady from './OfflineReady';
import Attribution from './Attribution';

function MeScreen() {
  return (
    <div>
      <OfflineReady />
      <Attribution />
    </div>
  );
}

export default MeScreen;
