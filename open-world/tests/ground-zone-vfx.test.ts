import {it,expect} from 'vitest';
import {groundZoneGeometry,groundZoneStyle} from '../apps/web/src/ground-zone-vfx.ts';
import {projectFx} from '../apps/web/src/skill-fx-layout.ts';
it('keeps vortex strands and landing points inside the actual ground radius',()=>{
 const origin={x:12,y:12},center=projectFx(origin),radius=3.5;
 for(const style of ['vortex','starfall','arrows','pulse'] as const){const result=groundZoneGeometry(origin,radius,1.4,31,style),points=[...result.strands.flat(),...result.drops.map(d=>d.ground)];for(const p of points){const x=(p.x-center.x)/64+(p.y-center.y)/36,y=(p.y-center.y)/36-(p.x-center.x)/64;expect(Math.hypot(x,y)).toBeLessThan(radius);}}
});
it('rotates a continuous ground spiral and uses downward motion for falling effects',()=>{
 expect(groundZoneStyle('spiral')).toBe('vortex');expect(groundZoneStyle('orbit')).toBe('vortex');expect(groundZoneStyle('starfall')).toBe('starfall');expect(groundZoneStyle('falling-arrows')).toBe('arrows');
 const a=groundZoneGeometry({x:12,y:12},3,0,31,'vortex'),b=groundZoneGeometry({x:12,y:12},3,.1,31,'vortex');expect(a.strands).not.toEqual(b.strands);expect(a.drops).toHaveLength(0);
 const drops=groundZoneGeometry({x:12,y:12},3,.1,31,'starfall').drops;expect(drops.every(d=>d.position.x===d.ground.x&&d.position.y<=d.ground.y)).toBe(true);
});
it('uses the combat age deterministically and freezes decoration for reduced motion',()=>{
 expect(groundZoneGeometry({x:12,y:12},3,1,7,'vortex')).toEqual(groundZoneGeometry({x:12,y:12},3,1,7,'vortex'));
 expect(groundZoneGeometry({x:12,y:12},3,0,7,'vortex',true)).toEqual(groundZoneGeometry({x:12,y:12},3,100,7,'vortex',true));
});
