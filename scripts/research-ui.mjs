import {load} from 'cheerio';
import fs from 'node:fs/promises';
const titles=['卫戍协议/帮助','卫戍协议：盟约/战场一览','卫戍协议/2024/战场一览','卫戍协议：盟约'];
await fs.mkdir('research/ui',{recursive:true});
for(const [i,title] of titles.entries()){
 const u='https://prts.wiki/api.php?action=parse&prop=text&format=json&page='+encodeURIComponent(title);
 const r=await fetch(u,{signal:AbortSignal.timeout(30000)});const j=await r.json();
 if(!j.parse){console.log(title,j.error);continue}
 const html=j.parse.text['*'];await fs.writeFile(`research/ui/page-${i}.html`,html);const $=load(html);
 const seen=new Set();const imgs=[];
 $('img').each((_,el)=>{const src=$(el).attr('src');if(!src||seen.has(src))return;seen.add(src);imgs.push({src,width:$(el).attr('width'),height:$(el).attr('height'),alt:$(el).attr('alt'),link:$(el).closest('a').attr('href')})});
 await fs.writeFile(`research/ui/images-${i}.json`,JSON.stringify(imgs,null,2));
 console.log('PAGE',i,title,imgs.length);console.log(imgs.filter(a=>!decodeURIComponent(a.src).includes('头像')&&!decodeURIComponent(a.src).includes('稀有度')).slice(0,100).map((a,n)=>`${n} ${a.width}x${a.height} ${decodeURIComponent(a.src)}`).join('\n'));
}
