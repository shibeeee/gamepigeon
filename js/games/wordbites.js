/* Word Bites: combine letter pieces into words across or down. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;

  const parseSingles = (t) => t.replace(/[^a-z]/gi, '').toLowerCase().split('');
  const parsePairs = (t) => t.toLowerCase().split(/[^a-z]+/).filter((x) => x.length === 2);
  const pairWarnings = (t) => t.toLowerCase().split(/[^a-z]+/).filter((x) => x && x.length !== 2);

  /* Draws a piece as tiles. dir: 's' single, 'h' horizontal, 'v' vertical. */
  function pieceEl(letters, dir, extra) {
    return h('span', { class: 'wb-piece ' + dir + (extra ? ' ' + extra : '') }, letters.toUpperCase().split('').map((c) => h('i', null, c)));
  }

  /* Lays the chosen pieces out the way they sit on the Word Bites board. */
  function diagram(item) {
    const horiz = item.dir === 'H';
    const len = item.word.length;
    const grid = h('div', { class: 'wb-diagram ' + (horiz ? 'across' : 'down'), style: horiz
      ? { gridTemplateColumns: `repeat(${len}, 1fr)`, gridTemplateRows: 'repeat(3, 1fr)' }
      : { gridTemplateRows: `repeat(${len}, 1fr)`, gridTemplateColumns: 'repeat(3, 1fr)' } });
    let pos = 1;
    item.parts.forEach((p, k) => {
      const hue = (k * 67) % 360;
      const style = { '--piece-hue': hue };
      if (p.type === 'cross') {
        // The unused letter sticks out before (above/left) or after (below/right).
        const start = p.use === 1 ? 1 : 2;
        const place = horiz
          ? { gridColumn: `${pos}`, gridRow: `${start} / span 2` }
          : { gridRow: `${pos}`, gridColumn: `${start} / span 2` };
        grid.appendChild(h('span', { class: 'wb-piece ' + (horiz ? 'v' : 'h'), style: Object.assign(style, place) },
          p.letters.toUpperCase().split('').map((c, i) => h('i', { class: i === p.use ? 'main' : 'spare' }, c))));
        pos += 1;
      } else {
        const n = p.letters.length;
        const place = horiz ? { gridColumn: `${pos} / span ${n}`, gridRow: '2' } : { gridRow: `${pos} / span ${n}`, gridColumn: '2' };
        grid.appendChild(h('span', { class: 'wb-piece ' + (n === 1 ? 's' : horiz ? 'h' : 'v'), style: Object.assign(style, place) },
          p.letters.toUpperCase().split('').map((c) => h('i', { class: 'main' }, c))));
        pos += n;
      }
    });
    return grid;
  }

  function mount(root) {
    const st = Object.assign({ singles: '', horiz: '', vert: '', used: [], usedKey: '', dir: 'all' }, GP.store.get('wordbites', {}));
    const save = () => GP.store.set('wordbites', st);
    let used = new Set(st.used);
    let results = [];
    const side = h('div', { class: 'wh-side' });
    const piecesPreview = h('div', { class: 'wb-pieces' });
    const show = h('div', { class: 'wb-show' });

    const field = (key, label, placeholder, help) => {
      const input = h('input', { class: 'text-input mono', value: st[key], placeholder, autocapitalize: 'characters', spellcheck: 'false' });
      const warn = h('small', { class: 'warn' });
      input.addEventListener('input', () => {
        st[key] = input.value;
        save();
        const bad = key === 'singles' ? [] : pairWarnings(input.value);
        warn.textContent = bad.length ? 'Pairs need exactly 2 letters: ' + bad.join(', ').toUpperCase() : '';
        solveSoon();
      });
      return h('label', { class: 'field wb-field' }, h('span', { class: 'field-label' }, label, h('small', null, help)), input, warn);
    };

    root.appendChild(h('div', { class: 'game-layout word' },
      h('section', { class: 'play-area' },
        h('div', { class: 'card' },
          h('h3', null, 'Your pieces'),
          field('singles', 'Single letters', 'A E R T', 'One tile each'),
          field('horiz', 'Across pairs', 'TH IN', 'Two letters side by side'),
          field('vert', 'Down pairs', 'ER ST', 'Top letter first'),
          piecesPreview,
          h('div', { class: 'btn-row' }, GP.button('Clear', { icon: 'trash', kind: 'ghost', onclick: () => {
            st.singles = st.horiz = st.vert = '';
            save();
            GP.$$('.wb-field input', root).forEach((i) => (i.value = ''));
            solve();
          } }))),
        show),
      h('aside', { class: 'panel' }, side)));

    function pieces() {
      return { s: parseSingles(st.singles), hz: parsePairs(st.horiz), vt: parsePairs(st.vert) };
    }

    const solveSoon = GP.debounce(() => solve(), 250);
    function solve() {
      const p = pieces();
      GP.clear(piecesPreview);
      p.s.forEach((x) => piecesPreview.appendChild(pieceEl(x, 's')));
      p.hz.forEach((x) => piecesPreview.appendChild(pieceEl(x, 'h')));
      p.vt.forEach((x) => piecesPreview.appendChild(pieceEl(x, 'v')));
      const key = [p.s.slice().sort().join(''), p.hz.slice().sort().join(','), p.vt.slice().sort().join(',')].join('|');
      if (key !== st.usedKey) { st.usedKey = key; used = new Set(); st.used = []; save(); }
      GP.clear(show);
      const letterCount = p.s.length + p.hz.length * 2 + p.vt.length * 2;
      if (letterCount < 3) { results = []; render(true); return; }
      GP.loadWords().then(() => {
        results = GP.words.wordBites(p.s, p.hz, p.vt).map((x) => Object.assign(x, { key: x.word + ':' + x.dir }));
        render();
      }, (e) => GP.toast(e.message, 'error'));
    }

    function toggle(key) {
      if (used.has(key)) used.delete(key); else used.add(key);
      st.used = [...used];
      save();
      render();
    }

    function select(item) {
      GP.sound.play('pop');
      GP.clear(show);
      show.appendChild(h('div', { class: 'card focus-card' },
        h('div', { class: 'focus-word' }, item.word.toUpperCase()),
        h('div', { class: 'focus-meta' }, (item.dir === 'H' ? 'Across' : 'Down') + ' · ' + GP.fmt(item.score) + ' points'),
        diagram(item),
        h('div', { class: 'btn-row' }, GP.button(used.has(item.key) ? 'Untick' : 'Tick off', { icon: 'check', kind: 'primary', onclick: () => toggle(item.key) }))));
    }

    function render(empty) {
      GP.clear(side);
      if (empty) {
        side.appendChild(h('div', { class: 'card empty-card' }, h('div', { class: 'big-emoji' }, '🧱'),
          h('p', null, 'Enter the pieces on your board. Separate pairs with spaces, like "TH ER".')));
        return;
      }
      const shown = results.filter((x) => st.dir === 'all' || x.dir === st.dir);
      side.appendChild(h('div', { class: 'card' }, h('h3', null, 'Direction'),
        GP.segmented([{ value: 'all', label: 'Both' }, { value: 'H', label: 'Across' }, { value: 'V', label: 'Down' }], st.dir, (v) => { st.dir = v; save(); render(); })));
      side.appendChild(h('div', { class: 'card grow' }, GP.wordResults({
        items: shown, used, onSelect: select, onToggleUsed: toggle,
        badge: (x) => h('em', { class: 'dir ' + x.dir }, x.dir === 'H' ? '→' : '↓'),
        emptyText: 'No words found with these pieces.',
      })));
    }

    solve();
    return { destroy() {} };
  }

  GP.registerGame({
    id: 'wordbites',
    name: 'Word Bites',
    tagline: 'Snap pieces into words',
    category: 'word',
    color: '#ff8a1f',
    help: `<p>Pieces hold one or two letters. Two-letter pieces are either across (side by
      side) or down (stacked). Slide pieces together to form words across or down.</p>
      <ul><li>Enter single letters, across pairs and down pairs. Separate pairs with spaces.</li>
      <li>Tap a word to see exactly how to arrange the pieces. A pair that crosses the word
      uses only one of its letters; the faded letter sticks out.</li>
      <li>Across words can be up to 8 letters, down words up to 9.</li></ul>`,
    mount,
  });
})();
