/* Word Hunt: find every word on the board and show how to swipe it. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;

  const LAYOUTS = {
    '4x4': { cols: 4, mask: null, count: 16, label: '4 × 4' },
    '5x5': { cols: 5, mask: null, count: 25, label: '5 × 5' },
    donut: { cols: 5, count: 25, label: 'Donut', mask: '01110' + '11111' + '11011' + '11111' + '01110' },
    cross: { cols: 5, count: 25, label: 'Cross', mask: '11011' + '11111' + '01110' + '11111' + '11011' },
  };
  for (const k in LAYOUTS) {
    const L = LAYOUTS[k];
    L.maskArr = L.mask ? L.mask.split('').map((c) => c === '1') : null;
  }

  // Letter bag weighted roughly like English text, for the "Random" button.
  const BAG = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMWWFFGGYYPPBVKJXQZ';

  function mount(root) {
    const st = Object.assign({ layout: '4x4', letters: {}, used: [], view: 'list', maxLen: 12, autoTick: true },
      GP.store.get('wordhunt', {}));
    const save = () => GP.store.set('wordhunt', st);
    let results = [];
    let query = '';
    let selected = null;
    let focusIdx = 0;
    const ticked = []; // words ticked off in one-at-a-time view, so Back can undo them
    let used = new Set(st.used);
    let tiles;

    const boardHost = h('div', { class: 'wh-board' });
    const overlay = h('svg:svg', { class: 'wh-path', 'aria-hidden': 'true' });
    const side = h('div', { class: 'wh-side' });
    const focusHost = h('div', { class: 'focus-host' });
    const quickHost = h('div', { class: 'quick-host' });

    const layoutSeg = GP.segmented(Object.keys(LAYOUTS).map((k) => ({ value: k, label: LAYOUTS[k].label })), st.layout, (v) => {
      st.layout = v;
      selected = null;
      save();
      buildBoard();
      solve();
    });

    root.appendChild(h('div', { class: 'game-layout word' },
      h('section', { class: 'play-area' },
        h('div', { class: 'toolbar' }, layoutSeg, GP.roundTimer('wordhunt')),
        h('div', { class: 'wh-stage' }, boardHost, overlay),
        quickHost,
        focusHost,
        h('div', { class: 'btn-row' },
          GP.button('Screenshot', { icon: 'upload', title: 'Read the letters from a screenshot', onclick: () => {
            const L = LAYOUTS[st.layout];
            GP.lettersFromScreenshot({ rows: L.count / L.cols, cols: L.cols, mask: L.maskArr, key: 'wordhunt-' + st.layout, done: (letters) => tiles.setAll(letters) });
          } }),
          GP.button('Type letters', { icon: 'paste', onclick: () => GP.pasteDialog(LAYOUTS[st.layout].count, (t) => tiles.fill(t, 0)) }),
          GP.button('Random', { icon: 'shuffle', onclick: randomize, title: 'Fill with random letters to practice' }),
          GP.button('Clear', { icon: 'trash', kind: 'ghost', onclick: clearBoard }))),
      h('aside', { class: 'panel' }, side)));

    function letters() {
      const L = LAYOUTS[st.layout];
      const arr = (st.letters[st.layout] || []).slice(0, L.count);
      while (arr.length < L.count) arr.push('');
      return arr;
    }

    function buildBoard() {
      const L = LAYOUTS[st.layout];
      GP.clear(boardHost);
      tiles = GP.tileInputs({
        count: L.count, cols: L.cols, mask: L.maskArr, values: letters(),
        className: 'wh-tiles size' + L.cols,
        onChange: (vals) => {
          st.letters[st.layout] = vals;
          save();
          solveSoon();
        },
      });
      boardHost.appendChild(tiles.el);
      GP.clear(quickHost).appendChild(GP.quickEntry(L.maskArr ? L.maskArr.filter(Boolean).length : L.count, () => tiles));
      drawPath();
    }

    function boardKey() { return st.layout + ':' + letters().join(''); }

    const solveSoon = GP.debounce(() => solve(), 120);
    function solve() {
      const L = LAYOUTS[st.layout];
      const vals = letters();
      const filled = vals.every((ch, i) => (L.maskArr && !L.maskArr[i]) || ch);
      if (st.usedKey !== boardKey()) { used = new Set(); st.usedKey = boardKey(); st.used = []; save(); }
      if (!filled) {
        results = [];
        selected = null;
        renderSide(vals.filter(Boolean).length);
        drawPath();
        return;
      }
      if (!GP.words.ready()) { GP.clear(side); side.appendChild(GP.loadingCard()); }
      GP.loadWords().then(() => {
        const cells = vals.map((ch, i) => ((L.maskArr && !L.maskArr[i]) ? null : ch));
        results = GP.words.wordHunt(cells, L.cols, st.maxLen);
        focusIdx = 0;
        if (selected && !results.find((x) => x.word === selected.word)) selected = null;
        renderSide();
        drawPath();
      }, (e) => GP.toast(e.message, 'error'));
    }

    function toggleUsed(word) {
      if (used.has(word)) used.delete(word); else used.add(word);
      st.used = [...used];
      save();
      renderSide();
    }

    function select(item) {
      selected = item;
      GP.sound.play('pop');
      drawPath();
      renderFocus();
      GP.showOnPhone(GP.$('.wh-stage', root));
    }

    function renderSide(filledCount) {
      GP.clear(side);
      const L = LAYOUTS[st.layout];
      side.appendChild(h('div', { class: 'card' },
        h('h3', null, 'View'),
        GP.segmented([{ value: 'list', label: 'All words', icon: 'list' }, { value: 'focus', label: 'One at a time', icon: 'play' }], st.view, (v) => {
          st.view = v; save(); renderSide(); renderFocus();
        }),
        h('div', { class: 'field' }, h('label', null, 'Longest word'),
          GP.segmented([6, 8, 10, 12].map((n) => ({ value: n, label: n === 12 ? 'Any' : String(n) })), st.maxLen, (v) => { st.maxLen = v; save(); solve(); })),
        h('div', { class: 'field' }, h('label', null, 'Order in one-at-a-time view'),
          GP.segmented([{ value: 'score', label: 'Most points first' }, { value: 'route', label: 'Smooth route' }], st.order || 'score', (v) => { st.order = v; save(); renderFocus(); })),
        GP.toggle('Tick words off as I go', st.autoTick, (v) => { st.autoTick = v; save(); }, 'In one-at-a-time view')));

      if (filledCount != null) {
        const total = L.maskArr ? L.maskArr.filter(Boolean).length : L.count;
        side.appendChild(h('div', { class: 'card empty-card' },
          h('div', { class: 'big-emoji' }, '🔤'),
          h('p', null, filledCount ? `Keep going: ${filledCount} of ${total} letters entered.` : 'Type the letters from your board. The words appear as soon as every tile is filled.')));
        renderFocus();
        return;
      }
      if (st.view === 'list') {
        side.appendChild(h('div', { class: 'card grow' }, GP.wordResults({
          items: results, used, selected: selected && selected.word,
          onSelect: select, onToggleUsed: toggleUsed,
          query, onQuery: (q) => (query = q),
          emptyText: 'No words found on this board.',
        })));
      }
      renderFocus();
    }

    /*
     * "Smooth route": after each word, prefer a high-value word that starts
     * near where your finger just stopped, so you spend less time moving.
     */
    let routeCache = null;
    function ordered() {
      if ((st.order || 'score') !== 'route') return results;
      if (routeCache && routeCache.src === results) return routeCache.list;
      const L = LAYOUTS[st.layout];
      const pos = (i) => [Math.floor(i / L.cols), i % L.cols];
      const left = results.slice(0, 120), out = [];
      let at = null;
      while (left.length) {
        let bi = 0, bv = -Infinity;
        left.forEach((x, k) => {
          const [r, c] = pos(x.path[0]);
          const dist = at ? Math.hypot(r - at[0], c - at[1]) : 0;
          const v = x.score / (1 + 0.35 * dist);
          if (v > bv) { bv = v; bi = k; }
        });
        const pickW = left.splice(bi, 1)[0];
        out.push(pickW);
        at = pos(pickW.path[pickW.path.length - 1]);
      }
      const list = out.concat(results.slice(120));
      routeCache = { src: results, list };
      return list;
    }

    function renderFocus() {
      GP.clear(focusHost);
      if (st.view === 'list' && selected && results.includes(selected)) {
        const w = selected.word;
        focusHost.appendChild(h('div', { class: 'card focus-card compact' },
          h('div', { class: 'focus-word' }, w.toUpperCase()),
          h('div', { class: 'focus-meta' }, GP.fmt(selected.score) + ' points · start on the green tile'),
          h('div', { class: 'btn-row' }, GP.button(used.has(w) ? 'Untick' : 'Tick off', { icon: 'check', kind: 'primary', onclick: () => toggleUsed(w) }))));
        return;
      }
      if (st.view !== 'focus' || !results.length) return;
      const queue = ordered().filter((x) => !used.has(x.word) || x === selected);
      if (!queue.length) {
        focusHost.appendChild(h('div', { class: 'card focus-card' }, h('p', null, 'All done! Every word is ticked off.'),
          GP.button('Start over', { icon: 'refresh', onclick: () => { used.clear(); st.used = []; save(); renderSide(); } })));
        return;
      }
      focusIdx = Math.max(0, Math.min(focusIdx, queue.length - 1));
      const item = queue[focusIdx];
      if (!selected || selected.word !== item.word) { selected = item; drawPath(); }
      const go = (d) => {
        if (d > 0 && st.autoTick) {
          used.add(item.word);
          ticked.push(item.word);
        } else if (d < 0 && st.autoTick && ticked.length) {
          const w = ticked.pop();
          used.delete(w);
          focusIdx = results.filter((x) => !used.has(x.word)).findIndex((x) => x.word === w);
        } else focusIdx += d;
        st.used = [...used];
        save();
        selected = null;
        renderSide();
      };
      const canGoBack = st.autoTick ? ticked.length > 0 : focusIdx > 0;
      const card = h('div', { class: 'card focus-card' },
        h('div', { class: 'focus-word' }, item.word.toUpperCase()),
        h('div', { class: 'focus-meta' }, GP.fmt(item.score) + ' points · ' + (queue.indexOf(item) + 1) + ' of ' + queue.length + ' left'),
        h('div', { class: 'btn-row' },
          GP.button('Back', { icon: 'prev', onclick: () => go(-1), disabled: !canGoBack }),
          GP.button(st.autoTick ? 'Got it, next' : 'Next', { icon: 'next', kind: 'primary', onclick: () => go(1) })),
        h('small', { class: 'swipe-tip' }, 'Swipe left for the next word'));
      GP.onSwipe(card, () => go(1), () => { if (canGoBack) go(-1); });
      focusHost.appendChild(card);
    }

    function drawPath() {
      GP.clear(overlay);
      if (!tiles) return;
      tiles.inputs.forEach((inp) => { if (inp) { inp.parentElement.classList.remove('on-path', 'start'); inp.parentElement.removeAttribute('data-step'); } });
      if (!selected) return;
      const stage = overlay.parentElement.getBoundingClientRect();
      const pts = selected.path.map((i, k) => {
        const inp = tiles.inputs[i], wrap = inp.parentElement;
        wrap.classList.add('on-path');
        if (k === 0) wrap.classList.add('start');
        wrap.dataset.step = k + 1;
        const r = inp.getBoundingClientRect();
        return [r.left - stage.left + r.width / 2, r.top - stage.top + r.height / 2];
      });
      overlay.setAttribute('viewBox', `0 0 ${stage.width} ${stage.height}`);
      const d = pts.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      overlay.appendChild(h('svg:path', { d, class: 'wh-line', pathLength: 1 }));
      overlay.appendChild(h('svg:circle', { cx: pts[0][0], cy: pts[0][1], r: 9, class: 'wh-dot start' }));
      const end = pts[pts.length - 1];
      overlay.appendChild(h('svg:circle', { cx: end[0], cy: end[1], r: 6, class: 'wh-dot end' }));
    }

    function randomize() {
      const L = LAYOUTS[st.layout];
      let text = '';
      for (let i = 0; i < L.count; i++) if (!L.maskArr || L.maskArr[i]) text += BAG[Math.floor(Math.random() * BAG.length)];
      tiles.fill(text, 0);
      GP.sound.play('flip');
    }

    function clearBoard() {
      const before = (st.letters[st.layout] || []).slice();
      if (before.some(Boolean)) GP.toast('Board cleared', null, { label: 'Undo', onclick: () => { st.letters[st.layout] = before; save(); buildBoard(); solve(); } });
      st.letters[st.layout] = [];
      selected = null;
      save();
      buildBoard();
      solve();
      tiles.focusFirstEmpty();
    }

    const onResize = GP.debounce(drawPath, 100);
    window.addEventListener('resize', onResize);
    const onKey = (e) => {
      if (st.view !== 'focus' || e.target.closest('input')) return;
      const btn = (sel) => GP.$('.focus-card ' + sel, root);
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (btn('.btn-primary')) btn('.btn-primary').click();
      } else if (e.key === 'ArrowLeft' && btn('.btn:not(.btn-primary)')) btn('.btn:not(.btn-primary)').click();
    };
    document.addEventListener('keydown', onKey);

    buildBoard();
    solve();
    if (!letters().some(Boolean)) setTimeout(() => tiles.focusFirstEmpty(), 60);

    return { destroy() { window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); } };
  }

  GP.registerGame({
    id: 'wordhunt',
    name: 'Word Hunt',
    tagline: 'Every word, and how to swipe it',
    category: 'word',
    color: '#e0a100',
    help: `<p>Connect neighboring tiles (including diagonals) to spell words. Each tile can be
      used once per word. Longer words score far more.</p>
      <ul><li>Type your board's letters. Words appear as soon as every tile is filled.</li>
      <li>Tap a word to see its path: start at the <b>green</b> tile and follow the numbers.</li>
      <li><b>One at a time</b> view walks you through the best words in order. Use Space or
      Enter for the next word.</li>
      <li>Double-tap a word in the list to tick it off.</li></ul>`,
    mount,
  });
})();
