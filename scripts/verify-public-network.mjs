import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
import { Net } from '../public/js/net.js';

const base = new URL(process.argv[2] || 'http://103.236.57.91:3001/');
const wsUrl = new URL('/ws', base);
wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
const report = { checkedAtUtc: new Date().toISOString(), endpoint: base.origin, checks: [] };
const clients = [];
const waitFor = async (label, predicate, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`${label}: timed out after ${timeout} ms`);
};
const health = async () => {
  const response = await fetch(new URL('/healthz', base), { signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.ok, true);
  assert.equal(value.app, '0.1.1');
  return value;
};
const makeClient = name => {
  const client = { name, frames: [], token: null };
  client.net = new Net({ url: wsUrl.href, WebSocket, getToken: () => client.token });
  client.net.on('*', frame => {
    client.frames.push(frame);
    if (frame.t === 'welcome') client.token = frame.token;
  });
  clients.push(client);
  client.net.setName(name);
  return client;
};
const latest = (client, type) => client.frames.findLast(frame => frame.t === type);
const pass = (name, details = {}) => report.checks.push({ name, passed: true, ...details });

try {
  report.healthBefore = await health();
  pass('public HTTP health');
  const started = Date.now();
  const a = makeClient('部署验收A');
  const b = makeClient('部署验收B');
  await waitFor('two players online', () => a.net.status === 'online' && b.net.status === 'online');
  assert.notEqual(a.net.playerId, b.net.playerId);
  pass('two independent WebSocket sessions', { elapsedMs: Date.now() - started });

  const pingStart = Date.now();
  const pong = await a.net.request('ping', { c: pingStart });
  assert.equal(pong.t, 'pong');
  assert.equal(pong.c, pingStart);
  pass('application ping/pong', { roundTripMs: Date.now() - pingStart });

  await a.net.request('room.create', { mode: 'coop', difficulty: 'NORMAL' });
  const room = await waitFor('room created', () => latest(a, 'room.state'));
  report.testRoomCode = room.code;
  await b.net.request('room.join', { code: room.code });
  const bothJoined = client => {
    const state = latest(client, 'room.state');
    return state?.code === room.code && state.seats.filter(Boolean).length === 2 && state;
  };
  const [roomA, roomB] = await Promise.all([
    waitFor('host sees both players', () => bothJoined(a)),
    waitFor('guest sees both players', () => bothJoined(b))
  ]);
  assert.deepEqual(roomA.seats, roomB.seats);
  pass('create/join room and synchronized seats');

  await b.net.request('room.ready', { ready: true });
  await waitFor('guest ready synchronized', () => latest(a, 'room.state')?.seats.some(seat => seat?.playerId === b.net.playerId && seat.ready));
  await a.net.request('room.start');
  const phaseOnBoth = phase => clients.every(client => latest(client, 'm.public')?.phase === phase);
  await waitFor('match briefing on both clients', () => phaseOnBoth('INFO_CHECK'));
  await waitFor('private state on both clients', () => clients.every(client => latest(client, 'm.private')));
  const firstPublic = latest(a, 'm.public');
  assert.equal(firstPublic.players.length, 2);
  assert.equal(firstPublic.stageId, latest(b, 'm.public').stageId);
  report.stageId = firstPublic.stageId;
  pass('ready/start match and public/private state synchronization');
  report.healthDuring = await health();
  assert.ok(report.healthDuring.sockets >= report.healthBefore.sockets + 2);
  assert.ok(report.healthDuring.matches >= report.healthBefore.matches + 1);

  const guestId = b.net.playerId;
  const oldWelcomeCount = b.frames.filter(frame => frame.t === 'welcome').length;
  const hostDisconnectMark = a.frames.length;
  b.net.ws.terminate();
  await waitFor('host sees disconnected guest', () => a.frames.slice(hostDisconnectMark).some(frame => frame.t === 'm.public' && frame.players.some(player => player.playerId === guestId && !player.connected)));
  const resumed = await waitFor('guest reconnects with same identity', () => {
    const welcome = latest(b, 'welcome');
    return b.frames.filter(frame => frame.t === 'welcome').length > oldWelcomeCount && b.net.status === 'online' && welcome;
  });
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.playerId, guestId);
  await waitFor('reconnected guest gets current match state', () => latest(b, 'room.state')?.inMatch && latest(b, 'm.public')?.phase === 'INFO_CHECK');
  pass('abrupt disconnect and automatic in-match session resumption');

  await a.net.request('g.infoReady');
  await b.net.request('g.infoReady');
  await waitFor('strategy selection synchronized', () => phaseOnBoth('BAND_DRAFT'));
  pass('both players advance to strategy selection');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const client of [...clients].reverse()) {
    if (client.net.status === 'online') {
      try { await client.net.request('room.leave', {}, { timeout: 3000 }); }
      catch (error) { (report.cleanupErrors ||= []).push(error.message); }
    }
    client.net.close();
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  try { report.healthAfter = await health(); }
  catch (error) { (report.cleanupErrors ||= []).push(error.message); }
  if (report.healthAfter && report.healthBefore) {
    report.testRoomsAndMatchesCleaned = report.healthAfter.rooms === report.healthBefore.rooms
      && report.healthAfter.matches === report.healthBefore.matches
      && report.healthAfter.sockets === report.healthBefore.sockets;
  }
  const output = path.resolve('deployment', '公网联机验证结果.json');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}
