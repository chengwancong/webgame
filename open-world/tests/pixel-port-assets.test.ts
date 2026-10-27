import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {PixelManifest} from '../apps/web/src/pixel-assets.ts';
const manifest=JSON.parse(fs.readFileSync(new URL('../apps/web/public/art-pixel/manifest.json',import.meta.url),'utf8')) as PixelManifest;
const source=JSON.parse(fs.readFileSync(new URL('../packages/asset-manifest/starsea.v1.json',import.meta.url),'utf8'));
it('ships all twelve building levels and each port facility on the x2 integer grid',()=>{
 const ids=[...['forge','dock','post'].flatMap(name=>[1,2,3,4].map(level=>`ss-scene-build-${name}-${level}`)),...['pet-yard','stall-jinyu','stall-mijia','stall-xuemi','wardrobe','warehouse'].map(name=>'ss-scene-port-'+name),...['house','pier','airship','workshop','stargate'].map(name=>'ss-scene-'+name),...['1','2','3'].map(level=>'ss-scene-workshop-tier-'+level)];
 for(const id of ids){const a=manifest.assets[id];expect(a,id).toBeDefined();expect(a.scale).toBe(2);expect(a.frame.every(n=>n%8===0),id).toBe(true);expect(a.provenance.reviewed,id).toBe(true);}
});
it('retains the source atlas frame names for buildings and the complete gate cycle',()=>{
 for(const asset of source.assets.filter((a:any)=>a.id.startsWith('ss-scene-build-'))){expect(manifest.assets[asset.id].frames?.[asset.runtime.frame]).toBeDefined();}
 const gate=manifest.assets['ss-scene-stargate'];for(const name of ['stargate-base','stargate-ring-lit',...Array.from({length:6},(_,i)=>'stargate-glow-'+i)])expect(gate.frames?.[name],name).toBeDefined();
});
