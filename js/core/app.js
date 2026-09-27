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

  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    if (m < 60 * 24) return Math.round(m / 60) + 'h ago';
    return Math.round(m / 1440) + 'd ago';
  }

  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isiOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* A one-time tip on how to put the app on the home screen. */
  function installTip() {
    if (standalone() || GP.store.get('tipInstallDismissed')) return null;
    const tip = h('div', { class: 'tip' },
      h('div', { class: 'tip-icon', html: LOGO }),
      h('div', { class: 'tip-text' },
        h('b', null, 'Put Pigeon Pal on your home screen'),
        h('small', null, isiOS()
          ? 'In Safari, tap the Share button, then "Add to Home Screen". It opens full screen and works offline.'
          : 'Use your browser menu and choose "Install" or "Add to Home screen". It then works offline.')),
      GP.button('', { icon: 'close', kind: 'ghost', title: 'Dismiss', onclick: () => { GP.store.set('tipInstallDismissed', true); tip.remove(); } }));
    return tip;
  }

  function share() {
    const url = location.href.split('#')[0];
    const data = { title: 'Pigeon Pal', text: 'Solvers and a practice AI for GamePigeon games', url };
    if (navigator.share) navigator.share(data).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => GP.toast('Link copied', 'good'));
  }

  function showHome() {
    document.title = 'Pigeon Pal';
    const prefs = GP.store.get('home', { filter: 'all', favs: [] });
    const favs = new Set(prefs.favs);
    const stats = GP.store.get('stats', {});
    const recent = GP.store.get('recent', {});
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
        const seen = recent[g.id];
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
              seen ? h('span', { class: 'badge' }, ago(seen)) : null,
              st ? h('span', { class: 'badge rec', title: 'Your record against the computer' }, st.w + 'W ' + st.l + 'L' + (st.d ? ' ' + st.d + 'D' : '')) : null)),
          star));
      });
      if (!list.length) grid.appendChild(h('p', { class: 'empty' }, prefs.filter === 'fav' ? 'Tap the star on a game to add it here.' : 'No games match.'));
    }

    search.addEventListener('input', draw);
    const inProgress = GP.gameList.filter((g) => progressOf(g) === 'In progress')
      .sort((a, b) => (recent[b.id] || 0) - (recent[a.id] || 0));
    app.appendChild(h('div', { class: 'home' },
      h('header', { class: 'hero' },
        h('div', { class: 'hero-top' },
          h('div', { class: 'logo', html: LOGO }),
          h('div', { class: 'hero-actions' },
            GP.button('', { icon: 'share', kind: 'ghost', title: 'Share Pigeon Pal', onclick: share }),
            themeButton(),
            GP.button('', { icon: 'gear', kind: 'ghost', title: 'Settings', onclick: openSettings }))),
        h('h1', null, 'Pigeon Pal'),
        h('p', { class: 'lead' }, 'Your coach for GamePigeon games. Enter what you see, get the best move, and practice against a smart AI.'),
        inProgress.length ? h('a', { class: 'resume', href: '#/play/' + inProgress[0].id },
          GP.icon('play'), 'Continue ' + inProgress[0].name, inProgress.length > 1 ? h('small', null, ' +' + (inProgress.length - 1) + ' more') : null) : null),
      installTip(),
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
          '. Chess by Stockfish (GPL-3.0). Not affiliated with GamePigeon.'))));
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
    const recent = GP.store.get('recent', {});
    recent[g.id] = Date.now();
    GP.store.set('recent', recent);
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
      h('h4', null, 'Accessibility'),
      h('div', { class: 'field' }, h('label', null, 'Text size'),
        GP.segmented([{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'xl', label: 'Extra large' }],
          S.textSize, (v) => GP.setSetting('textSize', v))),
      GP.toggle('High contrast', S.contrast, (v) => GP.setSetting('contrast', v), 'Stronger outlines and colors on boards and buttons'),
      GP.button('Show the welcome tour again', { icon: 'help', kind: 'ghost', class: 'btn-sm', onclick: () => tour(true) }),
      h('h4', null, 'Sound and feel'),
      GP.toggle('Sound effects', S.sound, (v) => GP.setSetting('sound', v)),
      GP.toggle('Vibration', S.haptics, (v) => GP.setSetting('haptics', v), 'On phones that support it'),
      h('h4', null, 'Computer opponent'),
      h('div', { class: 'field' }, h('label', null, 'Default strength for new games'),
        GP.segmented([{ value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }, { value: 'max', label: 'Max' }],
          S.strength, (v) => GP.setSetting('strength', v))),
      h('h4', null, 'Word games'),
      h('div', { class: 'field' }, h('label', null, 'Round timer length'),
        GP.segmented([60, 80, 90, 120].map((n) => ({ value: n, label: n + 's' })), GP.store.get('roundLen', 80), (v) => GP.store.set('roundLen', v))),
      h('h4', null, 'Your records'),
      recordsTable(),
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

  function recordsTable() {
    const stats = GP.store.get('stats', {});
    const rows = GP.gameList.filter((g) => stats[g.id]);
    if (!rows.length) return h('p', { class: 'hint-text' }, 'Play against the computer to start a record.');
    const box = h('div', null,
      h('table', { class: 'records' },
        h('tr', null, h('th', null, 'Game'), h('th', null, 'Won'), h('th', null, 'Lost'), h('th', null, 'Draw')),
        rows.map((g) => h('tr', null, h('td', null, g.name), h('td', null, stats[g.id].w), h('td', null, stats[g.id].l), h('td', null, stats[g.id].d)))),
      GP.button('Reset records', { kind: 'ghost', icon: 'refresh', class: 'btn-sm', onclick: () => {
        GP.store.set('stats', {});
        box.replaceWith(recordsTable());
        GP.toast('Records reset', null, { label: 'Undo', onclick: () => GP.store.set('stats', stats) });
      } }));
    return box;
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

  /* First-run tour: four short cards. */
  function tour(force) {
    if (!force && GP.store.get('tourDone')) return;
    const steps = [
      { art: 'connect4', title: 'Welcome to Pigeon Pal', text: 'A coach for your GamePigeon games. Pick a game, copy the board, and get the best move.' },
      { art: 'othello', title: 'Beat a real person', text: 'Choose "Real person" and enter the move your opponent made. The bot shows your best reply. Turn on "Bot plays my moves" and you only enter theirs.' },
      { art: 'gomoku', title: 'Hints, warnings and reviews', text: 'Red squares warn you about threats. After a game, tap "Review game" to see your mistakes and the better moves.' },
      { art: 'wordhunt', title: 'Word games in seconds', text: 'Type the letters, or load a screenshot and let the app read them. Every word appears instantly, best first.' },
    ];
    let i = 0;
    const body = h('div', { class: 'tour' });
    const draw = () => {
      const st = steps[i];
      GP.clear(body).append(
        h('div', { class: 'tour-art', html: GP.art(st.art) }),
        h('h3', null, st.title),
        h('p', null, st.text),
        h('div', { class: 'tour-dots' }, steps.map((_, k) => h('i', { class: k === i ? 'on' : '' }))));
      next.querySelector('span').textContent = i === steps.length - 1 ? 'Let\'s go' : 'Next';
    };
    const m = GP.modal('Quick tour', body, [
      { label: 'Skip', kind: 'ghost', onclick: () => GP.store.set('tourDone', true) },
      { label: 'Next', kind: 'primary', keepOpen: true, onclick: () => {
        if (i < steps.length - 1) { i++; draw(); GP.sound.play('pop'); } else { GP.store.set('tourDone', true); m.close(); }
      } },
    ]);
    const next = m.el.querySelector('footer .btn-primary');
    GP.onSwipe(body, () => { if (i < steps.length - 1) { i++; draw(); } }, () => { if (i > 0) { i--; draw(); } });
    draw();
  }

  route();
  if (!location.hash.startsWith('#/play/')) setTimeout(() => tour(false), 400);

  // Fetch the dictionary in the background so word games open instantly.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  setTimeout(() => idle(() => GP.loadWords().catch(() => {})), 1200);
})();
