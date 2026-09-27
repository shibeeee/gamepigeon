/* Hand-drawn SVG illustrations for the game cards (viewBox 160 x 100). */
(function () {
  'use strict';
  const GP = window.GP;

  function tile(x, y, s, letter, fill, color) {
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${fill || '#fff6dd'}" stroke="rgba(0,0,0,.12)"/>` +
      `<text x="${x + s / 2}" y="${y + s * 0.7}" text-anchor="middle" font-size="${s * 0.58}" font-weight="800" fill="${color || '#4a3a14'}" font-family="ui-rounded,system-ui,sans-serif">${letter}</text>`;
  }

  const ART = {
    connect4() {
      let s = '<rect x="30" y="18" width="100" height="74" rx="10" fill="#2463eb"/><rect x="30" y="18" width="100" height="10" rx="5" fill="#3b7bff" opacity=".6"/>';
      const grid = ['....y..', '...ry..', '..rry..', '.yrryr.'];
      grid.forEach((row, r) => row.split('').forEach((ch, c) => {
        const x = 40 + c * 13.4, y = 36 + r * 15;
        const fill = ch === 'r' ? '#f0463c' : ch === 'y' ? '#ffc21a' : '#123a91';
        s += `<circle cx="${x}" cy="${y}" r="5.6" fill="${fill}"/>`;
        if (ch !== '.') s += `<circle cx="${x - 1.5}" cy="${y - 1.8}" r="1.8" fill="#fff" opacity=".35"/>`;
      }));
      s += '<circle cx="80.2" cy="8" r="5.6" fill="#f0463c"/><path d="M80 15v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>';
      return s;
    },
    othello() {
      let s = '<rect x="40" y="10" width="80" height="80" rx="8" fill="#1f9d55"/>';
      for (let k = 1; k < 5; k++) s += `<path d="M${40 + k * 16} 10v80M40 ${10 + k * 16}h80" stroke="#157a41" stroke-width="1"/>`;
      const d = ['.....', '.bw..', '.wbw.', '..bb.', '.....'];
      d.forEach((row, r) => row.split('').forEach((ch, c) => {
        if (ch === '.') return;
        s += `<circle cx="${48 + c * 16}" cy="${18 + r * 16}" r="6.2" fill="${ch === 'b' ? '#16161a' : '#f5f5f5'}" stroke="rgba(0,0,0,.25)"/>`;
      }));
      s += '<circle cx="96" cy="34" r="2.2" fill="#fff" opacity=".6"/><circle cx="64" cy="82" r="2.2" fill="#fff" opacity=".6"/>';
      return s;
    },
    gomoku() {
      let s = '<rect x="35" y="5" width="90" height="90" rx="8" fill="#e5b56e"/>';
      for (let k = 0; k < 8; k++) s += `<path d="M${45 + k * 10} 15v70M45 ${15 + k * 10}h70" stroke="#9c6b2e" stroke-width=".8"/>`;
      const stones = [[2, 2, 1], [3, 3, 1], [4, 4, 1], [5, 5, 1], [6, 6, 1], [3, 2, 0], [4, 3, 0], [2, 5, 0], [5, 3, 0], [6, 4, 0]];
      stones.forEach(([r, c, p]) => {
        s += `<circle cx="${45 + c * 10}" cy="${15 + r * 10}" r="4.3" fill="${p ? '#141416' : '#fafafa'}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>`;
      });
      s += '<path d="M63 33L107 77" stroke="#ff4f93" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>';
      return s;
    },
    tictactoe() {
      let s = '<path d="M68 18v64M92 18v64M48 38h64M48 62h64" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity=".35"/>';
      const X = (x, y) => `<path d="M${x - 7} ${y - 7}l14 14M${x + 7} ${y - 7}l-14 14" stroke="#ff4f93" stroke-width="4.5" stroke-linecap="round"/>`;
      const O = (x, y) => `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#2f7bff" stroke-width="4.5"/>`;
      s += X(56, 27) + O(80, 27) + X(80, 50) + O(104, 50) + X(104, 73) + O(56, 73);
      s += '<path d="M50 21L110 79" stroke="#ffc21a" stroke-width="3" stroke-linecap="round" opacity=".9"/>';
      return s;
    },
    mancala(tint) {
      let s = `<rect x="12" y="22" width="136" height="56" rx="28" fill="${tint}"/><rect x="12" y="22" width="136" height="56" rx="28" fill="url(#wood)" opacity=".25"/>`;
      s += '<rect x="20" y="30" width="18" height="40" rx="9" fill="rgba(0,0,0,.25)"/><rect x="122" y="30" width="18" height="40" rx="9" fill="rgba(0,0,0,.25)"/>';
      const hues = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8'];
      for (let k = 0; k < 6; k++) {
        for (const y of [38, 62]) {
          const x = 48 + k * 13;
          s += `<circle cx="${x}" cy="${y}" r="5.8" fill="rgba(0,0,0,.25)"/>`;
          const n = (k * 7 + y) % 3 + 1;
          for (let p = 0; p < n; p++) s += `<circle cx="${x - 2 + p * 2}" cy="${y - 1 + (p % 2) * 2}" r="1.5" fill="${hues[(k + p + y) % 5]}"/>`;
        }
      }
      for (let p = 0; p < 6; p++) s += `<circle cx="${128 + (p % 2) * 4}" cy="${40 + p * 4}" r="1.6" fill="${hues[p % 5]}"/>`;
      return '<defs><linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>' + s;
    },
    'mancala-capture'() { return ART.mancala('#b5651d'); },
    'mancala-avalanche'() {
      return ART.mancala('#7d3c98') + '<path d="M50 50c10-14 30-14 40 0s30 14 40 0" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="3 3" opacity=".8"/><path d="M126 46l4 4-5 3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>';
    },
    seabattle() {
      let s = '<rect x="30" y="5" width="100" height="90" rx="8" fill="#0b4f86"/>';
      const heat = [
        [0, .2, .3, .2, .1, 0], [.2, .5, .7, .5, .3, .1], [.3, .7, 1, .8, .4, .2],
        [.2, .5, .8, .6, .3, .1], [.1, .3, .4, .3, .2, 0], [0, .1, .2, .1, 0, 0]];
      heat.forEach((row, r) => row.forEach((v, c) => {
        s += `<rect x="${36 + c * 15}" y="${10 + r * 13.5}" width="13" height="12" rx="2.5" fill="rgb(${Math.round(20 + 235 * v)},${Math.round(90 + 60 * v)},${Math.round(160 - 120 * v)})" opacity="${0.35 + v * 0.65}"/>`;
      }));
      s += '<rect x="96" y="37" width="28" height="12" rx="6" fill="#dfe6ee"/><circle cx="103" cy="43" r="2" fill="#f0463c"/>';
      s += '<circle cx="73" cy="43" r="11" fill="none" stroke="#fff" stroke-width="2"/><path d="M73 28v8M73 50v8M58 43h8M80 43h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
      return s;
    },
    wordhunt() {
      const L = 'TOPSAREHINGLCDEW';
      let s = '<rect x="38" y="4" width="84" height="92" rx="10" fill="#2e7d32" opacity=".9"/>';
      for (let i = 0; i < 16; i++) s += tile(44 + (i % 4) * 19, 12 + Math.floor(i / 4) * 19, 16, L[i]);
      s += '<path d="M52 20L71 39L90 39L109 58" stroke="#ff4f93" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><circle cx="52" cy="20" r="4" fill="#2fb45a" stroke="#fff" stroke-width="1.5"/>';
      return s;
    },
    anagrams() {
      let s = '';
      'SILENT'.split('').forEach((ch, i) => { s += tile(18 + i * 21, 58, 19, ch); });
      'LISTEN'.split('').forEach((ch, i) => { s += tile(18 + i * 21, 20, 19, ch, '#12b3a6', '#fff'); });
      s += '<path d="M80 45l-4-4M80 45l4-4M80 45v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/>';
      return s;
    },
    wordbites() {
      let s = '';
      const piece = (x, y, a, b, vert, hue) => {
        const w = vert ? 18 : 36, hgt = vert ? 36 : 18;
        let out = `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="5" fill="hsl(${hue},85%,60%)"/>`;
        out += `<text x="${x + 9}" y="${y + 13.5}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="ui-rounded,system-ui,sans-serif">${a}</text>`;
        if (b) out += `<text x="${x + (vert ? 9 : 27)}" y="${y + (vert ? 31.5 : 13.5)}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="ui-rounded,system-ui,sans-serif">${b}</text>`;
        return out;
      };
      s += piece(24, 41, 'B', 'I', false, 25) + piece(62, 23, 'X', 'T', true, 200) + piece(82, 41, 'E', '', false, 140).replace('width="36"', 'width="18"');
      s += piece(102, 41, 'S', '', false, 320).replace('width="36"', 'width="18"');
      s += piece(122, 12, 'O', 'N', true, 50);
      return s;
    },
  };

  GP.art = function (id) {
    const fn = ART[id];
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fn ? fn() : ''}</svg>`;
  };
})();
