/*
 * Controller shared by every turn-based game (Connect 4, Othello, Gomoku,
 * Tic Tac Toe, Mancala). It owns the move history, undo/redo, the AI
 * opponent, hints, the board editor, autosave and the side panel. Each game
 * only supplies its board renderer and a few labels.
 *
 * Two ways to use it:
 *   Helper   - you are playing someone on GamePigeon. Enter both players'
 *              moves and the app shows you the best reply.
 *   Practice - the computer plays the other side.
 */
(function () {
  'use strict';
  const GP = window.GP;
  const { h, button, segmented, toggle } = GP;

  class BoardGame {
    constructor(root, cfg) {
      this.root = root;
      this.cfg = cfg;
      this.engine = GP.engines[cfg.engine];
      this.token = 0;
      this.analysis = null;
      this.thinking = false;
      this.editing = false;
      this.editTool = cfg.editTools ? cfg.editTools[0].value : null;
      this.animate = null;
      this.load();
      this.build();
      this.onKey = this.onKey.bind(this);
      document.addEventListener('keydown', this.onKey);
      this.onResize = GP.debounce(() => this.renderBoard(), 150);
      window.addEventListener('resize', this.onResize);
      this.update();
    }

    /* ---------- persistence ---------- */
    defaultOptions() {
      const o = {};
      (this.cfg.options || []).forEach((opt) => (o[opt.key] = opt.default));
      return o;
    }
    load() {
      const saved = GP.store.get('game:' + this.cfg.id);
      if (saved && saved.v === 1 && saved.history && saved.history.length) {
        Object.assign(this, saved);
        this.options = Object.assign(this.defaultOptions(), saved.options);
        this.idx = Math.min(this.idx, this.history.length - 1);
      } else {
        this.me = 0;
        this.first = 0;
        this.mode = 'helper';
        this.autoHint = true;
        this.strength = GP.settings.strength;
        this.options = this.defaultOptions();
        this.reset(true);
      }
    }
    save() {
      GP.store.set('game:' + this.cfg.id, {
        v: 1, me: this.me, first: this.first, mode: this.mode, autoHint: this.autoHint, strength: this.strength,
        options: this.options, history: this.history, moves: this.moves, idx: this.idx, recorded: this.recorded,
        inProgress: !this.engine.result(this.state) && this.idx > 0,
        updated: Date.now(),
      });
    }
    reset(silent) {
      const s = this.engine.initial(this.initOptions(this.first));
      this.history = [s];
      this.moves = [null];
      this.idx = 0;
      this.recorded = false;
      this.editIdx = -1;
      if (!silent) {
        GP.sound.play('pop');
        this.update();
      }
    }
    initOptions(first) {
      return Object.assign({}, this.cfg.initialOptions, this.options, { first });
    }
    get state() { return this.history[this.idx]; }

    /* ---------- actions ---------- */
    play(move, byAI) {
      if (this.editing) return;
      const s = this.state;
      if (this.engine.result(s)) return;
      const legal = this.engine.legal(s);
      if (!legal.includes(move)) { GP.sound.play('error'); GP.buzz(30); return; }
      if (this.mode === 'ai' && s.turn !== this.me && !byAI) { GP.toast("It's the computer's turn"); return; }
      const next = this.engine.apply(s, move);
      this.history = this.history.slice(0, this.idx + 1).concat([next]);
      this.moves = this.moves.slice(0, this.idx + 1).concat([move]);
      this.idx++;
      this.recorded = this.recorded && this.idx > 0;
      this.animate = { move, from: s };
      if (this.cfg.onPlayed) this.cfg.onPlayed(this, move, s, next);
      else GP.sound.play('place');
      GP.buzz(8);
      this.update();
    }
    undo() {
      if (this.idx === 0) return;
      let i = this.idx - 1;
      if (this.mode === 'ai') while (i > 0 && this.history[i].turn !== this.me) i--;
      this.jump(i);
    }
    redo() {
      if (this.idx < this.history.length - 1) this.jump(this.idx + 1);
    }
    jump(i) {
      GP.ai.cancel();
      this.idx = i;
      this.animate = null;
      GP.sound.play('click');
      this.update();
    }
    hint() {
      if (this.engine.result(this.state)) return;
      this.analyze(true);
    }
    aiMove() {
      if (this.engine.result(this.state)) return;
      this.think(true);
    }
    newGame() {
      const go = () => this.reset();
      if (this.idx > 0 && !this.engine.result(this.state)) GP.confirm('Start a new game?', 'The current game will be cleared.', 'New game', go);
      else go();
    }

    /* ---------- the game loop ---------- */
    update() {
      const s = this.state;
      const res = this.engine.result(s);
      const token = ++this.token;
      this.analysis = null;
      this.thinking = false;
      if (!this.editing) this.save();
      if (res) this.finish(res);
      else if (!this.editing) {
        if (this.mode === 'ai' && s.turn !== this.me) this.think(false, token);
        else if (this.autoHint && s.turn === this.me) this.analyze(false, token);
      }
      this.render();
      this.animate = null;
    }

    think(forced, token) {
      token = token || ++this.token;
      this.thinking = true;
      this.renderStatus();
      const started = Date.now();
      GP.ai.search(this.cfg.engine, this.state, this.mode === 'ai' ? this.strength : 'normal').then((r) => {
        if (token !== this.token || !r) return;
        const wait = Math.max(0, 350 - (Date.now() - started)); // let the last move's animation finish
        setTimeout(() => { if (token === this.token) this.play(r.move, true); }, wait);
      }, () => {});
    }

    analyze(explicit, token) {
      token = token || ++this.token;
      const s = this.state;
      this.thinking = true;
      this.renderStatus();
      GP.ai.search(this.cfg.engine, s, 'normal').then((r) => {
        if (token !== this.token || !r) return;
        this.thinking = false;
        this.analysis = { side: s.turn, res: r, explicit };
        if (explicit) GP.sound.play('hint');
        this.render();
      }, () => {});
    }

    finish(res) {
      if (this.recorded) return;
      this.recorded = true;
      this.save();
      const iWon = res.winner === this.me, draw = res.winner == null;
      if (this.mode === 'ai') {
        const stats = GP.store.get('stats', {});
        const st = (stats[this.cfg.id] = stats[this.cfg.id] || { w: 0, l: 0, d: 0 });
        if (draw) st.d++; else if (iWon) st.w++; else st.l++;
        GP.store.set('stats', stats);
      }
      setTimeout(() => {
        if (draw) GP.sound.play('pop');
        else if (iWon) { GP.sound.play('win'); GP.confetti(); }
        else GP.sound.play('lose');
      }, 300);
    }

    onKey(e) {
      if (e.target.closest('input, textarea, select') || document.querySelector('.modal-back')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
      else if (mod) return;
      else if (e.key === 'ArrowLeft') this.undo();
      else if (e.key === 'ArrowRight') this.redo();
      else if (e.key === 'h') this.hint();
      else if (e.key === 'a') this.aiMove();
      else if (e.key === 'e') this.toggleEdit();
      else if (e.key === 'Escape' && this.editing) this.toggleEdit();
      else if (this.cfg.onKey) this.cfg.onKey(this, e);
    }

    /* ---------- editing ---------- */
    toggleEdit() {
      if (!this.cfg.edit) return;
      GP.ai.cancel();
      this.editing = !this.editing;
      if (this.editing) this.editIdx = -1;
      else this.recorded = !!this.engine.result(this.state) && this.recorded;
      GP.sound.play('click');
      this.update();
    }
    editCell(cell) {
      const next = this.cfg.edit(this.state, cell, this.editTool);
      if (!next) return;
      this.commitEdit(next);
      GP.sound.play('pop');
    }
    commitEdit(next) {
      if (this.editIdx !== this.idx) {
        this.history = this.history.slice(0, this.idx + 1).concat([next]);
        this.moves = this.moves.slice(0, this.idx + 1).concat(['edit']);
        this.idx++;
        this.editIdx = this.idx;
      } else this.history[this.idx] = next;
      this.recorded = false;
      this.save();
      this.render();
    }

    /* ---------- rendering ---------- */
    sideName(p) { return this.cfg.sides[p].name; }
    who(p) {
      if (p === this.me) return 'You';
      return this.mode === 'ai' ? 'Computer' : 'Opponent';
    }

    build() {
      const cfg = this.cfg;
      this.statusEl = h('div', { class: 'status' });
      this.boardEl = h('div', { class: 'board-host ' + cfg.engine });
      this.controlsEl = h('div', { class: 'controls' });
      this.panelEl = h('aside', { class: 'panel' });
      this.root.appendChild(h('div', { class: 'game-layout' },
        h('section', { class: 'play-area' }, this.statusEl, this.boardEl, this.controlsEl),
        this.panelEl));
    }

    render() {
      this.renderStatus();
      this.renderBoard();
      this.renderControls();
      this.renderPanel();
    }

    renderBoard() {
      const s = this.state;
      const res = this.engine.result(s);
      const hint = this.analysis && !res && !this.editing && (this.analysis.side === this.me || this.analysis.explicit)
        ? this.analysis.res : null;
      this.cfg.render(this.boardEl, {
        game: this,
        state: s,
        result: res,
        legal: res || this.editing ? [] : this.engine.legal(s),
        hint,
        editing: this.editing,
        canPlay: !res && !this.editing && !(this.mode === 'ai' && s.turn !== this.me),
        animate: this.animate,
        me: this.me,
        onMove: (m) => this.play(m),
        onEdit: (c) => this.editCell(c),
      });
    }

    renderStatus() {
      const s = this.state, res = this.engine.result(s), el = GP.clear(this.statusEl);
      let text, cls = '';
      if (this.editing) { text = 'Editing: tap the board to change it'; cls = 'edit'; }
      else if (res) {
        if (res.winner == null) { text = "It's a draw"; cls = 'draw'; }
        else if (res.winner === this.me) { text = this.mode === 'ai' ? 'You win!' : 'You won this one!'; cls = 'win'; }
        else { text = (this.mode === 'ai' ? 'The computer wins' : 'Your opponent wins'); cls = 'lose'; }
        if (this.cfg.resultText) text += ' ' + this.cfg.resultText(res, this);
      } else if (this.thinking && this.mode === 'ai' && s.turn !== this.me) { text = 'Computer is thinking'; cls = 'thinking'; }
      else if (s.turn === this.me) text = this.cfg.yourTurnText ? this.cfg.yourTurnText(this) : 'Your turn';
      else text = this.mode === 'ai' ? "Computer's turn" : "Opponent's turn: enter their move";
      el.className = 'status ' + cls;
      el.appendChild(this.cfg.swatch(res ? (res.winner == null ? s.turn : res.winner) : s.turn));
      el.appendChild(h('span', { class: 'status-text' }, text));
      if (this.thinking) el.appendChild(h('span', { class: 'dots' }, h('i'), h('i'), h('i')));
      if (!res && !this.editing && this.cfg.passMove != null) {
        const legal = this.engine.legal(s);
        if (legal.length === 1 && legal[0] === this.cfg.passMove && !(this.mode === 'ai' && s.turn !== this.me)) {
          el.appendChild(button('Pass', { kind: 'primary', class: 'btn-sm', onclick: () => this.play(this.cfg.passMove) }));
        }
      }
    }

    /* Everything the UI needs to present the current analysis, or null. */
    insight() {
      if (!this.analysis || this.engine.result(this.state)) return null;
      const cfg = this.cfg, r = this.analysis.res, s = this.state;
      const sc = this.analysis.side === this.me ? r.score : -r.score;
      const pct = Math.abs(sc) >= GP.DECISIVE ? (sc > 0 ? 100 : 0) : 50 + 50 * Math.tanh(sc / (cfg.evalScale || 400));
      const end = this.engine.movesToEnd && Math.abs(r.score) > GP.WIN - 1000 ? this.engine.movesToEnd(r.score) : null;
      let verdict = GP.describeScore(sc, cfg.evalUnit);
      if (end != null) verdict = (sc > 0 ? 'You win' : 'You lose') + ' in ' + GP.plural(end, 'move') + ' with best play';
      else if (Math.abs(sc) >= GP.DECISIVE) verdict = sc > 0 ? 'You are winning' : 'You are losing';
      return {
        res: r, pct, verdict,
        label: cfg.moveLabel(r.move, s),
        who: this.analysis.side === this.me ? 'you' : this.who(this.analysis.side).toLowerCase(),
        mine: this.analysis.side === this.me,
        why: cfg.explain ? cfg.explain(s, r.move, this.engine) : null,
      };
    }

    /* Compact hint bar under the board, so phones don't have to scroll to the panel. */
    renderCoach(el) {
      const ins = this.insight();
      const s = this.state;
      if (this.editing || this.engine.result(s)) return;
      if (!ins) {
        if (this.thinking && !(this.mode === 'ai' && s.turn !== this.me)) el.appendChild(h('div', { class: 'coach thinking' }, GP.icon('bulb'), h('span', null, 'Finding the best move'), h('span', { class: 'dots' }, h('i'), h('i'), h('i'))));
        return;
      }
      const canPlay = !(this.mode === 'ai' && s.turn !== this.me);
      el.appendChild(h('div', { class: 'coach' + (ins.pct >= 100 ? ' good' : ins.pct <= 0 ? ' bad' : '') },
        GP.icon('bulb'),
        h('span', { class: 'coach-text' }, h('b', null, (ins.mine ? 'Best move: ' : 'Their best: ') + ins.label),
          h('small', null, [ins.why, ins.verdict].filter(Boolean).join(' · '))),
        canPlay ? button('Play it', { kind: 'primary', class: 'btn-sm', onclick: () => this.play(ins.res.move) }) : null));
    }

    renderControls() {
      const el = GP.clear(this.controlsEl);
      if (this.editing) {
        const tools = segmented(this.cfg.editTools.map((t) => ({ value: t.value, label: t.label, swatch: t.swatch })), this.editTool, (v) => (this.editTool = v), 'seg-tools');
        const turn = segmented(this.cfg.sides.map((sd, i) => ({ value: i, label: sd.name + ' to move' })), this.state.turn, (v) => {
          this.commitEdit(Object.assign({}, this.state, { turn: v }));
        });
        el.append(
          h('div', { class: 'edit-bar' }, tools, turn),
          h('div', { class: 'btn-row' },
            button('Clear board', { icon: 'trash', kind: 'ghost', onclick: () => {
              const fresh = this.engine.initial(this.initOptions(this.state.turn));
              this.commitEdit(this.cfg.clearBoard ? this.cfg.clearBoard(fresh) : fresh);
            } }),
            button('Done', { icon: 'check', kind: 'primary', onclick: () => this.toggleEdit() })));
        return;
      }
      const over = !!this.engine.result(this.state);
      this.renderCoach(el);
      el.appendChild(h('div', { class: 'btn-row' },
        button('Undo', { icon: 'undo', onclick: () => this.undo(), disabled: this.idx === 0, title: 'Undo (Ctrl+Z)' }),
        button('Redo', { icon: 'redo', onclick: () => this.redo(), disabled: this.idx >= this.history.length - 1, title: 'Redo (Ctrl+Y)' }),
        button('Hint', { icon: 'bulb', onclick: () => this.hint(), disabled: over, title: 'Show the best move (H)' }),
        button('AI move', { icon: 'bot', onclick: () => this.aiMove(), disabled: over, title: 'Let the AI play this turn (A)' }),
        this.cfg.edit ? button('Edit', { icon: 'edit', onclick: () => this.toggleEdit(), title: 'Set up any position (E)' }) : null,
        button('New', { icon: 'refresh', kind: 'primary', onclick: () => this.newGame(), title: 'New game' })));
    }

    renderPanel() {
      const el = GP.clear(this.panelEl), cfg = this.cfg;
      const sideOpts = cfg.sides.map((sd, i) => ({ value: i, label: sd.name, swatch: sd.color }));

      // Players
      el.appendChild(h('div', { class: 'card' },
        h('h3', null, 'Players'),
        h('div', { class: 'field' }, h('label', null, 'Opponent'),
          segmented([
            { value: 'helper', label: 'Real person', title: 'You enter both players\' moves; the app coaches you' },
            { value: 'ai', label: 'Computer', title: 'Practice against the AI' },
          ], this.mode, (v) => { this.mode = v; this.update(); })),
        h('p', { class: 'hint-text' }, this.mode === 'helper'
          ? 'Playing on GamePigeon? Enter your opponent\'s moves here as they happen and follow the highlighted best move.'
          : 'Practice against the computer. Your record is saved on the home screen.'),
        h('div', { class: 'field' }, h('label', null, 'You play as'),
          segmented(sideOpts, this.me, (v) => { this.me = v; this.recorded = true; this.update(); })),
        cfg.fixedFirst ? null : h('div', { class: 'field' }, h('label', null, 'Who goes first'),
          segmented(sideOpts, this.first, (v) => {
            this.first = v;
            if (this.idx === 0) { this.reset(); } else GP.toast('Applies to the next new game');
          }))));

      // AI
      const ins = this.insight();
      const r = ins && ins.res;
      const evalText = ins
        ? 'Best for ' + ins.who + ': ' + ins.label + '  ·  ' + ins.verdict
        : this.thinking ? 'Thinking…' : 'Tap Hint to analyze';
      el.appendChild(h('div', { class: 'card' },
        h('h3', null, 'AI coach'),
        h('div', { class: 'evalbar', title: 'Who is ahead (your side on the left)' },
          h('i', { style: { width: (ins ? ins.pct : 50) + '%' } })),
        h('p', { class: 'eval-text' }, evalText, ins && ins.why ? h('span', { class: 'why' }, ' (' + ins.why + ')') : null,
          r ? h('small', null, ' Looked ' + r.depth + ' moves ahead.') : null),
        toggle('Show my best move automatically', this.autoHint, (v) => { this.autoHint = v; this.update(); }),
        this.mode === 'ai' ? h('div', { class: 'field' }, h('label', null, 'Computer strength'),
          segmented([
            { value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' }, { value: 'max', label: 'Max' },
          ], this.strength, (v) => { this.strength = v; this.save(); })) : null));

      // Game options
      if (cfg.options && cfg.options.length) {
        el.appendChild(h('div', { class: 'card' }, h('h3', null, 'Game options'),
          cfg.options.map((opt) => h('div', { class: 'field' }, h('label', null, opt.label),
            segmented(opt.choices, this.options[opt.key], (v) => {
              const apply = () => { this.options[opt.key] = v; this.reset(); };
              if (this.idx > 0 && !this.engine.result(this.state)) GP.confirm('Change ' + opt.label.toLowerCase() + '?', 'This starts a new game.', 'Start over', apply);
              else apply();
              // Redraw so the control shows the real value if the dialog is cancelled.
              if (this.idx > 0) setTimeout(() => this.renderPanel(), 0);
            })))));
      }

      // Move list
      const list = h('ol', { class: 'moves' });
      for (let i = 1; i < this.history.length; i++) {
        const prev = this.history[i - 1], m = this.moves[i];
        const label = m === 'edit' ? 'Board edited' : cfg.moveLabel(m, prev);
        list.appendChild(h('li', { class: i === this.idx ? 'on' : i > this.idx ? 'future' : '', onclick: () => this.jump(i) },
          h('span', { class: 'n' }, i), m === 'edit' ? GP.icon('edit') : cfg.swatch(prev.turn), h('span', null, label)));
      }
      el.appendChild(h('div', { class: 'card' },
        h('h3', null, 'Moves', h('button', { class: 'link', onclick: () => this.jump(0), disabled: this.idx === 0 }, 'Start')),
        this.history.length > 1 ? list : h('p', { class: 'hint-text' }, 'No moves yet. Tap the board to play.')));
      const on = list.querySelector('.on');
      if (on) list.scrollTop = on.offsetTop - list.clientHeight / 2;
    }

    destroy() {
      GP.ai.cancel();
      this.token++;
      document.removeEventListener('keydown', this.onKey);
      window.removeEventListener('resize', this.onResize);
    }
  }

  GP.BoardGame = BoardGame;

  /* "Why" text for games where a move places a piece: winning now, or blocking a win. */
  GP.explainPlacement = function (s, m, E) {
    const r = E.result(E.apply(s, m));
    if (r && r.winner === s.turn) return 'wins right now';
    try {
      const theirs = E.result(E.apply(Object.assign({}, s, { turn: 1 - s.turn }), m));
      if (theirs && theirs.winner === 1 - s.turn) return 'blocks their win';
    } catch (e) { /* the move isn't legal for them */ }
    return null;
  };

  /* Simple circular piece swatch. */
  GP.pieceSwatch = (cls) => h('i', { class: 'piece-swatch ' + cls });
})();
