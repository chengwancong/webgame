import type {CharacterState} from '../contracts/index.ts';
import {craftConsumables} from '../content/crafting.ts';
/** 旧存档可能记录多个同类合剂；保留计数，但只让剩余次数最多的一项生效。 */
export function activeCraftConsumables(s:Pick<CharacterState,'progression'>){
 const groups=new Map<string,typeof craftConsumables[number]>();
 for(const item of craftConsumables){const remaining=s.progression?.buffs[item.id!]??0,previous=groups.get(item.group!);if(remaining>0&&(!previous||remaining>(s.progression?.buffs[previous.id!]??0)))groups.set(item.group!,item);}
 return [...groups.values()];
}
/** 消耗品效果在结算当前击杀之前读取；结算后才减少剩余击杀数。 */
export function craftBuffValue(s:Pick<CharacterState,'progression'>,stat:string){
 return Math.max(0,...activeCraftConsumables(s).filter(c=>c.stat===stat).map(c=>c.value??0));
}
export function consumeCraftKills(s:Pick<CharacterState,'progression'>,kills:number){
 for(const id of Object.keys(s.progression?.buffs??{}))s.progression!.buffs[id]=Math.max(0,s.progression!.buffs[id]-kills);
}
