/* Anagrams: every word you can make from 6 or 7 letters. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;
  const VOWELS = 'AAEEEIIOOU', CONSONANTS = 'BCDDFGHLLMNNPRRSSSTTTWY';

  function mount(root) {
    const st = Object.assign({ count: 6, letters: [], used: [], usedKey: '' }, GP.store.get('anagrams', {}));
    const save = () => GP.store.set('anagrams', st);
    let used = new Set(st.used);
    let results = [];
    let tiles;

    const tileHost = h('div', { class: 'ana-rack' });
    const preview = h('div', { class: 'ana-preview' });
    const side = h('div', { class: 'wh-side' });

    root.appendChild(h('div', { class: 'game-layout word' },
      h('section', { class: 'play-area' },
        h('div', { class: 'toolbar' }, GP.segmented([{ value: 6, label: '6 letters' }, { value: 7, label: '7 letters' }], st.count, (v) => {
          st.count = v; save(); build(); solve();
        })),
        tileHost,
        h('div', { class: 'btn-row' },
          GP.button('Type letters', { icon: 'paste', onclick: () => GP.pasteDialog(st.count, (t) => tiles.fill(t, 0)) }),
          GP.button('Random', { icon: 'shuffle', onclick: randomize }),
          GP.button('Clear', { icon: 'trash', kind: 'ghost', onclick: () => { st.letters = []; save(); build(); solve(); tiles.focusFirstEmpty(); } })),
        preview),
      h('aside', { class: 'panel' }, side)));

    function letters() {
      const a = st.letters.slice(0, st.count);
      while (a.length < st.count) a.push('');
      return a;
    }

    function build() {
      GP.clear(tileHost);
      tiles = GP.tileInputs({
        count: st.count, cols: st.count, values: letters(), className: 'ana-tiles',
        onChange: (v) => { st.letters = v; save(); solve(); },
      });
      tileHost.appendChild(tiles.el);
    }

    function solve() {
      const vals = letters();
      const key = vals.slice().sort().join('');
      if (key !== st.usedKey) { st.usedKey = key; used = new Set(); st.used = []; save(); }
      GP.clear(preview);
      if (!vals.every(Boolean)) {
        results = [];
        render(vals.filter(Boolean).length);
        return;
      }
      GP.loadWords().then(() => {
        results = GP.words.anagrams(vals.join(''));
        render();
      }, (e) => GP.toast(e.message, 'error'));
    }

    function show(item) {
      GP.clear(preview);
      GP.sound.play('pop');
      const pool = letters().map((ch) => ch.toLowerCase());
      const order = [];
      for (const ch of item.word) {
        const k = pool.findIndex((c, i) => c === ch && !order.includes(i));
        order.push(k);
      }
      // Highlight rack tiles in the order they are used.
      tiles.inputs.forEach((inp, i) => {
        const wrap = inp.parentElement;
        wrap.classList.toggle('on-path', order.includes(i));
        if (order.includes(i)) wrap.dataset.step = order.indexOf(i) + 1; else wrap.removeAttribute('data-step');
      });
      preview.appendChild(h('div', { class: 'card focus-card' },
        h('div', { class: 'spell' }, item.word.toUpperCase().split('').map((ch, i) => h('span', { class: 'spell-tile', style: { animationDelay: i * 60 + 'ms' } }, ch))),
        h('div', { class: 'focus-meta' }, GP.fmt(item.score) + ' points'),
        h('div', { class: 'btn-row' },
          GP.button(used.has(item.word) ? 'Untick' : 'Tick off', { icon: 'check', kind: 'primary', onclick: () => toggle(item.word) }))));
    }

    function toggle(word) {
      if (used.has(word)) used.delete(word); else used.add(word);
      st.used = [...used];
      save();
      render();
    }

    function render(filled) {
      GP.clear(side);
      if (filled != null) {
        side.appendChild(h('div', { class: 'card empty-card' }, h('div', { class: 'big-emoji' }, '🧩'),
          h('p', null, filled ? `${filled} of ${st.count} letters entered.` : `Type your ${st.count} letters. Words appear instantly.`)));
        return;
      }
      side.appendChild(h('div', { class: 'card grow' }, GP.wordResults({
        items: results, used, onSelect: show, onToggleUsed: toggle, emptyText: 'No words found.',
      })));
    }

    function randomize() {
      let t = '';
      const nv = st.count === 7 ? 3 : 2;
      for (let i = 0; i < st.count; i++) {
        const src = i < nv ? VOWELS : CONSONANTS;
        t += src[Math.floor(Math.random() * src.length)];
      }
      tiles.fill(t.split('').sort(() => Math.random() - 0.5).join(''), 0);
      GP.sound.play('flip');
    }

    build();
    solve();
    if (!letters().some(Boolean)) setTimeout(() => tiles.focusFirstEmpty(), 60);
    return { destroy() {} };
  }

  GP.registerGame({
    id: 'anagrams',
    name: 'Anagrams',
    tagline: 'Unscramble every word',
    category: 'word',
    color: '#12b3a6',
    help: `<p>You get 6 or 7 letters. Make as many words (3 letters or longer) as you can.
      Longer words are worth much more.</p>
      <ul><li>Type the letters; the full list appears right away, longest first.</li>
      <li>Tap a word to see which tiles to use, in order.</li>
      <li>Double-tap (or use <b>Tick off</b>) to cross off words you've already played.</li></ul>`,
    mount,
  });
})();
