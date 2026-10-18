// numeric-spine S7：同步最终整数投影；比例/速度专用夹具避开最小生命和防作弊固定下限。
import {it,expect} from 'vitest';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {campMembers,campSpawns} from '../packages/rules/world-camps.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import '../packages/content/open-world/index.ts';
import {World} from '../packages/simulation/index.ts';
import {overlevelXpMultiplier,starseaKillReward} from '../apps/api/src/economy.ts';
import {newStarseaState,applyStarseaOp,recordFieldFact,type FieldFact} from '../packages/rules/starsea.ts';
import {conditionGroups} from '../packages/rules/quest-conditions.ts';
import {worldPhaseVisible,visibleWorldRows} from '../packages/rules/world-phase.ts';
import {tasks,stepsByTask} from '../packages/content/task-tables.ts';
import {starseaIslands,starseaMap} from '../packages/content/starsea/index.ts';
import type {CharacterState,Stats} from '../packages/contracts/index.ts';
const player=(level=1):CharacterState=>({id:crypto.randomUUID(),name:'世界事实',revision:0,build:1,level,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:starseaIslands[0],tasks:[]},starsea:newStarseaState()});
const stats:Stats={hp:1e6,attack:1,armor:1000,speed:6,mana:100,regen:0,effects:[]};
it('resolves rare from the declared rank factors before integer projection and keeps it frozen across restore',()=>{
 const template=monsterContent.templates.find(t=>t.kind==='melee')!,p={id:'rare-proof',template:template.id,level:template.referenceLevel,x:30,y:20},normal=resolveMonsterSpawn({...p,rank:'normal'}),rare=resolveMonsterSpawn({...p,rank:'rare'});
 expect(rare.monster!.baseStats.hp).toBeCloseTo(normal.monster!.baseStats.hp*8);expect(rare.monster!.baseStats.attack).toBeCloseTo(normal.monster!.baseStats.attack*8);expect(rare.hp).toBe(Math.max(1,Math.round(rare.monster!.baseStats.hp)));expect(rare.attack).toBe(Math.round(rare.monster!.baseStats.attack));expect(rare.monster?.rank).toBe('rare');expect(rare.elite).toBe(true);expect(rare.boss).toBe(false);
 const r:Region={...regionById('meadow'),width:60,height:60,safe:{x:20,y:20},obstacles:[],spawns:[],aggroRadius:8},w=new World(r,stats,[],[rare],[],41);w.mode='manual';for(let i=0;i<20;i++)w.step();const c=w.exportCheckpoint(),restored=World.restore(c);expect(restored.exportCheckpoint()).toEqual(c);
});
it('role parameters alter real AI engagement rather than only a label',()=>{
 const c=structuredClone(monsterContent),t=c.templates.find(t=>t.kind==='melee')!,p={id:'role-proof',template:t.id,level:t.referenceLevel,rank:'normal' as const,x:30,y:20},normal=resolveMonsterSpawn(p,c);t.role='swarm';c.roles.swarm.speed=1.4;const swarm=resolveMonsterSpawn(p,c);
 expect(swarm.monster!.ai.speed).toBeCloseTo(normal.monster!.ai.speed*1.4);expect(swarm.monster!.ai.aggroRadius).toBe(12);
 const r:Region={...regionById('meadow'),width:60,height:60,safe:{x:20,y:20},obstacles:[],spawns:[],aggroRadius:8};
 const a=new World(r,stats,[],[normal],[],41),b=new World(r,stats,[],[swarm],[],41);a.mode=b.mode='manual';for(let i=0;i<60;i++){a.step();b.step();}expect(a.enemies[0].position.x).toBe(30);expect(b.enemies[0].position.x).toBeLessThan(30);expect(b.enemies[0].engaged).toBe(true);
});
it('population ratios and exact health budget change actual camp members; tier is applied once',()=>{
 const originalLength=monsterContent.templates.length,base=monsterContent.templates.find(t=>t.kind==='melee')!,ranged=monsterContent.templates.find(t=>t.role==='ranged')!;
 const swarm={...structuredClone(base),id:'budget-swarm-proof',role:'swarm' as const};monsterContent.templates.push(swarm);
 try{const camp=structuredClone(worldTables.camps[0]);camp.pack=[{template:base.id,rank:'normal',count:1},{template:swarm.id,rank:'normal',count:1},{template:ranged.id,rank:'normal',count:1}];camp.budget={count:10,health:1000,roles:{normal:4,swarm:4,ranged:2}};
 const r=regionById(camp.region),members=campMembers(camp);expect(members).toHaveLength(10);expect(members.filter(m=>m.template===swarm.id)).toHaveLength(4);
 const one=campSpawns(r,worldTables,camp,1),tier=campSpawns(r,worldTables,camp,1,{hp:1.6,attack:1.25,armor:1});expect(one.reduce((n,m)=>n+m.hp,0)).toBe(1000);expect(tier.reduce((n,m)=>n+m.hp,0)).toBe(1600);
 camp.budget.count=13;camp.budget.roles={normal:1,swarm:10,ranged:2};expect(campMembers(camp)).toHaveLength(13);expect(campMembers(camp).filter(m=>m.template===swarm.id)).toHaveLength(10);
 }finally{monsterContent.templates.splice(originalLength);}
});
it('a changed condition affects the same character; different characters keep independent phases on reconnect',()=>{
 const target='phase-test',before=conditionGroups.get(target),row={_row:1,target,group:1,kind:'level' as const,value:'3',path:'fallback' as const};conditionGroups.set(target,new Map([[1,[row]]]));
 try{const a=player(4),b=player(6),objects=[{id:'new-outpost',when:target},{id:'old-camp',until:target}];expect(visibleWorldRows(a,objects).map(r=>r.id)).toEqual(['new-outpost']);row.value='5';expect(visibleWorldRows(a,objects).map(r=>r.id)).toEqual(['old-camp']);expect(visibleWorldRows(b,objects).map(r=>r.id)).toEqual(['new-outpost']);expect(worldPhaseVisible(JSON.parse(JSON.stringify(a)),objects[0])).toBe(false);expect(worldPhaseVisible(JSON.parse(JSON.stringify(b)),objects[0])).toBe(true);
 }finally{if(before)conditionGroups.set(target,before);else conditionGroups.delete(target);}
});
for(const op of ['open_chest','complete_event','kill_rare','clear_dungeon'] as FieldFact[])it(op+' accepts an earlier authoritative fact and rejects manual interaction as completion',()=>{
 const task=tasks.find(t=>t.campaign==='starsea'&&t.type==='side'&&stepsByTask.get(t.id)?.[0].map)!,original=structuredClone(task),rows=stepsByTask.get(task.id)!,conditions=conditionGroups.get(task.id),map=rows[0].map!,landmark=starseaMap(map).landmarks[0].id;
 task.accept_mode='talk';conditionGroups.set(task.id,new Map([[1,[{_row:1,target:task.id,group:1,kind:'level',value:'1',path:'fallback'}]]]));stepsByTask.set(task.id,[{...rows[0],op,seq:1,key:'fact-proof',landmark,point_count:1,point_index:0}]);
 try{const s=player(20);s.starsea!.islands=[...starseaIslands];const recorded=recordFieldFact(s,op,'fact-proof');expect(recorded.completed).toEqual([]);expect(s.starsea!.fieldFacts?.[op]).toEqual(['fact-proof']);const received=applyStarseaOp(s,'accept',{region:task.accept_map??map,task:task.id});expect(received.gain.completed.map(t=>t.id)).toContain(task.id);expect(recordFieldFact(s,op,'fact-proof').completed).toEqual([]);
 const waiting=player(20);waiting.starsea!.islands=[...starseaIslands];waiting.starsea!.quests[task.id]={step:0,attempt:0,acceptedAt:0};expect(()=>applyStarseaOp(waiting,'interact',{region:map,task:task.id,target:'fact-proof'})).toThrow('请先完成对应');expect(waiting.starsea!.done).not.toContain(task.id);
 }finally{Object.assign(task,original);stepsByTask.set(task.id,rows);if(conditions)conditionGroups.set(task.id,conditions);else conditionGroups.delete(task.id);}
});
it('experience tolerates two levels, decays smoothly and keeps a 25% floor; gold and materials are unchanged',()=>{
 expect(overlevelXpMultiplier(10,10)).toBe(1);expect(overlevelXpMultiplier(12,10)).toBe(1);expect(overlevelXpMultiplier(13,10)).toBeCloseTo(.85);expect(overlevelXpMultiplier(17,10)).toBe(.25);expect(overlevelXpMultiplier(60,1)).toBe(.25);
 const a=starseaKillReward(10,'normal',10),b=starseaKillReward(10,'normal',15);expect(b.xp).toBe(Math.round(a.xp*.55));expect(b.gold).toBe(a.gold);expect(b.material).toBe(a.material);
});
it('version-1 frozen catalogues restore original actors and timelines without taking live roles or curves',()=>{
 const template=monsterContent.templates.find(t=>t.kind==='melee')!,spawn=resolveMonsterSpawn({id:'legacy-proof',template:template.id,level:template.referenceLevel,rank:'normal',x:30,y:20}),r:Region={...regionById('meadow'),width:60,height:60,safe:{x:20,y:20},obstacles:[],spawns:[]},w=new World(r,stats,[],[spawn],[],41);w.mode='manual';for(let i=0;i<15;i++)w.step();const legacy=w.exportCheckpoint() as any;delete legacy.data.rules.monsters.roles;delete legacy.data.rules.monsters.ranks.rare;for(const t of legacy.data.rules.monsters.templates)delete t.role;for(const e of legacy.data.enemies)delete e.monster?.role;const actors=structuredClone(legacy.data.enemies),hero=structuredClone(legacy.data.hero),restored=World.restore(legacy).exportCheckpoint() as any;expect(restored.data.enemies).toEqual(actors);expect(restored.data.hero).toEqual(hero);expect(restored.data.tick).toBe(legacy.data.tick);expect(restored.data.projectiles).toEqual(legacy.data.projectiles);expect(restored.data.pending).toEqual(legacy.data.pending);
});
