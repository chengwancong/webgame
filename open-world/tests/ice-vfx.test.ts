import {it,expect} from 'vitest';
import {iceFieldCrystals,iceCrystalFaces} from '../apps/web/src/ice-vfx.ts';
import {projectFx} from '../apps/web/src/skill-fx-layout.ts';
it('anchors substantial crystals inside the actual circular footprint and leaves the caster center open',()=>{
 const center={x:12,y:12},floor=projectFx(center),radius=5;
 for(const c of iceFieldCrystals(center,radius,.3,21,false,true)){const dx=(c.ground.x-floor.x)/64+(c.ground.y-floor.y)/36,dy=(c.ground.y-floor.y)/36-(c.ground.x-floor.x)/64;expect(Math.hypot(dx,dy)).toBeGreaterThan(radius*.6);expect(Math.hypot(dx,dy)).toBeLessThan(radius);expect(c.height).toBeGreaterThan(90);expect(c.width).toBeGreaterThanOrEqual(27);}
});
it('grows on the combat clock and holds a stable reduced-motion arrangement',()=>{
 const args=[{x:12,y:12},3] as const,a=iceFieldCrystals(...args,0,14,false,true),b=iceFieldCrystals(...args,.2,14,false,true);expect(b[0].height).toBeGreaterThan(a[0].height);expect(a.map(c=>c.ground)).toEqual(b.map(c=>c.ground));expect(iceFieldCrystals(...args,0,14,true,true)).toEqual(iceFieldCrystals(...args,99,14,true,true));
});
it('keeps three solid facets grounded and a high contrast ridge through the crystal',()=>{
 const ground={x:30,y:180},f=iceCrystalFaces(ground,120,32,8);expect(f.outline).toContainEqual(ground);expect(f.ridge[0]).toEqual({x:38,y:60});expect(f.dark).toContainEqual(ground);expect(f.main).toContainEqual(ground);for(const p of Object.values(f).flat())expect(Number.isFinite(p.x)&&Number.isFinite(p.y)).toBe(true);
});
