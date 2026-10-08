import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { capturePairingFromUrl } from './features/beacon/helperKey';

// Classroom launcher opens the site as /#helperKey=... to pair this browser with the local helper.
capturePairingFromUrl();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <><a className="skip-link" href="#main-content">Skip to main content</a><App /></>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
