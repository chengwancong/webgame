import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {circleTelegraphGeometry,paintCircleTelegraph,paintBeamTelegraph} from '../apps/web/src/telegraph-polish.ts';
import {beamFootprint} from '../apps/web/src/vfx-geometry.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import source from '../packages/asset-manifest/telegraph-reuse.json';
it('keeps every progress state on the exact same world-projected hit boundary',()=>{
 const center={x:200,y:300};for(const progress of [0,.2,.7,1]){const g=circleTelegraphGeometry(center,6,progress);for(const p of g.edge){const dx=p.x-center.x,dy=p.y-center.y,x=dx/64+dy/36,y=dy/36-dx/64;expect(Math.hypot(x,y)).toBeCloseTo(6,8);}expect(Math.hypot((g.tip.x-center.x)/64+(g.tip.y-center.y)/36,(g.tip.y-center.y)/36-(g.tip.x-center.x)/64)).toBeLessThan(6);}
});
it('samples larger projected circles more finely without changing the range',()=>{expect(circleTelegraphGeometry({x:0,y:0},6,.5).steps).toBeGreaterThan(circleTelegraphGeometry({x:0,y:0},1,.5).steps);expect(circleTelegraphGeometry({x:0,y:0},100,.5).steps).toBeLessThanOrEqual(128);});
it('freezes reduced-motion decorations at a fixed simulation instant and keeps alpha valid',()=>{
 const commands:any[]=[],g:any={};for(const method of ['lineStyle','fillStyle','fillCircle','beginPath','moveTo','lineTo','closePath','strokePath','fillPath'])g[method]=(...args:any[])=>{commands.push([method,...args]);return g;};
 const paint=()=>{commands.length=0;paintCircleTelegraph(g,{x:100,y:100},3,70,0,100,vfxProfiles['monster/basic-area'],true);return JSON.stringify(commands);};expect(paint()).toBe(paint());
 paintBeamTelegraph(g,beamFootprint({x:0,y:0},{x:1,y:0},2,20),70,0,100,true);for(const [method,...args]of commands)if(method==='lineStyle'||method==='fillStyle'){const alpha=method==='lineStyle'?args[2]:args[1];expect(alpha).toBeGreaterThanOrEqual(0);expect(alpha).toBeLessThanOrEqual(1);}
});
it('publishes the user resource fragment byte-for-byte and does not claim a native animation import',()=>{const bytes=readFileSync(new URL('../assets/telegraph-reuse/tip-glow.png',import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);expect(readFileSync(new URL('../apps/web/public'+source.image,import.meta.url))).toEqual(bytes);expect(source.kind).toBe('static-fragment');expect(source.nativeAnimationImported).toBe(false);});
