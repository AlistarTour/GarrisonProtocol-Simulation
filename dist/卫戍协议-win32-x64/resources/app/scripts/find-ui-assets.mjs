import fs from 'node:fs/promises';import {load} from 'cheerio';
const $=load(await fs.readFile('research/ui/page-3.html','utf8'));
console.log($('a[href]').map((i,e)=>$(e).attr('href')).get().filter(x=>x.includes('hypergryph')).join('\n'));
const j=await fetch('https://prts.wiki/api.php?action=query&list=allimages&aiprefix='+encodeURIComponent('卫戍协议')+'&ailimit=500&aiprop=url%7Csize&format=json').then(r=>r.json());
await fs.writeFile('research/ui/wiki-files.json',JSON.stringify(j,null,2));
console.log(j.query.allimages.map(a=>`${a.name} ${a.width}x${a.height}`).join('\n'));
const list=JSON.parse(await fs.readFile('research/ui/images-1.json','utf8'));
const tasks=[{name:'map-reference.png',src:list.find(a=>decodeURIComponent(a.src).includes('战场01_地图')).src}];
const activity=JSON.parse(await fs.readFile('research/ui/images-3.json','utf8'));
for(const [name,term] of [['event-logo.png','活动名称_卫戍协议'],['official-preview.jpg','活动预告_感谢庆典2025_29']])tasks.push({name,src:activity.find(a=>decodeURIComponent(a.src).includes(term)).src});
for(const a of tasks){const u=new URL(a.src);const parts=u.pathname.split('/');if(parts[1]==='thumb')u.pathname='/'+parts.slice(2,-1).join('/');u.search='';const b=Buffer.from(await fetch(u).then(r=>r.arrayBuffer()));await fs.writeFile('research/ui/'+a.name,b);console.log('saved',a.name,b.length)}
