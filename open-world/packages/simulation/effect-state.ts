import type {Condition} from '../contracts/conditions.ts';
import type {EffectAction,ExecutableRule} from '../contracts/effects.ts';
export type BuffAction=Extract<EffectAction,{type:'buff'}>;
export type SelfBuff={when?:Condition[];id:string;source:string;starts:number;ends:number;baseEnds:number;stacks:number;action:BuffAction;requiresShield?:boolean;aura?:{status:import('../contracts/skill-mechanics.ts').StatusKind;radius:number;strength:number};targetId?:string};
export function putBuff(list:SelfBuff[],rule:ExecutableRule,action:BuffAction,tick:number,targetId?:string){
 const prior=list.find(b=>b.id===rule.id&&b.ends>tick),reset=action.resetOnTarget&&prior?.targetId!==targetId;
 const next:SelfBuff={id:rule.id,source:rule.source,starts:prior&&!reset?prior.starts:tick,ends:tick+action.duration,baseEnds:tick+action.duration,stacks:Math.min(action.maxStacks,prior&&!reset?prior.stacks+1:1),action:structuredClone(action),...(action.targetScoped?{targetId}:{})};
 return [...list.filter(b=>b.id!==rule.id&&b.ends>tick),next];
}
export const activeBuffs=(list:SelfBuff[],tick:number,targetId?:string)=>list.filter(b=>b.ends>tick&&(!b.action.targetScoped||b.targetId===targetId));
export const buffAmount=(buffs:SelfBuff[],stat:string)=>buffs.reduce((n,b)=>n+(b.action.mods[stat]??0)*b.stacks,0);
