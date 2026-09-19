// Application entry point: registers the service worker, requests
// persistent storage (M16, so iOS Safari is less likely to evict IndexedDB
// data under disk pressure), then mounts the router (RouterProvider) into
// the #root element in StrictMode.
// Depends on: react, react-dom/client, react-router-dom, ./app/routes,
// ./app/pwa, ./app/persist, ./app/theme.css, ./ui/primitives.css.
// Depended on by: index.html (loaded as the root ES module script).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { initPwa } from './app/pwa';
import { requestPersistentStorage } from './app/persist';
import './app/theme.css';
import './ui/primitives.css';

initPwa();
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
