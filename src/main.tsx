// Application entry point: mounts <App /> into the #root element in StrictMode.
// Depends on: react, react-dom/client, ./app/App, ./app/theme.css.
// Depended on by: index.html (loaded as the root ES module script).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './app/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
