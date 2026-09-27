/* Anagrams: every word you can make from 6 or 7 letters. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;

  function mount(root) {
    const st = Object.assign({ count: 6, letters: [], used: [], usedKey: '' }, GP.store.get('anagrams', {}));
    const save = () => GP.store.set('anagrams', st);
    let used = new Set(st.used);
    let results = [];
    let query = '';
    let current = null; // word shown in the preview card
    let tiles;

    const tileHost = h('div', { class: 'ana-rack' });
    const quickHost = h('div', { class: 'quick-host' });
    const preview = h('div', { class: 'ana-preview' });
    const side = h('div', { class: 'wh-side' });

    root.appendChild(h('div', { class: 'game-layout word' },
      h('section', { class: 'play-area' },
        h('div', { class: 'toolbar' }, GP.segmented([{ value: 6, label: '6 letters' }, { value: 7, label: '7 letters' }], st.count, (v) => {
          st.count = v; save(); build(); solve();
        }), GP.roundTimer('anagrams')),
        tileHost,
        quickHost,
        h('div', { class: 'btn-row' },
          GP.button('Screenshot', { icon: 'upload', title: 'Read the letters from a screenshot', onclick: () => {
            GP.lettersFromScreenshot({ rows: 1, cols: st.count, key: 'anagrams-' + st.count, done: (letters) => tiles.setAll(letters) });
          } }),
          GP.button('Clear', { icon: 'trash', kind: 'ghost', onclick: () => {
            const before = st.letters.slice();
            if (before.some(Boolean)) GP.toast('Letters cleared', null, { label: 'Undo', onclick: () => { st.letters = before; save(); build(); solve(); } });
            st.letters = []; save(); build(); solve(); tiles.focusFirstEmpty();
          } })),
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
      GP.clear(quickHost).appendChild(GP.quickEntry(st.count, () => tiles));
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
      current = null;
      if (!GP.words.ready()) { GP.clear(side); side.appendChild(GP.loadingCard()); }
      GP.loadWords().then(() => {
        results = GP.words.anagrams(vals.join(''));
        render();
      }, (e) => GP.toast(e.message, 'error'));
    }

    function show(item, quiet) {
      current = item;
      GP.clear(preview);
      if (!quiet) { GP.sound.play('pop'); setTimeout(() => GP.showOnPhone(tileHost), 30); }
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
          GP.button(used.has(item.word) ? 'Undo cross-off' : 'Cross off', { icon: 'check', kind: 'primary', onclick: () => toggle(item.word) }))));
    }

    function toggle(word) {
      if (used.has(word)) used.delete(word); else used.add(word);
      st.used = [...used];
      save();
      render();
      if (current) show(current, true);
    }

    function render(filled) {
      GP.clear(side);
      if (filled != null) {
        side.appendChild(h('div', { class: 'card empty-card' },           h('p', null, filled ? `${filled} of ${st.count} letters in.` : `Type your ${st.count} letters, or use a screenshot.`)));
        return;
      }
      side.appendChild(h('div', { class: 'card grow' }, GP.wordResults({
        items: results, used, onSelect: show, onToggleUsed: toggle, emptyText: 'No words found.',
        query, onQuery: (q) => (query = q), selected: current && current.word,
      })));
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
    help: `<p>Make as many words as you can from 6 or 7 letters. Longer words score more.</p>
      <ul><li>Type the letters, or tap <b>Screenshot</b>. Every word shows up right away, longest first.</li>
      <li>Tap a word to see which tiles to use, in order.</li>
      <li>Double-tap a word, or tap <b>Cross off</b>.</li></ul>`,
    mount,
  });
})();
