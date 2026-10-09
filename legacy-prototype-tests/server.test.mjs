import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

test('HTTP and two real WebSocket clients can create, join, synchronize and resume a room', { timeout: 20000 }, async t => {
  const port = 3100 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => proc.kill());
  await new Promise((resolve, reject) => { proc.stdout.on('data', () => resolve()); proc.on('error', reject); proc.on('exit', code => reject(new Error(`Server exited: ${code}`))); });
  const response = await fetch(base); assert.equal(response.status, 200); assert.match(await response.text(), /卫戍协议/);
  assert.equal((await fetch(`${base}/api/health`).then(r => r.json())).ok, true);
  assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/..%2fserver.mjs`)).status, 403);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  async function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const inbox = [];
    ws.on('message', bytes => inbox.push(JSON.parse(bytes.toString())));
    await once(ws, 'open');
    t.after(() => ws.close());
    async function wait(predicate, timeout = 3000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const index = inbox.findIndex(predicate);
        if (index >= 0) return inbox.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      throw new Error(`Message wait timed out. Inbox: ${JSON.stringify(inbox.slice(-2))}`);
    }
    return { ws, wait, send: m => ws.send(JSON.stringify(m)) };
  }
  const a = await client(); a.send({ type: 'create', name: '甲博士' });
  const saved = await a.wait(m => m.type === 'session'); assert.match(saved.code, /^[A-F0-9]{6}$/);
  const b = await client(); b.send({ type: 'match', difficulty: 'standard', name: '乙博士' });
  await b.wait(m => m.type === 'session');
  b.send({type:'ping',at:12345});assert.equal((await b.wait(m=>m.type==='pong')).at,12345);
  const lobby = await a.wait(m => m.type === 'state' && m.state.players.length === 2);
  assert.equal(lobby.state.players[1].name, '乙博士');
  a.send({ type: 'start' });
  await b.wait(m => m.type === 'state' && m.state.phase === 'prep');
  a.send({ type: 'buy', index: 0 });
  const updated = await b.wait(m => m.type === 'state' && m.state.players[0].units.length === 1);
  assert.equal(updated.state.players[0].funds, 9); assert.equal(updated.state.players[0].shop, undefined);
  a.ws.close(); await once(a.ws, 'close');
  const resumed = await client(); resumed.send({ type: 'resume', code: saved.code, token: saved.token });
  const state = await resumed.wait(m => m.type === 'state'); assert.equal(state.state.viewerId, saved.playerId);
  assert.equal(state.state.players[0].units.length, 1);
  const intruder = await client(); intruder.send({ type: 'resume', code: saved.code, token: 'wrong' });
  assert.equal((await intruder.wait(m => m.type === 'expired')).type, 'expired');
  b.send({ type: 'buy', index: -99 }); assert.equal((await b.wait(m => m.type === 'error')).type, 'error');
  resumed.send({ type: 'ready' }); b.send({ type: 'ready' });
  assert.equal((await resumed.wait(m => m.type === 'state' && m.state.phase === 'battle')).state.phase, 'battle');
});
