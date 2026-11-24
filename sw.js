/* Legt die App auf dem Gerät ab, damit sie ohne Netz startet. Bei jeder Änderung V hochzählen. */
const V = 'uebergabe-1.2.0';
const DATEIEN = ['./', 'index.html', 'app.css', 'pdf.js', 'daten.js', 'dokument.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(DATEIEN.map(d => new Request(d, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('uebergabe-') && x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(c => c.match(e.request, { ignoreSearch: true })).then(r => r || fetch(e.request)));
});
