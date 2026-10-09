import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets');
const cache = path.join(root, 'research');
await fs.mkdir(out, { recursive: true });
await fs.mkdir(cache, { recursive: true });
const sourceTitle = '卫戍协议：盟约/PRTS盟约记录';
const sourcePage = `https://prts.wiki/w/${encodeURIComponent(sourceTitle)}`;
async function get(url) {
  if (!['prts.wiki', 'media.prts.wiki', 'ak.hypergryph.com'].includes(new URL(url).hostname)) throw new Error('Asset source outside allowlist');
  const r = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'GarrisonWebPrototype/0.1 (local fan research)', 'Referer': 'https://prts.wiki/' } });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r;
}
async function page(title, filename) {
  const target = path.join(cache, filename);
  try { return await fs.readFile(target, 'utf8'); } catch {}
  const url = `https://prts.wiki/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json`;
  const json = await (await get(url)).json();
  if (!json.parse) throw new Error(`Missing wiki page: ${title}`);
  const html = json.parse.text['*'];
  await fs.writeFile(target, html);
  return html;
}
function original(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/');
  if (parts[1] === 'thumb') u.pathname = '/' + parts.slice(2, -1).join('/');
  u.search = '';
  return u.href;
}
const $ = load(await page(sourceTitle, 'covenants.html'));
const selected = new Set('隐现,讯使,惊蛰,幽灵鲨,红豆,梅,拉普兰德,德克萨斯,蛇屠箱,远山,狮蝎,布丁,送葬人,赫默,角峰,万顷,哈洛德,莎草,深巡,暴雨,洛洛,芳汀,能天使,极光,槐琥,斯卡蒂,海蒂,安哲拉,耶拉,菲亚梅塔,初雪,森蚺,风笛,华法琳,灵知,煌,异客,左乐,乌尔比安,圣约送葬人,塞雷娅,林,银灰,白面鸮,蕾缪安,锏,余,浊心斯卡蒂,佩佩,澄闪,泥岩'.split(','));
const tasks = new Map();
function asset(name, src, page = sourcePage) {
  if (!src) throw new Error(`Missing source for ${name}`);
  const url = original(src);
  tasks.set(name, { file: `assets/${name}.png`, url, sourcePage: page });
  return `/assets/${name}.png`;
}
const bonds = [];
const memberBonds = new Map();
$('table').each((i, table) => {
  if (i > 34 || !$(table).find('table').length) return;
  const name = $(table).find('tr').first().children('td').first().text().trim();
  if (!name) return;
  const icon = $(table).find('img').first().attr('src');
  const count = Number($(table).text().match(/激活所需人数\s*(\d+)/)?.[1]);
  const id = `bond-${bonds.length}`;
  bonds.push({ id, name, threshold: count, core: bonds.length < 6, icon: asset(id, icon) });
  $(table).find('img#charicon').each((_, img) => {
    const op = $(img).closest('a').attr('title');
    if (!memberBonds.has(op)) memberBonds.set(op, []);
    memberBonds.get(op).push(name);
  });
});
const roles = {
  先锋: { hp: 1550, atk: 330, def: 160, interval: 1.05, range: 1.3, block: 2, ground: true },
  近卫: { hp: 1950, atk: 450, def: 190, interval: 1.15, range: 1.4, block: 2, ground: true },
  重装: { hp: 2800, atk: 260, def: 410, interval: 1.4, range: 1.2, block: 3, ground: true },
  狙击: { hp: 1050, atk: 360, def: 75, interval: 0.95, range: 3.2, block: 0, ground: false },
  术师: { hp: 1150, atk: 440, def: 80, interval: 1.45, range: 2.9, block: 0, ground: false, arts: true },
  医疗: { hp: 1100, atk: 280, def: 85, interval: 1.4, range: 3.3, block: 0, ground: false, heal: true },
  辅助: { hp: 1200, atk: 280, def: 100, interval: 1.25, range: 2.8, block: 0, ground: false, arts: true, slow: true },
  特种: { hp: 1650, atk: 390, def: 150, interval: 1.05, range: 1.5, block: 1, ground: true }
};
const operators = [];
for (let tier = 1; tier <= 6; tier++) {
  $('table').eq(68 + tier).find('tr').each((_, row) => {
    const img = $(row).find('img#charicon').first();
    const name = img.closest('a').attr('title');
    if (!selected.has(name)) return;
    const profSrc = $(row).find('img#typeicon').first().attr('src') || '';
    const role = decodeURIComponent(profSrc).match(/图标_职业_(.+?)\.png/)?.[1];
    if (!roles[role]) throw new Error(`Unknown role: ${name}`);
    const id = `op-${operators.length}`;
    const scale = 1 + (tier - 1) * 0.19;
    const base = roles[role];
    operators.push({ id, name, tier, role, bonds: memberBonds.get(name) || ['协防干员'], image: asset(id, img.attr('src')), ...base,
      hp: Math.round(base.hp * scale), atk: Math.round(base.atk * scale), def: Math.round(base.def * scale),
      sourcePage: `https://prts.wiki/w/${encodeURIComponent(name)}` });
    selected.delete(name);
    asset(`class-${role}`, profSrc);
  });
}
if (selected.size) throw new Error(`Unresolved operators: ${[...selected]}`);
if (operators.length !== 51 || bonds.length !== 18) throw new Error('PRTS table structure changed; expected 51 selected operators and 18 covenants.');
const strategies = [
  { id: 'unity', name: '众志合一', owner: '阿米娅', hp: 30, description: '激活 2 / 3 / 4 种盟约时，全体攻击与生命 +15% / 30% / 50%。' },
  { id: 'watch', name: '重点监护', owner: '华法琳', hp: 27, description: '作战开始时，每个不同等阶的一名干员所属盟约增加 2 层。' },
  { id: 'fortress', name: '坚不可摧', owner: '歌利亚', hp: 45, description: '以 45 点目标生命开始模拟，为阵容成长争取更多回合。' }
];
for (const strategy of strategies) {
  const src = $('img').toArray().map(img => $(img).attr('src')).find(src => src && decodeURIComponent(src).includes(`策略发起人_${strategy.owner}.png`));
  strategy.image = asset(`strategy-${strategy.id}`, src);
}
const gearNames = ['精准狙击镜', '防暴盾', '浓缩嗅盐'];
const equipment = gearNames.map((name, i) => {
  const src = $('img').toArray().map(img => $(img).attr('src')).find(src => src && decodeURIComponent(src).includes(`道具_${name}.png`));
  return { id: `gear-${i}`, name, image: asset(`gear-${i}`, src), cost: 3,
    description: ['攻击力 +25%', '生命 +35%，防御 +80', '攻击速度 +25%'][i] };
});
asset('funds', $('img').toArray().map(img => $(img).attr('src')).find(src => src && decodeURIComponent(src).includes('图标_卫戍协议资金.png')));
const enemies = [];
for (const [i, name] of ['源石虫', '士兵', '重装防御者', '萨卡兹百夫长'].entries()) {
  const wikiPage = `https://prts.wiki/w/${encodeURIComponent(name)}`;
  const e = load(await page(name, `enemy-${i}.html`));
  const src = e('img').toArray().map(img => e(img).attr('src')).find(src => src && decodeURIComponent(src).includes(`敌人_${name}.png`));
  enemies.push({ id: `enemy-${i}`, name, image: asset(`enemy-${i}`, src, wikiPage), sourcePage: wikiPage });
}
const art = await (await get(`https://prts.wiki/api.php?action=query&titles=${encodeURIComponent('文件:立绘_阿米娅_1.png')}&prop=imageinfo&iiprop=url&format=json`)).json();
const info = Object.values(art.query.pages)[0].imageinfo?.[0];
if (info) asset('amiya-art', info.url, info.descriptionurl);
const list = [...tasks.entries()];
const manifest = [];
let cursor = 0;
async function worker() {
  while (cursor < list.length) {
    const [name, item] = list[cursor++];
    const target = path.join(root, 'public', item.file);
    let data;
    try { data = await fs.readFile(target); } catch { data = Buffer.from(await (await get(item.url)).arrayBuffer()); await fs.writeFile(target, data); }
    if (!data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Not a PNG: ${name}`);
    manifest.push({ ...item, name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), retrievedAt: new Date().toISOString(), attribution: '明日方舟 / 鹰角网络；来源 PRTS Wiki，权利归原作者所有' });
    console.log(`Downloaded ${name} (${data.length} bytes)`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await fs.writeFile(path.join(root, 'public/assets/manifest.json'), JSON.stringify({ sourcePolicy: 'Only Arknights official sites or PRTS Wiki', sourcePage, assets: manifest }, null, 2));
await fs.writeFile(path.join(root, 'public/data.json'), JSON.stringify({ operators, bonds, strategies, equipment, enemies, art: info ? '/assets/amiya-art.png' : null, sourcePage, rulesNote: '干员等阶与盟约归属取自 PRTS；战斗数值、装备效果与部分盟约技能为网页原型简化实现。' }, null, 2));
console.log(`Ready: ${operators.length} operators, ${bonds.length} covenants, ${manifest.length} assets.`);
