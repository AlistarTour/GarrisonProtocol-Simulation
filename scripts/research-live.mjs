import fs from 'node:fs/promises';
const bvid='BV1oHyrBsEZU';
const headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'};
async function json(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(r.status);return r.json();}
const view=await json('https://api.bilibili.com/x/web-interface/view?bvid='+bvid);
await fs.writeFile('research/video/official-live-view.json',JSON.stringify(view,null,2));
console.log(JSON.stringify({code:view.code,title:view.data?.title,owner:view.data?.owner,duration:view.data?.duration,cid:view.data?.cid,desc:view.data?.desc}));
if(view.code!==0)process.exit(1);
const player=await json(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${view.data.cid}`);
await fs.writeFile('research/video/official-live-player.json',JSON.stringify(player,null,2));
console.log('PLAYER',JSON.stringify({code:player.code,points:player.data?.view_points,subtitles:player.data?.subtitle}));
const play=await json(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${view.data.cid}&qn=64&fnval=0&fnver=0`);
await fs.writeFile('research/video/official-live-play.json',JSON.stringify(play,null,2));
console.log('PLAY',JSON.stringify({code:play.code,quality:play.data?.quality,files:play.data?.durl?.map(a=>({length:a.length,size:a.size}))}));
