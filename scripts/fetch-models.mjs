import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const data=JSON.parse(await fs.readFile('public/data.json','utf8'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const allowed=['static.prts.wiki','torappu.prts.wiki'];
async function get(url){if(!allowed.includes(new URL(url).hostname))throw new Error('Model source outside Wiki');const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(r.status+' '+url);return r;}
let ids;
try{ids=await fs.readFile('research/ui/char-ids.js','utf8')}catch{ids=await(await get('https://static.prts.wiki/charinfo/charId20261001.js')).text()}
const characters=JSON.parse(ids.slice(ids.indexOf('['),ids.lastIndexOf(']')+1));
let index=0;
async function save(op,url){
 const filename=path.posix.basename(new URL(url).pathname);
 if(!/^[\w.@-]+\.(png|skel|atlas)$/.test(filename))throw new Error('Unexpected model filename');
 const file=`assets/models/${op.id}/${filename}`;let bytes;
 try{bytes=await fs.readFile('public/'+file)}catch{bytes=Buffer.from(await(await get(url)).arrayBuffer());await fs.mkdir('public/assets/models/'+op.id,{recursive:true});await fs.writeFile('public/'+file,bytes)}
 const name=`model-${op.id}-${filename}`;
 manifest.assets=manifest.assets.filter(a=>a.name!==name);
 manifest.assets.push({name,file,url,sourcePage:op.sourcePage,metadataUrl:op.modelSource,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),attribution:'明日方舟 / 鹰角网络；PRTS 干员模型组件公开资源，原始 Spine 3.8 模型'});
 return {file:'/'+file,bytes};
}
await Promise.all(Array.from({length:4},async()=>{while(index<data.operators.length){
 const op=data.operators[index++],id=characters.find(c=>c.name===op.name)?.id;
 if(!id)throw new Error('No Wiki character id: '+op.name);
 op.modelSource=`https://torappu.prts.wiki/assets/char_spine/${id}/meta.json`;
 const meta=await(await get(op.modelSource)).json();
 const skin=meta.skin['默认']||Object.values(meta.skin)[0];
 const variant=skin['正面']||Object.values(skin)[0];
 const base=meta.prefix+variant.file;
 const atlas=await save(op,base+'.atlas'),skel=await save(op,base+'.skel');
 const pages=atlas.bytes.toString().split(/\r?\n/).map(l=>l.trim()).filter(l=>/^[\w.@-]+\.png$/.test(l));
 if(!pages.length)throw new Error('No texture pages: '+op.name);
 for(const page of pages)await save(op,new URL(page,base+'.atlas').href);
 op.model={skel:skel.file,atlas:atlas.file};console.log('MODEL',op.name,pages.length);
}}));
await fs.writeFile('public/data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('TOTAL',manifest.assets.length,'MODELS',data.operators.filter(o=>o.model).length);
