/* Mancala: Capture and Avalanche modes share one board. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;
  const E = GP.engines.mancala;

  // Stable pseudo-random pebble positions, so pebbles don't jump around on redraw.
  function pebbleSpots(slot, count, wide) {
    const out = [];
    let seed = slot * 7919 + 17;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < Math.min(count, 24); k++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.34;
      out.push([50 + Math.cos(a) * d * 100 * (wide ? 0.7 : 1), 50 + Math.sin(a) * d * 100 * (wide ? 1.1 : 1)]);
    }
    return out;
  }
  const HUES = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#22b8cf'];

  function slotEl(slot, count, isStore, opts) {
    const spots = pebbleSpots(slot, count, isStore);
    const el = h('button', {
      type: 'button',
      class: (isStore ? 'mc-store' : 'mc-pit') + (opts.cls || ''),
      'aria-label': opts.aria,
      onclick: opts.onclick,
      style: opts.delay != null ? { animationDelay: opts.delay + 'ms' } : null,
    },
    h('span', { class: 'mc-pebbles' }, spots.map(([x, y], k) => h('i', {
      style: { left: x + '%', top: y + '%', background: HUES[(slot * 3 + k) % HUES.length] },
    }))),
    h('b', { class: 'mc-count' }, count));
    return el;
  }

  function render(host, v) {
    const s = v.state, g = v.game, me = v.me, op = 1 - me;
    GP.clear(host);
    const p = v.result ? v.result.final : s.pits;
    const legal = new Set(v.legal);
    const touched = new Map();
    if (v.animate) E.trace(v.animate.from, v.animate.move).forEach((i, k) => { if (typeof i === 'number' && i >= 0 && !touched.has(i)) touched.set(i, k); });

    const pitFor = (side, k) => {
      const slot = E.pitIndex(side, k);
      const mine = side === s.turn && legal.has(k);
      const isHint = v.hint && s.turn === side && v.hint.move === k;
      return slotEl(slot, p[slot], false, {
        aria: (side === me ? 'Your' : 'Opponent') + ' pit ' + (k + 1),
        cls: (mine && v.canPlay ? ' playable' : '') + (isHint ? ' hint' : '') + (touched.has(slot) ? ' bump' : '') + (v.animate && E.pitIndex(v.animate.from.turn, v.animate.move) === slot ? ' source' : ''),
        delay: touched.has(slot) ? touched.get(slot) * 70 : null,
        onclick: v.editing ? () => v.onEdit(slot) : mine && v.canPlay ? () => v.onMove(k) : null,
      });
    };
    const store = (side) => {
      const slot = E.STORE[side];
      return slotEl(slot, p[slot], true, {
        aria: (side === me ? 'Your' : 'Opponent') + ' store',
        cls: ' side' + (side === me ? 'me' : 'op') + (touched.has(slot) ? ' bump' : ''),
        delay: touched.has(slot) ? touched.get(slot) * 70 : null,
        onclick: v.editing ? () => v.onEdit(slot) : null,
      });
    };

    const top = h('div', { class: 'mc-row top' });
    for (let k = 5; k >= 0; k--) top.appendChild(pitFor(op, k));
    const bottom = h('div', { class: 'mc-row bottom' });
    for (let k = 0; k < 6; k++) bottom.appendChild(pitFor(me, k));

    host.appendChild(h('div', { class: 'mc-wrap' },
      h('div', { class: 'mc-label' }, g.who(op) + ' (' + g.sideName(op) + ')'),
      h('div', { class: 'mc-board' + (s.turn === me ? ' my-turn' : ' op-turn') }, store(op), h('div', { class: 'mc-rows' }, top, bottom), store(me)),
      h('div', { class: 'mc-label' }, g.who(me) + ' (' + g.sideName(me) + ')')));
  }

  function makeCfg(mode) {
    return {
      id: 'mancala-' + mode,
      engine: 'mancala',
      initialOptions: { mode },
      sides: [{ name: 'Green', color: '#2fb45a' }, { name: 'Purple', color: '#9b5cff' }],
      swatch: (p) => GP.pieceSwatch('mcp' + p),
      moveLabel: (m) => 'Pit ' + (m + 1),
      evalScale: 600,
      options: [{
        key: 'pebbles', label: 'Pebbles per pit', default: 4,
        choices: [3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      }],
      render,
      onPlayed: (game, m, from, to) => GP.sound.play(from.turn === to.turn && !GP.engines.mancala.result(to) ? 'hint' : 'place'),
      yourTurnText: (game) => {
        const s = game.state;
        const prev = game.idx > 0 ? game.history[game.idx - 1] : null;
        return prev && prev.turn === s.turn && game.moves[game.idx] !== 'edit' ? 'Your turn again (landed in your store)' : 'Your turn';
      },
      resultText: (res) => '(' + Math.max(res.final[6], res.final[13]) + ' to ' + Math.min(res.final[6], res.final[13]) + ')',
      editTools: [{ value: 1, label: '+1 pebble' }, { value: -1, label: '-1 pebble' }, { value: 0, label: 'Empty' }],
      edit(s, slot, tool) {
        const pits = s.pits.slice();
        pits[slot] = tool === 0 ? 0 : Math.max(0, pits[slot] + tool);
        return Object.assign({}, s, { pits, last: null });
      },
      clearBoard: (fresh) => Object.assign({}, fresh, { pits: new Array(14).fill(0) }),
      onKey(game, e) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 6) game.play(n - 1);
      },
    };
  }

  const rules = `<p>Each player has six pits and a store (the big pit on their right). On your
    turn, pick up every pebble in one of your pits and drop them one by one counter-clockwise,
    into your own store but never your opponent's. If the last pebble lands in your store you
    go again. The game ends when one side is empty; the most pebbles in the store wins.</p>`;

  GP.registerGame({
    id: 'mancala-capture',
    name: 'Mancala Capture',
    tagline: 'Classic rules with captures',
    category: 'board',
    color: '#b5651d',
    help: rules + `<p><b>Capture:</b> if your last pebble lands in an empty pit on your side,
      you take it plus everything in the pit across from it.</p>
      <ul><li>Your side is always at the bottom. Keys <kbd>1</kbd>-<kbd>6</kbd> pick your pits from left to right.</li>
      <li>Use <b>Edit</b> to type in a game already in progress.</li></ul>`,
    mount: (root) => new GP.BoardGame(root, makeCfg('capture')),
  });

  GP.registerGame({
    id: 'mancala-avalanche',
    name: 'Mancala Avalanche',
    tagline: 'Chain reactions, huge turns',
    category: 'board',
    color: '#8e44ad',
    help: rules + `<p><b>Avalanche:</b> if your last pebble lands in a pit that already had
      pebbles, you scoop them all up and keep going. Your turn only ends in an empty pit.
      Turns can get long, so let the AI trace the chain for you.</p>
      <ul><li>Your side is always at the bottom. Keys <kbd>1</kbd>-<kbd>6</kbd> pick your pits from left to right.</li></ul>`,
    mount: (root) => new GP.BoardGame(root, makeCfg('avalanche')),
  });
})();
