// Offline support: the game shell is cached so it opens fast and works with bad network.
const VERSION = 'pt-v7-1';
const SHELL = ['./', './index.html', './css/style.css', './config.js', './manifest.webmanifest',
  './js/main.js','./js/world.js','./js/sim.js','./js/meta.js','./js/chars.js','./js/scene.js','./js/net.js','./js/ads.js','./js/details.js','./js/tutorial.js','./js/controls.js','./js/store.js','./js/products.js','./audio/theme.mp3',
  './icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k!==VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/ws') || url.pathname.startsWith('/api/')) return;
  const isCdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com';
  if (url.origin !== location.origin && !isCdn) return;
  if (e.request.mode === 'navigate'){
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type==='opaque'){ const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })));
});
