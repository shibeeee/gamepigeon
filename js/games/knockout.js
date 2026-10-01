/* Knockout: copy where the penguins are, get the best shot for each of yours. */
(function () {
  'use strict';
  const GP = window.GP, h = GP.h;
  const K = GP.engines.knockout;
  const VIEW = 1.12; // board shows -VIEW..VIEW

  function startPens() {
    const pens = [];
    [-0.45, -0.15, 0.15, 0.45].forEach((x, i) => {
      pens.push({ id: 'm' + i, team: 0, x, y: 0.55 });
      pens.push({ id: 't' + i, team: 1, x, y: -0.55 });
    });
    return pens;
  }

  function mount(root) {
    const st = Object.assign({ ice: 1, shape: 'square', slide: 1, strength: 'normal', tool: 'move', pens: startPens() }, GP.store.get('knockout', {}));
    const save = () => GP.store.set('knockout', { ice: st.ice, shape: st.shape, slide: st.slide, strength: st.strength, tool: st.tool, pens: st.pens });
    let result = null, thinking = false, token = 0, replay = null, nextId = Date.now() % 100000;
    const statusEl = h('div', { class: 'status' });
    const boardHost = h('div', { class: 'ko-host' });
    const barHost = h('div', { class: 'coach-slot' });
    const side = h('div', { class: 'wh-side' });

    root.appendChild(h('div', { class: 'game-layout' },
      h('section', { class: 'play-area' }, statusEl, boardHost, barHost,
        h('div', { class: 'btn-row' },
          GP.button('Start over', { icon: 'refresh', onclick: resetAll }))),
      h('aside', { class: 'panel' }, side)));

    const svgPoint = (svg, e) => {
      const r = svg.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 * VIEW - VIEW, ((e.clientY - r.top) / r.height) * 2 * VIEW - VIEW];
    };

    function drawBoard() {
      GP.clear(boardHost);
      const svg = h('svg:svg', { viewBox: `${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`, class: 'ko' });
      svg.appendChild(h('svg:rect', { x: -VIEW, y: -VIEW, width: 2 * VIEW, height: 2 * VIEW, class: 'ko-water', rx: 0.08 }));
      const s = st.ice;
      svg.appendChild(st.shape === 'circle'
        ? h('svg:circle', { cx: 0, cy: 0, r: s, class: 'ko-ice' })
        : h('svg:rect', { x: -s, y: -s, width: 2 * s, height: 2 * s, rx: 0.06 * s, class: 'ko-ice' }));
      const pos = replay ? new Map(replay.frames[replay.i].map((p) => [p.id, p])) : null;
      // Planned shots
      if (result && !replay) {
        for (const p of st.pens) {
          const m = result.moves[p.id];
          if (!m) continue;
          const pw = Math.hypot(m.dx, m.dy);
          if (pw < 0.01) {
            svg.appendChild(h('svg:text', { x: p.x, y: p.y + K.RADIUS + 0.11, class: 'ko-stay' }, 'stay'));
            continue;
          }
          const len = K.RADIUS + 0.08 + pw * 0.42, ux = m.dx / pw, uy = m.dy / pw;
          const x1 = p.x + ux * K.RADIUS, y1 = p.y + uy * K.RADIUS, x2 = p.x + ux * len, y2 = p.y + uy * len;
          svg.appendChild(h('svg:line', { x1, y1, x2: x2 - ux * 0.03, y2: y2 - uy * 0.03, class: 'ko-arrow' }));
          const hx = -uy * 0.045, hy = ux * 0.045;
          svg.appendChild(h('svg:polygon', { points: `${x2},${y2} ${x2 - ux * 0.08 + hx},${y2 - uy * 0.08 + hy} ${x2 - ux * 0.08 - hx},${y2 - uy * 0.08 - hy}`, class: 'ko-head' }));
          svg.appendChild(h('svg:text', { x: x2 + ux * 0.11, y: y2 + uy * 0.11 + 0.025, class: 'ko-pow' }, Math.round(pw * 100) + '%'));
        }
      }
      // Penguins
      st.pens.forEach((p) => {
        const q = pos ? pos.get(p.id) : p;
        if (!q) return;
        const off = pos ? q.out : !K.onIce(p.x, p.y, st);
        const g = h('svg:g', { class: 'ko-pen t' + p.team + (off ? ' off' : ''), transform: `translate(${q.x} ${q.y})`, dataset: { id: p.id } });
        g.appendChild(h('svg:circle', { r: K.RADIUS, class: 'ko-body' }));
        g.appendChild(h('svg:ellipse', { cx: 0, cy: K.RADIUS * 0.22, rx: K.RADIUS * 0.55, ry: K.RADIUS * 0.5, class: 'ko-belly' }));
        g.appendChild(h('svg:circle', { cx: 0, cy: -K.RADIUS * 0.15, r: K.RADIUS * 0.17, class: 'ko-beak' }));
        svg.appendChild(g);
      });
      bindPointer(svg);
      boardHost.appendChild(svg);
    }

    function bindPointer(svg) {
      let drag = null;
      svg.addEventListener('pointerdown', (e) => {
        if (replay) return;
        const [x, y] = svgPoint(svg, e);
        const hit = st.pens.slice().reverse().find((p) => Math.hypot(p.x - x, p.y - y) < K.RADIUS * 1.6);
        if (st.tool === 'remove') {
          if (hit) { st.pens = st.pens.filter((p) => p !== hit); GP.sound.play('pop'); changed(); }
          return;
        }
        if (st.tool === 'add0' || st.tool === 'add1') {
          if (!hit && Math.abs(x) < VIEW && Math.abs(y) < VIEW) {
            st.pens.push({ id: 'n' + nextId++, team: st.tool === 'add0' ? 0 : 1, x, y });
            GP.sound.play('place');
            changed();
          }
          return;
        }
        if (!hit) return;
        e.preventDefault();
        drag = { p: hit, dx: hit.x - x, dy: hit.y - y };
        svg.setPointerCapture(e.pointerId);
        result = null;
      });
      svg.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const [x, y] = svgPoint(svg, e);
        drag.p.x = Math.max(-VIEW + 0.05, Math.min(VIEW - 0.05, x + drag.dx));
        drag.p.y = Math.max(-VIEW + 0.05, Math.min(VIEW - 0.05, y + drag.dy));
        const g = svg.querySelector(`[data-id="${drag.p.id}"]`);
        if (g) {
          g.setAttribute('transform', `translate(${drag.p.x} ${drag.p.y})`);
          g.classList.toggle('off', !K.onIce(drag.p.x, drag.p.y, st));
        }
      });
      const end = () => { if (drag) { drag = null; changed(); } };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }

    function drawStatus() {
      GP.clear(statusEl);
      const mine = st.pens.filter((p) => p.team === 0 && K.onIce(p.x, p.y, st)).length;
      const theirs = st.pens.filter((p) => p.team === 1 && K.onIce(p.x, p.y, st)).length;
      statusEl.className = 'status' + (thinking ? ' thinking' : '');
      statusEl.append(h('i', { class: 'piece-swatch kop0' }), h('span', { class: 'status-text' },
        !mine ? 'No penguins of yours on the ice' : thinking ? 'Finding your best shots' : replay ? 'Replay: if they stay still' : `You ${mine} · Them ${theirs}`));
      if (thinking) statusEl.appendChild(h('span', { class: 'think-dots' }, h('i'), h('i'), h('i')));
    }

    function drawBar() {
      GP.clear(barHost);
      if (!result || !result.expect || thinking) return;
      const e = result.expect;
      barHost.appendChild(h('div', { class: 'coach' + (e.lostTheirs > e.lostMine ? ' good' : '') }, GP.icon('target'),
        h('span', { class: 'coach-text' }, h('b', null, 'Follow the arrows'),
          h('small', null, `On average knocks off ${e.lostTheirs.toFixed(1)} of theirs, loses ${e.lostMine.toFixed(1)} of yours`)),
        GP.button(replay ? 'Stop' : 'Watch', { icon: 'play', class: 'btn-sm', title: 'See your shots play out if they stay still', onclick: toggleReplay })));
    }

    function drawSide() {
      GP.clear(side);
      const slider = (min, max, step, value, fmt, onInput) => {
        const out = h('b', { class: 'ko-val' }, fmt(value));
        const inp = h('input', { type: 'range', min, max, step, value, class: 'ko-range' });
        inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value, false); });
        inp.addEventListener('change', () => onInput(+inp.value, true));
        return h('div', { class: 'ko-slider' }, inp, out);
      };
      side.appendChild(h('div', { class: 'card' },
        h('div', { class: 'field' }, h('label', null, 'Tap the board to'),
          GP.segmented([
            { value: 'move', label: 'Move' }, { value: 'add0', label: '+ Yours', swatch: '#2f7bff' },
            { value: 'add1', label: '+ Theirs', swatch: '#f43f7a' }, { value: 'remove', label: 'Remove' },
          ], st.tool, (v) => { st.tool = v; save(); }, 'seg-fill')),
        h('p', { class: 'hint-text' }, 'Drag the penguins to where they are in your game. Remove the ones that fell off.'),
        h('div', { class: 'field' }, h('label', null, 'Ice shape'),
          GP.segmented([{ value: 'square', label: 'Square' }, { value: 'circle', label: 'Round' }], st.shape, (v) => { st.shape = v; changed(); })),
        h('div', { class: 'field' }, h('label', null, 'Ice size (it shrinks each round)'),
          slider(0.4, 1, 0.02, st.ice, (v) => Math.round(v * 100) + '%', (v, done) => { st.ice = v; result = null; drawBoard(); if (done) changed(); }))));
      side.appendChild(h('div', { class: 'card' },
        h('div', { class: 'field' }, h('label', null, 'Bot strength'),
          GP.segmented([{ value: 'easy', label: 'Fast' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Strong' }, { value: 'max', label: 'Best' }],
            st.strength, (v) => { st.strength = v; changed(); })),
        h('div', { class: 'field' }, h('label', null, 'How far a full-power shot slides'),
          slider(0.5, 2, 0.05, st.slide, (v) => v.toFixed(2).replace(/0$/, '') + '× the ice', (v, done) => { st.slide = v; if (done) changed(); })),
        h('p', { class: 'hint-text' }, 'If shots in your game go further or shorter than the replay, adjust this.')));
    }

    const solveSoon = GP.debounce(solve, 250);
    function changed() {
      result = null;
      stopReplay();
      save();
      drawBoard();
      drawStatus();
      drawBar();
      drawSide();
      solveSoon();
    }

    function solve() {
      const t = ++token;
      const state = { ice: st.ice, shape: st.shape, slide: st.slide, pens: st.pens.map((p) => ({ id: p.id, team: p.team, x: p.x, y: p.y })) };
      if (!state.pens.some((p) => p.team === 0 && K.onIce(p.x, p.y, st))) { thinking = false; drawStatus(); return; }
      thinking = true;
      drawStatus();
      drawBar();
      // Fast/Normal/Strong/Best map to more thinking time.
      const strength = st.strength === 'easy' ? 'quick' : st.strength;
      GP.ai.search('knockout', state, strength, 'analyze').then((r) => {
        if (t !== token) return;
        thinking = false;
        result = r;
        GP.sound.play('hint');
        drawBoard(); drawStatus(); drawBar();
      }, () => { if (t === token) { thinking = false; drawStatus(); } });
    }

    function toggleReplay() {
      if (replay) { stopReplay(); drawBoard(); drawStatus(); drawBar(); return; }
      const frames = [];
      K.simulate(st, st.pens.filter((p) => K.onIce(p.x, p.y, st)), result.moves, frames);
      replay = { frames, i: 0, raf: 0 };
      const step = () => {
        if (!replay) return;
        drawBoard();
        if (replay.i < replay.frames.length - 1) { replay.i++; replay.raf = requestAnimationFrame(step); }
        else replay.raf = setTimeout(() => { stopReplay(); drawBoard(); drawStatus(); drawBar(); }, 1400);
      };
      drawStatus(); drawBar();
      step();
    }
    function stopReplay() {
      if (!replay) return;
      cancelAnimationFrame(replay.raf); clearTimeout(replay.raf);
      replay = null;
    }

    function resetAll() {
      const before = { pens: st.pens.map((p) => Object.assign({}, p)), ice: st.ice };
      st.pens = startPens();
      st.ice = 1;
      changed();
      GP.toast('Board reset', null, { label: 'Undo', onclick: () => { st.pens = before.pens; st.ice = before.ice; changed(); } });
    }

    drawBoard(); drawStatus(); drawSide(); drawBar();
    solve();
    return { destroy() { token++; stopReplay(); GP.ai.cancel(); } };
  }

  GP.registerGame({
    id: 'knockout',
    name: 'Knockout',
    tagline: 'Best shots for your penguins',
    category: 'board',
    color: '#3aa0d8',
    help: `<p>Both players aim all their penguins at the same time, then everyone slides. Knock the other team off the ice and stay on yourself.</p>
      <ul><li>Drag the penguins to match your game. Blue are yours, pink are theirs. Use <b>Remove</b> for ones that fell off, and shrink the <b>Ice size</b> as the rounds go.</li>
      <li>The arrows show where to send each of your penguins. Longer arrows and higher numbers mean more power. "Stay" means don't move it.</li>
      <li>Nobody can know what the other player will do, so the bot tries your shots against lots of likely moves and picks what works best on average. Tap <b>Watch</b> to see your shots play out.</li>
      <li>GamePigeon's exact physics aren't public, so this is a close model. If your shots travel further or shorter than the replay, change <b>How far a full-power shot slides</b>.</li></ul>`,
    mount,
  });
})();
