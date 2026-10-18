import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {AtlasAttachmentLoader,FakeTexture,RegionAttachment,Skeleton,SkeletonJson,Skin,TextureAtlas,Vector2} from '@esotericsoftware/spine-webgl';
import profileJson from '../assets/mini-hero/navy/profile.json';
import {MiniNativePlayback,miniAttachmentPoint,miniSourceTime,miniSupportsAppearance,miniDisplayScale,type MiniNativeProfile} from '../apps/web/src/mini-native-renderer.ts';
import type {ResolvedAppearance} from '../packages/contracts/appearance.ts';

const profile=profileJson as unknown as MiniNativeProfile;
const atlas=new TextureAtlas(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.atlas',import.meta.url),'utf8'));
for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height} as HTMLImageElement));
const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.json',import.meta.url),'utf8')));
function skin(weaponId='100011'){
  const combined=new Skin('unit-combination');
  for(const name of [...profile.skinNames,...profile.weapons[weaponId].skinNames])combined.addSkin(data.findSkin(name)!);
  return combined;
}
function appearance(weapon='100011',family:ResolvedAppearance['family']='sword'):ResolvedAppearance{
  return {rig:'modular-hero',family,styleProfile:'v2-soft',revision:0,parts:{head:{setId:'100011'},body:{setId:'100041'},hands:{setId:'100011'},legs:{setId:'100011'},feet:{setId:'100011'},back:{setId:'100011'},weapon:{setId:weapon}}};
}
function matrices(skeleton:Skeleton){return skeleton.bones.map(bone=>[bone.worldX,bone.worldY,bone.a,bone.b,bone.c,bone.d]);}

describe('MiniFantasy native timing and physics',()=>{
  it('lands all authored weapon impact poses on the simulation windup, then maps recovery',()=>{
    for(const weapon of Object.values(profile.weapons))for(const action of ['attack','skill','projectile'] as const){
      const motion=weapon.actions[action],duration=data.findAnimation(motion.name)!.duration,impact=motion.impactTime!;
      const state={action,clock:500,facing:-1,cast:{elapsed:0,windup:.8,recovery:.4}};
      expect(miniSourceTime(duration,motion,state)).toBe(0);
      state.cast.elapsed=.4;expect(miniSourceTime(duration,motion,state)).toBeCloseTo(impact/2,10);
      state.cast.elapsed=.8;expect(miniSourceTime(duration,motion,state)).toBe(impact);
      state.cast.elapsed=1;expect(miniSourceTime(duration,motion,state)).toBeCloseTo(impact+(duration-impact)/2,10);
      state.cast.elapsed=2;expect(miniSourceTime(duration,motion,state)).toBe(duration);
    }
  });
  it('does not skip the source release pose when windup and recovery are both zero',()=>{
    expect(miniSourceTime(1,{name:'Attack_OneHand1',impactTime:.35},{action:'attack',clock:10,facing:1,cast:{elapsed:0,windup:0,recovery:0}})).toBe(.35);
  });
  it('advances the actual native physics once per source frame and leaves pause unchanged',()=>{
    const playback=new MiniNativePlayback(data,skin()),animation=data.findAnimation('Wait1')!;
    playback.seek(animation,.4,60);const steps=playback.physicsSteps,resets=playback.resetCount,before=matrices(playback.skeleton);
    playback.seek(animation,.4,60);expect(playback.physicsSteps).toBe(steps);expect(playback.resetCount).toBe(resets);expect(matrices(playback.skeleton)).toEqual(before);
    playback.seek(animation,.5,60);expect(playback.physicsSteps-steps).toBe(6);expect(playback.resetCount).toBe(resets);
    expect(matrices(playback.skeleton).flat().every(Number.isFinite)).toBe(true);
    playback.seek(animation,.25,60);expect(playback.resetCount).toBe(resets+1);
    const direct=new MiniNativePlayback(data,skin());direct.seek(animation,.25,60);expect(matrices(playback.skeleton)).toEqual(matrices(direct.skeleton));
  });
  it('matches a direct source seek after incremental steps, action switches and loop rewind',()=>{
    const playback=new MiniNativePlayback(data,skin()),attack=data.findAnimation('Attack_OneHand1')!,idle=data.findAnimation('Wait1')!;
    for(let frame=0;frame<=30;frame++)playback.seek(attack,frame/60,60);
    const direct=new MiniNativePlayback(data,skin());direct.seek(attack,.5,60);expect(matrices(playback.skeleton)).toEqual(matrices(direct.skeleton));
    playback.seek(idle,.1,60);direct.seek(idle,.1,60);expect(matrices(playback.skeleton)).toEqual(matrices(direct.skeleton));
    playback.seek(idle,1.5,60);playback.seek(idle,.05,60);direct.seek(idle,.05,60);expect(matrices(playback.skeleton)).toEqual(matrices(direct.skeleton));
  });
});

describe('MiniFantasy attachment-space sockets and explicit equipment support',()=>{
  it('maps the original untrimmed sword grip pixels to its hand bone despite atlas trim',()=>{
    for(const [id,pixel,imageSize] of [['100011',[26.62,150.05],[55,184]],['300601',[27.62,192.05],[56,234]]] as const){
      const playback=new MiniNativePlayback(data,skin(id));playback.seek(data.findAnimation(profile.weapons[id].actions.attack.name)!,profile.weapons[id].actions.attack.impactTime!,60);
      const slot=playback.skeleton.findSlot('RIGHTHAND')!,point=miniAttachmentPoint(slot,{slot:'RIGHTHAND',pixel:[...pixel],imageSize:[...imageSize]})!,hand=slot.bone.localToWorld(new Vector2(0,0));
      expect(point.x).toBeCloseTo(hand.x,4);expect(point.y).toBeCloseTo(hand.y,4);
    }
  });
  it('keeps staff tip and orb source points distinct and animated with the original attachment',()=>{
    const playback=new MiniNativePlayback(data,skin('400105')),weapon=profile.weapons['400105'],animation=data.findAnimation(weapon.actions.attack.name)!;
    playback.seek(animation,weapon.actions.attack.impactTime!,60);const slot=playback.skeleton.findSlot('RIGHTHAND')!;
    const tip=miniAttachmentPoint(slot,weapon.sockets.weapon!)!,orb=miniAttachmentPoint(slot,weapon.sockets.muzzle!)!;
    expect(Math.hypot(tip.x-orb.x,tip.y-orb.y)).toBeCloseTo(32,4);
    playback.seek(animation,.8,60);const later=miniAttachmentPoint(slot,weapon.sockets.muzzle!)!;
    expect(Math.hypot(later.x-orb.x,later.y-orb.y)).toBeGreaterThan(1);
    expect([tip.x,tip.y,orb.x,orb.y,later.x,later.y].every(Number.isFinite)).toBe(true);
  });
  it('does not expose an invisible original attachment as a visible weapon tip',()=>{
    const playback=new MiniNativePlayback(data,skin());playback.seek(data.findAnimation('Wait1')!,0,60);
    const slot=playback.skeleton.findSlot('RIGHTHAND')!,attachment=slot.getAttachment() as RegionAttachment,alpha=attachment.color.a;
    try{attachment.color.a=0;expect(miniAttachmentPoint(slot,profile.weapons['100011'].sockets.weapon!)).toBeUndefined();}
    finally{attachment.color.a=alpha;}
  });
  it('accepts only the explicitly approved three real set IDs and starter body parts',()=>{
    expect(miniSupportsAppearance(appearance(),profile)).toBe(true);
    expect(miniSupportsAppearance(appearance('300601'),profile)).toBe(true);
    expect(miniSupportsAppearance(appearance('400105','magic'),profile)).toBe(true);
    expect(miniSupportsAppearance(appearance('300601'))).toBe(true);
    expect(miniSupportsAppearance(appearance('400101'),profile)).toBe(false);
    expect(miniSupportsAppearance(appearance('100011','axe'),profile)).toBe(false);
    const otherHelmet=appearance();otherHelmet.parts.head.setId='100081';expect(miniSupportsAppearance(otherHelmet,profile)).toBe(false);
  });
  it('fits every measured extreme in both UI mirrors with 8px padding without changing game scale',()=>{
    for(const [width,height,configuredHeight] of [[384,384,240],[256,256,180]]){
      const scale=miniDisplayScale(profile,width,height,{height:configuredHeight,footX:.5,footY:.8,fitBounds:true}),b=profile.previewBounds!;
      for(const mirror of [-1,1])for(const x of [b.minX,b.maxX])for(const y of [b.minY,b.maxY]){
        const sx=width*.5+(x-profile.ground[0])*scale*mirror,sy=height*.8-(y-profile.ground[1])*scale;
        expect(sx).toBeGreaterThanOrEqual(8-1e-8);expect(sx).toBeLessThanOrEqual(width-8+1e-8);
        expect(sy).toBeGreaterThanOrEqual(8-1e-8);expect(sy).toBeLessThanOrEqual(height-8+1e-8);
      }
    }
    expect(miniDisplayScale(profile,512,512,{height:96,footX:.5,footY:.75})).toBe(96/profile.referenceHeight);
  });
});
