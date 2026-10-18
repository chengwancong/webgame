import type {Gear,Receipt} from '../../../packages/contracts/index.ts';

/** Private, versioned accumulation inside a permit. Updated in the reward transaction. */
export type BattleRecord={version:1;complete:boolean;gold:number;xp:number;material:number;materials:Record<string,number>;books:Record<string,number>;gear:Gear[];firstClear:boolean;unlocked:string[]};
export function newBattleRecord(complete=true):BattleRecord{return {version:1,complete,gold:0,xp:0,material:0,materials:{},books:{},gear:[],firstClear:false,unlocked:[]};}
export function accumulateBattle(record:BattleRecord,delta:Receipt['delta']){
 record.gold+=delta.gold;record.xp+=delta.xp;record.material+=delta.material;
 for(const [id,n] of Object.entries(delta.progression?.materials??{}))record.materials[id]=(record.materials[id]??0)+n;
 for(const [id,n] of Object.entries(delta.books??{}))record.books[id]=(record.books[id]??0)+n;
}
