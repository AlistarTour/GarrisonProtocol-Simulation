// A live projected board using small terrain patches from the PRTS AC-1 image.
// The image's HUD, numbers and Wiki watermark are never drawn.
// Tile topology is simplified by the prototype engine; operators use Wiki Spine models.
export const BOARD={x:320,y:222,w:79,h:31,shear:-15};
export function project(x,y){return {x:BOARD.x+x*BOARD.w+y*BOARD.shear,y:BOARD.y+y*BOARD.h};}
export function boardTile(event,canvas){
 const r=canvas.getBoundingClientRect(),px=(event.clientX-r.left)/r.width*1280,py=(event.clientY-r.top)/r.height*720;
 const y=Math.floor((py-BOARD.y)/BOARD.h),x=Math.floor((px-BOARD.x-((py-BOARD.y)/BOARD.h)*BOARD.shear)/BOARD.w);
 return x>=0&&x<10&&y>=0&&y<7?{x,y}:null;
}
const center=(x,y)=>project(x+.5,y+.5);
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function corners(x,y,inset=0){return [project(x+inset,y+inset),project(x+1-inset,y+inset),project(x+1-inset,y+1-inset),project(x+inset,y+1-inset)];}
function terrainTile(ctx,atlas,x,y,high){
 const points=corners(x,y,.015),depth=high?21:7;
 polygon(ctx,[points[3],points[2],{x:points[2].x,y:points[2].y+depth},{x:points[3].x,y:points[3].y+depth}],high?'#403e32':'#775f40','#60492f');
 polygon(ctx,[points[1],points[2],{x:points[2].x,y:points[2].y+depth},{x:points[1].x,y:points[1].y+depth}],high?'#4a493d':'#957345');
 if(atlas?.complete&&atlas.naturalWidth){
  ctx.save();polygon(ctx,points);ctx.clip();const a=points[0];ctx.setTransform(1,0,BOARD.shear/BOARD.h,1,a.x,a.y);
  // Empty tile faces only: these source rectangles contain no HUD or labels.
  const src=high?[580,267,65,53]:[746,299,65,43];
  ctx.drawImage(atlas,...src,0,0,BOARD.w,BOARD.h);ctx.restore();
 }else polygon(ctx,points,high?'#6a7060':'#c4a05f');
 ctx.lineWidth=1;polygon(ctx,points,null,high?'#6f7464':'#ddc69a80');
 if(high){polygon(ctx,corners(x,y,.075),null,'#343d31');const c=center(x,y);ctx.fillStyle='#d0b565';for(const dx of [-25,25])ctx.fillRect(c.x+dx,c.y-16,3,5);}
}
function bar(ctx,c,width,ratio,color){ctx.fillStyle='#071713c9';ctx.fillRect(c.x-width/2,c.y,width,5);ctx.fillStyle=color;ctx.fillRect(c.x-width/2+1,c.y+1,(width-2)*Math.max(0,Math.min(1,ratio)),3);}
function portrait(ctx,img,c,size,opacity=1){if(!img?.complete||!img.naturalWidth)return;ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(img,c.x-size/2,c.y-size,size,size);ctx.restore();}
function gateway(ctx,x,y,color){const c=center(x,y),w=37,h=42;ctx.lineWidth=3;ctx.strokeStyle=color;ctx.fillStyle=color+'19';polygon(ctx,[{x:c.x-w,y:c.y-h},{x:c.x+w,y:c.y-h},{x:c.x+w+10,y:c.y},{x:c.x-w+10,y:c.y}],color+'17',color);polygon(ctx,[{x:c.x-w+10,y:c.y},{x:c.x+w+10,y:c.y},{x:c.x+w+2,y:c.y+20},{x:c.x-w+2,y:c.y+20}],color+'17',color);ctx.beginPath();ctx.moveTo(c.x-15,c.y-13);ctx.lineTo(c.x,c.y-38);ctx.lineTo(c.x+15,c.y-13);ctx.closePath();ctx.stroke();ctx.fillStyle=color;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('!',c.x,c.y-17);}
function attackRange(ctx,unit,op,images){
 if(!unit||unit.x===null||unit.y===null||!op)return;
 const r=Math.max(1,Math.min(4,Math.ceil(Number(op.range)||1))),cx=unit.x+.5,cy=unit.y+.5;
 const outer=[project(cx-r,cy),project(cx,cy-r),project(cx+r,cy),project(cx,cy+r)];
 ctx.save();
 ctx.globalAlpha=.24;polygon(ctx,outer,'#f8e8be');
 ctx.globalAlpha=.92;ctx.lineWidth=3;polygon(ctx,outer,null,'#fff8df');
 ctx.globalAlpha=.68;ctx.lineWidth=1;ctx.setLineDash([5,5]);polygon(ctx,outer,null,'#f2b656');ctx.setLineDash([]);
 // The tiny amber square is the official attack-range marker from the game UI.
 const marker=images?.get('/assets/official/attack-range-attack.png');
 if(marker?.complete&&marker.naturalWidth){
   ctx.globalAlpha=.9;
   for(let y=Math.max(0,unit.y-r+1);y<=Math.min(6,unit.y+r-1);y++)for(let x=Math.max(0,unit.x-r+1);x<=Math.min(9,unit.x+r-1);x++){
     if(Math.abs(x-unit.x)+Math.abs(y-unit.y)>r)continue;
     const c=center(x,y);ctx.drawImage(marker,c.x-6,c.y-6,12,12);
   }
 }
 ctx.restore();
}
export function drawBattle(ctx,{state,p,selected,editable,hoveredTile,routeVisible,selectedId,ops,data,images,modelReady,shopOpen}){
 ctx.clearRect(0,0,1280,720);
 const atlas=images.get('/assets/ui-map-01.png');
 const sky=ctx.createLinearGradient(0,0,1280,720);sky.addColorStop(0,'#6f5d43');sky.addColorStop(.45,'#ab8952');sky.addColorStop(1,'#133f38');ctx.fillStyle=sky;ctx.fillRect(0,0,1280,720);
 const desert=images.get('/assets/official/desert-background.png');
 if(desert?.complete&&desert.naturalWidth){ctx.save();ctx.globalAlpha=.34;ctx.globalCompositeOperation='multiply';const pattern=ctx.createPattern(desert,'repeat');ctx.fillStyle=pattern;ctx.fillRect(0,0,1280,720);ctx.restore();}
 if(atlas?.complete&&atlas.naturalWidth){
  // Environment strips exclude the fixed game HUD and PRTS watermark.
  ctx.drawImage(atlas,0,95,220,375,0,70,300,540);
  ctx.drawImage(atlas,1145,250,130,220,1120,145,160,440);
  ctx.drawImage(atlas,450,503,570,70,230,482,850,110);
 }
 const shade=ctx.createLinearGradient(0,0,0,720);shade.addColorStop(0,'#07100fc0');shade.addColorStop(.25,'#00000000');shade.addColorStop(.75,'#00000000');shade.addColorStop(1,'#091713b8');ctx.fillStyle=shade;ctx.fillRect(0,0,1280,720);
 const ground=(x,y)=>state.path.some(t=>t.x===x&&t.y===y);
 for(let y=0;y<7;y++)for(let x=0;x<10;x++)terrainTile(ctx,atlas,x,y,!ground(x,y));
 if(routeVisible){ctx.save();ctx.setLineDash([7,11]);ctx.lineWidth=2;ctx.strokeStyle='#c3573780';ctx.beginPath();state.path.forEach((t,i)=>{const c=center(t.x,t.y);i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)});ctx.stroke();ctx.restore();}
 if(selected&&editable){const o=ops.get(selected.opId);for(let y=0;y<7;y++)for(let x=0;x<10;x++){const occupied=p.units.some(u=>u.id!==selected.id&&u.x===x&&u.y===y);if(!occupied&&ground(x,y)===o.ground&&!(x===0&&y===1)&&!(x===9&&y===5))polygon(ctx,corners(x,y,.025),'#3dbf5959','#8fe79c');}}
 if(selected&&selected.x!==null)attackRange(ctx,selected,ops.get(selected.opId),images);
 gateway(ctx,state.path[0].x,state.path[0].y,'#fd715b');gateway(ctx,state.path.at(-1).x,state.path.at(-1).y,'#82e2f8');
 const units=(p.battle?.units||p.units.filter(u=>u.x!==null)).slice().sort((a,b)=>a.y-b.y||a.x-b.x);
 for(const u of units){
  const o=ops.get(u.opId),c=center(u.x,u.y),dead=u.hp!==undefined&&u.hp<=0;ctx.fillStyle='#1a271f6b';ctx.beginPath();ctx.ellipse(c.x,c.y+10,29,10,0,0,Math.PI*2);ctx.fill();
  if(u.id===selectedId){ctx.lineWidth=2;polygon(ctx,corners(u.x,u.y,.05),'#49dfb342','#f2e9c6');}
  // Keep a Wiki portrait fallback until the original model finishes loading.
  if(!modelReady(o.id))portrait(ctx,images.get(o.image),{x:c.x,y:c.y+8},65,dead?.3:1);
  ctx.fillStyle='#071712dd';ctx.strokeStyle=u.elite?'#dabc4b':'#8db39c';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(c.x-29,c.y-63,24,22,3);ctx.fill();ctx.stroke();ctx.fillStyle=u.elite?'#e5c662':'#b6e6d1';ctx.font='bold 17px Arial';ctx.textAlign='center';ctx.fillText(['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][o.tier],c.x-17,c.y-47);
  bar(ctx,{x:c.x,y:c.y+8},54,u.hp===undefined?1:u.hp/u.maxHp,'#50cef0');
  if(u.buff>0){ctx.strokeStyle='#5febbe';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(c.x,c.y+11,33,10,0,0,Math.PI*2);ctx.stroke();}
  if(!dead){const d=[[1,0],[0,1],[-1,0],[0,-1]][u.dir],a=project(u.x+.5+d[0]*.45,u.y+.5+d[1]*.4);ctx.fillStyle='#c6eee0';ctx.beginPath();ctx.arc(a.x,a.y+8,3,0,Math.PI*2);ctx.fill();}
 }
 for(const e of p.battle?.enemies||[]){const i=Math.floor(Math.max(0,Math.min(state.path.length-1,e.progress))),a=state.path[i],b=state.path[Math.min(i+1,state.path.length-1)],f=e.progress-i,c=center(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);portrait(ctx,images.get(data.enemies[e.type].image),{x:c.x,y:c.y+8},e.boss?73:49);bar(ctx,{x:c.x,y:c.y+8},e.boss?66:43,e.hp/e.maxHp,'#ec8b48');}
 for(const e of state.effects.filter(e=>e.playerId===p.id)){const a=center(e.x,e.y),b=center(e.tx,e.ty);ctx.save();ctx.globalAlpha=.7;ctx.strokeStyle={attack:'#eee7a7',arts:'#93ecfa',heal:'#a3e791',enemy:'#ef8258',skill:'#3cddc3',leak:'#f9583b'}[e.kind];ctx.lineWidth=2;ctx.beginPath();if(['skill','leak'].includes(e.kind))ctx.arc(a.x,a.y-20,30,0,Math.PI*2);else {ctx.moveTo(a.x,a.y-22);ctx.lineTo(b.x,b.y-19);}ctx.stroke();ctx.restore();}
 if(hoveredTile){ctx.lineWidth=2;polygon(ctx,corners(hoveredTile.x,hoveredTile.y,.01),null,'#e8ead0');}
 if(!['battle','rescue'].includes(state.phase)&&atlas?.complete&&atlas.naturalWidth)ctx.drawImage(atlas,60,600,980,81,130,shopOpen?445:599,870,82);
}
