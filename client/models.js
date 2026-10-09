import {Application,Container,Texture} from 'pixi.js';
import '@pixi/unsafe-eval';
import {TextureAtlas} from '@pixi-spine/base';
import {Spine,SkeletonBinary,AtlasAttachmentLoader} from '@pixi-spine/runtime-3.8';
const cache=new Map(),pending=new Map(),instances=new Map();
let app=null,layer=null,disabled=false,last=performance.now();
const choose=(animations,kind)=>{
 const patterns={idle:[/^Idle$/i,/^Idle(?:_\d+)?$/i,/^Relax/i,/^Default/i],attack:[/^Attack$/i,/^Attack(?:_\d+)?$/i,/Attack/i],skill:[/^Skill(?:_\d+)?$/i,/Skill/i],die:[/^Die$/i,/Death/i]};
 for(const pattern of patterns[kind]||patterns.idle){const a=animations.find(a=>pattern.test(a.name));if(a)return a.name;}
 return kind==='idle'?animations[0]?.name:choose(animations,'idle');
};
async function load(op){
 if(cache.has(op.id)||pending.has(op.id)||!op.model)return;
 const task=(async()=>{
  const responses=await Promise.all([fetch(op.model.skel),fetch(op.model.atlas)]);
  if(responses.some(response=>!response.ok))throw new Error('模型文件不存在');
  const [binary,text]=await Promise.all([responses[0].arrayBuffer(),responses[1].text()]);
  const pages=new Map(),base=new URL(op.model.atlas,location.href);
  const atlas=new TextureAtlas();
  await new Promise((resolve,reject)=>atlas.addSpineAtlas(text,(name,callback)=>{
   const image=new Image();image.onload=()=>{const texture=Texture.from(image);pages.set(name,texture);callback(texture.baseTexture);};image.onerror=()=>{reject(new Error('模型纹理无法载入'));callback(null);};image.src=new URL(name,base).href;
  },loaded=>loaded?resolve():reject(new Error('模型图集无法解析'))));
  const skeleton=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(binary));
  cache.set(op.id,skeleton);
 })().catch(error=>{console.warn('PRTS 模型载入失败:',op.name,error.message);}).finally(()=>pending.delete(op.id));
 pending.set(op.id,task);await task;
}
export function preloadModels(operators){for(const op of operators.slice(0,6))load(op);}
export function modelReady(id){return !disabled&&cache.has(id)&&!!app;}
function init(world){
 if(disabled)return false;
 if(!app){try{app=new Application({width:1280,height:720,backgroundAlpha:0,antialias:true,autoStart:false,resolution:1,powerPreference:'low-power'});layer=new Container();layer.sortableChildren=true;app.stage.addChild(layer);app.view.className='unit-model-layer';app.view.setAttribute('aria-hidden','true');app.view.style.pointerEvents='none';}catch(error){disabled=true;console.warn('浏览器不支持模型渲染:',error.message);return false;}}
 if(app.view.parentElement!==world)world.append(app.view);return true;
}
export function renderModels({world,state,p,ops,project,shopOpen}){
 if(!world||!init(world))return;
 const now=performance.now(),delta=Math.min(.05,(now-last)/1000);last=now;
 const combat=['battle','rescue'].includes(state.phase),deployed=p.battle?.units||p.units.filter(u=>u.x!==null),reserve=combat?[]:p.units.filter(u=>u.x===null);
 const list=[...deployed.map(u=>({u,reserve:false})),...reserve.map((u,index)=>({u,reserve:true,index}))];
 const visible=new Set();
 for(const item of list){
  const {u}=item,op=ops.get(u.opId);if(!cache.has(op.id)){load(op);continue;}
  visible.add(u.id);let record=instances.get(u.id);
  if(!record){
   const sprite=new Spine(cache.get(op.id));sprite.autoUpdate=false;
   const idle=choose(sprite.spineData.animations,'idle');if(idle)sprite.state.setAnimation(0,idle,true);sprite.update(0);
   const bounds=sprite.getLocalBounds(),scale=94/Math.max(1,bounds.height);
   record={sprite,scale,baseX:bounds.x+bounds.width/2,baseY:bounds.y+bounds.height,animation:idle};instances.set(u.id,record);layer.addChild(sprite);
  }
  const {sprite,scale}=record;
  const c=item.reserve?{x:174+item.index*91,y:shopOpen?518:671}:project(u.x+.5,u.y+.5);
  const mirror=!item.reserve&&u.dir===2?-1:1;
  sprite.scale.set(scale*mirror,scale);sprite.position.set(c.x-record.baseX*scale*mirror,c.y+8-record.baseY*scale);sprite.zIndex=item.reserve?1000:c.y;
  const dead=u.hp!==undefined&&u.hp<=0;
  const hits=state.effects.some(e=>e.playerId===p.id&&e.x===u.x&&e.y===u.y&&['attack','arts','heal'].includes(e.kind));
  const kind=dead?'die':!combat?'idle':u.buff>0?'skill':hits?'attack':'idle';
  const name=choose(sprite.spineData.animations,kind);
  if(name&&name!==record.animation){sprite.state.setAnimation(0,name,!dead);record.animation=name;}
  sprite.alpha=dead?.4:1;sprite.visible=true;sprite.update(delta*(combat?state.speed:1));
 }
 for(const [id,record] of instances)if(!visible.has(id)){layer.removeChild(record.sprite);record.sprite.destroy({children:true,texture:false,baseTexture:false});instances.delete(id);}
 for(const button of world.parentElement.querySelectorAll('.bench-slot[data-id]'))button.dataset.modelReady=String(instances.has(button.dataset.id));
 app.view.dataset.modelCount=String(instances.size);app.view.dataset.modelCache=String(cache.size);app.view.dataset.modelPending=String(pending.size);app.renderer.render(app.stage);
}
export function hideModels(){if(app)app.view.remove();}
