import '../packages/content/open-world/index.ts';
import {expect,it} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {gatheredInRegion,inInteractionReach,interactionReach,interactionApproaches,reachableApproach} from '../packages/rules/world-interactions.ts';
import {walkable} from '../packages/simulation/navigation.ts';
it('BUG-31 preserves current-map gathered nodes, including old snapshots without field.region',()=>{
 expect(gatheredInRegion({lastRegion:'wind',field:{gathered:['ore']}},'wind').has('ore')).toBe(true);
 expect(gatheredInRegion({lastRegion:'mist',field:{region:'wind',gathered:['ore']}},'mist').size).toBe(0);
});
it('BUG-55 chest prompt and server share the inclusive distance boundary',()=>{
 expect(inInteractionReach({x:0,y:0},{x:4.5,y:0},interactionReach.activity)).toBe(true);
 expect(inInteractionReach({x:0,y:0},{x:4.51,y:0},interactionReach.activity)).toBe(false);
});
it('BUG-38 and 40 keep the NPC approach open and put return interaction on the clear edge of the landing',()=>{
 const wind=regionById('ss-map-wind');for(let i=0;i<8;i++)expect(walkable(wind,{x:129+2*Math.cos(i*Math.PI/4),y:189+2*Math.sin(i*Math.PI/4)},.55)).toBe(true);
 const mist=regionById('ss-map-mist'),camps=worldTables.camps.filter(c=>c.region===mist.id),clearance=(p:{x:number;y:number})=>Math.min(...camps.map(c=>Math.hypot(c.x-p.x,c.y-p.y)-c.radius));
 expect(clearance(mist.portal)).toBeGreaterThanOrEqual(clearance(mist.safe));expect(walkable(mist,mist.portal,.55)).toBe(true);
});
it('BUG-59 every current gather node has multiple legal approach cells, and enclosed targets are rejected',()=>{
 for(const n of worldTables.objects.filter(n=>n.kind==='gather'))expect(interactionApproaches(regionById(n.region),n).length,n.id).toBeGreaterThanOrEqual(5);
 const map={...regionById('meadow'),width:12,height:12,obstacles:[{x:4,y:4,w:5,h:1},{x:4,y:8,w:5,h:1},{x:4,y:4,w:1,h:5},{x:8,y:4,w:1,h:5}]};
 expect(reachableApproach(map,{x:2,y:2},{x:6.5,y:6.5},2)).toBeUndefined();
});
