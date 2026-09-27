/*
 * Builds the Connect 4 opening book (data/c4book.js) with the exact solver.
 * Early positions take the solver a long time, so their best moves are
 * precomputed here. Covers every position the AI can meet while it plays
 * book moves, for both "AI moves first" and "AI moves second".
 *
 *   node tools/c4book.js [maxPly] [secondsPerPosition] [side]
 *
 * side: 0 = only "AI moves first", 1 = only "AI moves second", omitted = both.
 * Each side writes its own file (data/c4book-<side>.js) so two can run in
 * parallel; running it with the single argument "merge" combines them into
 * data/c4book.js. Safe to stop and restart: finished positions are kept.
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('../js/engines/c4solver.js');
const S = globalThis.GP.c4solver;
S.initTable(25);

const DATA = path.join(__dirname, '..', 'data');
const MAIN = path.join(DATA, 'c4book.js');
const onlySide = process.argv[4] != null ? +process.argv[4] : null;
const OUT = onlySide == null ? MAIN : path.join(DATA, 'c4book-' + onlySide + '.js');
const maxPly = +(process.argv[2] || 8);
const perPos = (+(process.argv[3] || 600)) * 1000;
const W = 7, H = 6;

// Key: each column bottom-up as a number with a leading 1 bit, base 36, 2 chars each.
function key(b) {
  let k = '';
  for (let c = 0; c < W; c++) {
    let v = 1;
    for (let r = H - 1; r >= 0; r--) { const x = b[r * W + c]; if (x < 0) break; v = (v << 1) | x; }
    k += v.toString(36).padStart(2, '0');
  }
  return k;
}
const mirror = (b) => { const m = b.slice(); for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) m[r * W + c] = b[r * W + (W - 1 - c)]; return m; };
function drop(b, c, t) { let r = H - 1; while (b[r * W + c] !== -1) r--; const nb = b.slice(); nb[r * W + c] = t; return nb; }

function readBook(file) {
  if (!fs.existsSync(file)) return {};
  const m = fs.readFileSync(file, 'utf8').match(/GP_C4BOOK=(\{.*\});/);
  return m ? JSON.parse(m[1]) : {};
}
const writeBook = (file, b) => fs.writeFileSync(file, '/* Connect 4 opening book: position key -> best column (exact). Built by tools/c4book.js. */\nglobalThis.GP_C4BOOK=' + JSON.stringify(b) + ';\n');

if (process.argv[2] === 'merge') {
  const all = Object.assign(readBook(MAIN), readBook(path.join(DATA, 'c4book-0.js')), readBook(path.join(DATA, 'c4book-1.js')));
  for (const k of Object.keys(all)) if (all[k] < 0) delete all[k]; // drop "unsolved" markers
  writeBook(MAIN, all);
  console.log('merged', Object.keys(all).length, 'entries');
  process.exit(0);
}

let book = Object.assign(readBook(MAIN), readBook(OUT));
const save = () => writeBook(OUT, book);

function lookup(b) {
  const k = key(b);
  if (book[k] != null) return book[k];
  const mk = key(mirror(b));
  if (book[mk] != null) return book[mk] < 0 ? book[mk] : W - 1 - book[mk];
  return null;
}

function solveInto(b, t) {
  if (lookup(b) != null) return lookup(b);
  const t0 = Date.now();
  const r = S.bestMove(b, t, perPos);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!r) { console.log('timeout', key(b), secs + 's'); book[key(b)] = -1; save(); return null; } // -1 = unsolved
  book[key(b)] = r.move;
  save();
  console.log('solved', key(b), 'move', r.move, 'value', r.value, secs + 's');
  return r.move;
}

// Breadth-first by ply so early (most valuable) positions finish first.
let frontier = [{ b: new Array(W * H).fill(-1), t: 0, aiSide: 0 }, { b: new Array(W * H).fill(-1), t: 0, aiSide: 1 }]
  .filter((n) => onlySide == null || n.aiSide === onlySide);
book[key(frontier[0].b)] = 3; // center wins for the first player (known result)
for (let ply = 0; ply <= maxPly && frontier.length; ply++) {
  const next = [], seen = new Set();
  console.log('ply', ply, 'positions', frontier.length);
  for (const n of frontier) {
    const kk = n.aiSide + key(n.b), mk = n.aiSide + key(mirror(n.b));
    if (seen.has(kk) || seen.has(mk)) continue;
    seen.add(kk);
    if (n.t === n.aiSide) {
      const m = solveInto(n.b, n.t);
      if (m == null || m < 0) continue;
      next.push({ b: drop(n.b, m, n.t), t: 1 - n.t, aiSide: n.aiSide });
    } else {
      for (let c = 0; c < W; c++) if (n.b[c] === -1) next.push({ b: drop(n.b, c, n.t), t: 1 - n.t, aiSide: n.aiSide });
    }
  }
  frontier = next;
}
save();
console.log('done', Object.keys(book).length, 'entries');
