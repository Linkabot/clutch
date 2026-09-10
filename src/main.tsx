// Application entry point: registers the service worker, then mounts the
// router (RouterProvider) into the #root element in StrictMode.
// Depends on: react, react-dom/client, react-router-dom, ./app/routes,
// ./app/pwa, ./app/theme.css.
// Depended on by: index.html (loaded as the root ES module script).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { initPwa } from './app/pwa';
import './app/theme.css';

initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
