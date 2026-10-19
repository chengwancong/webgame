import {expect,it} from 'vitest';
import {placeHudRect,overlaps} from '../apps/web/src/hud-avoidance.ts';
it('uses one collision-free layout for tracker, toast and measured world labels',()=>{
 const viewport={x:0,y:0,width:1280,height:720},tracker={x:20,y:130,width:270,height:220},toast={x:440,y:70,width:400,height:55};
 const label=placeHudRect({x:220,y:200,width:170,height:32},[tracker,toast],viewport,8)!;
 expect(label).toBeDefined();expect(overlaps(label,tracker,8)).toBe(false);expect(overlaps(label,toast,8)).toBe(false);expect(label.y+label.height).toBeLessThanOrEqual(720);
});
it('does not squeeze oversized labels or displace already-clear labels',()=>{
 const viewport={x:0,y:0,width:320,height:180},label={x:10,y:30,width:100,height:20};
 expect(placeHudRect(label,[],viewport,8)).toEqual(label);expect(placeHudRect({...label,width:400},[],viewport,8)).toBeUndefined();
});
