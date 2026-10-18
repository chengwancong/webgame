import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {vfxPresence,visibleFxScale,stageOpacity} from '../apps/web/src/vfx-presence.ts';
import library from '../packages/asset-manifest/combat-layer-fx.json';
import source from '../packages/asset-manifest/skill-fx.json';
import extra from '../packages/asset-manifest/vfx-v2.json';
import metrics from '../packages/asset-manifest/combat-fx-metrics.json';
it('provides real body and impact layers for every registered profile with a clear power hierarchy',()=>{
 const clips=new Set([...Object.keys(library.clips),...Object.keys(source.clips),...Object.keys(extra.clips)]);
 for(const p of Object.values(vfxProfiles)){const r=vfxPresence(p);for(const id of [r.impact,r.release,r.surface,r.flight].filter(Boolean))expect(clips.has(id!),p.key+'/'+id).toBe(true);expect(r.size).toBeGreaterThanOrEqual(p.size);expect(r.impactSize).toBeGreaterThan(70);}
 expect(vfxPresence(vfxProfiles['player/cut']).size).toBeLessThan(vfxPresence(vfxProfiles['player/execute']).size);expect(vfxPresence(vfxProfiles['player/fireball']).impact).not.toBe(vfxPresence(vfxProfiles['player/frost_bolt']).impact);
 expect(vfxPresence(vfxProfiles['player/poison_arrow']).flight).toBe('arrow');expect(vfxPresence(vfxProfiles['player/vortex']).surface).toBe('library-void-cloud');
});
it('normalizes actual painted bounds instead of shrinking padded cells and retains stable scale through an animation',()=>{
 const m=metrics['fireball-flight'],scale=visibleFxScale(156,m.visibleSize,[192,192]);expect(Math.max(...m.visibleSize)*scale).toBeCloseTo(156);expect(scale).toBeGreaterThan(156/192);expect(visibleFxScale(100,[NaN,0],[200,200])).toBe(.5);
 expect(stageOpacity(.5)).toBeGreaterThan(.6);for(const t of [-1,0,.3,1,3])expect(stageOpacity(t)).toBeGreaterThanOrEqual(0);expect(stageOpacity(1)).toBe(0);
});
it('reuses verified library frames with finite bounds and preserved original atlas provenance',async()=>{
 for(const [id,c]of Object.entries(library.clips)){expect(c.frames.length,id).toBeGreaterThan(1);expect(new Set(c.frames).size).toBe(c.frames.length);expect(c.visibleSize.every(n=>n>0&&n<=c.cell)).toBe(true);expect(c.origin.every(n=>Number.isFinite(n)&&n>=0&&n<=1)).toBe(true);
  const bytes=await readFile(new URL('../apps/web/public'+c.source.approvedAtlas,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex'),id).toBe(c.source.approvedAtlasHash);
 }
});
