import {expect,it,vi} from 'vitest';
import {registerLoadedActorAnimations} from '../apps/web/src/loaded-actor-animations.ts';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
it('defers atlas animation registration until texture completion and registers only once on re-entry',()=>{
 const assets=[...runtimeResources.values()].filter(a=>a.group==='monsters'&&a.runtime.kind==='atlas') as {id:string;group:string;runtime:{kind:string;actions:Record<string,{frames:string[];fps:number;loop?:boolean}>}}[];
 expect(assets.length).toBeGreaterThan(0);
 const textures=new Set<string>(),animations=new Set<string>();
 const create=vi.fn((animation:{key:string;frames:{key:string;frame:string}[]})=>{expect(animation.frames.length).toBeGreaterThan(0);expect(textures.has(animation.frames[0].key)).toBe(true);animations.add(animation.key);});
 const scene={textures:{exists:(id:string)=>textures.has(id)},anims:{exists:(key:string)=>animations.has(key),create}};
 registerLoadedActorAnimations(scene,assets);expect(create).not.toHaveBeenCalled();
 textures.add(assets[0].id);registerLoadedActorAnimations(scene,assets);
 const first=Object.keys(assets[0].runtime.actions).length;expect(create).toHaveBeenCalledTimes(first);
 assets.forEach(asset=>textures.add(asset.id));registerLoadedActorAnimations(scene,assets);
 const all=assets.reduce((n,a)=>n+Object.keys(a.runtime.actions).length,0);expect(create).toHaveBeenCalledTimes(all);
 registerLoadedActorAnimations(scene,assets);expect(create).toHaveBeenCalledTimes(all);
});
