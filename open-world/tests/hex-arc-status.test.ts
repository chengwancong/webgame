import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {hexRunes} from '../packages/content/hex-runes.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import type {Stats,Spawn} from '../packages/contracts/index.ts';

function fixture(quality:'common'|'rare'|'legendary',firstHp=1000){
 // Controlled chance=1 tests execution/ICD, not natural drop or proc probability.
 const rule=effectRuleSchema.parse({...structuredClone(hexRunes[0].tiers[quality]!.rules[0]),chance:1});
 const stats:Stats={hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules:[rule]};
 const enemies:Spawn[]=[0,1,2].map(i=>({id:'target-'+i,kind:'melee',name:'target',x:10+i*2,y:10,hp:i===1?firstHp:1000,attack:0,boss:false,elite:false,art:'raider'}));
 const w=new World({...regionById('meadow'),obstacles:[],safe:{x:8,y:10}},stats,[],enemies,[],7);
 w.mode='manual';return {w,rule};
}
function trigger(w:World){(w as any).fireEffects('hit',w.enemies[0],100);}

it.each([['rare','slow',60,.2],['legendary','shock',90,.25]] as const)('applies %s status only to surviving bounced targets',(quality,kind,duration,strength)=>{
 const {w,rule}=fixture(quality);trigger(w);
 expect(w.hasStatus('target-0',kind)).toBe(false);
 for(const id of ['target-1','target-2']){
  expect(w.hasStatus(id,kind)).toBe(true);
  expect(w.statuses.find(s=>s.targetId===id)).toMatchObject({skill:rule.id,effect:{kind,duration,strength}});
 }
 const hp=w.enemies.map(e=>e.hp);trigger(w);expect(w.enemies.map(e=>e.hp)).toEqual(hp);
});
it('does not add a status to a bounce target killed by the arc',()=>{
 const {w}=fixture('rare',1);trigger(w);
 expect(w.enemies[1].alive).toBe(false);expect(w.hasStatus('target-1','slow')).toBe(false);
 expect(w.hasStatus('target-2','slow')).toBe(true);
});
it('does not add a status when zero derived damage does not land',()=>{
 const {w}=fixture('rare');(w as any).fireEffects('hit',w.enemies[0],0);
 expect(w.enemies[1].hp).toBe(1000);expect(w.hasStatus('target-1','slow')).toBe(false);
 expect(w.hasStatus('target-2','slow')).toBe(false);
});
it('retains the old arc damage/decay and creates no statuses when the optional field is absent',()=>{
 const {w}=fixture('common');trigger(w);
 expect(w.enemies.map(e=>e.hp)).toEqual([1000,950,965]);expect(w.statuses).toEqual([]);
});
it('preserves applied statuses, cooldowns and subsequent deterministic state across checkpoint restore',()=>{
 const {w}=fixture('rare');trigger(w);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 expect(restored.statuses).toEqual(w.statuses);
 for(let i=0;i<65;i++){w.step();restored.step();}
 trigger(w);trigger(restored);
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
