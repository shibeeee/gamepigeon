/*
 * Offline support. App code is fetched fresh when online (so updates show up
 * right away) and falls back to the cache offline. The big dictionary never
 * changes, so it is served from the cache first.
 */
const CACHE = 'pigeon-pal-v3';
const FILES = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'data/words.js',
  'js/engines/common.js', 'js/engines/connect4.js', 'js/engines/othello.js', 'js/engines/gomoku.js',
  'js/engines/tictactoe.js', 'js/engines/mancala.js', 'js/engines/words.js', 'js/engines/seabattle.js',
  'js/engines/c4solver.js', 'data/c4book.js', 'js/engines/checkers.js', 'js/engines/dots.js', 'js/engines/filler.js',
  'js/engines/chess.js', 'vendor/chess/chess.js', 'js/core/imagegrid.js', 'js/core/stockfish.js',
  'js/games/chess.js', 'js/games/checkers.js', 'js/games/dots.js', 'js/games/filler.js',
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
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Big files that never change (dictionary, engines, OCR data) come from the cache first.
  const cacheFirst = url.pathname.endsWith('/data/words.js') || url.pathname.includes('/icons/') || url.pathname.includes('/vendor/');
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (cacheFirst && hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  }));
});
