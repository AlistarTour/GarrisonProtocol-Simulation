import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const tasks=[
 {name:'ui-map-01',local:'research/ui/map-reference.png',url:'https://media.prts.wiki/3/37/'+encodeURIComponent('卫戍协议盟约_战场01_地图.png'),page:'卫戍协议：盟约/战场一览'},
 {name:'ui-event-title',local:'research/ui/event-logo.png',url:'https://media.prts.wiki/2/2b/'+encodeURIComponent('活动名称_卫戍协议：盟约.png'),page:'卫戍协议：盟约'}
];
for(const item of tasks){
 const file=`assets/${item.name}.png`;
 let buffer;
 try{buffer=await fs.readFile(item.local)}catch{try{buffer=await fs.readFile(`public/${file}`)}catch{
  const response=await fetch(item.url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`UI asset download failed: ${response.status}`);
  buffer=Buffer.from(await response.arrayBuffer());
 }}
 if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error(`UI asset is not PNG: ${item.name}`);
 await fs.writeFile(`public/${file}`,buffer);
 const record={file,url:item.url,sourcePage:'https://prts.wiki/w/'+encodeURIComponent(item.page),name:item.name,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),retrievedAt:new Date().toISOString(),attribution:'明日方舟 / 鹰角网络；来源 PRTS Wiki，原图未经修改',usage:item.name==='ui-map-01'?'UI 对照参考；含原游戏 HUD 和 Wiki 注记，不是无 UI 地图素材':'活动标题'};
 manifest.assets=manifest.assets.filter(a=>a.name!==item.name);manifest.assets.push(record);
 console.log(item.name,buffer.length);
}
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const frame='assets/ui-official-keyvisual.png';
try{
 const bytes=await fs.readFile('public/'+frame);
 const record={file:frame,name:'ui-official-keyvisual',url:'https://www.bilibili.com/video/BV1KLkZB2Ezu/',sourcePage:'https://www.bilibili.com/video/BV1KLkZB2Ezu/',publisher:'明日方舟',publisherId:161775300,frameTime:76,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),attribution:'鹰角网络 / 明日方舟官方账号；2025 年盟约宣传 PV 原始视频帧',usage:'活动主页背景；不是原游戏主界面背景原始切图'};
 manifest.assets=manifest.assets.filter(a=>a.name!==record.name);manifest.assets.push(record);
 await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
}catch(error){if(error.code!=='ENOENT')throw error;console.warn('官方 PV 背景尚未导入；请保留交付的 ui-official-keyvisual.png。');}
