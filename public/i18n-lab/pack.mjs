#!/usr/bin/env node
// i18n-lab/pack.mjs — build two deliverables under dist-i18n/ (git-excluded):
//   1. Stronghold-Protocol-EN-patch   overlay only, a few KB, safe to share publicly
//   2. Stronghold-Protocol-EN-windows  a runnable PC bundle with the layer already installed
//      (contains game assets, so it is NOT something to attach to a public issue)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const LAB = path.join(ROOT, 'i18n-lab');
const DIST = path.join(ROOT, 'dist-i18n');
const TAG = '<script type="module" src="/i18n/overlay.js"></script>';
const ANCHOR = /(<script type="module" src="\/js\/main\.js"[^\n]*<\/script>\n)/;

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (from, to) => fs.cpSync(from, to, { recursive: true });

/** Transitive production dependency closure, read from each package.json. */
function prodModules() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const want = Object.keys(pkg.dependencies || {});
  const found = new Set();
  const queue = [...want];
  while (queue.length) {
    const name = queue.shift();
    if (found.has(name)) continue;
    const dir = path.join(ROOT, 'node_modules', name);
    if (!fs.existsSync(dir)) { console.warn(`  ! missing ${name}`); continue; }
    found.add(name);
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    for (const dep of Object.keys(p.dependencies || {})) queue.push(dep);
    // scoped siblings like @pixi/loaders live under node_modules/@scope
    for (const dep of Object.keys(p.dependencies || {})) if (dep.startsWith('@')) queue.push(dep);
  }
  return [...found].sort();
}

console.log('[1/3] EN patch (overlay only)');
const patch = path.join(DIST, 'Stronghold-Protocol-EN-patch');
rm(patch);
fs.mkdirSync(path.join(patch, 'i18n'), { recursive: true });
cp(path.join(LAB, 'overlay.js'), path.join(patch, 'i18n', 'overlay.js'));
cp(path.join(LAB, 'en'), path.join(patch, 'i18n', 'en'));
cp(path.join(LAB, 'install-en.mjs'), path.join(patch, 'install-en.mjs'));
cp(path.join(LAB, 'README-EN.md'), path.join(patch, 'README-EN.md'));

console.log('[2/3] EN PC bundle (runnable, includes game assets)');
const bundle = path.join(DIST, 'Stronghold-Protocol-EN-windows');
rm(bundle);
fs.mkdirSync(bundle, { recursive: true });
for (const dir of ['server', 'shared', 'data', 'scripts', 'tools']) cp(path.join(ROOT, dir), path.join(bundle, dir));
for (const file of ['package.json', 'README.md', 'LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md', 'Dockerfile']) {
  if (fs.existsSync(path.join(ROOT, file))) cp(path.join(ROOT, file), path.join(bundle, file));
}
cp(path.join(ROOT, 'public'), path.join(bundle, 'public'));
cp(path.join(LAB, 'en'), path.join(bundle, 'public', 'i18n', 'en'));
cp(path.join(LAB, 'overlay.js'), path.join(bundle, 'public', 'i18n', 'overlay.js'));

const htmlPath = path.join(bundle, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
if (!ANCHOR.test(html)) throw new Error('main.js anchor not found in index.html');
fs.writeFileSync(htmlPath, html.replace(ANCHOR, `$1  ${TAG}\n`));

const mods = prodModules();
fs.mkdirSync(path.join(bundle, 'node_modules'), { recursive: true });
for (const m of mods) cp(path.join(ROOT, 'node_modules', m), path.join(bundle, 'node_modules', m));
console.log(`  prod deps: ${mods.length} (${mods.join(', ')})`);

console.log('[3/3] zip');
fs.mkdirSync(ROOT, { recursive: true });
for (const name of ['Stronghold-Protocol-EN-patch', 'Stronghold-Protocol-EN-windows']) {
  const src = path.join(DIST, name);
  const zip = path.join(DIST, `${name}-0.1.1.zip`);
  rm(zip);
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Compress-Archive -LiteralPath '${src}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
  console.log(`  ${path.basename(zip)}  ${(fs.statSync(zip).size / 1048576).toFixed(1)} MB`);
}
console.log(`\noutput in ${DIST}`);
