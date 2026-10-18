import type {CharacterState,Receipt} from '../contracts/index.ts';
import type {TalentBatchPreview} from '../contracts/deep-progression.ts';
import {versions} from '../contracts/index.ts';
import {applyProgressionAction,previewProgressionAction,ensureProgression} from './deep-progression.ts';
/** Reuses every single-point gate and charge. The batch is an atomic affordable prefix. */
export function quoteTalentBatch(s:CharacterState,target:string):TalentBatchPreview{
 const next=structuredClone(s);ensureProgression(next);const basis=structuredClone(next);const cost={gold:0,material:0,items:{} as Record<string,number>};let count=0,reason='';
 for(;;){const one=previewProgressionAction(next,{op:'talent.learn',target});if(!one.enabled){reason=one.reason;break;}applyProgressionAction(next,{op:'talent.learn',target});count++;cost.gold+=one.cost.gold;cost.material+=one.cost.material;for(const [id,n]of Object.entries(one.cost.items))cost.items[id]=(cost.items[id]??0)+n;}
 const before=previewProgressionAction(basis,{op:'talent.learn',target}).before,after=previewProgressionAction(next,{op:'talent.learn',target}).before;
 return {revision:s.revision,ruleset_version:versions.rules,target,count,cost,enabled:count>0,reason,summary:count?`本次投入 ${count} 点；停止条件：${reason}`:reason,before,after};
}
export function applyTalentBatch(s:CharacterState,target:string,expectedCount:number):Receipt['delta']{
 const quote=quoteTalentBatch(s,target);if(!quote.enabled||quote.count!==expectedCount)throw Error(quote.reason||'批量报价已变化，请重新预览。');
 const next=structuredClone(s),delta:Receipt['delta']={gold:0,xp:0,material:0,progression:{materials:{},reputation:{}}};
 for(let n=0;n<quote.count;n++){const one=applyProgressionAction(next,{op:'talent.learn',target});delta.gold+=one.gold;delta.material+=one.material;for(const [id,value]of Object.entries(one.progression?.materials??{}))delta.progression!.materials[id]=(delta.progression!.materials[id]??0)+value;}
 next.build=s.build+1;Object.assign(s,next);return delta;
}
