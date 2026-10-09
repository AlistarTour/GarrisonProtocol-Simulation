import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

export const DATA = JSON.parse(fs.readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const OPS = new Map(DATA.operators.map(op => [op.id, op]));
export const LAST_ROUND = 16;
export const PATH = [];
for (let x = 0; x <= 8; x++) PATH.push({ x, y: 1 });
PATH.push({ x: 8, y: 2 });
for (let x = 8; x >= 1; x--) PATH.push({ x, y: 3 });
PATH.push({ x: 1, y: 4 });
for (let x = 1; x <= 9; x++) PATH.push({ x, y: 5 });
export const isGround = (x, y) => PATH.some(p => p.x === x && p.y === y);
const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const fail = message => { throw new Error(message); };
export function random(room) {
  let x = room.seed | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  room.seed = x >>> 0;
  return room.seed / 4294967296;
}
function pick(room, list) { return list[Math.floor(random(room) * list.length)]; }
export function createRoom({ code = 'SOLO', solo = true, difficulty = 'standard', seed = Date.now() } = {}) {
  return { code, solo, difficulty: ['standard', 'hard', 'extreme'].includes(difficulty) ? difficulty : 'standard',
    seed: (seed >>> 0) || 1, phase: 'lobby', round: 0, players: [], events: [], effects: [],
    clock: 0, phaseTime: 0, speed: 1, createdAt: Date.now(), updatedAt: Date.now(), rewardRound: 0 };
}
export function log(room, message, kind = 'info') {
  room.events.unshift({ id: randomUUID(), message, kind, round: room.round });
  room.events = room.events.slice(0, 24);
}
export function addPlayer(room, name = '博士', strategy = 'unity') {
  if (room.phase !== 'lobby') fail('模拟已开始，请等待下一次模拟。');
  if (room.players.length >= 4) fail('同盟已满，最多 4 位博士。');
  const player = { id: randomUUID(), token: randomUUID(), name: String(name).trim().slice(0, 16) || '博士',
    connected: true, strategy: DATA.strategies.some(s => s.id === strategy) ? strategy : 'unity',
    hp: 30, funds: 12, level: 1, units: [], shop: [], savedShop: null, equipment: [], gearOffer: 'gear-0',
    layers: {}, ready: false, battle: null, reward: null, kills: 0, damage: 0, spent: 0, bonus: 0, refreshes: 0 };
  room.players.push(player);
  log(room, `${player.name}已加入同盟。`);
  return player;
}
export function bondsOf(player) {
  const result = {};
  for (const bond of DATA.bonds) {
    const roster = ['远见', '投资人', '奇迹'].includes(bond.name) ? player.units : player.units.filter(u => u.x !== null);
    const unique = new Set(roster.filter(u => OPS.get(u.opId).bonds.includes(bond.name)).map(u => u.opId));
    const count = unique.size;
    result[bond.name] = { count, active: count >= bond.threshold, threshold: bond.threshold, layers: player.layers[bond.name] || 0 };
  }
  return result;
}
export function unitStats(player, unit, difficulty = 'standard') {
  const op = OPS.get(unit.opId), bonds = bondsOf(player);
  let atk = op.atk, hp = op.hp, def = op.def, interval = op.interval;
  const elite = unit.elite ? 1.8 : 1;
  atk *= elite; hp *= elite; def *= elite;
  if (difficulty === 'standard') { atk *= 1.3; hp *= 1.3; def *= 1.3; }
  if (player.strategy === 'unity') {
    const n = Object.values(bonds).filter(b => b.active).length;
    const bonus = n >= 4 ? 1.5 : n >= 3 ? 1.3 : n >= 2 ? 1.15 : 1;
    atk *= bonus; hp *= bonus;
  }
  const active = name => bonds[name]?.active;
  const layer = name => bonds[name]?.layers || 0;
  if (op.bonds.includes('炎') && active('炎')) atk *= 1.23 + 0.009 * layer('炎');
  if (op.bonds.includes('谢拉格') && active('谢拉格')) atk *= 1.3;
  if (op.bonds.includes('阿戈尔') && active('阿戈尔')) hp *= 1.35 + 0.01 * layer('阿戈尔');
  if (op.bonds.includes('维多利亚') && unit.gear && active('维多利亚')) atk *= 1.2 + 0.008 * layer('维多利亚');
  if (op.bonds.includes('拉特兰') && active('拉特兰')) interval /= 1.12 + 0.005 * layer('拉特兰');
  if (op.bonds.includes('萨尔贡') && active('萨尔贡')) interval /= 1.12 + 0.0022 * layer('萨尔贡');
  if (active('精准') && !op.ground) atk *= 1.1 + 0.012 * layer('精准');
  if (active('坚守')) hp *= 1.3 + 0.0125 * layer('坚守');
  if (active('助力')) def *= 1.15 + 0.012 * layer('助力');
  if (active('灵巧')) interval /= 1.1 + 0.01 * layer('灵巧');
  if (active('协防干员')) atk *= unit.elite ? 1.4 : 1.2;
  if (unit.gear === 'gear-0') atk *= 1.25;
  if (unit.gear === 'gear-1') { hp *= 1.35; def += 80; }
  if (unit.gear === 'gear-2') interval /= 1.25;
  return { atk: Math.round(atk), maxHp: Math.round(hp), def: Math.round(def), interval, range: op.range, block: op.block };
}
const costOf = (player, opId) => OPS.get(opId).name === '红豆' ? 1 : bondsOf(player)['远见']?.layers >= 100 ? 2 : 3;
export function refreshShop(room, player, free = false) {
  if (!free) {
    if (player.savedShop) fail('请先领取晋升补给。');
    const miracle = bondsOf(player)['奇迹'];
    const gratis = miracle?.active && random(room) < 0.25 + miracle.layers * 0.003;
    if (!gratis) { if (player.funds < 2) fail('刷新需要 2 资金。'); player.funds -= 2; player.spent += 2; }
    player.refreshes++;
  }
  const available = DATA.operators.filter(op => op.tier <= player.level);
  const n = 3 + Math.floor(player.level / 2);
  player.shop = Array.from({ length: n }, (_, i) => {
    if (free && player.shop[i]?.frozen && player.shop[i].opId) return player.shop[i];
    let op = pick(room, available);
    // Higher tiers are less common; the seeded server owns all draws.
    if (op.tier === player.level && player.level > 1 && random(room) < 0.45) op = pick(room, available.filter(o => o.tier < player.level));
    return { opId: op.id, frozen: false, cost: costOf(player, op.id) };
  });
  if (room.round === 1 && free && player.level === 1) {
    // A first shop always lets a new player field a blocker and ranged damage.
    for (const [i, name] of ['讯使', '梅', '惊蛰'].entries()) player.shop[i] = { opId: DATA.operators.find(o => o.name === name).id, frozen: false, cost: 3 };
  }
  player.gearOffer = pick(room, DATA.equipment).id;
}
function makeUnit(opId, elite = false) { return { id: randomUUID(), opId, elite, x: null, y: null, dir: 0, gear: null }; }
export function buy(room, player, index) {
  if (!Number.isInteger(index)) fail('无效的招募位置。');
  const slot = player.shop[index];
  if (!slot?.opId) fail('这位干员已被招募。');
  if (player.funds < slot.cost) fail('调度资金不足。');
  const matching = player.units.filter(u => u.opId === slot.opId && !u.elite);
  const benchCount = player.units.filter(u => u.x === null).length;
  if (matching.length < 2 && benchCount >= 9) fail('整备区已满，请部署或出售干员。');
  player.funds -= slot.cost; player.spent += slot.cost;
  const op = OPS.get(slot.opId);
  const fromPromotion = Boolean(player.savedShop);
  slot.opId = null;
  if (matching.length >= 2) {
    const anchor = matching.find(u => u.x !== null) || matching[0];
    const promoted = { ...makeUnit(op.id, true), x: anchor.x, y: anchor.y, dir: anchor.dir, gear: anchor.gear };
    for (const used of matching.slice(0, 2)) if (used !== anchor && used.gear) player.equipment.push(used.gear);
    player.units = player.units.filter(u => !matching.slice(0, 2).includes(u));
    player.units.push(promoted);
    if (fromPromotion) { player.shop = player.savedShop; player.savedShop = null; }
    player.savedShop = player.shop;
    const targetTier = Math.min(6, player.level + 1);
    const pool = DATA.operators.filter(o => o.tier === targetTier);
    player.shop = Array.from({ length: 3 }, () => ({ opId: pick(room, pool).id, cost: 0, frozen: false }));
    log(room, `${player.name}的${op.name}晋升为精锐，获得一次免费补给。`, 'success');
  } else {
    player.units.push(makeUnit(op.id));
    if (fromPromotion) { player.shop = player.savedShop; player.savedShop = null; }
  }
  for (const bond of op.bonds) player.layers[bond] = (player.layers[bond] || 0) + (matching.length >= 2 ? 4 : 2);
}
export function start(room, player) {
  if (room.players[0]?.id !== player.id) fail('只有同盟创建者可以开始模拟。');
  if (room.phase !== 'lobby') fail('模拟已经开始。');
  for (const p of room.players) p.hp = DATA.strategies.find(s => s.id === p.strategy).hp;
  room.round = 1;
  beginPrep(room);
  log(room, '协议已运行。第 16 回合迎战领袖。', 'success');
}
function beginPrep(room) {
  room.phase = 'prep'; room.phaseTime = 0; room.effects = [];
  for (const p of room.players) {
    p.ready = false; p.battle = null; p.spent = 0; p.refreshes = 0;
    if (p.savedShop) { p.shop = p.savedShop; p.savedShop = null; }
    p.funds = Math.min(26, 11 + Math.floor(room.round * 1.2)) + p.bonus;
    p.bonus = 0;
    refreshShop(room, p, true);
    const bonds = bondsOf(p);
    if (bonds['远见']?.active) p.funds += Math.floor(bonds['远见'].layers / 10) * 2;
    if (room.round % 3 === 0) p.equipment.push(pick(room, DATA.equipment).id);
  }
}
export function action(room, player, msg) {
  if (!player) fail('请先加入模拟。');
  if (msg.type === 'start') return start(room, player);
  if (msg.type === 'strategy') {
    if (room.phase !== 'lobby' || !DATA.strategies.some(s => s.id === msg.id)) fail('现在不能变更策略。');
    player.strategy = msg.id; return;
  }
  if (msg.type === 'speed') {
    if (room.players[0].id !== player.id) fail('只有创建者可以调整速度。');
    if (![1, 2].includes(msg.value)) fail('无效的作战速度。');
    room.speed = msg.value; return;
  }
  if (msg.type === 'reward') {
    if (room.phase !== 'reward' || !player.reward) fail('当前没有战术决策。');
    if (![0, 1, 2].includes(msg.index)) fail('无效的决策。');
    if (msg.index === 0) player.bonus += 8;
    if (msg.index === 1) player.equipment.push('gear-0', 'gear-1');
    if (msg.index === 2) player.hp += 5;
    player.reward = null;
    log(room, `${player.name}已完成战术决策。`);
    if (room.players.every(p => !p.reward)) { room.round++; beginPrep(room); }
    return;
  }
  if (msg.type === 'restart') {
    if (room.players[0]?.id !== player.id || !['won', 'lost'].includes(room.phase)) fail('当前不能重启模拟。');
    for (const p of room.players) { p.units = []; p.equipment = []; p.layers = {}; p.level = 1; p.kills = 0; p.damage = 0; p.bonus = 0; p.savedShop = null; p.shop = []; }
    room.phase = 'lobby'; room.round = 0; room.clock = 0; room.speed = 1; room.effects = []; room.events = [];
    return;
  }
  if (room.phase !== 'prep') fail('请在休整期调整阵容。');
  if (msg.type === 'ready') {
    player.ready = !player.ready;
    if (room.players.every(p => p.ready)) beginBattle(room);
    return;
  }
  if (player.ready) fail('请先取消准备，再调整阵容。');
  if (msg.type === 'buy') return buy(room, player, msg.index);
  if (msg.type === 'refresh') return refreshShop(room, player);
  if (msg.type === 'freeze') {
    if (player.savedShop) fail('晋升补给不能冻结。');
    const slot = player.shop[msg.index];
    if (!slot?.opId) fail('没有可冻结的补给。');
    slot.frozen = !slot.frozen; return;
  }
  if (msg.type === 'upgrade') {
    if (player.savedShop) fail('请先领取晋升补给。');
    if (player.level >= 6) fail('调度中心已达到最高等级。');
    const cost = 5 + player.level * 2;
    if (player.funds < cost) fail(`升级需要 ${cost} 资金。`);
    player.funds -= cost; player.spent += cost; player.level++;
    log(room, `${player.name}的调度中心升至 Lv.${player.level}。`);
    return;
  }
  if (msg.type === 'buyGear') {
    if (player.funds < 3) fail('装备需要 3 资金。');
    if (player.equipment.length >= 12) fail('装备仓库已满。');
    if (!player.gearOffer) fail('本次装备已购买，请刷新补给。');
    player.funds -= 3; player.spent += 3; player.equipment.push(player.gearOffer); player.gearOffer = null; return;
  }
  const unit = player.units.find(u => u.id === msg.unitId);
  if (!unit) fail('未找到该干员。');
  if (msg.type === 'deploy') {
    const { x, y } = msg;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 9 || y < 0 || y > 6) fail('无效的部署位置。');
    if ((x === 0 && y === 1) || (x === 9 && y === 5)) fail('出入口不能部署干员。');
    const op = OPS.get(unit.opId);
    if (op.ground !== isGround(x, y)) fail(op.ground ? '地面干员需要部署在地面路径。' : '高台干员需要部署在高台。');
    if (unit.x === null && player.units.filter(u => u.x !== null).length >= 10) fail('最多同时部署 10 名干员。');
    if (player.units.some(u => u.id !== unit.id && u.x === x && u.y === y)) fail('该位置已有干员。');
    unit.x = x; unit.y = y;
    if (Number.isInteger(msg.dir) && msg.dir >= 0 && msg.dir <= 3) unit.dir = msg.dir;
    return;
  }
  if (msg.type === 'rotate') { unit.dir = (unit.dir + 1) % 4; return; }
  if (msg.type === 'withdraw') {
    if (unit.x === null) return;
    if (player.units.filter(u => u.x === null).length >= 9) fail('整备区已满。');
    unit.x = null; unit.y = null; return;
  }
  if (msg.type === 'sell') {
    player.funds += unit.elite ? 3 : 1;
    if (unit.gear) player.equipment.push(unit.gear);
    player.units = player.units.filter(u => u.id !== unit.id); return;
  }
  if (msg.type === 'equip') {
    if (!Number.isInteger(msg.index) || !player.equipment[msg.index]) fail('没有这件装备。');
    const [gear] = player.equipment.splice(msg.index, 1);
    if (unit.gear) player.equipment.push(unit.gear);
    unit.gear = gear; return;
  }
  fail('未知操作。');
}
function enemy(room, type, progress = 0, hpOverride = null) {
  const round = room.round;
  const difficulty = room.difficulty === 'extreme' ? 1.6 : room.difficulty === 'hard' ? 1.25 : 1;
  const base = [430, 650, 1500, 6000][type];
  const maxHp = Math.round(base * (1 + (round - 1) * 0.2) * difficulty * (type === 3 ? 1.5 : 1));
  return { id: randomUUID(), type, name: DATA.enemies[type].name, progress, hp: hpOverride ?? maxHp, maxHp,
    atk: Math.round([130, 230, 300, 540][type] * (1 + round * 0.1) * difficulty), def: [10, 80, 390, 300][type],
    speed: [1.2, 0.85, 0.65, 0.55][type], cooldown: 0, slow: 0, boss: type === 3, blockedBy: null };
}
function wave(room) {
  const count = 6 + Math.floor(room.round * 1.4);
  return Array.from({ length: count }, (_, i) => {
    let type = room.round <= 3 ? (i % 4 === 3 ? 1 : 0) : room.round < 8 ? (i % 5 === 4 ? 2 : 1) : (i % 3 === 0 ? 2 : 1);
    if (room.round === LAST_ROUND && i === count - 1) type = 3;
    return { at: i * (room.round === LAST_ROUND ? 0.6 : 0.85), type };
  });
}
function battleUnit(room, player, unit) {
  const stats = unitStats(player, unit, room.difficulty);
  return { ...unit, ...stats, hp: stats.maxHp, cooldown: 0.15, skill: 7 + (OPS.get(unit.opId).tier % 3), buff: 0, revives: 0 };
}
export function beginBattle(room) {
  room.phase = 'battle'; room.phaseTime = 0; room.effects = [];
  for (const p of room.players) {
    const active = bondsOf(p);
    for (const [name, bond] of Object.entries(active)) if (bond.active) p.layers[name] = (p.layers[name] || 0) + (active['助力'].active ? 4 : 2);
    if (p.strategy === 'watch') {
      const tiers = new Set();
      for (const u of p.units.filter(u => u.x !== null)) {
        const op = OPS.get(u.opId);
        if (!tiers.has(op.tier)) { for (const name of op.bonds) p.layers[name] = (p.layers[name] || 0) + 2; tiers.add(op.tier); }
      }
    }
    p.funds = 0; p.ready = true;
    p.battle = { units: p.units.filter(u => u.x !== null).map(u => battleUnit(room, p, u)), enemies: [], queue: wave(room),
      leaks: [], kills: 0, damage: 0, done: false, rescue: false };
  }
  log(room, `第 ${room.round} 回合作战开始。`, 'battle');
}
export function enemyPosition(e) {
  const n = Math.max(0, Math.min(PATH.length - 1, e.progress));
  const i = Math.floor(n), a = PATH[i], b = PATH[Math.min(i + 1, PATH.length - 1)], f = n - i;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
function inRange(unit, target, range = unit.range) {
  const dx = target.x - unit.x, dy = target.y - unit.y;
  const dir = directions[unit.dir];
  return dx * dx + dy * dy <= range * range && dx * dir.x + dy * dir.y >= -0.45;
}
function fx(room, player, unit, target, kind = 'attack', amount = 0) {
  room.effects.push({ id: randomUUID(), playerId: player.id, x: unit.x, y: unit.y, tx: target.x, ty: target.y, kind, amount: Math.round(amount), until: room.clock + 0.4 });
}
function runBattle(room, p, dt) {
  const b = p.battle;
  if (!b || b.done) return;
  while (b.queue.length && b.queue[0].at <= room.phaseTime) b.enemies.push(enemy(room, b.queue.shift().type));
  const bonds = bondsOf(p);
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    const op = OPS.get(u.opId);
    u.cooldown -= dt; u.skill -= dt; u.buff = Math.max(0, u.buff - dt);
    if (u.skill <= 0 && b.enemies.length) {
      u.buff = 4; u.skill = 13; fx(room, p, u, u, 'skill');
      if (op.role === '重装') u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2);
      if (bonds['萨尔贡'].active && op.bonds.includes('萨尔贡')) p.layers['萨尔贡'] = (p.layers['萨尔贡'] || 0) + 2;
    }
    if (u.cooldown > 0) continue;
    if (op.heal || op.name === '浊心斯卡蒂') {
      const target = b.units.filter(v => v.hp > 0 && v.hp < v.maxHp && inRange(u, v)).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (target) { const heal = u.atk * (u.buff ? 1.6 : 1); target.hp = Math.min(target.maxHp, target.hp + heal); u.cooldown = u.interval; fx(room, p, u, target, 'heal', heal); }
    } else {
      const targets = b.enemies.filter(e => e.hp > 0 && (e.blockedBy === u.id || inRange(u, enemyPosition(e)))).sort((a, c) => c.progress - a.progress);
      if (!targets.length) continue;
      const multi = ['惊蛰', '远山', '菲亚梅塔', '煌', '乌尔比安', '林', '佩佩'].includes(op.name) ? 3 : 1;
      for (const target of targets.slice(0, multi)) {
        const attack = u.atk * (u.buff ? 1.7 : 1);
        let damage = op.arts ? attack * 0.8 : Math.max(attack * 0.05, attack - target.def * (bonds['精准'].count >= 3 ? 0.7 : 1));
        if (bonds['突袭'].active && op.bonds.includes('突袭') && u.buff) damage *= 1.1 + bonds['突袭'].layers * 0.01;
        target.hp -= damage; b.damage += damage;
        if (op.slow || bonds['谢拉格'].count >= 6) target.slow = 1.2;
        fx(room, p, u, enemyPosition(target), op.arts ? 'arts' : 'attack', damage);
      }
      u.cooldown = u.interval / (u.buff ? 1.25 : 1);
    }
  }
  const blockCounts = new Map();
  const living = [];
  for (const e of b.enemies) {
    if (e.hp <= 0) { b.kills++; continue; }
    e.cooldown -= dt; e.slow = Math.max(0, e.slow - dt);
    const pos = enemyPosition(e);
    const previousBlocker = b.units.find(u => u.id === e.blockedBy && u.hp > 0);
    let blocker = previousBlocker && (blockCounts.get(previousBlocker.id) || 0) < previousBlocker.block ? previousBlocker : null;
    if (!blocker) blocker = b.units.find(u => u.hp > 0 && u.block > 0 && Math.abs(u.x - pos.x) < 0.42 && Math.abs(u.y - pos.y) < 0.42 && (blockCounts.get(u.id) || 0) < u.block);
    e.blockedBy = blocker?.id || null;
    if (blocker) {
      blockCounts.set(blocker.id, (blockCounts.get(blocker.id) || 0) + 1);
      if (e.cooldown <= 0) {
        let damage = Math.max(e.atk * 0.05, e.atk - blocker.def);
        if (bonds['协防干员'].active) damage *= 0.8;
        blocker.hp -= damage; e.cooldown = 1.2;
        fx(room, p, pos, blocker, 'enemy', damage);
        if (blocker.hp <= 0 && bonds['不屈'].active && blocker.revives < 1 && random(room) < 0.18 + bonds['不屈'].layers * 0.004) {
          blocker.hp = blocker.maxHp * 0.5; blocker.revives++; fx(room, p, blocker, blocker, 'heal');
        }
      }
    } else e.progress += e.speed * dt * (e.slow ? 0.5 : 1);
    if (e.progress >= PATH.length - 1) {
      b.leaks.push({ type: e.type, hp: e.hp, maxHp: e.maxHp, boss: e.boss });
      fx(room, p, { x: 9, y: 5 }, { x: 9, y: 5 }, 'leak');
    } else living.push(e);
  }
  b.enemies = living;
  if ((!b.queue.length && !b.enemies.length) || room.phaseTime >= 95) {
    if (room.phaseTime >= 95) { b.leaks.push(...b.enemies.map(e => ({ type: e.type, hp: e.hp, maxHp: e.maxHp, boss: e.boss }))); b.enemies = []; b.queue = []; }
    b.done = true;
  }
}
function applyLeaks(room) {
  for (const p of room.players) {
    const b = p.battle;
    const loss = b.leaks.reduce((n, e) => n + (e.boss ? 15 : e.type === 2 ? 2 : 1), 0);
    p.hp = Math.max(0, p.hp - loss);
    p.kills += b.kills; p.damage += Math.round(b.damage);
    log(room, loss ? `${p.name}漏过 ${b.leaks.length} 个目标，耐久损失 ${loss}。` : `${p.name}完成完美作战。`, loss ? 'danger' : 'success');
  }
  if (room.players.every(p => p.hp <= 0)) { room.phase = 'lost'; log(room, '防线失守，模拟终止。', 'danger'); }
  else if (room.round === LAST_ROUND) {
    const bossEscaped = room.players.some(p => p.battle.leaks.some(e => e.boss));
    room.phase = bossEscaped ? 'lost' : 'won';
    log(room, bossEscaped ? '领袖突破防线，模拟终止。' : '领袖已被击退。协议履行完毕。', bossEscaped ? 'danger' : 'success');
  } else if ([5, 8, 12].includes(room.round)) {
    room.phase = 'reward'; room.phaseTime = 0;
    for (const p of room.players) p.reward = true;
  } else { room.round++; beginPrep(room); }
}
function resolveBattle(room) {
  const leaked = room.players.flatMap(p => p.battle.leaks.map(e => ({ ...e, ownerId: p.id })));
  const winners = room.players.filter(p => !p.battle.leaks.length && p.battle.units.some(u => u.hp > 0));
  if (room.phase === 'battle' && !room.solo && leaked.length && winners.length) {
    room.phase = 'rescue'; room.phaseTime = 0;
    for (const p of room.players) { p.battle.done = true; p.battle.leaks = []; }
    leaked.forEach((e, i) => {
      const p = winners[i % winners.length];
      const en = enemy(room, e.type, 0, e.hp);
      en.maxHp = e.maxHp; en.ownerId = e.ownerId;
      p.battle.enemies.push(en); p.battle.done = false; p.battle.rescue = true;
    });
    log(room, '联防阶段：完美作战阵地正在拦截突破目标。', 'battle');
    return;
  }
  applyLeaks(room);
}
export function tick(room, elapsed = 0.1) {
  room.updatedAt = Date.now();
  if (!['prep', 'battle', 'rescue', 'reward'].includes(room.phase)) return;
  const dt = elapsed * (['battle', 'rescue'].includes(room.phase) ? room.speed : 1);
  room.clock += dt; room.phaseTime += dt;
  room.effects = room.effects.filter(e => e.until > room.clock).slice(-100);
  if (room.phase === 'prep' && !room.solo && room.phaseTime >= 70) beginBattle(room);
  else if (room.phase === 'reward' && !room.solo && room.phaseTime >= 70) {
    for (const p of room.players) if (p.reward) { p.bonus += 8; p.reward = null; }
    room.round++; beginPrep(room);
  } else if (['battle', 'rescue'].includes(room.phase)) {
    for (const p of room.players) runBattle(room, p, dt);
    if (room.players.every(p => p.battle?.done)) resolveBattle(room);
  }
}
export function publicRoom(room, viewerId) {
  return { code: room.code, solo: room.solo, difficulty: room.difficulty, phase: room.phase, round: room.round,
    maxRound: LAST_ROUND, clock: room.clock, phaseTime: room.phaseTime, speed: room.speed, path: PATH,
    hostId: room.players[0]?.id, viewerId, events: room.events, effects: room.effects,
    players: room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected, strategy: p.strategy, hp: p.hp,
      funds: p.funds, level: p.level, units: p.units.map(u => ({ ...u, stats: unitStats(p, u, room.difficulty) })), ready: p.ready, battle: p.battle ? {
        units: p.battle.units, enemies: p.battle.enemies, pending: p.battle.queue.length, leaks: p.battle.leaks.length,
        kills: p.battle.kills, damage: Math.round(p.battle.damage), done: p.battle.done, rescue: p.battle.rescue
      } : null, bonds: bondsOf(p), kills: p.kills, damage: p.damage,
      ...(p.id === viewerId ? { shop: p.shop, equipment: p.equipment, gearOffer: p.gearOffer, reward: p.reward, promotion: Boolean(p.savedShop) } : {}) })) };
}
