import type {CombatEvent,World} from '../../../packages/simulation/index.ts';
import {newCombatReview,observeCombatReview,resolveCombatReview,type CombatReviewRecord} from '../../../packages/simulation/combat-review.ts';
import {selectCombatAdvice} from '../../../packages/rules/combat-advice.ts';
import type {DungeonDiagnostic} from '../../../packages/contracts/dungeons.ts';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {gapDiagnosis} from '../../../packages/rules/gap-diagnosis.ts';
/** 把缺口诊断的一行话放在建议最前面（docs/progression-goal-plan.md G4）。 */
export function withGapDiagnosis(s:CharacterState,d:DungeonDiagnostic):DungeonDiagnostic{const line=gapDiagnosis(s,{damageType:d.fatal?.damageType,outputShort:d.requiredDps!==null&&d.dpsGap!==null&&d.dpsGap>d.requiredDps*.15});return line?{...d,suggestions:[line,...d.suggestions]}:d;}
export type DungeonMeasurement={stage:number;ticks:number;bossTicks?:number;lastTick?:number;review?:CombatReviewRecord;bossMaxHp:number;bossRemainingHp:number;bossDamage:number;taken:Record<string,number>;healed:Record<string,number>};
export function newDungeonMeasurement(stage:number):DungeonMeasurement{return {stage,ticks:0,bossTicks:0,lastTick:-1,review:newCombatReview('server'),bossMaxHp:0,bossRemainingHp:0,bossDamage:0,taken:{},healed:{}};}
/** Consume every actual executed tick, including the front rooms, once. */
export function observeDungeonTick(m:DungeonMeasurement,w:World,events:readonly CombatEvent[]=w.events){
 if(m.lastTick!==undefined&&w.tick<=m.lastTick)return;m.lastTick=w.tick;m.bossTicks??=m.ticks;m.ticks++;m.review??=newCombatReview('server');observeCombatReview(m.review,w,events);
 const bosses=w.enemies.filter(e=>e.boss&&e.reward),ids=new Set(bosses.map(e=>e.id));if(bosses.length){m.bossTicks++;m.bossMaxHp=bosses.reduce((n,e)=>n+e.maxHp,0);m.bossRemainingHp=bosses.reduce((n,e)=>n+e.hp,0);}
 for(const e of events){if(e.type==='hit_resolved'){if(ids.has(e.id))m.bossDamage+=e.amount??0;if(w.players.has(e.id)||e.id===w.playerId)m.taken[e.id]=(m.taken[e.id]??0)+(e.amount??0);}if(e.type==='healed'&&(w.players.has(e.id)||e.id===w.playerId))m.healed[e.id]=(m.healed[e.id]??0)+(e.amount??0);}
}
export function dungeonDiagnostic(m:DungeonMeasurement,character:string,hp:number,tickRate:number,targetSeconds:number,key:DungeonDiagnostic['key']=null,defeated=true):DungeonDiagnostic{
 const seconds=m.ticks/tickRate,bossSeconds=(m.bossTicks??m.ticks)/tickRate,measured=bossSeconds>0?m.bossDamage/bossSeconds:null,required=m.bossMaxHp>0?m.bossMaxHp/targetSeconds:null,taken=seconds>0?(m.taken[character]??0)/seconds:0,healing=seconds>0?(m.healed[character]??0)/seconds:0,net=Math.max(0,taken-healing),gap=required!==null&&measured!==null?Math.max(0,required-measured):null;
 const survival=net>0?hp/net:null,hpGap=m.bossMaxHp>0?Math.max(0,net*targetSeconds-hp):null;
 // These numbers pick the advice only; the settlement page never shows them.
 const outputShort=required!==null&&gap!==null&&gap>required*.15,review=resolveCombatReview(m.review,character,outputShort),suggestions:string[]=[];
 if(m.bossMaxHp===0)suggestions.push(defeated?'还没见到首领，就倒下了':'先清掉沿路敌人，再挑战首领');
 else if(gap!==null&&gap>0)suggestions.push('你很难打动它，先提升输出');
 else if(hpGap!==null&&hpGap>0)suggestions.push('你扛不住它的连击，先提升生存');
 if(key&&!key.obtained)suggestions.push(key.materials>=key.required?'碎片已经够了，回港口锻造台做钥匙':'碎片还差 '+(key.required-key.materials)+' 个');
 if(!suggestions.length)suggestions.push('再试一次，注意躲开地上的预警');
 // `fatal` and `advice` are what the page shows; everything else only chose them.
 return {defeated,fatal:defeated?review.fatal:null,bossRemainingPercent:m.bossMaxHp>0?100*m.bossRemainingHp/m.bossMaxHp:null,measuredDps:measured,requiredDps:required,dpsGap:gap,survivalSeconds:survival,hpGap,targetSeconds,key,advice:defeated?review.advice:selectCombatAdvice('output'),suggestions,measurement:{seconds,bossDamage:m.bossDamage,damageTaken:m.taken[character]??0,healing:m.healed[character]??0},note:''};
}
