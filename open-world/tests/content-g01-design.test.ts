import {it,expect} from 'vitest';
import plan from '../docs/hub-portal-rework-20261021/handoff/content-design-r1.json';
import {petContent} from '../packages/content/zhangjian.ts';
import {hexRuneById} from '../packages/content/hex-runes.ts';
import {hubNodeById} from '../packages/content/hub-chart.ts';
import {petDesignPrototype} from '../tools/content-g01-pet-prototypes.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import type {Stats} from '../packages/contracts/index.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {regionExplore} from '../packages/rules/zhangjian.ts';
import {hubChartContent} from '../packages/content/hub-chart.ts';
function simulate(family:'wind-free'|'wind-light'|'wind-heavy',count:number){
 const stats:Stats={hp:1000,attack:100,armor:0,speed:1,mana:100,regen:0,effects:[],rules:[petDesignPrototype(family)]};
 const enemies=Array.from({length:count},(_,i)=>({id:'design-target-'+i,name:'设计验证目标',kind:'melee' as const,x:12+i,y:10,hp:100000,attack:0,boss:false,elite:false,art:'raider'}));
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},stats,[],enemies,[],11);w.mode='manual';w.targetId='design-target-0';for(const e of w.enemies)e.cooldown=999999;
 let shieldPeak=0;for(let tick=0;tick<240;tick++){w.step();shieldPeak=Math.max(shieldPeak,w.hero.shield??0);}
 return {damage:w.enemies.map(e=>100000-e.hp),shieldPeak};
}
it('defines all 18 existing families and nine flows without adding paid or unknown IDs',()=>{expect(new Set(plan.pets.map(p=>p.id))).toEqual(new Set(petContent.families.map(p=>p.id)));expect(new Set(plan.flows.map(f=>f.id))).toEqual(new Set(Object.keys(petContent.flows)));for(const p of plan.pets){expect(p.behavior.length).toBeGreaterThan(15);expect(p.cost.length).toBeGreaterThan(10);}});
it('four builds reference actual HEX and nodes, with an explicit downside and automatic-mode behavior',()=>{for(const b of plan.builds){for(const id of b.hex)expect(hexRuneById.has(id),id).toBe(true);for(const id of [...b.farmNodes,...b.testNodes])expect(hubNodeById.has(id),id).toBe(true);expect(b.switchWhen.length).toBeGreaterThan(10);expect(b.automatic.length).toBeGreaterThan(10);}});
it('dragon exploration requires both authored doors and reaches 100% without an invented seventh gate',()=>{const h=newHubState();const nodes=hubChartContent.nodes.filter(n=>n.region==='dragon');for(const n of nodes)h.chart.cleared[n.id]={firstAt:'2026-10-23T00:00:00Z',bestSeconds:1};h.explore={caches:nodes.filter(n=>n.kind!=='gate').map(n=>'cache:'+n.id),doors:[],keys:['mist','rift']};expect(regionExplore(h,'dragon')).toMatchObject({score:19,total:23});h.explore.doors=['dragon-door-1','dragon-door-2'];expect(regionExplore(h,'dragon')).toMatchObject({score:23,total:23,percent:100});});
it('rapid prototype spends damage on exactly one enemy instead of an area',()=>{const r=simulate('wind-free',3);expect(r.damage[0]).toBeGreaterThan(0);expect(r.damage.slice(1)).toEqual([0,0]);expect(r.shieldPeak).toBe(0);});
it('protection prototype grants real shields and trades away all direct pet damage',()=>{const r=simulate('wind-light',3);expect(r.damage).toEqual([0,0,0]);expect(r.shieldPeak).toBeGreaterThan(0);});
it('chain prototype hits three distinct enemies and cannot recover missing jumps on one enemy',()=>{const group=simulate('wind-heavy',3),single=simulate('wind-heavy',1);expect(group.damage.every(n=>n>0)).toBe(true);expect(single.damage[0]).toBe(group.damage[0]);expect(group.damage.reduce((a,b)=>a+b,0)).toBeGreaterThan(single.damage[0]);});
