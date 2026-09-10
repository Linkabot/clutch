// Displays the current service-worker readiness state on the Me tab, read
// from the Zustand app store (swStatus is set by src/app/pwa.ts).
// Depends on: react, ../../app/store.
// Depended on by: src/features/me/MeScreen.tsx.
import { useAppStore, type SwStatus } from '../../app/store';

const STATUS_TEXT: Record<SwStatus, string> = {
  registering: 'Preparing offline…',
  ready: 'Offline ready',
  unsupported: 'Offline not available',
  error: 'Offline not available',
};

function OfflineReady() {
  const swStatus = useAppStore((state) => state.swStatus);
  return <p data-testid="offline-status">{STATUS_TEXT[swStatus]}</p>;
}

export default OfflineReady;
