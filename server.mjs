import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoom, addPlayer, action, tick, publicRoom, start, log } from './game/engine.mjs';

const port = Number(process.env.PORT || 3000);
const root = path.join(import.meta.dirname, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const rooms = new Map();
const clients = new Map();
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, version: '0.1.0', rooms: rooms.size })); }
  if (pathname === '/api/network') {
    const addresses = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${port}`);
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ addresses }));
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') && !pathname.endsWith('.json') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self' ws: wss:; base-uri 'none'; frame-ancestors 'none'" });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  let allowed = !origin;
  try { allowed ||= new URL(origin).host === req.headers.host; } catch {}
  if (req.url !== '/ws' || !allowed) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
function send(ws, value) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value)); }
function broadcast(room) {
  for (const [ws, session] of clients) if (session.room === room) send(ws, { type: 'state', state: publicRoom(room, session.player.id) });
}
function code() { let value; do { value = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(value)); return value; }
function detach(ws, explicit = false) {
  const s = clients.get(ws);
  if (!s) return;
  clients.delete(ws);
  s.player.connected = false; s.room.updatedAt = Date.now();
  if (explicit && s.room.phase === 'lobby') {
    s.room.players = s.room.players.filter(p => p.id !== s.player.id);
    log(s.room, `${s.player.name}已离开同盟。`);
  }
  broadcast(s.room);
}
wss.on('connection', ws => {
  let count = 0, windowStart = Date.now();
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    try {
      if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now(); }
      if (++count > 30) throw new Error('操作过于频繁，请稍后再试。');
      const msg = JSON.parse(raw.toString());
      if (!msg || typeof msg.type !== 'string') throw new Error('无效请求。');
      if (msg.type === 'ping') { send(ws, { type: 'pong', at: msg.at }); return; }
      if (['create', 'join', 'solo', 'match'].includes(msg.type)) {
        if (clients.has(ws)) throw new Error('请先离开当前模拟。');
        let room;
        if (msg.type === 'join') {
          room = rooms.get(String(msg.code).toUpperCase());
          if (!room || room.solo) throw new Error('同盟密钥无效，或房间已关闭。');
        } else if (msg.type === 'match') {
          room = [...rooms.values()].find(r => !r.solo && r.phase === 'lobby' && r.difficulty === msg.difficulty && r.players.length < 4 && r.players.some(p => p.connected));
          room ||= createRoom({ code: code(), solo: false, difficulty: msg.difficulty });
        } else {
          room = createRoom({ code: code(), solo: msg.type === 'solo', difficulty: msg.difficulty });
        }
        const player = addPlayer(room, msg.name, msg.strategy);
        rooms.set(room.code, room);
        clients.set(ws, { room, player });
        send(ws, { type: 'session', code: room.code, playerId: player.id, token: player.token });
        if (room.solo) start(room, player);
        broadcast(room); return;
      }
      if (msg.type === 'resume') {
        if (clients.has(ws)) throw new Error('已经连接。');
        const room = rooms.get(String(msg.code).toUpperCase());
        const player = room?.players.find(p => p.token === msg.token);
        if (!player) { send(ws, { type: 'expired' }); return; }
        for (const [other, session] of clients) if (session.player === player) { clients.delete(other); other.close(4001, 'Session replaced'); }
        player.connected = true; clients.set(ws, { room, player }); broadcast(room); return;
      }
      if (msg.type === 'leave') { detach(ws, true); send(ws, { type: 'left' }); return; }
      const session = clients.get(ws);
      if (!session) throw new Error('请先加入同盟。');
      action(session.room, session.player, msg);
      session.room.updatedAt = Date.now(); broadcast(session.room);
    } catch (err) { send(ws, { type: 'error', message: err.message || '操作失败。' }); }
  });
  ws.on('close', () => detach(ws));
  ws.on('error', () => {});
  send(ws, { type: 'connected' });
});
const simulation = setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.connected)) { tick(room, 0.1); if (['prep', 'battle', 'rescue', 'reward'].includes(room.phase)) broadcast(room); }
    else if (Date.now() - room.updatedAt > 10 * 60 * 1000) rooms.delete(room.code);
  }
}, 100);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
}, 30000);
server.listen(port, '0.0.0.0', () => {
  console.log(`卫戍协议：盟约 · http://localhost:${port}`);
  for (const i of Object.values(os.networkInterfaces()).flat()) if (i?.family === 'IPv4' && !i.internal) console.log(`局域网联机 · http://${i.address}:${port}`);
});
function shutdown() { clearInterval(simulation); clearInterval(heartbeat); for (const ws of wss.clients) ws.close(); wss.close(); server.close(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
