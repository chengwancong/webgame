import {it,expect,vi} from 'vitest';
import {existsSync} from 'node:fs';
vi.mock('phaser',()=>({default:{Textures:{Events:{ADD:'addtexture'}},Loader:{Events:{FILE_LOAD_ERROR:'loaderror',COMPLETE:'complete'}}}}));
import {LegacyActorArt,bootLegacyTextures,legacyTexture} from '../apps/web/src/legacy-actor-art.ts';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';

function fakeScene(preloaded:string[]){
 const handlers=new Map<string,((...a:any[])=>void)[]>(),on=(e:string,f:(...a:any[])=>void)=>{handlers.set(e,[...handlers.get(e)??[],f]);},emit=(e:string,...a:any[])=>{for(const f of handlers.get(e)??[])f(...a);};
 const textures=new Set(preloaded),anims=new Set<string>(),queued:string[]=[];let loading=false,starts=0;
 const scene={textures:{on,exists:(k:string)=>textures.has(k)},anims:{exists:(k:string)=>anims.has(k),create:(c:{key:string})=>{anims.add(c.key);}},
  load:{on,isLoading:()=>loading,start:()=>{loading=true;starts++;},atlas:(key:string)=>{queued.push(key);}}};
 const finish=(key:string,ok=true)=>{if(ok){textures.add(key);emit('addtexture',key);}else emit('loaderror',{key});};
 return {scene:scene as any,anims,queued,finish,starts:()=>starts};
}

it('boots with only the hero atlas and every legacy atlas file exists for on-demand loading',()=>{
 expect(bootLegacyTextures).toEqual(['hero']);
 const keys=new Set(Object.keys(actorCatalog).map(legacyTexture).filter(Boolean));
 expect(keys.size).toBeGreaterThan(10);
 for(const key of keys)expect(existsSync('apps/web/public/art/'+key+'.png'),key).toBe(true);
 expect(legacyTexture('hero')).toBe('hero');
});
it('loads a missing atlas once, creates its animations, then reports ready',()=>{
 const f=fakeScene(['hero']),art=new LegacyActorArt(f.scene);
 expect(f.anims.has('hero-idle')).toBe(true);expect(f.anims.has('raider-idle')).toBe(false);
 const done=vi.fn();
 expect(art.ensure(['hero'])).toBe(true);
 expect(art.ensure(['raider','hero'],done)).toBe(false);expect(art.ensure(['raider'])).toBe(false);
 expect(f.queued).toEqual(['raider']);expect(f.starts()).toBe(1);expect(art.ready('raider')).toBe(false);
 f.finish('raider');
 expect(done).toHaveBeenCalledOnce();expect(art.ready('raider')).toBe(true);expect(f.anims.has('raider-idle')).toBe(true);
});
it('does not wait forever on a broken atlas',()=>{
 const f=fakeScene(['hero']),art=new LegacyActorArt(f.scene),done=vi.fn();
 art.ensure(['beast'],done);vi.spyOn(console,'error').mockImplementation(()=>{});f.finish('beast',false);
 expect(done).toHaveBeenCalledOnce();expect(art.ready('beast')).toBe(true);
});
