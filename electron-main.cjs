const {app, BrowserWindow, dialog} = require('electron');
const {spawn} = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');

let PORT = 3001;
let serverProcess = null;

function connectionSettings() {
  const configPath = path.join(app.isPackaged ? path.dirname(process.execPath) : __dirname, '服务器配置.json');
  let config = {};
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`服务器配置.json 无法读取：${error.message}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('服务器配置.json 必须是 JSON 对象');
  const serverUrl = process.env.GARRISON_SERVER_URL || config.serverUrl || '';
  if (serverUrl) {
    const url = new URL(serverUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('serverUrl 必须是 HTTP 或 HTTPS 游戏地址');
    return { serverUrl: url.href };
  }
  PORT = Number(process.env.GARRISON_PORT || (config.localPort ?? 3001));
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('localPort 必须是 1–65535 的整数');
  return { serverUrl: '' };
}

function pingServer() {
  return new Promise(resolve => {
    const request = http.get({hostname: '127.0.0.1', port: PORT, path: '/healthz'}, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; if (body.length > 32768) response.destroy(); });
      response.on('error', () => resolve(false));
      response.on('end', () => {
        try { const status = JSON.parse(body); resolve(response.statusCode === 200 && status.ok === true && status.app === require('./package.json').version); }
        catch { resolve(false); }
      });
    });
    request.setTimeout(700, () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

async function waitForServer(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await pingServer()) return true;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

function startServer() {
  const serverFile = path.join(__dirname, 'server', 'index.js');
  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: __dirname,
    env: {...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT), HOST: '127.0.0.1'},
    windowsHide: true,
    stdio: 'ignore'
  });
  serverProcess.on('error', () => {});
}

async function createWindow() {
  const settings = connectionSettings();
  if (!settings.serverUrl) {
    if (!(await pingServer())) startServer();
    const ready = await waitForServer();
    if (!ready) throw new Error(`作战终端无法在端口 ${PORT} 启动，请检查端口占用或修改服务器配置.json`);
  }
  const window = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#070b0d',
    autoHideMenuBar: true,
    title: '卫戍协议：盟约',
    webPreferences: {contextIsolation: true, nodeIntegration: false}
  });
  await window.loadURL(settings.serverUrl || `http://127.0.0.1:${PORT}/`);
  return window;
}

app.whenReady().then(createWindow).catch(error => {
  console.error(error);
  dialog.showErrorBox('作战终端连接失败', error.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
