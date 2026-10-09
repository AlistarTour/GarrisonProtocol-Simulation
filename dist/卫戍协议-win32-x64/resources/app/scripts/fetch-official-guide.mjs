import fs from 'node:fs/promises';
const sourcePage='https://www.taptap.cn/moment/738117540928029245?group_id=53933';
const urls=['https://img2-tc.tapimg.com/moment/etag/lupQmyiZ6bn7eP2axB3_h2sQoxgr_20251113193435.jpg/_tap_ugc.jpg','https://img2-tc.tapimg.com/moment/etag/lqD8I5vd2sa7cXijoxdqqrGk1VCT_20251113193438.jpg/_tap_ugc.jpg'];
const records=[];
for(const [i,url] of urls.entries()){
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(String(r.status));
 const bytes=Buffer.from(await r.arrayBuffer());const file=`research/video/official-guide-${i+1}.jpg`;
 await fs.writeFile(file,bytes);records.push({file,url,sourcePage,publisher:'明日方舟AI四号机（官方版主）',retrievedAt:new Date().toISOString()});console.log(file,bytes.length);
}
await fs.writeFile('research/video/guide-provenance.json',JSON.stringify(records,null,2));
