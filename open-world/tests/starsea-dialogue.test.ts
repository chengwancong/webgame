import {it,expect} from 'vitest';
import {archiveQuestCompletions} from '../apps/api/src/quest-journal.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {starterSkills} from '../packages/content/index.ts';
import {makeGear} from '../packages/rules/index.ts';
import {newStarseaState,applyStarseaOp,recordStarseaKill,starseaView} from '../packages/rules/starsea.ts';
import {starseaCampaign,starseaMap} from '../packages/content/starsea/index.ts';
import {tasks,triggers,dialogueLines,stepsByTask} from '../packages/content/task-tables.ts';
const state=():CharacterState=>{const sword=makeGear(0,crypto.randomUUID());return {id:crypto.randomUUID(),name:'对白',revision:0,build:1,level:3,xp:0,gold:0,material:0,gear:[sword],equipment:{weapon:sword.id},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:['ss-map-port','ss-map-wind'],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;};
const wind='ss-map-wind',port='ss-map-port';
const killAll=(s:CharacterState,region:string,spawns:{id:string}[])=>{for(const m of spawns){const g=recordStarseaKill(s,region,m.id,false);archiveQuestCompletions(s,g.completed,crypto.randomUUID(),new Date().toISOString());}};

it('chapter 1 plays accept, step numbers and multi-line completion from the dialogue table',()=>{
 const s=state();
 expect(s.starsea!.quests['ss-c01-t01']).toBeTruthy();
 expect(starseaView(s)!.step!.seq).toBe(1);
 killAll(s,wind,applyStarseaOp(s,'start',{region:wind}).spawns);
 let c=starseaView(s)!.completion!;expect(c.lines!.map(l=>l.speaker)).toEqual(['领航员·米洛','你','领航员·米洛','领航员·米洛']);
 applyStarseaOp(s,'waypoint',{region:wind,target:'ow-wind-wp2'});applyStarseaOp(s,'talk',{region:wind,task:'ss-c01-n01'});
 applyStarseaOp(s,'talk',{region:port});
 c=starseaView(s)!.completion!;expect(c.lines).toHaveLength(5);expect(c.lines![0].speaker).toBe('');
 const t03=starseaView(s)!;expect(t03.task!.id).toBe('ss-c01-t03');expect(t03.task!.accept.map(l=>l.speaker)).toContain('你');expect(t03.step!.seq).toBe(1);
 const raid=applyStarseaOp(s,'interact',{region:wind,target:'object:engine'});expect(starseaView(s)!.step!.seq).toBe(2);
 killAll(s,wind,raid.spawns);applyStarseaOp(s,'defense-finish',{region:wind,now:Date.now()+10000});
 expect(starseaView(s)!.completion!.lines![0].speaker).toBe('机巧师·铜铃');
 applyStarseaOp(s,'arrive',{region:wind,target:'route-fork',position:starseaMap(wind).landmarks.find(p=>p.id==='route-fork')!});applyStarseaOp(s,'track',{region:wind,task:'ss-c01-t04'});killAll(s,wind,applyStarseaOp(s,'start',{region:wind,choice:'a'}).spawns);
 s.starsea!.done.push('ss-c01-n02');applyStarseaOp(s,'arrive',{region:'ss-map-boss-1',target:'safe'});
 expect(starseaView(s)!.task!.id).toBe('ss-c01-t05');
 recordStarseaKill(s,'ss-map-boss-1','boss',true);
 expect(starseaView(s)!.completion!.title).toBe('击退登港先锋');
 applyStarseaOp(s,'accept',{region:port,task:'ss-c01-t06'});applyStarseaOp(s,'talk',{region:port,task:'ss-c01-t06'});
 c=starseaView(s)!.completion!;const route=starseaCampaign.chapters[0].choice.a.name;
 expect(c.lines!.at(-1)!.text).toContain(route);expect(c.text).toContain(route);expect(c.text).not.toContain('{route}');
});

it('every trigger points at a real step and plays without route context',()=>{
 for(const t of triggers){
  expect(tasks.some(x=>x.id===t.task)).toBe(true);
  expect(dialogueLines(t.group).length).toBeGreaterThan(0);
  if(t.step)expect((stepsByTask.get(t.task)??[]).some(x=>x.seq===t.step)).toBe(true);
 }
 for(const t of tasks.filter(x=>x.accept_mode==='arrive'))expect(dialogueLines(t.dialog_accept!).length).toBeGreaterThan(0);
});
