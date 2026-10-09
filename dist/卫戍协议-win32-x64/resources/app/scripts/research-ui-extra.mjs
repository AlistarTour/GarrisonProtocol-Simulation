import fs from 'node:fs/promises';
import {load} from 'cheerio';
const endpoints = [
 ['bwiki', 'https://wiki.biligame.com/arknights/'+encodeURIComponent('盟约')],
 ['official', 'https://ak.hypergryph.com/news/9697'],
 ['wiki-general','https://prts.wiki/api.php?action=parse&prop=text&format=json&page='+encodeURIComponent('卫戍协议')],
 ['wiki-search','https://prts.wiki/api.php?action=query&list=search&srnamespace=6&srlimit=100&format=json&srsearch='+encodeURIComponent('"盟约"')]
];
await Promise.allSettled(endpoints.map(async([key,url])=>{
 try {
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)});let html=await r.text();
  await fs.writeFile(`research/ui/${key}.txt`,html);
  if(key==='wiki-search'){console.log(key,JSON.parse(html).query.search.map(a=>a.title));return}
  if(key.startsWith('wiki'))html=JSON.parse(html).parse.text['*'];
  const $=load(html);const imgs=$('img').map((_,e)=>({src:$(e).attr('src')||$(e).attr('data-src'),width:$(e).attr('width'),height:$(e).attr('height'),alt:$(e).attr('alt')})).get();
  await fs.writeFile(`research/ui/${key}-images.json`,JSON.stringify(imgs,null,2));
  console.log(key,r.status,imgs.filter(a=>!a.width||Number(a.width)>300));
 }catch(e){console.log(key,e.message)}
}));
const catalog=JSON.parse(await fs.readFile('research/ui/wiki-files.json','utf8')).query.allimages;
for(const term of ['战场示意','盟约_战场02_地图','盟约_战场04_地图']){
 const a=catalog.find(a=>a.name.includes(term));if(!a)continue;
 const b=Buffer.from(await fetch(a.url,{signal:AbortSignal.timeout(30000)}).then(r=>r.arrayBuffer()));
 await fs.writeFile(`research/ui/${term}.png`,b);console.log('saved',term);
}
