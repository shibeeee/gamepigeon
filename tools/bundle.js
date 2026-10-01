/*
 * Joins every script the page loads into one file, so phones make one
 * request instead of thirty. Used when publishing the website:
 *   node tools/bundle.js <site folder>
 * It writes js/app.bundle.js in that folder and points index.html at it.
 * The separate files stay in place (the background worker still uses them).
 */
const fs = require('fs');
const path = require('path');

const site = process.argv[2];
if (!site) { console.error('usage: node tools/bundle.js <site folder>'); process.exit(1); }
const indexPath = path.join(site, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const tag = /\s*<script src="([^"?]+)(\?v=[^"]*)?"><\/script>/g;
const files = [];
html.replace(tag, (m, src) => { files.push(src); return m; });
if (!files.length) { console.error('no scripts found'); process.exit(1); }

const parts = files.map((f) => '/* ' + f + ' */\n' + fs.readFileSync(path.join(site, f), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, ''));
fs.writeFileSync(path.join(site, 'js/app.bundle.js'), parts.join('\n;\n'));

let first = true;
html = html.replace(tag, () => {
  if (!first) return '';
  first = false;
  return '\n  <script src="js/app.bundle.js?v=__BUILD__"></script>';
});
fs.writeFileSync(indexPath, html);
console.log('Bundled ' + files.length + ' scripts into js/app.bundle.js');
