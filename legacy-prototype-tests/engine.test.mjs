import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { DATA, createRoom, addPlayer, start, action, tick, publicRoom, bondsOf, unitStats, isGround } from '../game/engine.mjs';

function setup(solo = true) { const room = createRoom({ solo, seed: 123 }); const player = addPlayer(room, '测试博士'); start(room, player); return { room, player }; }
const op = name => DATA.operators.find(o => o.name === name);
function unit(name, x = null, y = null, elite = false, dir = 0) { return { id: `${name}-${Math.random()}`, opId: op(name).id, x, y, elite, dir, gear: null }; }
function runUntil(room, predicate, limit = 10000) { for (let i = 0; i < limit; i++) { if (predicate()) return; tick(room, 0.1); } assert.fail(`Simulation stalled in ${room.phase}, round ${room.round}`); }

test('all art and skeletal models match their Wiki or official provenance checksums', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/manifest.json', import.meta.url)));
  assert.equal(DATA.operators.length, 51); assert.equal(DATA.bonds.length, 18); assert.equal(manifest.assets.length, 296);
  for (const asset of manifest.assets) {
    const host=new URL(asset.url).hostname;
    assert.ok(['media.prts.wiki','www.bilibili.com','torappu.prts.wiki'].includes(host));
    if(host==='www.bilibili.com'){assert.equal(asset.publisherId,161775300);assert.equal(asset.name,'ui-official-keyvisual');}
    const bytes = fs.readFileSync(new URL(`../public/${asset.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    if(asset.file.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    else assert.match(asset.file,/\.(atlas|skel)$/);
  }
  assert.equal(DATA.operators.filter(o=>o.portrait).length,51);
  assert.equal(DATA.operators.filter(o=>o.model).length,51);
  for (const operator of DATA.operators) for (const name of operator.bonds) assert.ok(DATA.bonds.some(b => b.name === name));
});
test('invalid actions cannot alter funds or deploy outside legal terrain', () => {
  const { room, player } = setup();
  action(room, player, { type: 'buy', index: 0 });
  const funds = player.funds;
  assert.throws(() => action(room, player, { type: 'buy', index: -1 }));
  assert.throws(() => action(room, player, { type: 'deploy', unitId: player.units[0].id, x: -1, y: 1 }));
  assert.throws(() => action(room, player, { type: 'deploy', unitId: player.units[0].id, x: 2, y: 2 }));
  assert.equal(player.units[0].x, null); assert.equal(player.funds, funds);
  action(room, player, { type: 'deploy', unitId: player.units[0].id, x: 4, y: 1 });
  action(room, player, { type: 'ready' });
  assert.throws(() => action(room, player, { type: 'sell', unitId: player.units[0].id }));
  assert.equal(player.funds, 0);
});
test('triple promotion retains deployed position and gives exactly one free recruitment', () => {
  const { room, player } = setup();
  player.units = [unit('讯使', 3, 1), unit('讯使')];
  player.shop = [{ opId: op('讯使').id, cost: 3 }];
  action(room, player, { type: 'buy', index: 0 });
  assert.equal(player.units.length, 1); assert.ok(player.units[0].elite);
  assert.equal(player.units[0].x, 3); assert.equal(player.units[0].y, 1);
  assert.ok(player.savedShop); assert.equal(player.shop.length, 3); assert.ok(player.shop.every(s => s.cost === 0));
  const funds = player.funds;
  action(room, player, { type: 'buy', index: 0 });
  assert.equal(player.funds, funds); assert.equal(player.savedShop, null); assert.equal(player.shop.length, 1);
});
test('full reserve still allows a promotion and equipped items survive merging', () => {
  const { room, player } = setup();
  player.units = [unit('讯使'), unit('讯使'), ...Array.from({ length: 7 }, () => unit('梅'))];
  player.units[0].gear = 'gear-0'; player.units[1].gear = 'gear-1';
  player.shop = [{ opId: op('讯使').id, cost: 3 }];
  action(room, player, { type: 'buy', index: 0 });
  assert.equal(player.units.length, 8); assert.equal(player.units.find(u => u.elite).gear, 'gear-0'); assert.deepEqual(player.equipment, ['gear-1']);
});
test('same-name units count once, reserve economy bonds count, gear improves the server stats', () => {
  const { player } = setup();
  player.units = [unit('讯使', 3, 1), unit('讯使', 4, 1), unit('角峰', 5, 1), unit('耶拉', 5, 0), unit('赫默'), unit('远山')];
  const bonds = bondsOf(player);
  assert.equal(bonds['谢拉格'].count, 3); assert.equal(bonds['谢拉格'].active, true);
  assert.equal(bonds['远见'].active, true);
  const before = unitStats(player, player.units[0]); player.units[0].gear = 'gear-0';
  assert.ok(unitStats(player, player.units[0]).atk > before.atk);
});
test('frozen supply persists to next round while unused funds are reset', () => {
  const { room, player } = setup();
  const id = player.shop[0].opId; action(room, player, { type: 'freeze', index: 0 });
  player.units = [unit('泥岩', 4, 1, true, 2), unit('澄闪', 3, 0, true, 1)];
  player.funds = 99; action(room, player, { type: 'ready' }); assert.equal(player.funds, 0);
  runUntil(room, () => room.phase !== 'battle');
  assert.equal(room.round, 2); assert.equal(player.shop[0].opId, id); assert.ok(player.shop[0].frozen); assert.ok(player.funds < 99);
});
test('starter formation survives the first wave and combat is genuinely simulated', () => {
  const { room, player } = setup();
  for (let i = 0; i < 3; i++) action(room, player, { type: 'buy', index: i });
  for (const [i, x, y, dir] of [[0, 4, 1, 2], [1, 3, 0, 1], [2, 4, 2, 3]]) action(room, player, { type: 'deploy', unitId: player.units[i].id, x, y, dir });
  action(room, player, { type: 'ready' });
  runUntil(room, () => room.phase !== 'battle');
  assert.equal(player.hp, 30); assert.equal(player.kills, 7); assert.ok(player.damage > 0); assert.equal(room.round, 2);
});
test('multiplayer preparation respects all-player readiness and the 70 second timeout', () => {
  const room = createRoom({ solo: false, seed: 3 }), a = addPlayer(room), b = addPlayer(room, '队友'); start(room, a);
  action(room, a, { type: 'ready' }); assert.equal(room.phase, 'prep');
  tick(room, 69); assert.equal(room.phase, 'prep'); tick(room, 1); assert.equal(room.phase, 'battle');
  assert.throws(() => addPlayer(room, '迟到博士'));
  assert.throws(() => action(room, b, { type: 'speed', value: 2 }));
});
test('perfect defenders enter the rescue stage and protect a teammate', () => {
  const room = createRoom({ solo: false, seed: 7 }), a = addPlayer(room, '守卫'), b = addPlayer(room, '队友'); start(room, a);
  a.units = [unit('泥岩', 4, 1, true, 2), unit('澄闪', 3, 0, true, 1), unit('蕾缪安', 3, 2, true, 3)];
  action(room, a, { type: 'ready' }); action(room, b, { type: 'ready' });
  runUntil(room, () => room.phase === 'rescue');
  assert.ok(a.battle.enemies.length > 0); assert.equal(b.battle.leaks.length, 0);
  runUntil(room, () => room.phase !== 'rescue');
  assert.equal(room.phase, 'prep'); assert.equal(room.round, 2); assert.equal(b.hp, 30);
});
test('empty formation loses rather than receiving a fabricated victory', () => {
  const { room, player } = setup();
  for (let r = 0; r < 6 && room.phase !== 'lost'; r++) { action(room, player, { type: 'ready' }); runUntil(room, () => room.phase !== 'battle'); }
  assert.equal(room.phase, 'lost'); assert.equal(player.hp, 0);
});
test('a complete 16-round run reaches a real boss and a victory result', () => {
  const { room, player } = setup();
  player.units = [unit('泥岩', 4, 1, true, 2), unit('余', 8, 3, true, 3), unit('锏', 3, 5, true, 2),
    unit('蕾缪安', 3, 0, true, 1), unit('澄闪', 5, 2, true, 3), unit('林', 6, 4, true, 3),
    unit('白面鸮', 4, 0, true, 1), unit('华法琳', 5, 4, true, 3), unit('菲亚梅塔', 7, 2, true, 1), unit('异客', 2, 4, true, 1)];
  let bossSeen = false;
  for (let r = 1; r <= 16; r++) {
    assert.equal(room.phase, 'prep'); assert.equal(room.round, r); action(room, player, { type: 'ready' });
    for (let t = 0; t < 4000 && room.phase === 'battle'; t++) { tick(room, 0.1); if (player.battle?.enemies.some(e => e.boss)) bossSeen = true; }
    if (room.phase === 'reward') action(room, player, { type: 'reward', index: 2 });
  }
  assert.ok(bossSeen); assert.equal(room.phase, 'won'); assert.ok(player.kills > 100); assert.ok(player.hp > 0);
});
test('public snapshots hide reconnect credentials and other players private shops', () => {
  const room = createRoom({ solo: false }), a = addPlayer(room), b = addPlayer(room, '队友');
  const snapshot = publicRoom(room, a.id), json = JSON.stringify(snapshot);
  assert.ok(!json.includes(a.token) && !json.includes(b.token));
  assert.ok(snapshot.players[0].shop); assert.equal(snapshot.players[1].shop, undefined);
});
