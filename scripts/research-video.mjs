import fs from 'node:fs/promises';
import {load} from 'cheerio';
await fs.mkdir('research/video',{recursive:true});
const bvid='BV1KLkZB2Ezu';
const headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'};
async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${r.status} ${url}`);return r;}
const view=await (await get('https://api.bilibili.com/x/web-interface/view?bvid='+bvid)).json();
await fs.writeFile('research/video/official-pv-view.json',JSON.stringify(view,null,2));
console.log('VIEW',JSON.stringify({code:view.code,title:view.data?.title,owner:view.data?.owner,duration:view.data?.duration,cid:view.data?.cid,pages:view.data?.pages,desc:view.data?.desc}));
if(view.code!==0)process.exit(1);
const play=await (await get(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${view.data.cid}&qn=64&fnval=0&fnver=0`)).json();
await fs.writeFile('research/video/official-pv-play.json',JSON.stringify(play,null,2));
console.log('PLAY',JSON.stringify({code:play.code,quality:play.data?.quality,formats:play.data?.accept_description,durl:play.data?.durl?.map(a=>({length:a.length,size:a.size,url:a.url}))}));
if(play.code===0&&play.data?.durl?.[0]){
 const response=await get(play.data.durl[0].url);const buffer=Buffer.from(await response.arrayBuffer());
 await fs.writeFile('research/video/official-pv.mp4',buffer);console.log('SAVED',buffer.length);
}
const r=await get('https://ak.hypergryph.com/');const html=await r.text();await fs.writeFile('research/video/official-home.html',html);const $=load(html);console.log('OFFICIAL SCRIPTS',$('script[src]').map((i,e)=>$(e).attr('src')).get());
