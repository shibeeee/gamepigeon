/* App shell: home screen, navigation, settings. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;
  const app = GP.$('#app');
  let current = null; // mounted game

  GP.applySettings();

  /* ---------- routing (#/ and #/play/<id>) ---------- */
  function route() {
    if (current && current.destroy) current.destroy();
    current = null;
    GP.clear(app);
    window.scrollTo(0, 0);
    const m = location.hash.match(/^#\/play\/([\w-]+)/);
    const game = m && GP.gameList.find((g) => g.id === m[1]);
    if (game) showGame(game);
    else showHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function progressOf(g) {
    const saved = GP.store.get('game:' + g.id);
    if (saved && saved.inProgress) return 'In progress';
    const word = GP.store.get(g.id);
    if (word && ((word.letters && Object.values(word.letters).some((x) => (Array.isArray(x) ? x.join('') : x)))
      || (word.cells && word.cells.some((v) => v)) || word.singles || word.horiz || word.vert)) return 'Saved';
    return null;
  }

  function showHome() {
    document.title = 'Pigeon Pal';
    const prefs = GP.store.get('home', { filter: 'all', favs: [] });
    const favs = new Set(prefs.favs);
    const stats = GP.store.get('stats', {});
    const grid = h('div', { class: 'cards' });
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Search games', 'aria-label': 'Search games' });

    function draw() {
      GP.clear(grid);
      const q = search.value.trim().toLowerCase();
      const list = GP.gameList
        .filter((g) => prefs.filter === 'all' || (prefs.filter === 'fav' ? favs.has(g.id) : g.category === prefs.filter))
        .filter((g) => !q || (g.name + ' ' + g.tagline).toLowerCase().includes(q))
        .sort((a, b) => (favs.has(b.id) - favs.has(a.id)));
      list.forEach((g, i) => {
        const st = stats[g.id];
        const prog = progressOf(g);
        const star = h('button', {
          type: 'button', class: 'fav' + (favs.has(g.id) ? ' on' : ''), title: favs.has(g.id) ? 'Unfavorite' : 'Favorite',
          'aria-label': 'Favorite ' + g.name,
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (favs.has(g.id)) favs.delete(g.id); else favs.add(g.id);
            prefs.favs = [...favs];
            GP.store.set('home', prefs);
            GP.sound.play('pop');
            draw();
          },
        }, GP.icon('star'));
        grid.appendChild(h('a', { class: 'game-card', href: '#/play/' + g.id, style: { '--c': g.color, animationDelay: i * 35 + 'ms' } },
          h('div', { class: 'art', html: GP.art(g.id) }),
          h('div', { class: 'card-body' },
            h('h3', null, g.name),
            h('p', null, g.tagline),
            h('div', { class: 'badges' },
              h('span', { class: 'badge kind' }, g.category === 'word' ? 'Word' : 'Board'),
              prog ? h('span', { class: 'badge prog' }, prog) : null,
              st ? h('span', { class: 'badge rec', title: 'Your record against the computer' }, st.w + 'W ' + st.l + 'L' + (st.d ? ' ' + st.d + 'D' : '')) : null)),
          star));
      });
      if (!list.length) grid.appendChild(h('p', { class: 'empty' }, prefs.filter === 'fav' ? 'Tap the star on a game to add it here.' : 'No games match.'));
    }

    search.addEventListener('input', draw);
    const inProgress = GP.gameList.filter((g) => progressOf(g) === 'In progress');
    app.appendChild(h('div', { class: 'home' },
      h('header', { class: 'hero' },
        h('div', { class: 'hero-top' },
          h('div', { class: 'logo', html: LOGO }),
          h('div', { class: 'hero-actions' },
            themeButton(),
            GP.button('', { icon: 'gear', kind: 'ghost', title: 'Settings', onclick: openSettings }))),
        h('h1', null, 'Pigeon Pal'),
        h('p', { class: 'lead' }, 'Your coach for GamePigeon games. Enter what you see, get the best move, and practice against a smart AI.'),
        inProgress.length ? h('a', { class: 'resume', href: '#/play/' + inProgress[0].id },
          GP.icon('play'), 'Continue ' + inProgress[0].name, inProgress.length > 1 ? h('small', null, ' +' + (inProgress.length - 1) + ' more') : null) : null),
      h('div', { class: 'home-tools' },
        h('div', { class: 'search-wrap' }, GP.icon('search'), search),
        GP.segmented([
          { value: 'all', label: 'All' }, { value: 'board', label: 'Board' },
          { value: 'word', label: 'Word' }, { value: 'fav', label: 'Favorites', icon: 'star' },
        ], prefs.filter, (v) => { prefs.filter = v; GP.store.set('home', prefs); draw(); })),
      grid,
      h('footer', { class: 'foot' },
        h('p', null, 'Everything saves automatically on this device. Works offline once loaded.'),
        h('p', null, 'Inspired by ', h('a', { href: 'https://github.com/k-gerner/Game-Pigeon-Solvers', target: '_blank', rel: 'noopener' }, 'Kyle Gerner\'s Game Pigeon Solvers'),
          '. Not affiliated with GamePigeon.'))));
    draw();
  }

  function themeButton() {
    const dark = () => GP.settings.theme === 'dark' || (GP.settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const b = GP.button('', { icon: dark() ? 'sun' : 'moon', kind: 'ghost', title: 'Switch theme', onclick: () => {
      GP.setSetting('theme', dark() ? 'light' : 'dark');
      b.replaceWith(themeButton());
    } });
    return b;
  }

  /* ---------- game page ---------- */
  function showGame(g) {
    document.title = g.name + ' · Pigeon Pal';
    const body = h('main', { class: 'game-body' });
    app.appendChild(h('div', { class: 'game-page', style: { '--c': g.color } },
      h('header', { class: 'topbar' },
        h('a', { class: 'btn btn-ghost btn-icon', href: '#/', title: 'All games', 'aria-label': 'All games' }, GP.icon('back')),
        h('div', { class: 'topbar-title' }, h('span', { class: 'mini-art', html: GP.art(g.id) }), h('h1', null, g.name)),
        GP.button('', { icon: 'help', kind: 'ghost', title: 'How to play (?)', onclick: () => help(g) }),
        GP.button('', { icon: 'gear', kind: 'ghost', title: 'Settings', onclick: openSettings })),
      body));
    try {
      current = g.mount(body);
    } catch (e) {
      body.appendChild(h('div', { class: 'card' }, h('p', null, 'Something went wrong loading this game: ' + e.message),
        GP.button('Reset this game', { kind: 'primary', onclick: () => { GP.store.remove('game:' + g.id); GP.store.remove(g.id); route(); } })));
      console.error(e);
    }
    const seen = GP.store.get('seenHelp', {});
    if (!seen[g.id]) {
      seen[g.id] = true;
      GP.store.set('seenHelp', seen);
      setTimeout(() => help(g), 250);
    }
  }

  function help(g) {
    GP.modal(g.name, h('div', { class: 'help' },
      h('div', { class: 'help-art', html: GP.art(g.id), style: { '--c': g.color } }),
      h('div', { html: g.help }),
      g.category === 'board' && g.id !== 'seabattle' ? h('p', { class: 'keys' }, 'Shortcuts: ',
        h('kbd', null, 'H'), ' hint, ', h('kbd', null, 'A'), ' AI move, ', h('kbd', null, 'E'), ' edit board, ',
        h('kbd', null, '←'), ' ', h('kbd', null, '→'), ' undo / redo.') : null),
    [{ label: 'Got it', kind: 'primary' }]);
  }

  /* ---------- settings ---------- */
  function openSettings() {
    const S = GP.settings;
    const accent = GP.segmented(Object.keys(GP.ACCENTS).map((k) => ({ value: k, label: '', swatch: GP.ACCENTS[k], title: k })), S.accent,
      (v) => GP.setSetting('accent', v), 'swatches');
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: importData });
    GP.modal('Settings', h('div', { class: 'settings' },
      h('h4', null, 'Look'),
      h('div', { class: 'field' }, h('label', null, 'Theme'),
        GP.segmented([{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }],
          S.theme, (v) => GP.setSetting('theme', v))),
      h('div', { class: 'field' }, h('label', null, 'Accent color'), accent),
      GP.toggle('Animations', S.animations, (v) => GP.setSetting('animations', v)),
      GP.toggle('Color-blind friendly colors', S.colorblind, (v) => GP.setSetting('colorblind', v), 'Uses blue and orange instead of red and green'),
      h('h4', null, 'Sound and feel'),
      GP.toggle('Sound effects', S.sound, (v) => GP.setSetting('sound', v)),
      GP.toggle('Vibration', S.haptics, (v) => GP.setSetting('haptics', v), 'On phones that support it'),
      h('h4', null, 'Computer opponent'),
      h('div', { class: 'field' }, h('label', null, 'Default strength for new games'),
        GP.segmented([{ value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }, { value: 'max', label: 'Max' }],
          S.strength, (v) => GP.setSetting('strength', v))),
      h('h4', null, 'Your data'),
      h('p', { class: 'hint-text' }, 'Games, settings and records are saved in this browser. Back them up to move to another device.'),
      h('div', { class: 'btn-row' },
        GP.button('Back up', { icon: 'download', onclick: exportData }),
        GP.button('Restore', { icon: 'upload', onclick: () => fileInput.click() }),
        GP.button('Erase all', { icon: 'trash', kind: 'danger', onclick: () => GP.confirm('Erase everything?', 'All saved games, records and settings will be deleted from this device.', 'Erase', () => {
          GP.store.clear();
          location.reload();
        }) })),
      fileInput),
    [{ label: 'Done', kind: 'primary', onclick: () => { if (!current) route(); } }]);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'pigeon-pal', version: 1, saved: new Date().toISOString(), data: GP.store.all() }, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'pigeon-pal-backup.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    GP.toast('Backup downloaded', 'good');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      const json = JSON.parse(text);
      if (!json || json.app !== 'pigeon-pal' || typeof json.data !== 'object') throw new Error('not a Pigeon Pal backup');
      for (const k in json.data) GP.store.set(k, json.data[k]);
      GP.toast('Backup restored', 'good');
      setTimeout(() => location.reload(), 600);
    }).catch((err) => GP.toast('Could not restore: ' + err.message, 'error'));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.target.closest('input, textarea') && !GP.$('.modal-back')) {
      const m = location.hash.match(/^#\/play\/([\w-]+)/);
      const g = m && GP.gameList.find((x) => x.id === m[1]);
      if (g) help(g);
    }
  });

  const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="#ff4f93"/></linearGradient></defs>
    <rect width="64" height="64" rx="16" fill="url(#lg)"/>
    <path d="M18 40c0-10 7-18 17-18 6 0 10 3 12 6l6-1-4 5c0 9-7 16-17 16h-9l-5 5z" fill="#fff"/>
    <circle cx="40" cy="30" r="2.6" fill="#1b1b1f"/><path d="M26 42c4 2 9 2 13-1" stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  GP.LOGO = LOGO;

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  route();
})();
