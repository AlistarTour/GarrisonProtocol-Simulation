import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const data=JSON.parse(await fs.readFile('public/data.json','utf8'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const names=data.operators.map(o=>'文件:立绘_'+o.name+'_1.png');
const info=new Map();
for(let i=0;i<names.length;i+=25){
 const response=await fetch('https://prts.wiki/api.php?action=query&titles='+encodeURIComponent(names.slice(i,i+25).join('|'))+'&prop=imageinfo&iiprop=url&format=json',{signal:AbortSignal.timeout(30000)});
 const j=await response.json();for(const page of Object.values(j.query.pages))if(page.imageinfo?.[0])info.set(page.title,page.imageinfo[0]);
}
let index=0;
await Promise.all(Array.from({length:4},async()=>{while(index<data.operators.length){
 const op=data.operators[index++], source=info.get('文件:立绘 '+op.name+' 1.png');if(!source){console.log('MISSING',op.name);continue;}
 const name=op.id+'-portrait',file='assets/'+name+'.png';let bytes;
 try{bytes=await fs.readFile('public/'+file)}catch{const r=await fetch(source.url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(r.status);bytes=Buffer.from(await r.arrayBuffer());await fs.writeFile('public/'+file,bytes)}
 op.portrait='/'+file;
 manifest.assets=manifest.assets.filter(a=>a.name!==name);
 manifest.assets.push({name,file,url:source.url,sourcePage:source.descriptionurl,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),attribution:'明日方舟 / 鹰角网络；PRTS Wiki 原始立绘'});
 console.log('PORTRAIT',op.name,bytes.length);
}}));
await fs.writeFile('public/data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
