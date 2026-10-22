import {expect,it} from 'vitest';
import {hexD04Samples} from '../tools/fixtures/hex-d04-samples.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {hexRunes,hexRuneCatalogSchema} from '../packages/content/hex-runes.ts';
import type {EffectRule} from '../packages/contracts/effects.ts';
const qualities=['common','magic','rare','legendary'] as const;
function world(rules:EffectRule[]){
 const w=new World({...regionById('meadow'),obstacles:[],safe:{x:20,y:20}},{hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules},[],[0,1,2].map(i=>({id:'e'+i,name:'controlled',kind:'melee',x:22+i,y:20,hp:1000,attack:0,boss:false,elite:false,art:'raider'})),[],41);w.mode='manual';for(const e of w.enemies)e.cooldown=99999;return w;
}
it('reads the promoted eight quality definitions from the one formal source',()=>{
 expect(hexRuneCatalogSchema.safeParse(hexRunes).success).toBe(true);
 expect(hexD04Samples.map(r=>r.id)).toEqual(['hex-aftershock','hex-detonation-sigil']);
 expect(hexD04Samples[0]).toBe(hexRunes[1]);expect(hexD04Samples[1]).toBe(hexRunes[2]);
 expect(hexD04Samples.flatMap(r=>Object.keys(r.tiers))).toHaveLength(8);
});
it.each(qualities)('A2 %s counts distinct hit releases and executes the declared nova',quality=>{
 const rules=hexD04Samples[0].tiers[quality]!.rules,w=world(rules),r=rules[0],every=r.every!;
 const hit=()=> (w as any).comboHit(w.enemies[0],100,undefined,'physical',false,[]);
 for(let i=0;i<every-1;i++)hit();expect(w.enemies[0].hp).toBe(1000);
 hit();expect(w.effectStats[r.id].count).toBe(1);
 // D13 scales the authored damage paths by 0.5; triggers and geometry stay fixed.
 expect(w.enemies[0].hp).toBe(1000-[30,35,40,53][qualities.indexOf(quality)]);
 if(quality==='rare'||quality==='legendary'){
  expect(w.effectStats[rules[1].id].count).toBe(1);expect(w.zones).toHaveLength(1);
  expect(w.zones[0]).toMatchObject({radius:quality==='legendary'?3.25:2.5,life:60,damage:0});
  w.step();expect(w.statuses.find(s=>s.targetId==='e0'&&s.effect.kind==='slow')?.effect.strength).toBe(.3);
 }else expect(w.zones).toHaveLength(0);
});
it.each(qualities)('S1 %s executes exact DOT budgets and the 180-tick ICD from formal content',quality=>{
 const rules=hexD04Samples[1].tiers[quality]!.rules,w=world(rules),r=rules[0];
 for(const [i,total]of [[0,100],[1,200]])w.applyStatus('e'+i,{kind:'burn',duration:90,interval:30,total,strength:0,damageType:'fire',scope:'hit',cleanse:true},'hero','qa-dot');
 const copy=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,copy]){
  (run as any).fireEffects('hit',run.enemies[0],100);const hp=run.enemies.map(e=>e.hp);
  expect(run.effectStats[r.id].count).toBe(1);expect(1000-hp[0]).toBe([25,30,60,75][qualities.indexOf(quality)]);
  expect(1000-hp[1]).toBe(quality==='legendary'?150:0);expect(hp[2]).toBe(1000);
  expect(run.hasStatus('e0','burn')).toBe(quality==='common'||quality==='magic');
  (run as any).fireEffects('hit',run.enemies[0],100);expect(run.enemies.map(e=>e.hp)).toEqual(hp);
 }
 expect(copy.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
