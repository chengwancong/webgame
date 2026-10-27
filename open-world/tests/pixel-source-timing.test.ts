import {it,expect} from 'vitest';
import fs from 'node:fs';
import source from '../packages/asset-manifest/wardrobe.json';
import {heroAnimationFrame} from '../apps/web/src/effect-attachments.ts';
import type {PixelManifest} from '../apps/web/src/pixel-assets.ts';
const manifest=JSON.parse(fs.readFileSync(new URL('../apps/web/public/art-pixel/manifest.json',import.meta.url),'utf8')) as PixelManifest;
it('retains the published motion durations and release times for every wardrobe entry',()=>{
 const family:Record<string,string>={sword:'sword',hammer:'axe',axe:'axe',bow:'bow',staff:'magic',hidden:'fist',wand:'magic',gun:'gun',fist:'fist',spear:'spear',magic:'magic'};
 for(const [type,motionFamily] of Object.entries(family)){
  const asset=manifest.assets[`hero:${type}:wardrobe`],reference=(source.motions as Record<string,{actions:Record<string,{duration:number;impactTime:number}>}>)[motionFamily];
  expect(asset.layers?.length).toBe(2);
  for(const action of ['idle','move','attack','skill','projectile','hurt','death']){
   const clip=asset.actions![action];expect(clip.duration).toBe(reference.actions[action].duration);expect(clip.impactTime).toBe(reference.actions[action].impactTime);
   expect(clip.frameTimes[clip.impactFrame]).toBeCloseTo(clip.impactTime,9);
  }
 }
});
it('uses the existing boot-hero release frames, including the distinct skill release',()=>{
 const hero=manifest.assets.hero;for(const action of ['attack','skill'] as const)expect(hero.actions![action].impactTime).toBe(heroAnimationFrame(action,1,1,1)/15);
 expect(hero.actions!.skill.impactTime).not.toBe(hero.actions!.attack.impactTime);
});
it('registers all gameplay weapons and keeps authored body/weapon layers on the same native grid',()=>{
 for(const type of ['sword','hammer','axe','bow','staff','hidden','wand'])for(const mode of ['native','wardrobe']){
  const asset=manifest.assets[`hero:${type}:${mode}`];expect(asset.frame).toEqual([128,128]);expect(asset.scale).toBe(1);
  for(const key of asset.layers!){expect(manifest.assets[key].frame).toEqual(asset.frame);expect(manifest.assets[key].anchor).toEqual(asset.anchor);}
 }
});
