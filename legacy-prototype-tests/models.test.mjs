import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BaseTexture} from 'pixi.js';
import {TextureAtlas} from '@pixi-spine/base';
import {SkeletonBinary,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData} from '@pixi-spine/runtime-3.8';

test('all 51 original Spine models parse against their actual atlas and can animate',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url)));
 for(const op of data.operators){
  const resolve=path=>new URL(`../public${path}`,import.meta.url);
  const atlas=new TextureAtlas();
  const atlasText=fs.readFileSync(resolve(op.model.atlas),'utf8');
  atlas.addSpineAtlas(atlasText,(name,callback)=>{
   const image=fs.readFileSync(new URL(name,resolve(op.model.atlas)));
   callback(new BaseTexture(null,{width:image.readUInt32BE(16),height:image.readUInt32BE(20)}));
  });
  const parsed=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(fs.readFileSync(resolve(op.model.skel)));
  assert.match(parsed.version,/^3\.8\./,op.name);
  assert.ok(parsed.bones.length>0&&parsed.animations.length>0,op.name);
  const idle=parsed.animations.find(a=>/^Idle/i.test(a.name))||parsed.animations[0];
  const skeleton=new Skeleton(parsed),animation=new AnimationState(new AnimationStateData(parsed));
  animation.setAnimation(0,idle.name,true);animation.update(.25);animation.apply(skeleton);skeleton.updateWorldTransform();
  assert.ok(skeleton.bones.every(b=>Number.isFinite(b.worldX)&&Number.isFinite(b.worldY)),op.name);
  atlas.dispose();
 }
});
