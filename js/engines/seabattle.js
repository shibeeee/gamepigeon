/*
 * Sea Battle helper. Ships are straight lines of length 1-4 and never touch
 * each other, not even diagonally.
 *
 * Cell states: 0 unknown, 1 miss, 2 hit, 3 sunk.
 *
 * For every ship still afloat we count each position it could occupy that is
 * consistent with what we know. A position that covers unresolved hits is far
 * more likely than one that doesn't, so it is weighted up. The total weight on
 * a cell is its score; the highest-scoring unknown cells are the best shots.
 */
(function (root) {
  'use strict';
  const GP = (root.GP = root.GP || {});
  const UNKNOWN = 0, MISS = 1, HIT = 2, SUNK = 3;

  const FLEETS = {
    10: { 4: 1, 3: 2, 2: 3, 1: 4 },
    9: { 4: 3, 3: 5 },
    8: { 4: 1, 3: 3, 2: 3 },
  };

  function neighbours(n, i, diagonalOnly) {
    const r = Math.floor(i / n), c = i % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (diagonalOnly && (!dr || !dc)) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
    return out;
  }

  /* Cells that cannot contain a ship: around sunk ships and diagonal to hits. */
  function blockedCells(n, cells) {
    const blocked = new Uint8Array(n * n);
    cells.forEach((v, i) => {
      if (v === SUNK) for (const j of neighbours(n, i)) if (cells[j] === UNKNOWN) blocked[j] = 1;
      if (v === HIT) for (const j of neighbours(n, i, true)) if (cells[j] === UNKNOWN) blocked[j] = 1;
    });
    return blocked;
  }

  /* Groups of orthogonally connected cells with the given state. */
  function groups(n, cells, state) {
    const seen = new Uint8Array(n * n), out = [];
    for (let i = 0; i < n * n; i++) {
      if (cells[i] !== state || seen[i]) continue;
      const g = [], stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop();
        g.push(k);
        const r = Math.floor(k / n), c = k % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc, j = rr * n + cc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && !seen[j] && cells[j] === state) { seen[j] = 1; stack.push(j); }
        }
      }
      out.push(g.sort((a, b) => a - b));
    }
    return out;
  }

  function analyze(n, cells, remaining) {
    const blocked = blockedCells(n, cells);
    const score = new Float64Array(n * n);
    const hitNear = new Uint8Array(n * n); // cells touching a hit (8 directions)
    cells.forEach((v, i) => { if (v === HIT) for (const j of neighbours(n, i)) hitNear[j] = 1; });

    for (const key of Object.keys(remaining)) {
      const len = +key, count = remaining[key];
      if (!count) continue;
      for (let dir = 0; dir < (len === 1 ? 1 : 2); dir++) {
        const dr = dir, dc = 1 - dir;
        for (let r = 0; r + dr * (len - 1) < n; r++) {
          for (let c = 0; c + dc * (len - 1) < n; c++) {
            const idx = [];
            let hits = 0, ok = true;
            for (let k = 0; k < len; k++) {
              const i = (r + k * dr) * n + (c + k * dc);
              const v = cells[i];
              if (v === MISS || v === SUNK || blocked[i]) { ok = false; break; }
              if (v === HIT) hits++;
              idx.push(i);
            }
            if (!ok) continue;
            // A ship may not touch a hit that isn't part of it.
            const inShip = new Set(idx);
            for (const i of idx) {
              if (!hitNear[i]) continue;
              for (const j of neighbours(n, i)) if (cells[j] === HIT && !inShip.has(j)) { ok = false; break; }
              if (!ok) break;
            }
            if (!ok) continue;
            if (hits === len) continue; // adds nothing: every cell is already known
            const w = count * (hits ? Math.pow(60, hits) : 1);
            for (const i of idx) if (cells[i] === UNKNOWN) score[i] += w;
          }
        }
      }
    }
    let max = 0;
    for (let i = 0; i < n * n; i++) if (cells[i] === UNKNOWN && !blocked[i] && score[i] > max) max = score[i];
    const best = [];
    if (max > 0) for (let i = 0; i < n * n; i++) if (score[i] === max && cells[i] === UNKNOWN) best.push(i);
    return { score, max, best, blocked };
  }

  GP.seabattle = { UNKNOWN, MISS, HIT, SUNK, FLEETS, analyze, groups, blockedCells, neighbours };
})(typeof globalThis !== 'undefined' ? globalThis : self);
