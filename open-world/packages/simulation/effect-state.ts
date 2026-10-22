import type {Condition} from '../contracts/conditions.ts';
import type {EffectAction,ExecutableRule} from '../contracts/effects.ts';
import {z} from 'zod';
export const effectMarksSchema=z.array(z.object({source:z.string(),ruleId:z.string(),key:z.string().min(1),targetId:z.string(),ends:z.number().int().nonnegative()}).strict()).max(4096);
export type EffectMark=z.infer<typeof effectMarksSchema>[number];
export type HexRecoveryEvent={tick:number;amount:number};
export type HexManaEvent=HexRecoveryEvent&{kind:'spent'|'refund'};
const recoveryWindow=z.array(z.object({tick:z.number().int().nonnegative(),amount:z.number().finite().nonnegative()}).strict()).max(2048);
const manaWindow=z.array(z.object({tick:z.number().int().nonnegative(),amount:z.number().finite().nonnegative(),kind:z.enum(['spent','refund'])}).strict()).max(2048);
export function validateHexBudgets(recovery:unknown,mana:unknown,tick:number){
 for(const rows of [recovery===undefined?[]:recoveryWindow.parse(recovery),mana===undefined?[]:manaWindow.parse(mana)])if(rows.some((e,i)=>e.tick>tick||i>0&&e.tick<rows[i-1].tick))throw Error('Invalid HEX budget clock');
}
export type BuffAction=Extract<EffectAction,{type:'buff'}>;
export type SelfBuff={hexMechanism?:string;when?:Condition[];id:string;source:string;starts:number;ends:number;baseEnds:number;stacks:number;action:BuffAction;requiresShield?:boolean;aura?:{status:import('../contracts/skill-mechanics.ts').StatusKind;radius:number;strength:number};targetId?:string};
export function putBuff(list:SelfBuff[],rule:ExecutableRule,action:BuffAction,tick:number,targetId?:string){
 const prior=list.find(b=>b.id===rule.id&&b.ends>tick),reset=action.resetOnTarget&&prior?.targetId!==targetId;
 const next:SelfBuff={id:rule.id,source:rule.source,...(rule.rule.hexMechanism?{hexMechanism:rule.rule.hexMechanism}:{}),starts:prior&&!reset?prior.starts:tick,ends:action.untilCombatEnd?Number.MAX_SAFE_INTEGER:tick+action.duration,baseEnds:action.untilCombatEnd?Number.MAX_SAFE_INTEGER:tick+action.duration,stacks:Math.min(action.maxStacks,prior&&!reset?prior.stacks+1:1),action:structuredClone(action),...(action.targetScoped?{targetId}:{})};
 return [...list.filter(b=>b.id!==rule.id&&b.ends>tick),next];
}
export const activeBuffs=(list:SelfBuff[],tick:number,targetId?:string)=>list.filter(b=>b.ends>tick&&(!b.action.targetScoped||b.targetId===targetId));
export const buffAmount=(buffs:SelfBuff[],stat:string)=>buffs.reduce((n,b)=>n+(b.action.mods[stat]??0)*b.stacks,0);
/** Preserve existing arithmetic below the cap. Only the multiplier attributable
 * to HEX is bounded; ordinary buffs and conditions keep their existing owner. */
export function hexDamageScale(buffs:SelfBuff[],conditional:number,priorHex=1,cap=Infinity,casting=false){
 const ordinary=buffs.filter(b=>!b.hexMechanism),a=buffAmount(buffs,'damageAdd'),m=buffAmount(buffs,'damageMult'),oa=buffAmount(ordinary,'damageAdd'),om=buffAmount(ordinary,'damageMult');
 const full=casting?1+a+m:conditional||a+m?(1+conditional+a)*(1+m):1;
 const base=casting?1+oa+om:conditional||oa+om?(1+conditional+oa)*(1+om):1;
 if(base<=0)return {multiplier:full,hexFactor:priorHex};
 const desired=priorHex*full/base;if(desired<=1+cap)return {multiplier:full,hexFactor:desired};
 const hexFactor=Math.min(1+cap,desired);
 return {multiplier:priorHex>0?base*hexFactor/priorHex:full,hexFactor};
}
