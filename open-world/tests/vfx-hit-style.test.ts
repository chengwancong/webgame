import {it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import hitManifest from '../packages/asset-manifest/combat-hit-fx.json';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import cookedManifest from '../packages/asset-manifest/combat-cooked-fx.json';
import {hitLayer,areaLayer,critLayer,freezeLayer,iceStatusLayer,cookedHitClip,statusMarkerKind,statusMarkerLayers} from '../apps/web/src/vfx-hit-style.ts';

type Clip={image:string;source:{library?:string;pack?:string;sourceSha256?:string;license?:string}};
const clips={...hitManifest.clips,...cookedManifest.clips} as Record<string,Clip>;

it('gives every skill profile a registered library hit layer with a real sheet',()=>{
 const used=new Set([critLayer.clip,freezeLayer.clip,iceStatusLayer.clip]);
 for(const p of Object.values(vfxProfiles)){const hit=hitLayer(p),area=areaLayer(p);used.add(hit.clip);if(area)used.add(area.clip);expect(hit.size,p.key).toBeGreaterThan(40);}
 for(const id of used){const clip=clips[id];expect(clip,id).toBeTruthy();if(id.startsWith('cooked-')){expect(clip.source.pack,id).toContain('Cooked FX');expect(clip.source.sourceSha256,id).toMatch(/^[0-9a-f]{64}$/);expect(clip.source.license,id).toBeTruthy();}else expect(clip.source.library,id).toMatch(/^\d{3}-/);expect(existsSync('apps/web/public'+clip.image),id).toBe(true);}
});

it('keeps element identity: each element hits with its own layer, monsters read smaller than the hero',()=>{
 const byElement=new Map<string,Set<string>>();
 for(const p of Object.values(vfxProfiles).filter(p=>p.key.startsWith('player/'))){const set=byElement.get(p.element)??new Set();set.add(hitLayer(p).clip);byElement.set(p.element,set);}
 const owners=new Map<string,string>();for(const [element,set] of byElement)for(const clip of set){const identity=element==='earth'?'steel':element;if(owners.has(clip))expect(owners.get(clip),clip).toBe(identity);owners.set(clip,identity);}
 for(const p of Object.values(vfxProfiles).filter(p=>p.element==='earth'))if(p.key.startsWith('player/')){expect(hitLayer(p).clip).not.toBe('hit-earth');expect(areaLayer(p)).toBeUndefined();}else if(p.key.startsWith('monster/'))expect(hitLayer(p).clip).toBe('hit-earth');
 const hero=Object.values(vfxProfiles).find(p=>p.key.startsWith('player/')&&p.element==='fire'&&p.power===2)!,monster=Object.values(vfxProfiles).find(p=>p.key.startsWith('monster/')&&p.element==='fire'&&p.power===2);
 if(monster)expect(hitLayer(monster).size).toBeLessThan(hitLayer(hero).size);
});

it('registers the Cooked FX replacements with provenance and keeps the physical spec layers mapped',()=>{
 expect(['hit-slash','hit-blast','hit-fire-big','hit-ice'].map(cookedHitClip)).toEqual(['cooked-slash-x','cooked-hit','cooked-explosion','cooked-ice-hit']);
 expect(cookedHitClip('ground-dust')).toBe('ground-dust');
 for(const layer of Object.values(statusMarkerLayers)){const clip=clips[layer.clip];expect(clip,layer.clip).toBeTruthy();expect(existsSync('apps/web/public'+clip.image),layer.clip).toBe(true);}
 expect(['stun','petrify','time_stop'].map(statusMarkerKind)).toEqual(['control','control','control']);
 expect(['burn','poison','vulnerable','attack_up','freeze','slow'].map(statusMarkerKind)).toEqual(['burn','poison','debuff','buff',undefined,undefined]);
});
