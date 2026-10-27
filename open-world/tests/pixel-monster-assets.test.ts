import {it,expect} from 'vitest';
import fs from 'node:fs';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import {collectInventory} from '../tools/pixel/inventory.ts';
import type {PixelManifest} from '../apps/web/src/pixel-assets.ts';
const manifest=JSON.parse(fs.readFileSync(new URL('../apps/web/public/art-pixel/manifest.json',import.meta.url),'utf8')) as PixelManifest;
it('covers every live monster, legacy actor and implicit elite form, including all selected native profiles',()=>{
 const rows=collectInventory().filter(r=>r.batch==='PX4');expect(rows).toHaveLength(147);
 for(const row of rows){const asset=manifest.assets[row.key];expect(asset,row.key).toBeDefined();for(const file of row.paths)expect(asset.original,row.key).toContain(file);expect(asset.scale).toBe(1);}
});
it('keeps elite body sizing at the source 1.25 factor bounded by its original display height',()=>{
 for(const [key,asset] of Object.entries(manifest.assets))if(asset.batch==='PX4'&&key.endsWith(':elite')){
  const base=manifest.assets[key.slice(0,-6)];expect(asset.bodyHeight,key).toBeCloseTo(Math.min(base.bodyHeight!*1.25,asset.displayHeight??Infinity),6);expect(asset.file,key).not.toBe(base.file);expect(asset.scale).toBe(1);
 }
});
it('retains source impact times and phase windows for all six native bosses',()=>{
 const bosses=[...runtimeResources.values()].filter(a=>a.id.startsWith('ss-boss-'));expect(bosses).toHaveLength(6);
 for(const source of bosses){const asset=manifest.assets[source.id];expect(asset.frame).toEqual([320,320]);expect(asset.bodyHeight).toBeGreaterThanOrEqual(192);expect(asset.bodyHeight).toBeLessThanOrEqual(256);expect(asset.displayHeight).toBeLessThanOrEqual(256);
  for(const [name,clip] of Object.entries(source.actions) as [string,any][])if(Number.isFinite(clip.impactTime))expect(asset.actions![name].impactTime).toBeCloseTo(clip.impactTime,8);
  for(const [name,clip] of Object.entries((source.actions as any).skills??{}) as [string,any][])if(Number.isFinite(clip.impactTime))expect(asset.actions![name].impactTime).toBeCloseTo(clip.impactTime,8);
  for(const phase of ['phase-enter','phase-end'])expect(asset.actions![phase+':idle'].duration).toBeCloseTo((source.states as any)[phase].transitionWindow,6);
  expect(asset.actions!['phase-active:idle']).toBeDefined();expect(asset.actions!.death.frameTimes[3]).toBeCloseTo((source.states as any).death.cleanupTime,8);expect(asset.actions!.death.sockets[3].ss_core).toBeUndefined();
 }
});
it('retains the mimic wake sequence and the existing legacy boss cast entry points',()=>{
 expect(manifest.assets['hub-mimic'].actions!.wake.count).toBeGreaterThanOrEqual(6);
 for(const id of ['frost_queen','abyss_lord','dragon_king'])for(const name of ['cast','cast-physical'])expect(manifest.assets[id].actions![name]).toBeDefined();
});
