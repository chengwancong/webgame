import {it,expect} from 'vitest';
import fs from 'node:fs';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import story from '../packages/asset-manifest/story-npcs.json';
import type {PixelManifest} from '../apps/web/src/pixel-assets.ts';
const manifest=JSON.parse(fs.readFileSync(new URL('../apps/web/public/art-pixel/manifest.json',import.meta.url),'utf8')) as PixelManifest;
it('covers every registered world NPC with authored idle/move and unchanged source durations',()=>{
 let count=0;for(const source of runtimeResources.values())if(source.group==='npc'){
  count++;const a=manifest.assets[source.id];expect(a,source.id).toBeDefined();expect(a.frame).toEqual([64,64]);expect(a.scale).toBe(2);
  expect(a.original).toContain(source.runtime.profile);expect(a.actions!.idle.count).toBe(4);expect(a.actions!.move.count).toBe(6);
  for(const [name,clip] of Object.entries(source.actions) as [string,{duration:number}][])if(Number.isFinite(clip.duration))expect(a.actions![name].duration,source.id+'/'+name).toBe(clip.duration);
 }expect(count).toBe(53);
});
it('registers all seven story NPC profiles without replacing dialogue portraits',()=>{
 expect(Object.keys(story.npcs)).toHaveLength(7);for(const [id,npc] of Object.entries(story.npcs)){
  const a=manifest.assets['story-npc:'+id];expect(a.original).toEqual([npc.profile]);expect(a.actions!.idle.loop).toBe(true);expect(a.actions!.move.loop).toBe(true);expect(a.original.some(p=>p.includes('portrait'))).toBe(false);
 }
});
