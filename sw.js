/*
 * Offline support.
 *
 * - Online: app files always come fresh from the network (bypassing the
 *   browser's HTTP cache), and the copy is saved for offline use.
 * - Offline: the saved copy is used.
 * - Big files that never change (engines, OCR data, icons) come from the
 *   saved copy first.
 *
 * Every file URL carries the build id (?v=...), so one version's files are
 * never mixed with another's. A new build installs a fresh cache and deletes
 * the old ones; the page reloads itself once it takes over.
 */
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'pigeon-pal-' + BUILD;

self.addEventListener('install', (e) => {
  // Save the entry page now; everything else is saved as it's used.
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(['./', 'index.html'].map((u) => c.add(new Request(u, { cache: 'no-cache' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pigeon-pal') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const immutable = url.pathname.includes('/vendor/') || url.pathname.includes('/icons/');
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    if (immutable) {
      const hit = await cache.match(e.request);
      if (hit) return hit;
    }
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(e.request)) || (e.request.mode === 'navigate' && (await cache.match('index.html')));
      if (hit) return hit;
      throw err;
    }
  }));
});
