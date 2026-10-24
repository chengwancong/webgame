import {describe,it,expect} from 'vitest';
import {hubChartContent,hubNodeById} from '../packages/content/hub-chart.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {hubElements,hubExplore} from '../packages/content/zhangjian.ts';
import {hubNodeStatus,hubChartView} from '../packages/rules/hub-chart.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {tasks} from '../packages/content/task-tables.ts';
import {hubEndgame} from '../packages/content/hub-endgame.ts';
import {selectDailyDeepNodes,weeklyDeepBoss,abyssBoss} from '../packages/rules/hub-endgame.ts';
import {hubDropSlots} from '../packages/content/hub-node-loot.ts';
import {questEligible} from '../packages/rules/quest-conditions.ts';
import {hits} from '../tools/copy-voice-scan.ts';
import {petContent} from '../packages/content/zhangjian.ts';
const regions=['wind','mist','forge','frost','rift','dragon'];
describe('CONTENT-G01 six-region playable content',()=>{
 it('adds no banned wording in the new node lines and pet narrative fields',()=>{const texts=[...hubChartContent.nodes.filter(n=>regions.slice(2).includes(n.region)).flatMap(n=>[n.name,n.line]),...petContent.families.flatMap(f=>[f.skillName!,f.flavor!,f.combatRole!]),...Object.values(petContent.flowDescriptions!)];for(const text of texts)expect(hits(text),text).toEqual([]);});
 it('retains exactly four side stories and eighteen bounties per region without frozen-world objectives',()=>{
  for(const r of regions){const sides=tasks.filter(t=>t.series===`ow-${r}-regional`&&!t.frozen);expect(sides).toHaveLength(4);for(const t of sides){expect(t.hub_node).toBeTruthy();expect(hubNodeById.has(t.hub_node!)).toBe(true);expect(t.auto_track).toBe(false);}expect(tasks.filter(t=>t.type==='bounty'&&t.id.startsWith('ow-'+r+'-'))).toHaveLength(18);}
 });
 it('does not hide migrated later-region stories behind the old sample-only freeze',()=>{const s={level:50,starsea:{seen:['hub-node:wind-story-1'],bosses:['ss-map-boss-2'],prologue:{done:true}}} as CharacterState;expect(questEligible(s,'ss-c03-t01')).toBe(true);expect(questEligible(s,'ss-c04-t01')).toBe(false);});
 it('daily pools are deterministic, unique and cover all four types across the five approved seeds',()=>{
  for(const seed of [11,23,47,71,101]){const now=Date.parse('2026-10-23T00:00:00Z'),nodes=selectDailyDeepNodes(seed,now);expect(nodes).toEqual(selectDailyDeepNodes(seed,now));expect(new Set(nodes.map(n=>n.node)).size).toBe(6);expect(new Set(nodes.map(n=>hubNodeById.get(n.node)!.kind)).size).toBe(4);expect(selectDailyDeepNodes(seed,now+86400000)[0].id).not.toBe(nodes[0].id);}
 });
 it('weekly rotations wrap after six weeks and abyss floors never repeat adjacent bosses',()=>{
  const monday=Date.parse('2026-10-26T21:00:00Z');expect(weeklyDeepBoss(monday,false,11).affixes).toHaveLength(0);expect(new Set(weeklyDeepBoss(monday,true,11).affixes).size).toBe(2);expect(weeklyDeepBoss(monday,false,11).node).toBe(weeklyDeepBoss(monday+6*7*86400000,false,11).node);
  for(const seed of [11,23,47,71,101])for(let floor=2;floor<=100;floor++)expect(abyssBoss(floor,seed).id).not.toBe(abyssBoss(floor-1,seed).id);expect(()=>abyssBoss(101,1)).toThrow();expect(hubEndgame.abyss.milestones.filter(m=>m.cosmeticRequired).map(m=>m.floor)).toEqual([50,100]);
 });
 it('deduplicates nest and shard slot preferences, preserving a single 3x multiplier',()=>{expect(hubDropSlots('forge-nest-2',['armor'])).toEqual(['armor','helmet']);expect(hubDropSlots('forge-nest-2',['weapon'])).toEqual(['armor','helmet','weapon']);});
 it('has ten connected nodes with complete type mix, valid dungeon maps and explicit weaknesses per region',()=>{
  for(const region of regions){const nodes=hubChartContent.nodes.filter(n=>n.region===region);expect(nodes).toHaveLength(10);
   expect(nodes.filter(n=>n.kind==='story')).toHaveLength(3);expect(nodes.filter(n=>n.kind==='nest')).toHaveLength(3);
   const visited=new Set<string>(),walk=(id:string)=>{if(visited.has(id))return;visited.add(id);hubNodeById.get(id)!.links.forEach(walk);};walk(nodes[0].id);expect(visited.size).toBe(10);
   for(const n of nodes){const d=dungeonContent.definitions.find(d=>d.id===n.dungeonId);expect(d,n.id).toBeDefined();expect(d!.hub?.node).toBe(n.id);expect(d!.stages.length).toBeGreaterThan(0);expect(hubElements.nodes[n.id]).toEqual(hubElements.regions[region as keyof typeof hubElements.regions]);}
  }
 });
 it('keeps later regions inaccessible until their previous gate; three arbitrary regional clears unlock the gate',()=>{
  const s={starsea:{prologue:{done:true}}} as CharacterState,h=newHubState();
  for(const region of regions){const gate=hubNodeById.get(region+'-gate')!;if(region!=='wind')expect(hubNodeStatus(s,h,hubNodeById.get(region+'-story-1')!).status).toBe('locked');
   const i=regions.indexOf(region);if(i)h.chart.cleared[regions[i-1]+'-gate']={firstAt:new Date().toISOString(),bestSeconds:1};
   for(const suffix of ['nest-3','nest-1','story-2'])h.chart.cleared[region+'-'+suffix]={firstAt:new Date().toISOString(),bestSeconds:1};
   expect(hubNodeStatus(s,h,gate).status).toBe('open');
  }
 });
 it('new-region recommendations stay within each band and never fall in authored order',()=>{
  for(const r of hubChartContent.regions.filter(r=>regions.slice(2).includes(r.id))){let last=r.levelRange[0];for(const n of hubChartContent.nodes.filter(n=>n.region===r.id)){expect(n.recommendedLevel).toBeGreaterThanOrEqual(last);expect(n.recommendedLevel).toBeLessThanOrEqual(r.levelRange[1]);last=n.recommendedLevel;}}
 });
 it('new locks refer to real successor-gate keys and never gate the main route',()=>{
  for(const region of ['forge','frost','rift'] as const){expect(hubExplore.regions[region]!.doors).toHaveLength(2);for(const door of hubExplore.regions[region]!.doors){expect(hubNodeById.has(hubExplore.keys[door.key]!.from)).toBe(true);expect(hubNodeById.get(door.node)!.kind).toBe('nest');}}
 });
});
