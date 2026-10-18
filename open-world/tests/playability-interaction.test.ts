import {describe,it,expect} from 'vitest';
import {selectInteraction,type InteractionCandidate} from '../apps/web/src/interaction-candidate.ts';
const hero={x:0,y:0};
const candidate=(kind:InteractionCandidate['kind'],priority:number):InteractionCandidate=>({id:kind,kind,priority,position:{x:1,y:0},reach:4,text:kind});
describe('提示与执行共享交互候选',()=>{
 for(const [a,ap,b,bp] of [['starsea',0,'waypoint',2],['starsea',0,'board',3],['starsea',0,'portal',1],['portal',1,'waypoint',2],['portal',1,'board',3],['waypoint',2,'board',3]] as const){
  it(`${a} 与 ${b} 重叠`,()=>{const objects=[candidate(b,bp),candidate(a,ap)];const prompt=selectInteraction(hero,objects);const execution=selectInteraction(hero,objects);expect(prompt?.id).toBe(a);expect(execution).toBe(prompt);});
 }
 it('提示边界与执行边界一致，远处高优先级对象不抢交互',()=>{const npc={...candidate('starsea',0),reach:2.8,position:{x:2.81,y:0}},portal={...candidate('portal',1),position:{x:4,y:0}};expect(selectInteraction(hero,[npc,portal])).toBe(portal);expect(selectInteraction({x:-.01,y:0},[portal])).toBeUndefined();});
});
