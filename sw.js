// ═══════════════════════════════════════════════════════
// sw.js — NutriControl Service Worker
// Caches all app shell files for offline use.
// Data (Supabase) is always fetched fresh from the network.
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'nutricontrol-v1';

// All files that make up the app shell (update version above when any file changes)
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/db.js',
  './js/utils.js',
  './js/auth.js',
  './js/log.js',
  './js/dashboard.js',
  './js/history.js',
  './js/admin.js',
  './js/profile.js',
  './js/export.js',
  './js/ui.js',
  // CDN dependencies — cached on first use
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=DM+Serif+Display&display=swap',
];

// ── Install: cache app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      // Cache local files strictly; CDN files best-effort
      const local  = APP_SHELL.filter(u => u.startsWith('.'));
      const remote = APP_SHELL.filter(u => !u.startsWith('.'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(remote.map(u => cache.add(u)))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => { console.log('[SW] Deleting old cache:', key); return caches.delete(key); })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for Supabase, cache-first for everything else ─
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Always go to network for Supabase API calls (live data)
  if (url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for app shell & CDN assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      // Not in cache — fetch from network and cache the response
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
