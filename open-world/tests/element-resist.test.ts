import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {armorMitigation} from '../packages/rules/combat-numerics.ts';
import {statLabels} from '../packages/contracts/stats.ts';
import type {Stats} from '../packages/contracts/index.ts';

// 2026-10-07 受伤顺序：伤害减免 → 护甲（按原始命中）→ 全抗＋元素抗性（上限 75%，物理／真实不吃）→ 护盾。
const hit=(stats:Partial<Stats>,amount:number,damageType:string)=>{
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:100000,attack:10,armor:0,mana:100,speed:6,regen:0,effects:[],...stats} as Stats,[],[],[],7);
 const before=w.hero.hp;(w as unknown as {hurt:(a:number,s:string,c:object)=>void}).hurt(amount,'basic-melee',{category:'periodic',damageType,scaled:true});return before-w.hero.hp;
};
const armor=(amount:number,value:number)=>armorMitigation(amount,value).damage;

it('registers the six element resistances as capped defense stats',()=>{
 for(const el of ['fire','cold','lightning','arcane','shadow','poison'])expect(statLabels[el+'Resist']).toMatch(/抗性$/);
});
it('armor mitigates the raw hit of every type, then all + element resist applies to elemental damage only',()=>{
 const stats={armor:40,allResist:.1,fireResist:.2};
 expect(hit(stats,200,'fire')).toBe(Math.max(1,Math.round(armor(200,40)*(1-.3))));
 expect(hit(stats,200,'cold')).toBe(Math.max(1,Math.round(armor(200,40)*(1-.1))));
 expect(hit(stats,200,'physical')).toBe(armor(200,40));
});
it('caps combined resistance at 75% and lets damage reduction act first',()=>{
 expect(hit({allResist:.5,poisonResist:.6},400,'poison')).toBe(Math.round(armor(400,0)*.25));
 expect(hit({damageReduction:.2,armor:40,lightningResist:.25},300,'lightning')).toBe(Math.round(armor(240,40)*.75));
});
