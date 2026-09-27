/* Tic Tac Toe */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;

  function mark(p, fresh) {
    const cls = 'ttt-mark' + (fresh ? ' draw-in' : '');
    if (p === 0) {
      return h('svg:svg', { viewBox: '0 0 100 100', class: cls + ' x' },
        h('svg:path', { d: 'M22 22 L78 78', pathLength: 1 }), h('svg:path', { d: 'M78 22 L22 78', pathLength: 1 }));
    }
    return h('svg:svg', { viewBox: '0 0 100 100', class: cls + ' o' }, h('svg:circle', { cx: 50, cy: 50, r: 29, pathLength: 1 }));
  }

  function verdict(score) {
    if (score >= GP.DECISIVE) return ['good', 'Win'];
    if (score <= -GP.DECISIVE) return ['bad', 'Lose'];
    return ['mid', 'Draw'];
  }

  function render(host, v) {
    const s = v.state;
    GP.clear(host);
    const legal = new Set(v.legal);
    const win = new Set(v.result && v.result.line ? v.result.line : []);
    const grid = h('div', { class: 'ttt' });
    for (let i = 0; i < 9; i++) {
      const p = s.b[i];
      const cell = h('button', {
        type: 'button',
        class: 'ttt-cell' + (win.has(i) ? ' win' : '') + (v.hint && v.hint.move === i ? ' hint' : '') + (v.threats && v.threats.cells.includes(i) ? ' threat' : ''),
        'aria-label': 'Square ' + (i + 1),
        onclick: v.editing ? () => v.onEdit(i) : legal.has(i) && v.canPlay ? () => v.onMove(i) : null,
      });
      if (p >= 0) cell.appendChild(mark(p, v.animate && v.animate.move === i));
      else if (v.hint && v.hint.scores && v.hint.scores[i] != null) {
        const [cls, text] = verdict(v.hint.scores[i]);
        cell.appendChild(h('span', { class: 'ttt-verdict ' + cls }, text));
      }
      grid.appendChild(cell);
    }
    host.appendChild(grid);
  }

  const cfg = {
    id: 'tictactoe',
    engine: 'tictactoe',
    sides: [{ name: 'X', color: '#ff4f93' }, { name: 'O', color: '#2f7bff' }],
    swatch: (p) => h('i', { class: 'piece-swatch tttp' + p }, p ? 'O' : 'X'),
    moveLabel: (m) => ['Top left', 'Top', 'Top right', 'Left', 'Center', 'Right', 'Bottom left', 'Bottom', 'Bottom right'][m],
    render,
    explain: GP.explainPlacement,
    threats(s, me, E) {
      const cells = [];
      for (let i = 0; i < 9; i++) {
        if (s.b[i] >= 0) continue;
        const r = E.result(E.apply(Object.assign({}, s, { turn: 1 - me }), i));
        if (r && r.winner === 1 - me) cells.push(i);
      }
      return cells.length ? { cells, text: 'They win next turn unless you block' + (cells.length > 1 ? ' (two threats!)' : '') } : null;
    },
    editTools: [
      { value: 0, label: 'X', swatch: '#ff4f93' },
      { value: 1, label: 'O', swatch: '#2f7bff' },
      { value: -1, label: 'Erase' },
    ],
    edit(s, i, tool) {
      const b = s.b.slice();
      b[i] = b[i] === tool ? -1 : tool;
      return Object.assign({}, s, { b, last: -1 });
    },
    onKey(game, e) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) game.play(n - 1);
    },
  };

  GP.registerGame({
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    tagline: 'The AI never loses',
    category: 'board',
    color: '#ff4f93',
    help: `<p>Get three of your marks in a row. The AI searches every possible game, so it
      plays perfectly: the best you can do against it is a draw.</p>
      <ul><li>With hints on, every empty square is labeled <b>Win</b>, <b>Draw</b> or
      <b>Lose</b> for you, assuming perfect play afterwards.</li>
      <li>Keys <kbd>1</kbd>-<kbd>9</kbd> pick squares, left to right, top to bottom.</li></ul>`,
    mount: (root) => new GP.BoardGame(root, cfg),
  });
})();
