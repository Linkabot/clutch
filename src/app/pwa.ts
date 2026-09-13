// Registers the service worker via vite-plugin-pwa's virtual module and
// keeps the Zustand app store's swStatus in sync with the outcome.
// Depends on: virtual:pwa-register (resolved by vite-plugin-pwa at build
// time; see the type reference in src/vite-env.d.ts), ./store.
// Depended on by: src/main.tsx.
import { registerSW } from 'virtual:pwa-register';
import { useAppStore } from './store';

/** Registers the service worker and wires its lifecycle to swStatus. */
export function initPwa(): void {
  const { setSwStatus } = useAppStore.getState();

  if (!('serviceWorker' in navigator)) {
    setSwStatus('unsupported');
    return;
  }

  registerSW({
    immediate: true,
    onOfflineReady: () => {
      setSwStatus('ready');
    },
    onRegisteredSW: (_swUrl, registration) => {
      if (registration?.active && navigator.serviceWorker.controller) {
        setSwStatus('ready');
      }
    },
    onRegisterError: () => {
      setSwStatus('error');
    },
  });
}
