/* Chalk service worker: offline app shell + background backup.
   Bump VERSION whenever you upload changed files; the app then offers a reload. */
const VERSION = 'chalk-1.0.0';
const SHELL = ['./', 'index.html', 'app.js', 'sync.js', 'style.css', 'vendor/chart.umd.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
importScripts('sync.js');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== 'chalk-fonts') await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // app files: from the installed version, so the app always opens offline
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      if (req.mode === 'navigate') return (await cache.match('index.html')) || fetch(req);
      return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
    })());
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open('chalk-fonts'); const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
  }
  // everything else (the Google Sheet backup) goes straight to the network
});

// Android: finish sending changes after the app is closed, as soon as there is signal
self.addEventListener('sync', (e) => {
  if (e.tag !== 'chalk-sync') return;
  e.waitUntil(withSyncLock(pushOutbox).then(async (r) => {
    for (const c of await self.clients.matchAll()) c.postMessage('synced');
    return r;
  }));
});
