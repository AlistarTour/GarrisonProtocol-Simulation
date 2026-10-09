import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {syncPackageDocs} from './sync-package-docs.mjs';

const require = createRequire(import.meta.url);
const {packager} = require('@electron/packager');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const serverUrlIndex = process.argv.indexOf('--server-url');
const serverUrl = serverUrlIndex === -1 ? '' : process.argv[serverUrlIndex + 1];
if (serverUrlIndex !== -1 && !serverUrl) throw new Error('--server-url requires a URL');
if (serverUrl) {
  const parsed = new URL(serverUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid game server URL');
}
await fs.mkdir(out, {recursive: true});
const electronCache = path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache');
let electronZipDir;
try {
  for (const entry of await fs.readdir(electronCache, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(electronCache, entry.name);
    if ((await fs.readdir(candidate)).some(name => name === 'electron-v44.7.0-win32-x64.zip')) { electronZipDir = candidate; break; }
  }
} catch {}

const ignored = /[\\/](?:research|tests|screenshots|scripts|legacy-prototype|legacy-prototype-tests|public-old|server-old|shared-old|data-old|game|client|\.git|dist)(?:[\\/]|$)|[\\/]server\.mjs$|[\\/](?:README|UI还原对照)\.md$|[\\/](?:Dockerfile|启动游戏\.bat)$|[\\/]node_modules[\\/](?:electron|@electron[\\/]packager)(?:[\\/]|$)/i;

const appPaths = await packager({
  dir: root,
  name: '卫戍协议',
  platform: 'win32',
  arch: 'x64',
  out,
  overwrite: true,
  asar: false,
  prune: true,
  electronVersion: '44.7.0',
  electronZipDir,
  ignore: file => ignored.test(file) || /[\\/]?(?:server[\\/]server|shared[\\/]shared|data[\\/]data)(?:[\\/]|$)/i.test(file),
  appVersion: manifest.version,
  win32metadata: {CompanyName: 'Covenant Simulation',FileDescription: '卫戍协议：盟约 · 浏览器合作模拟',ProductName: '卫戍协议：盟约'}
});

const target = appPaths[0];
await fs.writeFile(path.join(target, '服务器配置.json'), JSON.stringify({serverUrl, localPort: 3001}, null, 2) + '\n', 'utf8');
await syncPackageDocs(target);
console.log(`Portable EXE ready: ${path.join(target, '卫戍协议.exe')}`);
