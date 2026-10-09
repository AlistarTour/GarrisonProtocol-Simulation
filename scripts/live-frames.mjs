import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const play=JSON.parse(await fs.readFile('research/video/official-live-play.json','utf8'));
const url=play.data.durl[0].url;
const times=process.argv.slice(2).map(Number);
for(const second of times.length?times:[600,1200,1800,2400,3000,3600,4200]){
 const path=`research/video/live-${second}.jpg`;
 await new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-headers','Referer: https://www.bilibili.com/\r\nUser-Agent: Mozilla/5.0\r\n','-ss',String(second),'-i',url,'-frames:v','1','-q:v','2',path],{windowsHide:true});
  let error='';p.stderr.on('data',d=>error+=d);p.on('error',reject);p.on('close',c=>c?reject(new Error(error.replaceAll(url,'[video]'))):resolve());
 });
 console.log('FRAME',second,path);
}
