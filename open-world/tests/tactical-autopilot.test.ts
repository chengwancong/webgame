import {describe,it,expect} from 'vitest';
import {createTacticalEncounter,projectTacticalEncounter,applyTacticalAction} from '../packages/simulation/tactical/encounter.ts';
import {chooseTacticalPlan,executeTacticalPlan} from '../packages/simulation/tactical/autopilot.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';

const create=(heroId:'sword'|'hidden'='sword')=>createTacticalEncounter({battleId:'autopilot-test',boardId:tacticalBoards[0].id,heroId,seed:101});
describe('public tactical autopilot',()=>{
 it('is deterministic, leaves the public input unchanged, and ignores the initial seed',()=>{
  const projection=projectTacticalEncounter(create()),before=structuredClone(projection);
  const a=chooseTacticalPlan(projection),b=chooseTacticalPlan({...projection,seed:987654321});
  expect(a).toEqual(b);expect(projection).toEqual(before);expect(a.legalCombinations).toBeGreaterThan(1);
 });
 it('executes exactly the manual actions with the same seeded results',()=>{
  const state=create(),plan=chooseTacticalPlan(projectTacticalEncounter(state));
  const auto=executeTacticalPlan(state,plan);
  let manual=state;const events=[];
  for(const action of plan.actions){if(manual.outcome)break;const r=applyTacticalAction(manual,action);manual=r.state;events.push(...r.events);}
  expect(auto).toEqual({state:manual,events});
  expect(state.round).toBe(1);expect(state.budget.moveUsed).toBe(false);
 });
 it('support-first prioritizes the exposed shaman over an equally killable melee target',()=>{
  const p=projectTacticalEncounter(create());
  p.board={width:8,height:8,blocked:[]};p.intents=[];p.zones=[];
  const hero=p.units.find(u=>u.side==='hero')!,template=p.units.find(u=>u.side==='enemy')!;
  hero.cell={x:2,y:2};
  p.units=[hero,{...structuredClone(template),id:'a-melee',kind:'melee',cell:{x:3,y:2},hp:10,maxHp:10,eliteAffixes:[]},
   {...structuredClone(template),id:'z-shaman',kind:'shaman',cell:{x:2,y:3},hp:10,maxHp:10,eliteAffixes:[]}];
  p.budget.moveUsed=true;p.orchestration.target='support-first';
  const plan=chooseTacticalPlan(p),attack=plan.actions.find(a=>a.type==='basic'||a.type==='skill');
  expect(attack).toMatchObject({target:{x:2,y:3}});
 });
 it('ends a fully spent decision rather than retrying an illegal skill',()=>{
  const p=projectTacticalEncounter(create());p.budget={moveUsed:true,mainActionUsed:true,ended:false};
  expect(chooseTacticalPlan(p).actions).toEqual([{type:'end'}]);
 });
 it('keeps a committed non-crit hit when its expected kill did not open the planned movement cell',()=>{
  const state=create(),hero=state.units.find(u=>u.side==='hero')!,enemy=state.units.find(u=>u.side==='enemy')!;
  state.board={width:8,height:8,blocked:[]};state.intents=[];state.zones=[];
  hero.cell={x:2,y:2};enemy.cell={x:3,y:2};enemy.hp=10.5;enemy.maxHp=20;
  state.units=[hero,enemy];state.rngState=123; // first LCG roll is not a crit
  const result=executeTacticalPlan(state,{actions:[{type:'basic',target:{x:3,y:2}},{type:'move',to:{x:3,y:2}}]});
  expect(result.events.filter(e=>e.type==='skill'&&e.cause==='cut')).toHaveLength(1);
  expect(result.state.units.find(u=>u.id===enemy.id)?.hp).toBe(0.5);
  expect(result.state.round).toBe(2);
 });
 it('uses basic attack when every non-basic skill is cooling down',()=>{
  const p=projectTacticalEncounter(create()),hero=p.units.find(u=>u.side==='hero')!,enemy=p.units.find(u=>u.side==='enemy')!;
  p.board={width:8,height:8,blocked:[]};p.intents=[];p.zones=[];
  hero.cell={x:2,y:2};hero.cooldowns={whirl:99,ward:99,vortex_blade:99};
  enemy.cell={x:3,y:2};enemy.hp=10;enemy.shield=0;p.units=[hero,enemy];p.budget.moveUsed=true;
  expect(chooseTacticalPlan(p).actions.some(a=>a.type==='basic')).toBe(true);
 });
});
