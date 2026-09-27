/* Othello (called Reversi in GamePigeon) */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;
  const E = GP.engines.othello;
  const COLS = 'ABCDEFGH';

  function label(m) { return m === E.PASS ? 'Pass' : COLS[m % 8] + (Math.floor(m / 8) + 1); }

  function render(host, v) {
    const s = v.state;
    GP.clear(host);
    const legal = new Set(v.legal);
    const hint = v.hint && v.hint.move !== E.PASS ? v.hint.move : -1;
    const flipped = new Set();
    if (v.animate && v.animate.move !== E.PASS) for (const i of E.flipsFor(v.animate.from, v.animate.move)) flipped.add(i);
    const counts = E.counts(s);

    const board = h('div', { class: 'oth' });
    const preview = (i, on) => {
      for (const j of on ? E.flipsFor(s, i) : []) board.children[j].classList.add('would-flip');
      if (!on) GP.$$('.would-flip', board).forEach((el) => el.classList.remove('would-flip'));
    };
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      const canTap = v.editing || (legal.has(i) && v.canPlay);
      const cell = h('button', {
        type: 'button',
        class: 'oth-cell' + (legal.has(i) && !v.editing ? ' legal' : '') + (i === hint ? ' hint' : ''),
        'aria-label': label(i),
        onclick: canTap ? () => (v.editing ? v.onEdit(i) : v.onMove(i)) : null,
        onmouseenter: legal.has(i) && v.canPlay ? () => preview(i, true) : null,
        onmouseleave: legal.has(i) && v.canPlay ? () => preview(i, false) : null,
      });
      if (p >= 0) {
        cell.appendChild(h('i', { class: 'disc p' + p + (flipped.has(i) ? ' flip' : '') + (v.animate && i === v.animate.move ? ' pop' : '') + (i === s.last ? ' last' : '') }));
      }
      if (hint === i && v.hint.scores) cell.appendChild(h('span', { class: 'oth-flips' }, '+' + E.flipsFor(s, i).length));
      board.appendChild(cell);
    }
    const colLabels = h('div', { class: 'coords top' }, COLS.split('').map((c) => h('span', null, c)));
    const rowLabels = h('div', { class: 'coords side' }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('span', null, n)));
    const score = h('div', { class: 'oth-score' },
      h('span', { class: 'chip' }, GP.pieceSwatch('othp0'), 'Black ', h('b', null, counts[0])),
      h('span', { class: 'chip' }, GP.pieceSwatch('othp1'), 'White ', h('b', null, counts[1])));
    host.append(score, h('div', { class: 'oth-wrap' }, colLabels, rowLabels, board));
  }

  const cfg = {
    id: 'othello',
    engine: 'othello',
    sides: [{ name: 'Black', color: '#1b1b1f' }, { name: 'White', color: '#f4f4f4' }],
    swatch: (p) => GP.pieceSwatch('othp' + p),
    moveLabel: label,
    passMove: E.PASS,
    evalScale: 300,
    render,
    onPlayed: (game, m) => GP.sound.play(m === E.PASS ? 'click' : 'flip'),
    resultText: (res) => '(' + res.counts[0] + ' to ' + res.counts[1] + ')',
    editTools: [
      { value: 0, label: 'Black', swatch: '#1b1b1f' },
      { value: 1, label: 'White', swatch: '#f4f4f4' },
      { value: -1, label: 'Erase' },
    ],
    edit(s, i, tool) {
      const b = s.b.slice();
      b[i] = b[i] === tool ? -1 : tool;
      return Object.assign({}, s, { b, last: null });
    },
  };

  GP.registerGame({
    id: 'othello',
    name: 'Reversi',
    tagline: 'Outflank and flip',
    category: 'board',
    color: '#1f9d55',
    help: `<p>Place a disc so that it traps a line of your opponent's discs between it and
      another of yours. The trapped discs flip to your color. Whoever has the most discs when
      nobody can move wins. GamePigeon calls this game Reversi, but it uses Othello rules.</p>
      <ul><li>Dots show the legal moves. Hover over one to see which discs it would flip.</li>
      <li>If you have no legal move, a <b>Pass</b> button appears.</li>
      <li>Corners can never be flipped, which is why the AI loves them.</li></ul>`,
    mount: (root) => new GP.BoardGame(root, cfg),
  });
})();
