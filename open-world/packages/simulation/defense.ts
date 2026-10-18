import type {Vec} from '../contracts/index.ts';
export type DefenseTarget={position:Vec;hp:number;maxHp:number;radius:number;requiredTicks:number;heldTicks:number;enemyIds:string[];failed:boolean;complete:boolean;/** 失败原因是角色倒下（而非引擎被毁）。 */downed?:boolean};
