import {it,expect} from 'vitest';
import manifest from '../packages/asset-manifest/combat-physical-fx.json';
import {physicalSpecs,physicalLimits} from '../apps/web/src/physical-vfx-spec.ts';
import {GroundImpact} from '../apps/web/src/vfx-ground.ts';
import hits from '../packages/asset-manifest/combat-hit-fx.json';
import library from '../packages/asset-manifest/combat-layer-fx.json';
import {physicalActions} from '../apps/web/src/physical-actions.ts';
import {physicalSkillIds} from '../apps/web/src/physical-vfx-qa.ts';
import {PhysicalSkillLayers,physicalFlightStyle,dashGhostPositions} from '../apps/web/src/vfx-physical-skills.ts';
import {physicalBodyMotion} from '../apps/web/src/physical-motion.ts';
import {vfxProfile} from '../apps/web/src/vfx-profiles.ts';
it('covers the exact 43-skill brief with source-backed main, hit, and ground combinations',()=>{
 expect(Object.keys(physicalSpecs).sort()).toEqual([...physicalSkillIds].sort());
 for(const [id,s]of Object.entries(physicalSpecs)){expect(s.action,id).toBe(physicalActions[id].action);if(s.main)expect(s.main in manifest.clips||s.main in hits.clips||s.main in library.clips,id).toBe(true);for(const hit of s.hit)expect(hit in manifest.clips||hit in hits.clips,id+':'+hit).toBe(true);expect(s.hit,id).not.toContain('hit-earth');expect(s.stones).toBeLessThanOrEqual(10);if(['rush','thunder_dash','shadow_step'].includes(id))expect(s.lunge).toBe(0);expect(physicalBodyMotion(id,1,3,{x:1,y:1},true)).toEqual({x:0,y:0,groundY:0});}
 for(const s of Object.values(physicalSpecs)){if(!s.main)continue;if(s.main in library.clips){const source=(library.clips as Record<string,{source:{originalPath:string;sha256:string}}>)[s.main].source;expect(source.originalPath).toContain('Q版日式手游SPINE特效300套');expect(source.sha256).toHaveLength(64);continue;}const clip=({...manifest.clips,...hits.clips} as Record<string,{source:{library:string;sheetSha256:string;originalSha256:string;frameTableSha256?:string}}>)[s.main];expect(clip.source.library).toMatch(/^\d{3}-/);expect(clip.source.originalSha256).toHaveLength(64);expect(clip.source.sheetSha256).toHaveLength(64);if(s.main in manifest.clips)expect(clip.source.frameTableSha256).toHaveLength(64);}
 expect(physicalSpecs.ground_slam.ground).toEqual(['crater','ring','dust','stones']);expect(physicalSpecs.seismic_staff.stones).toBe(8);expect(physicalSpecs.staff_strike.main).toBe('ground-ring');expect(physicalSpecs.staff_flurry.onHit).toBe(true);expect(physicalSpecs.explosive_kunai.surface).toBe(true);expect(physicalSpecs.rain_of_arrows.surface).toBe(true);
});
it('draws one source body per real flight, preserves needle scale and pierce length, and disables spinning in reduced motion',()=>{
 const calls:any[]=[];const node:any=new Proxy({},{get:()=>()=>node}),layers=new PhysicalSkillLayers({} as any,{} as any,()=>false,(...args:any[])=>{calls.push(args);return node;},()=>undefined);
 for(const [n,id]of ['throwing_knife','multi_shot','death_lotus'].entries()){expect(layers.flight('p:'+n,{id:n,skill:id} as any,vfxProfile('player/'+id)!,{x:1,y:2},{x:1,y:2},0,3,5)).toBe(true);}
 expect(calls).toHaveLength(3);expect(calls.map(a=>a[1])).toEqual(['knife-flight','arrow-flight','knife-flight']);
 expect(physicalFlightStyle(physicalSpecs.venom_needle,'venom_needle',3,false).width).toBeCloseTo(26.4);expect(physicalFlightStyle(physicalSpecs.pierce_arrow,'pierce_arrow',3,false).width).toBe(128);expect(physicalFlightStyle(physicalSpecs.throwing_knife,'throwing_knife',3,true).turn).toBe(0);
});
it('distributes at most three afterimages on the real displacement segment instead of stacking at arrival',()=>{expect(dashGhostPositions({x:10,y:20},{x:90,y:60},3)).toEqual([{x:30,y:30},{x:50,y:40},{x:70,y:50}]);expect(dashGhostPositions({x:10,y:20},{x:90,y:60},2)).toHaveLength(2);expect(dashGhostPositions({x:0,y:0},{x:1,y:1},20)).toHaveLength(3);expect(dashGhostPositions({x:0,y:0},{x:1,y:1},0)).toEqual([]);});
it('waits for actual activations and contacts, and reduced dashes allocate no ghost textures',()=>{
 const calls:any[]=[];const node:any=new Proxy({},{get:()=>()=>node}),scene:any={textures:{createCanvas:()=>{throw Error('Reduced motion allocated a ghost');}}},pool:any={graphics:()=>node};
 const layers=new PhysicalSkillLayers(scene,pool,()=>true,(...args:any[])=>{calls.push(args);return node;},()=>({image:{texture:'hero'}} as any)),point={x:10,y:10};
 const event:any={id:'hero',type:'cast_released',skill:'explosive_kunai',position:point,tick:1};
 layers.release(event,vfxProfile('player/explosive_kunai')!,'release',3,'cast',point,point,point);expect(calls).toHaveLength(0);
 layers.release(event,vfxProfile('player/explosive_kunai')!,'surface',3,'surface',point,point,point);expect(calls[0][1]).toBe('hit-fire-big');calls.length=0;
 layers.release({...event,skill:'staff_flurry'},vfxProfile('player/staff_flurry')!,'release',3,'staff',point,point,point);expect(calls).toHaveLength(0);
 layers.release({...event,skill:'rush'},vfxProfile('player/rush')!,'release',3,'dash',point,point,point);expect(calls.some(a=>String(a[0]).includes('ghost'))).toBe(false);
 calls.length=0;layers.release({...event,skill:'rain_of_arrows'},vfxProfile('player/rain_of_arrows')!,'release',3,'rain',point,point,point);expect(calls).toHaveLength(0);
 layers.reset();
});
it('registers source-backed main layers and bounded ground effects for the four samples',()=>{for(const id of ['cut','whirl','cleave','ground_slam']){const spec=physicalSpecs[id];expect(spec,id).toBeTruthy();if(spec.main){const clip=manifest.clips[spec.main as keyof typeof manifest.clips];expect(clip.source.library).toMatch(/^\d{3}-/);expect(clip.source.frameTableSha256).toHaveLength(64);}}expect(physicalLimits.minimumRibbonWidth).toBe(6);expect(physicalLimits.whiteFlashTicks).toBeLessThanOrEqual(2);});
it('caps sixty simultaneous ground slams at six decals and the remaining global particle budget',()=>{
 let reduced=false;const image:any=new Proxy({},{get:()=>()=>image}),pool:any={visible:()=>true,image:()=>image},ground=new GroundImpact(pool,()=>reduced);
 for(let i=0;i<60;i++)ground.add({type:'cast_released',id:'hero',skill:'ground_slam',position:{x:10,y:10},tick:0},physicalSpecs.ground_slam,4,4,0xffffff);
 expect(ground.stats().decals).toBe(6);expect(ground.draw(3,384)).toBeLessThanOrEqual(384);expect(ground.stats().stones).toBeLessThanOrEqual(384);
 reduced=true;expect(ground.draw(4,384)).toBe(0);expect(ground.stats().stones).toBe(0);ground.draw(40,384);expect(ground.stats().decals).toBe(0);
});
