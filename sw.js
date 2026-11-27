// Shiori service worker: keeps the app working offline.
const V = 'shiori-v16';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'convert.js', 'sync.js', 'ai.js', 'voice.js', 'manifest.webmanifest',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/dotgothic16-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2', 'fonts/ibm-plex-mono-latin-ext-400-normal.woff2', 'fonts/ibm-plex-mono-latin-ext-500-normal.woff2', 'fonts/ibm-plex-mono-latin-400-italic.woff2',
  'fonts/hanken-grotesk-latin-400-normal.woff2', 'fonts/hanken-grotesk-latin-500-normal.woff2', 'fonts/hanken-grotesk-latin-600-normal.woff2', 'fonts/hanken-grotesk-latin-ext-400-normal.woff2',
  'fonts/newsreader-latin-400-normal.woff2', 'fonts/newsreader-latin-400-italic.woff2', 'fonts/newsreader-latin-500-normal.woff2', 'fonts/newsreader-latin-ext-400-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url); if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always straight from the network
  // network first for the app code (so updates arrive), cache fallback when offline
  // always revalidate with the server (cheap when nothing changed), so a new version shows up on the next reload
  const fresh = r.mode === 'navigate' ? new Request(r.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(r, { cache: 'no-cache' });
  e.respondWith(fetch(fresh).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
