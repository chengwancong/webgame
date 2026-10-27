import {beforeAll,it,expect} from 'vitest';import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import {ShibaSpineSample,type ShibaRaster} from '../apps/web/src/shiba-spine-runtime.ts';
const base=path.resolve('apps/web/public/art-pixel/shiba-spine-sample'),json=JSON.parse(fs.readFileSync(path.join(base,'shiba.json'),'utf8')),atlas=fs.readFileSync(path.join(base,'shiba.atlas'),'utf8'),images:Record<string,ShibaRaster>={};let rig:ShibaSpineSample;
beforeAll(async()=>{for(const name of fs.readdirSync(path.join(base,'images'))){const{data,info}=await sharp(path.join(base,'images',name)).ensureAlpha().raw().toBuffer({resolveWithObject:true});images[name.replace('.png','')]={width:info.width,height:info.height,data};}rig=new ShibaSpineSample(json,atlas,images);});
it('retains the real game hero bones, constraints and original animation tracks exactly',()=>{
 const source=JSON.parse(fs.readFileSync(path.resolve('assets/mini-hero/navy/runtime/Character.json'),'utf8'));
 expect(rig.skeleton.bones).toHaveLength(47);expect(json.bones.slice(0,source.bones.length)).toEqual(source.bones);
 for(const key of ['ik','transform','physics'])expect(json[key]).toEqual(source[key]);
 for(const name of ['Wait1','Run1','Attack_OneHand1']){const tracks={...json.animations[name].bones};delete tracks.shiba_tail;expect(tracks).toEqual(source.animations[name].bones);}
 for(const[name,duration]of [['Wait1',2],['Run1',.6],['Attack_OneHand1',1]] as const)expect(rig.skeleton.data.findAnimation(name)!.duration).toBeCloseTo(duration,6);
 expect(json.transform.find((c:{name:string})=>c.name==='armR2_RIGHTHAND').target).toBe('armR2');
 expect(json.animations.Attack_OneHand1.events).toEqual([{time:.35,name:'shiba_impact'}]);
});
it('animates legs in opposite phases and carries the weapon on the hand rather than moving a full-character sticker',()=>{
 rig.pose('run',0);const a=rig.skeleton.findBone('target_legL')!.worldX,b=rig.skeleton.findBone('target_legR')!.worldX;rig.pose('run',.15);
 expect(rig.skeleton.findBone('target_legL')!.worldX-a).toBeGreaterThan(0);expect(rig.skeleton.findBone('target_legR')!.worldX-b).toBeLessThan(0);
 rig.pose('attack',.24,false);const handBefore=rig.skeleton.findBone('hand')!,before=[handBefore.worldX,handBefore.worldY],weapon=rig.skeleton.findBone('RIGHTHAND')!;
 rig.pose('attack',.35,false);expect([handBefore.worldX,handBefore.worldY]).not.toEqual(before);expect(Number.isFinite(weapon.worldX+weapon.worldY)).toBe(true);
});
it('resets loops exactly and preserves the same attachment pixels when mirrored',()=>{
 rig.pose('run',0);const first=rig.frame();rig.pose('run',.6);expect(rig.frame()).toEqual(first);
 const mirrored=rig.frame(64,64,[32,60],true);for(let y=0;y<64;y++)for(let x=0;x<64;x++)expect([...mirrored.slice((y*64+x)*4,(y*64+x)*4+4)]).toEqual([...first.slice((y*64+63-x)*4,(y*64+63-x)*4+4)]);
});
it('uses the blink attachment and produces connected binary-alpha palette pixels after baking',async()=>{
 rig.pose('idle',1.4);expect(rig.skeleton.findSlot('shiba-head')!.getAttachment()!.name).toBe('head_closed');rig.pose('idle',1.6);expect(rig.skeleton.findSlot('shiba-head')!.getAttachment()!.name).toBe('head');
 const asset=JSON.parse(fs.readFileSync(path.join(base,'pixel-asset.json'),'utf8'));
 // @ts-expect-error Production art checker is directly executable ESM.
 const{checkAsset}=await import('../tools/pixel/check-pixel-art.mjs');expect(await checkAsset(asset)).toEqual([]);expect(asset.actions.attack.frameTimes[asset.actions.attack.impactFrame]).toBe(.35);
});
