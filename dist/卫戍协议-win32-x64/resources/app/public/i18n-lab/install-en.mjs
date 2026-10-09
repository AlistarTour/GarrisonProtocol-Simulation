#!/usr/bin/env node
// install-en.mjs — drop the English UI layer into an existing Stronghold Protocol install.
//
//   node install-en.mjs            install
//   node install-en.mjs --undo     remove it again
//
// It copies ./i18n into ./public/i18n and adds ONE <script> line to ./public/index.html.
// No game file is rewritten, so it survives nothing — but it also cannot break anything, and
// --undo restores the original exactly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const SRC = path.join(HERE, 'i18n');
const DEST = path.join(ROOT, 'public', 'i18n');
const HTML = path.join(ROOT, 'public', 'index.html');
const TAG = '<script type="module" src="/i18n/overlay.js"></script>';
const ANCHOR = /(<script type="module" src="\/js\/main\.js"[^\n]*<\/script>\n)/;

const fail = (msg) => { console.error(`✘ ${msg}`); process.exit(1); };

if (!fs.existsSync(path.join(ROOT, 'server', 'index.js'))) fail('run this from the game folder (the one containing server/index.js)');
if (!fs.existsSync(HTML)) fail('public/index.html not found');
if (!fs.existsSync(SRC)) fail('i18n/ folder is missing next to install-en.mjs');

const undo = process.argv.includes('--undo');
const html = fs.readFileSync(HTML, 'utf8');

if (undo) {
  if (!html.includes(TAG)) { console.log('English layer is not installed — nothing to do.'); process.exit(0); }
  fs.writeFileSync(HTML, html.replace(`  ${TAG}\n`, ''));
  fs.rmSync(DEST, { recursive: true, force: true });
  console.log('✔ English layer removed. public/index.html restored to its original content.');
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(SRC, DEST, { recursive: true });

if (html.includes(TAG)) {
  console.log('• public/i18n refreshed; index.html already loads it.');
} else {
  if (!ANCHOR.test(html)) fail('could not find the main.js script tag in public/index.html — add this line by hand right after it:\n    ' + TAG);
  fs.writeFileSync(HTML, html.replace(ANCHOR, `$1  ${TAG}\n`));
  console.log('✔ Installed: copied public/i18n and added one script tag to public/index.html.');
}

console.log('\nStart the server as usual, then open:   http://localhost:3001/?lang=en');
console.log('To switch back to Chinese:              http://localhost:3001/?lang=zh');
console.log('To remove the layer completely:         node install-en.mjs --undo');
