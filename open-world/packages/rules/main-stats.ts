import {gearWeaponType} from './weapon-skills.ts';
import {randomInt} from 'node:crypto';
import type {Gear} from '../contracts/index.ts';
import {gearAffixConfig,type AffixRandom} from './affix-generator.ts';
import {stageForItemLevel,gearMaxRank} from './item-power.ts';
import {combatNumerics} from './combat-numerics.ts';
/** Issuance only: never invoked by reads, migrations or rerolls. */
export function assignMainStat(g:Gear,ilvl:number,random:AffixRandom={int:randomInt,float:()=>Math.random()},config=gearAffixConfig){
 if(g.attributeVersion===2)return g;
 if(gearWeaponType(g)==='bow'&&!g.setId){g.setId=['set-hidden-omega','set-sword-omega','set-sword-primal'][random.int(0,3)];g.setName=({'set-hidden-omega':'千刃','set-sword-omega':'剑势','set-sword-primal':'决斗'} as Record<string,string>)[g.setId];}
 const pool=config.mainStats.filter(r=>r.slot===g.slot);g.attributeVersion=2;if(!pool.length)return g;
 const total=pool.reduce((n,r)=>n+r.weight,0);let roll=random.int(0,total),chosen=pool.at(-1)!;
 for(const row of pool){roll-=row.weight;if(roll<0){chosen=row;break;}}
 const stage=stageForItemLevel(ilvl).tier,value=Math.round((chosen.t1+(chosen.t8-chosen.t1)*(stage-1)/7)*1e6)/1e6;
 g.mainStat={stat:chosen.stat,value};g.attack=0;g.armor=0;return g;
}
export function mainStatContribution(g:Gear){
 if(!g.mainStat)return;
 if(g.rank>gearMaxRank(g,5))throw Error('Invalid main-stat reinforcement rank');
 const enhancement=Math.round(g.mainStat.value*combatNumerics.reinforcement.primaryRatioPerRank*g.rank*1e6)/1e6;
 return {stat:g.mainStat.stat,base:g.mainStat.value,enhancement,effective:Math.round((g.mainStat.value+enhancement)*1e6)/1e6};
}
