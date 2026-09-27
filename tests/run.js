/* Engine and solver tests. Run with: node tests/run.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
for (const f of ['data/words.js', 'js/engines/common.js', 'js/engines/connect4.js', 'js/engines/othello.js',
  'js/engines/gomoku.js', 'js/engines/tictactoe.js', 'js/engines/mancala.js', 'js/engines/words.js', 'js/engines/seabattle.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}
const GP = globalThis.GP;
GP.words.init(globalThis.GP_WORDS);

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e)); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }
const fast = { timeMs: 400 };

console.log('Connect 4');
const C4 = GP.engines.connect4;
function c4(moves, first) { let s = C4.initial({ first }); for (const m of moves) s = C4.apply(s, m); return s; }
test('drops to the bottom', () => { const s = c4([3]); eq(s.b[5 * 7 + 3], 0); eq(s.turn, 1); });
test('takes an immediate win', () => { const s = c4([0, 6, 1, 6, 2, 5]); eq(C4.search(s, fast).move, 3); });
test('blocks an immediate loss', () => { const s = c4([0, 6, 1, 6, 2]); eq(C4.search(s, fast).move, 3); });
test('detects a vertical win', () => { const s = c4([0, 1, 0, 1, 0, 1, 0]); eq(C4.result(s).winner, 0); });
test('full column is not legal', () => { const s = c4([0, 0, 0, 0, 0, 0]); ok(!C4.legal(s).includes(0)); });

console.log('Tic Tac Toe');
const T = GP.engines.tictactoe;
test('perfect play is a draw', () => {
  let s = T.initial();
  while (!T.result(s)) s = T.apply(s, T.search(s, { timeMs: 5000 }).move);
  eq(T.result(s).winner, null);
});
test('wins when it can', () => { let s = T.initial(); for (const m of [0, 3, 1, 4]) s = T.apply(s, m); eq(T.search(s, fast).move, 2); });

console.log('Othello');
const O = GP.engines.othello;
test('opening has 4 moves', () => eq(O.legal(O.initial()).sort((a, b) => a - b), [19, 26, 37, 44]));
test('a move flips a disc', () => { const s = O.apply(O.initial(), 19); eq(O.counts(s), [4, 1]); eq(s.turn, 1); });
test('search returns a legal move', () => { const s = O.initial(); ok(O.legal(s).includes(O.search(s, fast).move)); });
test('self-play finishes', () => {
  let s = O.initial(), n = 0;
  while (!O.result(s) && n++ < 130) s = O.apply(s, O.search(s, { timeMs: 30, maxDepth: 2 }).move);
  ok(O.result(s), 'game should end');
});

console.log('Gomoku');
const G = GP.engines.gomoku;
function gm(moves) { let s = G.initial({ size: 15 }); for (const m of moves) s = G.apply(s, m); return s; }
const at = (r, c) => r * 15 + c;
test('opens in the center', () => eq(G.search(G.initial({ size: 15 }), fast).move, at(7, 7)));
test('completes five', () => {
  const s = gm([at(7, 3), at(0, 0), at(7, 4), at(0, 2), at(7, 5), at(0, 4), at(7, 6), at(0, 6)]);
  ok([at(7, 2), at(7, 7)].includes(G.search(s, fast).move));
});
test('blocks an open four', () => {
  const s = gm([at(7, 3), at(1, 1), at(7, 4), at(1, 3), at(7, 5), at(12, 12), at(7, 6)]);
  ok([at(7, 2), at(7, 7)].includes(G.search(s, fast).move));
});
test('blocks an open three', () => {
  const s = gm([at(7, 5), at(1, 1), at(7, 6), at(12, 12), at(7, 7)]);
  ok([at(7, 4), at(7, 8), at(7, 3), at(7, 9)].includes(G.search(s, fast).move));
});
test('five is detected', () => { const s = gm([at(3, 3), 0, at(4, 4), 1, at(5, 5), 2, at(6, 6), 3, at(7, 7)]); eq(G.result(s).winner, 0); });

console.log('Mancala');
const M = GP.engines.mancala;
test('extra turn when landing in store', () => { const s = M.apply(M.initial({}), 2); eq(s.turn, 0); eq(s.pits[6], 1); });
test('capture takes the opposite pit', () => {
  const pits = [0, 0, 0, 0, 1, 0, 0, 4, 4, 4, 4, 4, 4, 0]; // pit 4 -> 5 (empty), opposite is 7
  const s = M.apply({ pits, turn: 0, mode: 'capture' }, 4);
  eq(s.pits[6], 5); eq(s.pits[7], 0); eq(s.turn, 1);
});
test('avalanche keeps sowing', () => {
  const pits = [1, 2, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0];
  const s = M.apply({ pits, turn: 0, mode: 'avalanche' }, 0); // 1 -> pit 1 (now 3), picks up 3 -> 2,3,4
  eq(s.pits.slice(0, 7), [0, 0, 1, 1, 1, 0, 0]);
});
test('game ends and sweeps', () => {
  const pits = [0, 0, 0, 0, 0, 1, 10, 1, 0, 0, 0, 0, 0, 10];
  const s = M.apply({ pits, turn: 0, mode: 'capture' }, 5);
  const r = M.result(s); ok(r); eq(r.final[6], 11); eq(r.final[13], 11);
});
test('search prefers the extra turn', () => eq(M.search(M.initial({}), fast).move, 2));

console.log('Words');
const Wd = GP.words;
test('anagrams of "listen"', () => { const w = Wd.anagrams('listen').map((x) => x.word); ok(w.includes('silent') && w.includes('tinsel') && w.includes('lens')); });
test('word hunt finds a path', () => {
  const cells = 'catsxxxxxxxxxxxx'.split('');
  const r = Wd.wordHunt(cells, 4);
  const cats = r.find((x) => x.word === 'cats');
  ok(cats); eq(cats.path, [0, 1, 2, 3]);
});
test('word hunt respects holes', () => {
  ok(!Wd.wordHunt(['c', 'a', null, 't'], 4).some((x) => x.word === 'cat'));
  ok(Wd.wordHunt(['c', 'a', 't', null], 4).some((x) => x.word === 'cat'));
});
test('word bites uses pairs', () => {
  const r = Wd.wordBites(['s'], ['ca'], ['tx']);
  const h = r.find((x) => x.word === 'cats' && x.dir === 'H');
  ok(h, 'cats horizontally'); eq(h.parts.map((p) => p.type), ['inline', 'cross', 'single']);
});

console.log('Sea Battle');
const SB = GP.seabattle;
test('center beats corner on an empty board', () => {
  const a = SB.analyze(10, new Array(100).fill(0), SB.FLEETS[10]);
  ok(a.score[44] > a.score[0]);
});
test('targets next to a hit', () => {
  const cells = new Array(100).fill(0); cells[44] = 2;
  const a = SB.analyze(10, cells, SB.FLEETS[10]);
  ok(a.best.every((i) => [34, 43, 45, 54].includes(i)), 'best ' + a.best);
});
test('blocks around sunk ships', () => {
  const cells = new Array(100).fill(0); cells[44] = 3;
  const b = SB.blockedCells(10, cells);
  ok(b[33] && b[55] && !b[66]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
