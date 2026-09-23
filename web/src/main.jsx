import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import DialloPOS from './DialloPOS.jsx';
import CustomerDisplay from './CustomerDisplay.jsx';
import AdminApp from './AdminApp.jsx';
import CatalogPage from './CatalogPage.jsx';

// A second browser window opened with ?display=customer (see
// customerDisplay.js) gets the bare customer-facing cart view instead of
// the full POS — same bundle, same origin, just a different root component.
const isCustomerDisplay = new URLSearchParams(window.location.search).get('display') === 'customer';
// /admin is the platform owner's own panel (create/suspend shops) — a
// completely separate root that never mounts anything shop-scoped
// (AuthProvider, DataProvider, etc.), so it can't end up fetching a shop's
// sales/products/customers even by accident. See AdminApp.jsx.
const isAdminPanel = window.location.pathname.replace(/\/+$/, '') === '/admin';
// /catalog/:slug is a shop's public product catalog — no login at all, a
// third separate root, see CatalogPage.jsx.
const catalogMatch = window.location.pathname.match(/^\/catalog\/([^/]+)\/?$/);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {catalogMatch ? <CatalogPage slug={catalogMatch[1]} />
      : isAdminPanel ? <AdminApp />
      : isCustomerDisplay ? <CustomerDisplay />
      : <DialloPOS />}
  </React.StrictMode>
);

// Register the service worker only in production builds — in dev it would
// just fight with Vite's own module reloading.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
