/*
 * Knockout: penguins on an ice floe. Both players aim all their penguins at
 * the same time, then everything slides at once; penguins that slide off the
 * ice are out. Last team standing wins.
 *
 * GamePigeon's exact physics aren't published, so this is a model: round
 * penguins of equal weight, steady friction, bouncy collisions, and a
 * penguin is out once its center leaves the ice. "slide" (how far a full
 * power shot travels on empty ice, in ice widths) can be tuned to match.
 *
 * Units: the ice is centered on (0, 0); a square ice spans -ice..ice, a round
 * one has radius ice. A move is { dx, dy } with length 0..1 (1 = full power).
 */
(function (root) {
  'use strict';
  const GP = root.GP;

  const RADIUS = 0.075;   // penguin radius
  const FRICTION = 1.6;   // slowing per second, in units/s^2
  const DT = 1 / 90;
  const BOUNCE = 0.92;

  function onIce(x, y, st) {
    const s = st.ice;
    if (st.shape === 'circle') return x * x + y * y <= s * s;
    return Math.abs(x) <= s && Math.abs(y) <= s;
  }
  /* How far inside the edge a point is (negative = off the ice). */
  function edgeRoom(x, y, st) {
    const s = st.ice;
    if (st.shape === 'circle') return s - Math.hypot(x, y);
    return Math.min(s - Math.abs(x), s - Math.abs(y));
  }

  /* Top speed, so a full power shot slides `slide` ice widths on empty ice. */
  function topSpeed(st) {
    const dist = (st.slide || 1) * 2 * st.ice;
    return Math.sqrt(2 * FRICTION * dist);
  }

  /*
   * Runs one round. pens: [{ id, team, x, y }], moves: { id: {dx, dy} }.
   * Returns the final pens with an `out` flag. With `frames`, records the
   * positions over time for the replay.
   */
  function simulate(st, pens, moves, frames) {
    const vmax = topSpeed(st);
    const P = pens.map((p) => {
      const m = moves[p.id] || { dx: 0, dy: 0 };
      return { id: p.id, team: p.team, x: p.x, y: p.y, vx: m.dx * vmax, vy: m.dy * vmax, out: !onIce(p.x, p.y, st) };
    });
    const d2min = (2 * RADIUS) * (2 * RADIUS);
    for (let step = 0; step < 900; step++) {
      let moving = false;
      for (const p of P) {
        if (p.out) continue;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 0) {
          const ns = Math.max(0, sp - FRICTION * DT);
          p.vx *= ns / sp; p.vy *= ns / sp;
          p.x += p.vx * DT; p.y += p.vy * DT;
          if (ns > 1e-3) moving = true;
          else { p.vx = 0; p.vy = 0; }
        }
      }
      // Collisions between penguins still on the ice.
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        if (a.out) continue;
        for (let j = i + 1; j < P.length; j++) {
          const b = P[j];
          if (b.out) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= d2min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          // Push apart, then swap the speed along the line between them.
          const push = (2 * RADIUS - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const k = rel * (1 + BOUNCE) / 2;
            a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny;
            moving = true;
          }
        }
      }
      for (const p of P) if (!p.out && !onIce(p.x, p.y, st)) { p.out = true; p.vx = p.vy = 0; }
      if (frames && step % 2 === 0) frames.push(P.map((p) => ({ id: p.id, x: p.x, y: p.y, out: p.out })));
      if (!moving) break;
    }
    if (frames) frames.push(P.map((p) => ({ id: p.id, x: p.x, y: p.y, out: p.out })));
    return P;
  }

  /* Small seeded random numbers, so the same board always gets the same answer. */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function seedOf(st) {
    let h = 7;
    for (const p of st.pens) h = (h * 31 + Math.round(p.x * 1000) * 17 + Math.round(p.y * 1000) + p.team) | 0;
    return (h ^ Math.round(st.ice * 1000) ^ (st.shape === 'circle' ? 99 : 0)) >>> 0;
  }

  /*
   * Likely moves for the other team. Nobody knows what they'll do, so the
   * plan is tested against a spread of sensible choices: charging at one of
   * your penguins (closer ones more often), staying put, edging to safety,
   * and the odd random shot.
   */
  function opponentScenarios(st, mine, theirs, count, rand) {
    const out = [];
    for (let k = 0; k < count; k++) {
      const moves = {};
      for (const p of theirs) {
        const r = rand();
        if (r < 0.15) continue; // stays
        let ang, pow;
        if (r < 0.75 && mine.length) {
          // Charge: pick a target, nearer ones more likely.
          const w = mine.map((q) => 1 / (0.15 + Math.hypot(q.x - p.x, q.y - p.y)));
          let t = rand() * w.reduce((a, b) => a + b, 0), q = mine[0];
          for (let i = 0; i < mine.length; i++) { t -= w[i]; if (t <= 0) { q = mine[i]; break; } }
          ang = Math.atan2(q.y - p.y, q.x - p.x) + (rand() - 0.5) * 0.35;
          pow = 0.55 + rand() * 0.45;
        } else if (r < 0.9) {
          // Back toward the middle.
          ang = Math.atan2(-p.y, -p.x) + (rand() - 0.5) * 0.6;
          pow = Math.min(1, Math.hypot(p.x, p.y) / (2 * st.ice * (st.slide || 1))) * (0.6 + rand() * 0.6);
        } else {
          ang = rand() * Math.PI * 2;
          pow = rand();
        }
        moves[p.id] = { dx: Math.cos(ang) * pow, dy: Math.sin(ang) * pow };
      }
      out.push(moves);
    }
    return out;
  }

  /* Score of one finished round for `team` (higher is better). */
  function score(st, end, team) {
    let v = 0, mineLeft = 0, theirsLeft = 0;
    for (const p of end) {
      const mine = p.team === team;
      if (p.out) { v += mine ? -10 : 10; continue; }
      if (mine) mineLeft++; else theirsLeft++;
      // Ending near the edge is risky next round.
      const room = Math.min(1, edgeRoom(p.x, p.y, st) / (0.5 * st.ice));
      v += (mine ? 1 : -1) * room;
    }
    if (!theirsLeft && mineLeft) v += 40;
    if (!mineLeft && theirsLeft) v -= 40;
    return v;
  }

  // Candidate shots for one penguin: stay, or 24 directions at 4 powers.
  const DIRS = 24, POWERS = [0.35, 0.6, 0.8, 1];
  function candidates() {
    const c = [{ dx: 0, dy: 0 }];
    for (let i = 0; i < DIRS; i++) {
      const a = (i / DIRS) * Math.PI * 2;
      for (const pw of POWERS) c.push({ dx: Math.cos(a) * pw, dy: Math.sin(a) * pw });
    }
    return c;
  }

  /*
   * Finds the best shots for team 0 ("you"). Tries each penguin's options in
   * turn while keeping the others fixed, and repeats while time allows.
   * Every option is played out against the same set of likely opponent moves.
   */
  function plan(st, opts) {
    opts = opts || {};
    const budget = Math.max(200, opts.timeMs || 900);
    const deadline = Date.now() + budget;
    const rand = rng(seedOf(st));
    const live = st.pens.filter((p) => onIce(p.x, p.y, st));
    const mine = live.filter((p) => p.team === 0), theirs = live.filter((p) => p.team === 1);
    if (!mine.length) return { moves: {}, expect: null };
    const scen = opponentScenarios(st, mine, theirs, theirs.length ? 40 : 1, rand);
    const cand = candidates();

    const evalPlan = (myMoves) => {
      let total = 0, lostMine = 0, lostTheirs = 0;
      for (const om of scen) {
        const end = simulate(st, live, Object.assign({}, om, myMoves));
        total += score(st, end, 0);
        for (const p of end) if (p.out) { if (p.team === 0) lostMine++; else lostTheirs++; }
      }
      return { v: total / scen.length, lostMine: lostMine / scen.length, lostTheirs: lostTheirs / scen.length };
    };

    // Start: everyone stays put.
    const best = {};
    mine.forEach((p) => (best[p.id] = cand[0]));
    let cur = evalPlan(best);
    let passes = 0;
    outer:
    for (; passes < 6; passes++) {
      let improved = false;
      for (const p of mine) {
        let bestC = best[p.id], bestR = cur;
        for (const c of cand) {
          if (c === best[p.id]) continue;
          if (Date.now() > deadline && passes > 0) break outer;
          const trial = Object.assign({}, best, { [p.id]: c });
          const r = evalPlan(trial);
          if (r.v > bestR.v + 1e-9) { bestR = r; bestC = c; }
        }
        if (bestC !== best[p.id]) { best[p.id] = bestC; cur = bestR; improved = true; }
      }
      if (!improved) { passes++; break; }
    }
    // Fine-tune each shot's angle and power a little.
    for (const p of mine) {
      if (Date.now() > deadline) break;
      const b = best[p.id];
      const pw = Math.hypot(b.dx, b.dy);
      if (!pw) continue;
      const a0 = Math.atan2(b.dy, b.dx);
      for (const da of [-0.12, -0.06, 0.06, 0.12]) for (const dp of [-0.1, 0, 0.1]) {
        const np = Math.min(1, Math.max(0.15, pw + dp));
        const c = { dx: Math.cos(a0 + da) * np, dy: Math.sin(a0 + da) * np };
        const r = evalPlan(Object.assign({}, best, { [p.id]: c }));
        if (r.v > cur.v + 1e-9) { cur = r; best[p.id] = c; }
      }
    }
    return { moves: best, expect: cur, scenarios: scen.length, passes };
  }

  GP.engines = GP.engines || {};
  GP.engines.knockout = {
    RADIUS, simulate, onIce, plan,
    // The worker calls search(); the answer is a whole plan, not one move.
    search: (st, opts) => plan(st, opts),
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
