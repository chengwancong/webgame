import {augmentCommandIdSchema,augmentPolicySchema,augmentRunSchema,type AugmentPolicy,type AugmentRun,type AugmentOption,type AugmentContext} from '../contracts/run-augments.ts';
export type {AugmentPolicy,AugmentRun,AugmentOption,AugmentContext} from '../contracts/run-augments.ts';
function rng(seed:number){let value=seed>>>0||1;return {float(){value^=value<<13;value^=value>>>17;value^=value<<5;value>>>=0;return value/4294967296;},int(n:number){if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid random bound');return Math.floor(this.float()*n);},get seed(){return value;}};}
function validateCatalog(catalog:AugmentOption[]){if(new Set(catalog.map(a=>a.id)).size!==catalog.length)throw Error('Duplicate augment identifier');for(const a of catalog)if(!a.id||!['silver','gold','prismatic'].includes(a.tier)||!a.tags.length||a.requires&&(!a.requires.setId||!Number.isInteger(a.requires.pieces)||a.requires.pieces<1))throw Error('Invalid augment definition');}
export function newAugmentRun(seed:number,input:AugmentPolicy):AugmentRun{const policy=augmentPolicySchema.parse(input);if(!Number.isSafeInteger(seed))throw Error('Invalid augment seed');return {offered:[],chosen:[],rerollsLeft:policy.rerolls,round:0,offerVersion:0,privateSeed:seed>>>0||1,commands:{}};}
/** The owner persists the returned private state in the same command transaction. */
export function offerAugments(input:AugmentRun,config:AugmentPolicy,catalog:AugmentOption[],ctx:AugmentContext,reroll=false):AugmentRun{
 const run=augmentRunSchema.parse(input),policy=augmentPolicySchema.parse(config);validateCatalog(catalog);
 if(!policy.enabled)throw Error('Augments disabled');if(!reroll&&run.round>=policy.rounds.length)throw Error('All augment rounds offered');if(!reroll&&run.offered.length)throw Error('An offer is already pending');if(reroll&&(!run.offered.length||run.round<1))throw Error('No current offer');
 const result=structuredClone(run),random=rng(run.privateSeed),round=reroll?run.round-1:run.round,odds=policy.rounds[round];if(!odds?.length)throw Error('Augment tier table missing');
 let tier=odds[0].tier;
 if(reroll){const old=catalog.find(a=>a.id===run.offered[0]);if(!old||!run.offered.every(id=>catalog.find(a=>a.id===id)?.tier===old.tier))throw Error('Previous offer definitions changed');tier=old.tier;}
 else {let roll=random.float()*odds.reduce((sum,a)=>sum+a.weight,0);for(const row of odds){roll-=row.weight;if(roll<0){tier=row.tier;break;}}}
 const eligible=catalog.filter(a=>a.tier===tier&&!run.chosen.includes(a.id)&&(!a.requires||(ctx.sets[a.requires.setId]??0)>=a.requires.pieces)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 let pool=reroll?eligible.filter(a=>!run.offered.includes(a.id)):eligible;if(pool.length<policy.choices)pool=eligible;if(pool.length<policy.choices)throw Error('Not enough eligible augment options');
 const applicable=(list:AugmentOption[])=>{const matching=list.filter(a=>a.tags.some(tag=>ctx.tags.includes(tag)));return matching.length?matching:list.filter(a=>a.tags.includes('all'));};
 let preferred=applicable(pool);
 // Retain one already revealed applicable card only when every fresh card is
 // incompatible. The other two still come from the new pool. This preserves
 // the required usable choice instead of consuming a reroll on an invalid offer.
 if(!preferred.length&&reroll)preferred=applicable(eligible);
 if(!preferred.length)throw Error('No option can match this build');
 const first=preferred[random.int(preferred.length)],offers=[first.id];pool=pool.filter(a=>a.id!==first.id);
 while(offers.length<policy.choices){const index=random.int(pool.length);offers.push(pool[index].id);pool.splice(index,1);}
 for(let i=offers.length-1;i>0;i--){const j=random.int(i+1);[offers[i],offers[j]]=[offers[j],offers[i]];}
 result.offered=offers;result.privateSeed=random.seed;result.offerVersion++;if(!reroll)result.round++;return result;
}
function replay(run:AugmentRun,id:string,payload:AugmentRun['commands'][string]){augmentCommandIdSchema.parse(id);const previous=run.commands[id];if(!previous)return false;if(previous.op!==payload.op||previous.choice!==payload.choice||previous.offerVersion!==payload.offerVersion)throw Error('Command ID reused with different payload');return true;}
export function chooseAugment(input:AugmentRun,commandId:string,choice:string,version:number):AugmentRun{
 const run=augmentRunSchema.parse(input),payload={op:'choose' as const,choice,offerVersion:version};if(replay(run,commandId,payload))return structuredClone(run);
 if(version!==run.offerVersion)throw Error('Offer has changed');if(!run.offered.includes(choice))throw Error('Choice was not offered');if(run.chosen.includes(choice))throw Error('Augment already chosen');
 const result=structuredClone(run);result.chosen.push(choice);result.offered=[];result.commands[commandId]=payload;return result;
}
export function rerollAugments(input:AugmentRun,commandId:string,version:number,policy:AugmentPolicy,catalog:AugmentOption[],ctx:AugmentContext):AugmentRun{
 const run=augmentRunSchema.parse(input),payload={op:'reroll' as const,offerVersion:version};if(replay(run,commandId,payload))return structuredClone(run);
 if(version!==run.offerVersion||!run.offered.length)throw Error('No current offer');if(run.rerollsLeft<=0)throw Error('No rerolls left');const result=offerAugments(run,policy,catalog,ctx,true);result.rerollsLeft--;result.commands[commandId]=payload;return result;
}
export function publicAugmentRun(run:AugmentRun){return {offered:[...run.offered],chosen:[...run.chosen],rerollsLeft:run.rerollsLeft,round:run.round,offerVersion:run.offerVersion};}
