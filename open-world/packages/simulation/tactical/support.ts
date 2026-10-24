/** An off-grid pet has no unit or independent turn. These guards are not an effect implementation. */
export type TacticalSupportLedger={ownerTurnId:string;roots:Record<string,string[]>;counts:Record<string,number>};
export const freshSupportLedger=(ownerTurnId:string):TacticalSupportLedger=>({ownerTurnId,roots:{},counts:{}});
export type TacticalSupportTrigger={ownerTurnId:string;rootActionId:string;effectGroup:string;origin:'hero'|'enemy'|'status'|'pet-support';conditionMet:boolean};
export function claimTacticalSupport(ledger:TacticalSupportLedger,trigger:TacticalSupportTrigger,perOwnerTurnLimit:number):{claimed:boolean;reason?:'turn'|'condition'|'recursive'|'duplicate'|'limit';ledger:TacticalSupportLedger}{
 if(!Number.isSafeInteger(perOwnerTurnLimit)||perOwnerTurnLimit<1)throw Error('Invalid support limit');
 if(!trigger.rootActionId||!trigger.effectGroup)throw Error('Missing support identity');
 if(trigger.ownerTurnId!==ledger.ownerTurnId)return {claimed:false,reason:'turn',ledger};
 if(!trigger.conditionMet)return {claimed:false,reason:'condition',ledger};
 if(trigger.origin==='pet-support')return {claimed:false,reason:'recursive',ledger};
 const roots=Object.hasOwn(ledger.roots,trigger.effectGroup)?ledger.roots[trigger.effectGroup]:[];
 if(roots.includes(trigger.rootActionId))return {claimed:false,reason:'duplicate',ledger};
 const count=Object.hasOwn(ledger.counts,trigger.effectGroup)?ledger.counts[trigger.effectGroup]:0;
 if(count>=perOwnerTurnLimit)return {claimed:false,reason:'limit',ledger};
 return {claimed:true,ledger:{ownerTurnId:ledger.ownerTurnId,roots:{...ledger.roots,[trigger.effectGroup]:[...roots,trigger.rootActionId]},counts:{...ledger.counts,[trigger.effectGroup]:count+1}}};
}
