/* Pieces shared by the word games: letter tile inputs and the results list. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;

  /*
   * A grid of one-letter inputs. `mask[i]` false means a hole (no tile).
   * Typing moves forward, Backspace moves back, arrows move around and
   * pasting "abcd..." fills tiles in order.
   */
  GP.tileInputs = function (opts) {
    const { count, cols, mask, onChange } = opts;
    const values = (opts.values || []).slice();
    const el = h('div', { class: 'tiles ' + (opts.className || ''), style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    const inputs = [];
    const live = (i) => !mask || mask[i];
    const nextLive = (i, dir) => {
      for (let j = i + dir; j >= 0 && j < count; j += dir) if (live(j)) return j;
      return -1;
    };
    const emit = () => onChange(values.slice());

    for (let i = 0; i < count; i++) {
      if (!live(i)) {
        el.appendChild(h('span', { class: 'tile hole', 'aria-hidden': 'true' }));
        inputs.push(null);
        continue;
      }
      const inp = h('input', {
        class: 'tile',
        maxlength: 2,
        autocomplete: 'off',
        autocapitalize: 'characters',
        spellcheck: 'false',
        'aria-label': 'Letter ' + (i + 1),
        value: (values[i] || '').toUpperCase(),
      });
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('input', () => {
        const ch = inp.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase();
        inp.value = ch;
        values[i] = ch.toLowerCase();
        emit();
        if (ch) {
          GP.sound.play('click');
          const n = nextLive(i, 1);
          if (n >= 0) inputs[n].focus();
          else inp.blur();
        }
      });
      inp.addEventListener('keydown', (e) => {
        let to = -1;
        if (e.key === 'Backspace' && !inp.value) { to = nextLive(i, -1); if (to >= 0) { values[to] = ''; inputs[to].value = ''; emit(); } }
        else if (e.key === 'ArrowRight') to = nextLive(i, 1);
        else if (e.key === 'ArrowLeft') to = nextLive(i, -1);
        else if (e.key === 'ArrowDown') to = i + cols < count && live(i + cols) ? i + cols : -1;
        else if (e.key === 'ArrowUp') to = i - cols >= 0 && live(i - cols) ? i - cols : -1;
        else if (e.key === 'Enter') { inp.blur(); return; }
        if (to >= 0) { e.preventDefault(); inputs[to].focus(); }
      });
      inp.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^a-z]/gi, '');
        if (!text) return;
        e.preventDefault();
        fill(text, i);
      });
      // Inputs can't show ::after badges, so path numbers live on a wrapper.
      el.appendChild(h('span', { class: 'tile-wrap' }, inp));
      inputs.push(inp);
    }

    function fill(text, from) {
      let j = from || 0;
      if (!live(j)) j = nextLive(j, 1);
      for (const ch of text.toLowerCase()) {
        if (j < 0) break;
        values[j] = ch;
        inputs[j].value = ch.toUpperCase();
        j = nextLive(j, 1);
      }
      emit();
    }

    return {
      el,
      inputs,
      fill,
      focusFirstEmpty() {
        const target = inputs.find((x, k) => x && !values[k]) || inputs.find(Boolean);
        if (target) target.focus();
      },
    };
  };

  /* Asks for a string of letters and fills tiles with it. */
  GP.pasteDialog = function (count, onText) {
    const input = h('input', { class: 'text-input', placeholder: 'e.g. ' + 'SAMPLELETTERS'.slice(0, Math.min(count, 13)), autocapitalize: 'characters', spellcheck: 'false' });
    const m = GP.modal('Type or paste letters', h('div', null,
      h('p', null, 'Enter the letters in reading order: left to right, top to bottom.'),
      input), [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Fill board', kind: 'primary', onclick: () => onText(input.value.replace(/[^a-z]/gi, '')) },
    ]);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { onText(input.value.replace(/[^a-z]/gi, '')); m.close(); } });
    setTimeout(() => input.focus(), 40);
  };

  /* On phones the panel sits under the board; bring the board back into view. */
  GP.showOnPhone = (el) => {
    if (!el || window.innerWidth > 900) return;
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: GP.settings.animations ? 'smooth' : 'auto', block: 'start' });
  };

  /* Shown while the dictionary downloads (only the very first time). */
  GP.loadingCard = () => h('div', { class: 'card empty-card' }, h('div', { class: 'spinner' }), h('p', null, 'Loading the dictionary…'));

  /*
   * A small round timer (GamePigeon word rounds are 80 seconds). It keeps
   * running while the page redraws, and beeps near the end.
   */
  const timers = {};
  GP.roundTimer = function (id) {
    const t = (timers[id] = timers[id] || { end: 0, iv: null, el: null });
    const len = () => GP.store.get('roundLen', 80);
    const el = h('button', { type: 'button', class: 'round-timer', title: 'Round timer: tap to start or stop. Long rounds? Change the length in Settings.' });
    t.el = el;
    let lastSec = null;
    function draw() {
      const left = t.end ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000)) : 0;
      GP.clear(t.el);
      t.el.classList.toggle('running', !!t.end);
      t.el.classList.toggle('low', !!t.end && left <= 10);
      t.el.style.setProperty('--p', t.end ? left / len() : 1);
      t.el.append(GP.icon('play'), h('span', null, t.end ? left + 's' : len() + 's round'));
      if (t.end && left !== lastSec) {
        if (left <= 3 && left > 0) GP.sound.play('tick');
        lastSec = left;
      }
      if (t.end && left === 0) {
        stop();
        GP.sound.play('buzzer');
        GP.buzz(300);
        GP.toast("Time's up!", 'warn');
      }
    }
    function stop() { clearInterval(t.iv); t.iv = null; t.end = 0; draw(); }
    el.addEventListener('click', () => {
      if (t.end) { stop(); return; }
      t.end = Date.now() + len() * 1000;
      GP.sound.play('pop');
      clearInterval(t.iv);
      t.iv = setInterval(() => (document.contains(t.el) ? draw() : null), 250);
      draw();
    });
    draw();
    return el;
  };

  /*
   * Results list. items: [{word, score, ...}]. Words you've entered in the
   * game can be ticked off ("used"); the list remembers them.
   */
  GP.wordResults = function (opts) {
    const { items, used, onSelect, onToggleUsed } = opts;
    let selected = opts.selected || null;
    const el = h('div', { class: 'results' });
    const words = new Set(items.map((x) => x.word));
    const total = items.reduce((a, x) => a + x.score, 0);
    const remaining = items.filter((x) => !used.has(x.key || x.word)).reduce((a, x) => a + x.score, 0);
    el.appendChild(h('div', { class: 'results-summary' },
      h('div', null, h('b', null, GP.fmt(items.length)), h('small', null, items.length === 1 ? 'word' : 'words')),
      h('div', null, h('b', null, GP.fmt(total)), h('small', null, 'points possible')),
      h('div', null, h('b', null, GP.fmt(used.size ? remaining : total)), h('small', null, 'points left'))));

    // Search box: filters the list and checks any word against the dictionary.
    const search = h('input', { class: 'text-input filter', type: 'search', placeholder: 'Find or check a word', value: opts.query || '', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Find or check a word' });
    const check = h('small', { class: 'check' });
    const copy = GP.button('', { icon: 'paste', kind: 'ghost', title: 'Copy the word list', onclick: () => {
      const text = items.filter((x) => !used.has(x.key || x.word)).map((x) => x.word.toUpperCase()).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        () => GP.toast('Copied ' + GP.plural(text ? text.split('\n').length : 0, 'word'), 'good'),
        () => GP.toast('Copying is blocked in this browser', 'warn'));
    } });
    el.appendChild(h('div', { class: 'filter-row' }, h('div', { class: 'filter-wrap' }, search, check), copy));
    const applyFilter = () => {
      const q = search.value.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (opts.onQuery) opts.onQuery(q);
      GP.$$('.word-chip', el).forEach((c) => (c.hidden = !!q && !c.dataset.w.includes(q)));
      GP.$$('.word-group', el).forEach((g) => (g.hidden = !GP.$$('.word-chip', g).some((c) => !c.hidden)));
      check.className = 'check';
      if (q.length >= 3 && GP.words.ready()) {
        if (words.has(q)) { check.textContent = '✓ ' + q.toUpperCase() + ' is on this board'; check.classList.add('good'); }
        else if (GP.words.isWord(q)) { check.textContent = q.toUpperCase() + ' is a word, but you can\'t make it here'; check.classList.add('mid'); }
        else { check.textContent = '✗ ' + q.toUpperCase() + ' is not in the dictionary'; check.classList.add('bad'); }
      } else check.textContent = '';
    };
    search.addEventListener('input', applyFilter);

    const byLen = new Map();
    items.forEach((x) => {
      const n = x.word.length;
      if (!byLen.has(n)) byLen.set(n, []);
      byLen.get(n).push(x);
    });
    const list = h('div', { class: 'word-groups' });
    for (const [n, group] of byLen) {
      list.appendChild(h('div', { class: 'word-group' },
        h('h4', null, n + ' letters', h('small', null, GP.fmt(group[0].score) + ' pts each')),
        h('div', { class: 'word-chips' }, group.map((x) => {
          const key = x.key || x.word;
          const chip = h('button', {
            type: 'button',
            class: 'word-chip' + (used.has(key) ? ' used' : '') + (selected === key ? ' on' : ''),
            title: 'Tap to show, double-tap to tick off',
            onclick: () => { selected = key; GP.$$('.word-chip.on', el).forEach((c) => c.classList.remove('on')); chip.classList.add('on'); onSelect(x); },
            ondblclick: () => onToggleUsed(key),
            dataset: { w: x.word },
          }, x.word.toUpperCase(), opts.badge ? opts.badge(x) : null);
          return chip;
        }))));
    }
    if (!items.length) list.appendChild(h('p', { class: 'empty' }, opts.emptyText || 'No words yet.'));
    el.appendChild(list);
    if (search.value) applyFilter();
    return el;
  };
})();
