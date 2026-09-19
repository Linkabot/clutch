// Requests persistent storage from the browser (M16), so the app's
// IndexedDB data (progress, settings -- src/storage/db.ts) is less likely to
// be evicted by iOS Safari's "best-effort" storage cleanup under disk
// pressure. Called once at startup from src/main.tsx; never throws -- a
// rejected or missing Storage API resolves false instead, so a persist()
// failure never blocks app startup.
// Depends on: nothing beyond the Navigator Storage API.
// Depended on by: src/main.tsx, tests/unit/persist.test.ts.
export async function requestPersistentStorage(nav: Navigator = navigator): Promise<boolean> {
  if (typeof nav.storage?.persist !== 'function') {
    return false;
  }
  try {
    return await nav.storage.persist();
  } catch {
    return false;
  }
}
