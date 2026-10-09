import {modelReady,renderModels,preloadModels,hideModels} from './models.bundle.js';
import {drawBattle,boardTile,project} from './battle-renderer.js';
import {simulationBriefing,activityHome,allianceSelection,difficultySelection,strategySelection,allianceLobby,battlefield,svg} from './original-screens.js';
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialog-content');
const data = await fetch('/data.json').then(r => { if (!r.ok) throw new Error('数据库载入失败'); return r.json(); });
const ops = new Map(data.operators.map(o => [o.id, o]));
preloadModels(data.operators);
const gear = new Map(data.equipment.map(g => [g.id, g]));
const images = new Map();
for (const src of [...data.operators.map(o => o.image), ...data.bonds.map(b => b.icon), ...data.enemies.map(e => e.image), '/assets/ui-map-01.png', '/assets/official/desert-background.png', '/assets/official/attack-range-attack.png']) {
  const img = new Image(); img.src = src; images.set(src, img);
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.8a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
  exit: '<path d="M9 4H4v16h5M14 7l5 5-5 5M8 12h11"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  freeze: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4l3 3 3-3M9 20l3-3 3 3"/>',
  rotate: '<path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/>',
  route: '<path d="M3 5h15v7H6v7h15"/><rect x="2" y="3" width="3" height="4"/><rect x="18" y="17" width="3" height="4"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
const romans = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const phaseNames = { lobby: '协议待命', prep: '休整期', battle: '作战阶段', rescue: '联防阶段', reward: '战术决策', won: '协议完成', lost: '模拟终止' };
const difficultyNames = { standard: '标准模拟', hard: '险境模拟', extreme: '绝境模拟' };
let ws, connected = false, reconnectTimer, reconnectAttempts = 0, state = null, uiKey = '', selectedId = null, selectedGear = null;
let viewedId = null, selectedStrategy = 'unity', nickname = localStorage.getItem('garrison-name') || '博士', difficulty = 'standard';
let routeVisible = true, hoveredTile = null, keyboardTile = { x: 3, y: 2 }, pendingRecruit = null;
let creating = false, intentionalClose = false, terminalModalKey = '', networkAddresses = [];
let uiPage = 'home', protocolMode = 'solo', shopOpen = true, unitTab = 'trait', latency = null;
let placement = null;
// In-app browsers may keep multiple game views under one top-level session.
// A per-view URL key isolates reconnect storage without exposing the token.
const pageUrl = new URL(location.href);
const initialRoom = pageUrl.searchParams.get('room') || '';
const existingClientId = pageUrl.searchParams.get('client');
function newClientId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // randomUUID needs HTTPS, but getRandomValues also works over LAN HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const clientId = /^[a-f0-9-]{36}$/i.test(existingClientId || '') ? existingClientId : newClientId();
const sessionKey = `garrison-session-${clientId}`;
if (!existingClientId) {
  const legacy = sessionStorage.getItem('garrison-session');
  if (legacy) { sessionStorage.setItem(sessionKey, legacy); sessionStorage.removeItem('garrison-session'); }
  pageUrl.searchParams.set('client', clientId);
  history.replaceState(null, '', pageUrl);
}
let roomInput = /^[A-F0-9]{6}$/i.test(initialRoom) ? initialRoom : '';
if(roomInput){uiPage='alliance';protocolMode='coop';}
const me = () => state?.players.find(p => p.id === state.viewerId);
const viewed = () => state?.players.find(p => p.id === viewedId) || me();
const myUnit = () => me()?.units.find(u => u.id === selectedId);
const currentUnit = () => viewed()?.units.find(u => u.id === selectedId);
const canEdit = () => state?.phase === 'prep' && !me()?.ready && viewed()?.id === me()?.id && connected;
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : ''); el.textContent = message;
  document.querySelector('#toasts').append(el); setTimeout(() => el.remove(), 4000);
}
function send(message) {
  if (!connected || ws.readyState !== WebSocket.OPEN) { toast('连接正在恢复，请稍候。', true); return; }
  ws.send(JSON.stringify(message));
}
function session() { try { return JSON.parse(sessionStorage.getItem(sessionKey)); } catch { return null; } }
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    connected = true; reconnectAttempts = 0; creating = false;
    const saved = session();
    if (saved) send({ type: 'resume', ...saved }); else render(true);
    send({type:'ping',at:performance.now()}); updateConnection();
  };
  ws.onmessage = event => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if(msg.type==='pong'){latency=Math.max(1,Math.round(performance.now()-msg.at));updateConnection();return;}
    if (msg.type === 'session') {
      sessionStorage.setItem(sessionKey, JSON.stringify({ code: msg.code, token: msg.token }));
      creating = false;
    } else if (msg.type === 'state') {
      const previousIds = new Set(me()?.units.map(u => u.id) || []);
      state = msg.state;
      if (!viewedId || !state.players.some(p => p.id === viewedId)) viewedId = state.viewerId;
      if (pendingRecruit) {
        const unit = me().units.find(u => !previousIds.has(u.id) && u.opId === pendingRecruit);
        if (unit) selectedId = unit.id;
        pendingRecruit = null;
      }
      if (selectedId && !viewed()?.units.some(u => u.id === selectedId)) selectedId = null;
      render(); updateDynamic(); showPhaseDialog();
    } else if (msg.type === 'error') {
      pendingRecruit = null; placement = null; creating = false; toast(msg.message, true); render(true);
    } else if (msg.type === 'expired') {
      sessionStorage.removeItem(sessionKey); state = null; uiKey = ''; selectedId = null; viewedId = null;
      toast('上次模拟已结束或服务器已重启。'); render(true);
    } else if (msg.type === 'left') {
      sessionStorage.removeItem(sessionKey); state = null; selectedId = null; viewedId = null; uiKey = ''; terminalModalKey = ''; uiPage='home';
      if (dialog.open) dialog.close(); render(true);
    }
  };
  ws.onclose = event => {
    connected = false; updateConnection();
    if (event.code === 4001) { intentionalClose = true; toast('此模拟已在另一个标签页打开。', true); return; }
    if (intentionalClose) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, Math.min(8000, 1000 * 2 ** reconnectAttempts++));
  };
  ws.onerror = () => {};
}
function updateConnection() {
  const el = document.querySelector('.connection');
  if (el) { el.textContent = connected ? '终端已连接' : '正在重连'; el.classList.toggle('offline', !connected); }
  const hud=document.querySelector('#hud-connection');
  if(hud){hud.textContent=connected?(latency===null?'在线':latency+'ms'):'重连';hud.classList.toggle('offline',!connected);}
}
function home() {
  if(uiPage==='alliance')return allianceSelection({roomInput,connected,difficulty,difficultyNames});
  if(uiPage==='difficulty')return difficultySelection({difficulty,difficultyNames,mode:protocolMode});
  if(uiPage==='briefing')return simulationBriefing({data,difficulty,difficultyNames});
  if(uiPage==='strategy')return strategySelection({data,selectedStrategy,connected});
  return activityHome({nickname,connected});
}
function lobby() {return allianceLobby({state,me:me(),data,difficultyNames});}
function game() {return battlefield({state,p:me(),v:viewed(),data,ops,gear,selectedId,selectedGear,editable:canEdit(),selected:currentUnit(),shopOpen,unitTab,connected,latency,direction:placement&&placement.id===selectedId&&currentUnit()?.x!==null?project(currentUnit().x+.5,currentUnit().y+.5):null});}
function scaleScreen(){const stage=document.querySelector('.ak-stage');if(stage)stage.style.setProperty('--ui-scale',String(stage.getBoundingClientRect().width/1280));}
function positionDirection(){
  const el=document.querySelector('.ak-direction');
  const unit=currentUnit();
  if(!el||!unit||unit.x===null||unit.y===null)return;
  const point=project(unit.x+.5,unit.y+.5);
  el.style.setProperty('left',`${point.x-160}px`,'important');
  el.style.setProperty('top',`${Math.max(130,point.y-130)}px`,'important');
}
window.addEventListener('resize',scaleScreen);
function render(force = false) {
  const key = !state ? `home-${uiPage}-${selectedStrategy}-${connected}-${creating}-${difficulty}` : JSON.stringify({ phase: state.phase, round: state.round, speed: state.speed, selectedId, selectedGear, viewedId, routeVisible, shopOpen, unitTab, placement,
    players: state.players.map(p => ({ id: p.id, name: p.name, strategy: p.strategy, ready: p.ready, connected: p.connected, units: p.units, funds: p.funds, level: p.level, shop: p.shop, gearOffer: p.gearOffer, equipment: p.equipment, bonds: p.bonds, hp: p.hp, done: p.battle?.done })), log: state.events[0]?.id });
  if (!force && uiKey === key) return;
  uiKey = key;
  app.innerHTML = !state ? home() : state.phase === 'lobby' ? lobby() : game();
  scaleScreen();
  positionDirection();
  if(!state||state.phase==='lobby')hideModels();
  setupCanvas(); updateDynamic();
}
function updateDynamic() {
  if (!state || state.phase === 'lobby') return;
  const clock = document.querySelector('#phase-time');
  const seconds = Math.max(0, Math.ceil(['prep', 'reward'].includes(state.phase) && !state.solo ? 70 - state.phaseTime : state.phaseTime));
  if (clock) clock.textContent = state.phase === 'prep' && state.solo ? '∞' : String(seconds);
  const hp = document.querySelector('#view-hp'); if (hp) hp.textContent = viewed().hp;
  const health=document.querySelector('#unit-health'),u=currentUnit(),live=viewed().battle?.units.find(unit=>unit.id===selectedId);if(health&&u)health.textContent=`生命 ${Math.round(live?.hp??u.stats.maxHp)} / ${live?.maxHp??u.stats.maxHp}`;
  const enemies = document.querySelector('#enemy-count');
  if (enemies) enemies.textContent = viewed().battle ? `${viewed().battle.kills}/${viewed().battle.kills+viewed().battle.enemies.length+viewed().battle.pending}` : `本回合 ${6 + Math.floor(state.round * 1.4)}`;
}
function modal(html, key = '') {
  dialogContent.innerHTML = html; terminalModalKey = key;
  if (!dialog.open) dialog.showModal();
}
const modalHeader = (tag, title, text = '') => `<div class="dialog-eyebrow">${tag}</div><h2 class="dialog-title">${title}</h2>${text ? `<p class="dialog-description">${text}</p>` : ''}`;
function showPhaseDialog() {
  if (!state) return;
  if (state.phase === 'reward' && me().reward && terminalModalKey !== `reward-${state.round}`) {
    modal(`${modalHeader('TACTICAL DECISION', '机变阶段 · 道具补给', '补给已送达。为接下来的作战选择一项支援。')}<div class="reward-grid">${[
      ['追加补给', '下一休整期额外获得 8 资金。'], ['装备支援', '获得精准狙击镜与防暴盾各一件。'], ['阵线修复', '立即恢复 5 点目标耐久。']
    ].map(([title, text], i) => `<button class="reward-card" data-action="reward" data-index="${i}"><span class="reward-index">0${i + 1}</span><strong>${title}</strong><p>${text}</p></button>`).join('')}</div>`, `reward-${state.round}`);
  } else if (['won', 'lost'].includes(state.phase) && terminalModalKey !== state.phase) {
    const p = me();
    if(state.phase==='won'){const resultId=`${state.code}-${state.clock}`;if(localStorage.getItem('garrison-last-result')!==resultId){localStorage.setItem('garrison-last-result',resultId);localStorage.setItem('garrison-completed',String(Number(localStorage.getItem('garrison-completed')||0)+1));}}
    modal(`<div class="dialog-eyebrow">PROTOCOL / ${state.phase === 'won' ? 'FULFILLED' : 'TERMINATED'}</div><h2 class="result-heading ${state.phase === 'lost' ? 'lost' : ''}">${state.phase === 'won' ? '协议履行完毕' : '防线失守'}</h2><p class="dialog-description">${state.phase === 'won' ? '目标领袖已被击退，感谢你的指挥，博士。' : '模拟已终止。调整构筑与部署，再次建立防线。'}</p><div class="result-stats"><div><label>作战回合</label><b>${state.round}</b></div><div><label>击退目标</label><b>${p.kills}</b></div><div><label>剩余耐久</label><b>${p.hp}</b></div></div><div class="result-actions">${p.id === state.hostId ? '<button class="btn primary" data-action="restart">再次模拟</button>' : '<button class="btn outline" data-action="close">查看阵地</button>'}<button class="btn outline" data-action="leave">返回终端</button></div>`, state.phase);
  } else if (state.phase !== 'reward' && terminalModalKey.startsWith('reward-') && dialog.open) { dialog.close(); terminalModalKey = ''; }
}
function help() {
  modal(`${modalHeader('PRTS / FIELD MANUAL', '作战说明')}<div class="dialog-text"><h3>1. 招募与构筑</h3><p>在调度中心招募干员，选择整备区的干员后点击地图部署。地面干员放在路径上，高台干员放在其余地块。同一初始干员集齐 3 名会晋升为精锐，并赠送一次高一阶干员的免费补给。</p><h3>2. 阵地与朝向</h3><p>地面干员可以阻挡敌人，狙击与术师从高台输出，医疗会自动治疗范围内的队友。选中干员后按 R 旋转、Delete 出售、Esc 取消。手机上点击已选中的场上干员可以旋转；长按整备干员可查看详细操作。选中装备后再点击干员即可装备。</p><h3>3. 资金与盟约</h3><p>每个休整期重新发放资金，回合结束剩余资金清零。冻结补给可保留到下回合；刷新花费 2 资金，升级中心可招募更高阶干员。盟约按不同干员人数计数，激活后提供属性加成并增长层数。</p><h3>4. 同盟模拟</h3><p>创建同盟后分享链接与 6 位密钥，最多 4 人合作。所有人准备或 70 秒结束后自动作战。点击队友标签可观察阵地；完美作战的阵地可以在联防阶段拦截突破的敌人。第 16 回合击败领袖即完成协议。</p><h3>首版复现范围</h3><p>本项目是可玩的同人原型。干员名称、等阶、职业、盟约归属及图片取自 PRTS。地图、16 回合敌人配置、干员面板、通用自动技能、装备数值与部分盟约效果经过简化。尚未实现原活动完整特质、召唤物、机变阶段、全装备/法术、弹药和全部领袖机制。联防保留敌人血量并重新进入支援阵地；战术决策固定为三选一。服务器重启后房间会清空。</p></div>`);
}
function sources() {
  modal(`${modalHeader('ASSET PROVENANCE', '资料与素材来源', '游戏图片均已保存在本地。每项素材的原始 URL、页面与 SHA-256 校验值可在素材清单中查阅。')}<div class="source-list"><div class="source-row"><div><b>明日方舟官方实机演示</b><small>2025 感谢庆典直播 · 41:45 调度中心，42:00 干员详情，42:40 战斗</small></div><a href="https://www.bilibili.com/video/BV1oHyrBsEZU/?t=2505" target="_blank" rel="noreferrer">官方视频</a></div><div class="source-row"><div><b>官方「盟约」玩法介绍</b><small>2025-11-13 官方玩法长图：活动主页、同盟大厅、策略与整备区</small></div><a href="https://www.taptap.cn/moment/738117540928029245?group_id=53933" target="_blank" rel="noreferrer">官方页面</a></div><div class="source-row"><div><b>官方「盟约」宣传 PV</b><small>主页背景采用 76 秒处的原始视频帧；不是主界面原始美术切图</small></div><a href="https://www.bilibili.com/video/BV1KLkZB2Ezu/" target="_blank" rel="noreferrer">官方 PV</a></div><div class="source-row"><div><b>逐屏 UI 对照</b><small>原始参考与当前网页截图；列出尚未还原的项目</small></div><a href="/ui-reference.html" target="_blank">打开对照页</a></div><div class="source-row"><div><b>PRTS · 卫戍协议：盟约</b><small>活动总览与合作模拟规则</small></div><a href="https://prts.wiki/w/卫戍协议：盟约" target="_blank" rel="noreferrer">原始页面</a></div><div class="source-row"><div><b>PRTS · PRTS 盟约记录</b><small>51 名干员、18 种盟约、策略与装备图标</small></div><a href="${data.sourcePage}" target="_blank" rel="noreferrer">原始页面</a></div><div class="source-row"><div><b>PRTS · 卫戍协议 / 帮助</b><small>招募、晋升、阶段与操作规则</small></div><a href="https://prts.wiki/w/卫戍协议/帮助" target="_blank" rel="noreferrer">原始页面</a></div><div class="source-row"><div><b>本地素材清单</b><small>296 项素材 · 194 个 PNG、51 个骨骼、51 个图集</small></div><a href="/assets/manifest.json" target="_blank">查看清单</a></div><div class="source-row"><div><b>明日方舟官方网站</b><small>明日方舟及角色权利归鹰角网络与原作者所有</small></div><a href="https://ak.hypergryph.com/" target="_blank" rel="noreferrer">访问官网</a></div></div><p class="dialog-description">这是非官方同人模拟原型，与官方游戏账号和游戏服务器无连接。玩法简化情况请查看作战说明。</p>`);
}
function catalog(query = '') {
  const filtered = data.operators.filter(o => `${o.name} ${o.role} ${o.bonds.join(' ')}`.includes(query));
  const grid = filtered.map(o => `<button class="catalog-card" data-action="operator" data-id="${o.id}"><img src="${o.image}" alt=""><b>${o.name}</b><small>${romans[o.tier]} / ${o.role}</small></button>`).join('');
  if (document.querySelector('#catalog-search')) { document.querySelector('#catalog-grid').innerHTML = grid; return; }
  modal(`${modalHeader('OPERATOR ARCHIVE', '干员档案', '按名称、职业或盟约搜索。此处面板是网页原型基础数值。')}<div class="catalog-controls"><input id="catalog-search" placeholder="搜索干员 / 职业 / 盟约" aria-label="搜索干员"></div><div class="catalog-grid" id="catalog-grid">${grid}</div>`);
}
function operatorInfo(id) {
  const op = ops.get(id); if (!op) return;
  modal(`${modalHeader('OPERATOR FILE', op.name, `${romans[op.tier]} 阶 · ${op.role} · ${op.ground ? '地面' : '高台'}部署`)}<div class="catalog-detail"><img src="${op.image}" alt="${op.name}"><div><p>盟约：${op.bonds.join(' / ')}</p><p>基础生命：${op.hp}<br>基础攻击 / 治疗：${op.atk}<br>基础防御：${op.def}<br>攻击间隔：${op.interval} 秒 · 阻挡数：${op.block}</p></div></div><div class="dialog-text"><p>网页原型采用按职业和等阶配置的简化面板。每名干员会自动释放通用强化技能；精锐状态面板为初始状态的 1.8 倍。标准模拟额外提供 30% 属性加成。</p><p>名称、等阶、职业和盟约归属来自 PRTS。原干员完整技能请查看 Wiki。</p></div><div class="result-actions"><a class="btn outline" href="${op.sourcePage}" target="_blank" rel="noreferrer">查看 PRTS 干员页面</a><button class="btn outline" data-action="catalog">返回档案</button>${currentUnit() && currentUnit().opId === id ? `<button class="btn danger" data-action="sell" ${canEdit() ? '' : 'disabled'}>出售选中干员</button>` : ''}</div>`);
}
const bondDescriptions = {
  炎: '炎干员攻击力 +(23 + 0.9 × 层数)%。六人召唤炎佑尚未实现。',
  萨尔贡: '原型中萨尔贡干员获得随层数增加的攻击速度，技能开启时增长层数。原活动逐次技能叠加机制尚未完整实现。',
  维多利亚: '持有装备的维多利亚干员伤害提升至 (120 + 0.8 × 层数)%。维式重锤尚未实现。',
  谢拉格: '谢拉格干员伤害提升至 130%；六名不同干员时，攻击会附加减速。暴风雪与冻结采用简化效果。',
  拉特兰: '原型中拉特兰干员获得额外攻击速度。原活动弹药系统尚未实现。',
  阿戈尔: '阿戈尔干员生命 +(35 + 层数)%。吞噬与生命分享尚未实现。',
  精准: '高台干员攻击 +(10 + 1.2 × 层数)%。三人时攻击忽略部分防御。',
  坚守: '所有干员生命 +(30 + 1.25 × 层数)%。伤害分摊尚未实现。',
  远见: '每个休整期按每 10 层额外获得 2 资金，达到 100 层后招募价格减少 1。整备区干员参与计数。',
  奇迹: '主动刷新时有 (25 + 0.3 × 层数)% 概率免费。整备区干员参与计数。',
  助力: '所有干员防御 +(15 + 1.2 × 层数)%，休整期结束时令已激活盟约增加更多层数。',
  灵巧: '原型中所有干员攻击速度 +(10 + 层数)；周围八格限制暂作全体效果。',
  不屈: '地面干员倒下时有 (18 + 0.4 × 层数)% 概率恢复一半生命，每场限一次。',
  突袭: '突袭干员强化技能期间额外提升伤害。自动再部署尚未实现。',
  协防干员: '全体承受伤害减少 20%，初始干员伤害提升至 120%，精锐提升至 140%。',
  投资人: '当前仅支持人数与层数统计；“获得时”特质重复触发尚未实现。',
  迅捷: '当前仅支持人数与层数统计；技能技力返还尚未实现。',
  调和: '预留盟约数据；当前干员池不含调和干员，补位效果尚未实现。'
};
function bondInfo(id) {
  const bond = data.bonds.find(b => b.id === id); if (!bond) return;
  const roster = data.operators.filter(o => o.bonds.includes(bond.name));
  modal(`${modalHeader('COVENANT REPORT', bond.name, `需要 ${bond.threshold} 名不同干员 · ${bond.core ? '核心' : '附加'}盟约`)}<div class="dialog-text"><p>${bondDescriptions[bond.name] || '此盟约尚未实现完整效果。'}</p><p>当前 ${viewed()?.bonds[bond.name]?.layers || 0} 层。不同干员按名称计数；精锐干员也只计一人。</p></div><h3 class="dialog-description">可招募的所属干员</h3><div class="catalog-grid">${roster.map(o => `<button class="catalog-card" data-action="operator" data-id="${o.id}"><img src="${o.image}" alt=""><b>${o.name}</b><small>${romans[o.tier]} / ${o.role}</small></button>`).join('')}</div>`);
}
async function invite() {
  if (!state || state.solo) { toast('独立模拟无需同盟密钥。'); return; }
  try { networkAddresses = (await fetch('/api/network').then(r => r.json())).addresses; } catch {}
  const base = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? networkAddresses[0] || location.origin : location.origin;
  const link = `${base}/?room=${state.code}`;
  modal(`${modalHeader('ALLIANCE INVITATION', '邀请博士加入同盟', '队友打开链接，输入博士代号后点击加入。双方需要能够访问同一台服务器。')}<div class="invite-code">${state.code}</div><div class="network-list">${esc(link)}</div><div class="invite-actions"><button class="btn primary" data-action="copyInvite" data-link="${esc(link)}">${icon('copy')} 复制邀请链接</button><button class="btn outline" data-action="copyCode">复制密钥</button></div><p class="dialog-description">本机已支持局域网合作。互联网合作需要将这份 Node 服务部署到可公开访问的服务器，或配置可访问的网络地址。</p>`);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制。'); } catch { toast('浏览器限制了剪贴板，可直接选中上方链接复制。'); }
}
function selectUnit(id) {
  placement = null;
  if (selectedGear !== null && canEdit() && me().units.some(u => u.id === id)) {
    send({ type: 'equip', unitId: id, index: selectedGear }); selectedGear = null; selectedId = id;
  } else selectedId = id;
  render(true);
}
app.addEventListener('click', handleClick);
dialogContent.addEventListener('click', handleClick);
async function handleClick(event) {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const name = button.dataset.action;
  if (name === 'homePage') {if(state)return handleClick({target:{closest:()=>({dataset:{action:'leavePrompt'}})}});uiPage='home';render(true);return;}
  if (name === 'alliancePage') {uiPage='alliance';protocolMode='coop';render(true);return;}
  if (name === 'soloSetup') {uiPage='difficulty';protocolMode='solo';render(true);return;}
  if (name === 'difficultyPage') {uiPage='difficulty';render(true);return;}
  if (name === 'difficultySelect') {difficulty=button.dataset.id;render(true);return;}
  if (name === 'briefingPage') {uiPage='briefing';render(true);return;}
  if (name === 'strategyPage') {uiPage='strategy';render(true);return;}
  if (name === 'toggleShop') {shopOpen=!shopOpen;render(true);return;}
  if (name === 'unitTab') {unitTab=button.dataset.id;render(true);return;}
  if (name === 'face') {
    const unit=myUnit();if(!unit||!canEdit())return;
    const turns=(Number(button.dataset.dir)-unit.dir+4)%4;
    for(let i=0;i<turns;i++)send({type:'rotate',unitId:unit.id});
    placement=null;selectedId=null;render(true);return;
  }
  if (name === 'cancelPlacement') {
    if(!placement||!canEdit())return;
    send(placement.x===null?{type:'withdraw',unitId:placement.id}:{type:'deploy',unitId:placement.id,x:placement.x,y:placement.y});
    placement=null;selectedId=null;render(true);return;
  }
  if (name === 'freezeAll') {const freeze=me().shop.some(s=>s.opId&&!s.frozen);me().shop.forEach((s,index)=>{if(s.opId&&s.frozen!==freeze)send({type:'freeze',index});});return;}
  if (name === 'stats') return modal(`${modalHeader('S.W.E.E.P. REPORT', '成就统计')}<div class="dialog-text"><p>本机完成模拟：${localStorage.getItem('garrison-completed')||0} 次</p><p>战斗记录与目标进度保存在本浏览器。${state?`当前回合：${state.round}，累计击退：${me().kills}。`:''}</p></div>`);
  if (name === 'goals') return modal(`${modalHeader('DEFENCE OBJECTIVES', '防卫目标')}<div class="dialog-text"><h3>关键目标</h3><p>完成一次独立模拟或同盟模拟。</p><p>当前完成：${Number(localStorage.getItem('garrison-completed')||0)>0?'已完成':'未完成'}</p><h3>每日防卫目标</h3><p>参与模拟并击退敌方攻势。网页版本的进度仅在本机记录。</p></div>`);
  if (name === 'rewards') return modal(`${modalHeader('MERIT EXCHANGE', '功勋兑换处')}<div class="dialog-text"><p>此页面保留原活动报酬入口。网页模拟完成记录：${localStorage.getItem('garrison-completed')||0} 次。</p><p>官方活动奖励和游戏账号道具无法在网页版本中领取。</p></div>`);
  if (name === 'help') return help();
  if (name === 'sources') return sources();
  if (name === 'catalog') { dialogContent.innerHTML = ''; return catalog(); }
  if (name === 'operator') return operatorInfo(button.dataset.id);
  if (name === 'bond') return bondInfo(button.dataset.id);
  if (name === 'simulation') { if (dialog.open) dialog.close(); render(true); return; }
  if (name === 'strategy') {
    if (state?.phase === 'lobby') send({ type: 'strategy', id: button.dataset.id });
    else { selectedStrategy = button.dataset.id; render(true); }
    return;
  }
  if (['solo', 'create', 'join', 'match'].includes(name)) {
    if (name === 'join' && !/^[A-F0-9]{6}$/i.test(roomInput)) { toast('请输入 6 位同盟密钥。', true); return; }
    creating = true;
    send({ type: name, name: nickname, strategy: selectedStrategy, difficulty, code: roomInput.trim().toUpperCase() });
    render(true); return;
  }
  if (name === 'start') return send({ type: 'start' });
  if (name === 'invite') return invite();
  if (name === 'copyInvite') return copyText(button.dataset.link);
  if (name === 'copyCode') return copyText(state.code);
  if (name === 'leavePrompt') return modal(`${modalHeader('DISCONNECT', '离开本次模拟', '离开后返回终端。已开始的模拟会保留阵容供队友继续作战；全员离线后房间保留 10 分钟。')}<div class="result-actions"><button class="btn danger" data-action="leave">离开模拟</button><button class="btn outline" data-action="close">继续指挥</button></div>`);
  if (name === 'leave') { send({ type: 'leave' }); return; }
  if (name === 'close') { dialog.close(); return; }
  if (name === 'restart') { dialog.close(); terminalModalKey = ''; send({ type: 'restart' }); return; }
  if (name === 'view') { placement=null; viewedId = button.dataset.id; selectedId = null; selectedGear = null; render(true); return; }
  if (name === 'unit') return selectUnit(button.dataset.id);
  if (name === 'deselect') { placement=null; selectedId = null; selectedGear = null; render(true); return; }
  if (name === 'gear') { selectedGear = selectedGear === Number(button.dataset.index) ? null : Number(button.dataset.index); render(true); toast(selectedGear !== null ? '点击一名干员，为其装备道具。' : '已取消装备选择。'); return; }
  if (name === 'buy') { pendingRecruit = me().shop[Number(button.dataset.index)].opId; send({ type: 'buy', index: Number(button.dataset.index) }); return; }
  if (name === 'ready' && ['reward', 'won', 'lost'].includes(state.phase)) { terminalModalKey = ''; showPhaseDialog(); return; }
  if (['freeze', 'refresh', 'upgrade', 'ready', 'buyGear'].includes(name)) { send({ type: name, index: Number(button.dataset.index) }); return; }
  if (['rotate', 'withdraw', 'sell'].includes(name)) {
    const unit = myUnit(); if (!unit) { toast('请先选择自己的干员。', true); return; }
    send({ type: name, unitId: unit.id });
    if (name === 'sell' && dialog.open) dialog.close();
    return;
  }
  if (name === 'speed') return send({ type: 'speed', value: state.speed === 1 ? 2 : 1 });
  if (name === 'route') { routeVisible = !routeVisible; render(true); return; }
  if (name === 'reward') { send({ type: 'reward', index: Number(button.dataset.index) }); dialog.close(); return; }
  if (name === 'logs') return modal(`${modalHeader('AFTER ACTION LOG', '作战记录')}<div>${state.events.map(e => `<div class="log-entry ${e.kind}"><span class="log-round">R${String(e.round).padStart(2, '0')}</span><span>${esc(e.message)}</span></div>`).join('')}</div>`);
}
app.addEventListener('input', event => {
  if (event.target.id === 'nickname') { nickname = event.target.value; localStorage.setItem('garrison-name', nickname); }
  if (event.target.id === 'room-code') roomInput = event.target.value.trim().toUpperCase();
});
app.addEventListener('change', event => { if (event.target.id === 'difficulty') difficulty = event.target.value; });
dialogContent.addEventListener('input', event => { if (event.target.id === 'catalog-search') catalog(event.target.value.trim()); });
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
app.addEventListener('dragstart', event => { const slot = event.target.closest('.bench-slot[data-id]'); if (slot && canEdit()) { selectedId = slot.dataset.id; event.dataTransfer.setData('text/plain', selectedId); event.dataTransfer.effectAllowed = 'move'; } });
let longPressTimer;
app.addEventListener('pointerdown', event => {
  const slot = event.target.closest('.bench-slot[data-id]');
  if (slot && event.pointerType !== 'mouse') longPressTimer = setTimeout(() => { selectedId = slot.dataset.id; operatorInfo(viewed().units.find(u => u.id === selectedId).opId); }, 550);
});
for (const event of ['pointerup', 'pointercancel', 'pointermove']) app.addEventListener(event, () => clearTimeout(longPressTimer));
window.addEventListener('keydown', event => {
  if (dialog.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { selectedId = null; selectedGear = null; render(true); }
  if (event.key.toLowerCase() === 'r' && canEdit() && myUnit()) { send({ type: 'rotate', unitId: selectedId }); event.preventDefault(); }
  if (event.key === 'Delete' && canEdit() && myUnit()) send({ type: 'sell', unitId: selectedId });
});

// The canvas is only a renderer. Simulation, purchases and all RNG stay on the server.
function tileFromEvent(event,canvas){return boardTile(event,canvas);}
function tileAction(tile) {
  if (!tile || !state) return;
  const p = viewed(), unit = p.units.find(u => u.x === tile.x && u.y === tile.y);
  if (unit) {
    if (selectedGear !== null && canEdit()) return selectUnit(unit.id);
    if (selectedId === unit.id && canEdit()) send({ type: 'rotate', unitId: unit.id });
    else selectUnit(unit.id);
  } else if (selectedId && canEdit()) {
    const moving=myUnit();placement={id:selectedId,x:moving.x,y:moving.y};
    send({ type: 'deploy', unitId: selectedId, x: tile.x, y: tile.y });
  }
}
function setupCanvas() {
  const canvas = document.querySelector('#battlefield'); if (!canvas) return;
  canvas.addEventListener('click', event => tileAction(tileFromEvent(event, canvas)));
  canvas.addEventListener('pointermove', event => { hoveredTile = tileFromEvent(event, canvas); });
  canvas.addEventListener('pointerleave', () => { hoveredTile = null; });
  canvas.addEventListener('dragover', event => { if (canEdit()) { event.preventDefault(); hoveredTile = tileFromEvent(event, canvas); event.dataTransfer.dropEffect = 'move'; } });
  canvas.addEventListener('drop', event => { event.preventDefault(); if (canEdit()) { selectedId = event.dataTransfer.getData('text/plain'); tileAction(tileFromEvent(event, canvas)); } });
  canvas.parentElement.addEventListener('keydown', event => {
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (deltas[event.key]) { const [dx, dy] = deltas[event.key]; keyboardTile = { x: Math.max(0, Math.min(9, keyboardTile.x + dx)), y: Math.max(0, Math.min(6, keyboardTile.y + dy)) }; hoveredTile = keyboardTile; event.preventDefault(); }
    if (event.key === 'Enter') { tileAction(keyboardTile); event.preventDefault(); }
  });
}
function draw(){
  requestAnimationFrame(draw);
  const canvas=document.querySelector('#battlefield');if(!canvas||!state)return;
  const p=viewed();if(!p)return;
  drawBattle(canvas.getContext('2d'),{state,p,selected:currentUnit(),editable:canEdit(),hoveredTile,routeVisible,selectedId,ops,data,images,modelReady,shopOpen});
  renderModels({world:canvas.parentElement,state,p,ops,project,shopOpen});
}
setInterval(()=>{if(connected&&ws.readyState===WebSocket.OPEN)send({type:'ping',at:performance.now()});},5000);
render(true); connect(); requestAnimationFrame(draw);
