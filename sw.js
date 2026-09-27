/* Offline support: serve the app from cache, refresh the cache in the background. */
const CACHE = 'pigeon-pal-v1';
const FILES = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'data/words.js',
  'js/engines/common.js', 'js/engines/connect4.js', 'js/engines/othello.js', 'js/engines/gomoku.js',
  'js/engines/tictactoe.js', 'js/engines/mancala.js', 'js/engines/words.js', 'js/engines/seabattle.js',
  'js/ai/worker.js', 'js/core/util.js', 'js/core/art.js', 'js/core/boardgame.js', 'js/core/wordui.js', 'js/core/app.js',
  'js/games/wordhunt.js', 'js/games/anagrams.js', 'js/games/wordbites.js', 'js/games/seabattle.js',
  'js/games/connect4.js', 'js/games/othello.js', 'js/games/gomoku.js', 'js/games/mancala.js', 'js/games/tictactoe.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then((cache) => cache.match(e.request, { ignoreSearch: true }).then((hit) => {
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  })));
});
