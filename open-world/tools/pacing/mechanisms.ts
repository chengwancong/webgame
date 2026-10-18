import {effectRuleSchema,type EffectRule} from '../../packages/contracts/effects.ts';
import type {NewAspect} from '../../packages/content/aspect-description-types.ts';
import {refreshAspectDescriptions} from '../../packages/content/aspect-description.ts';
import type {PacingScene} from '../../packages/contracts/pacing.ts';

export const mechanismAspectIds=new Set(['aspect-st-ember','aspect-st-permafrost','aspect-mv-tailwind','aspect-tf-whirl','aspect-tf-knife','aspect-tr-tempo','aspect-df-burst','aspect-tr-headhunter']);
import knobData from '../../config/json/pacing-mechanism-knobs.json';
import {newAspects} from '../../packages/content/aspects.ts';
/** 目标场景唯一来源为Excel旋钮表，身份参数行不参与触发验收。 */
export const mechanismTargetScenes:Record<string,PacingScene[]>=Object.fromEntries(knobData.knobs.filter((k:any)=>k.kind==='rule').map((k:any)=>[k.rule,k.scenes??[]]));
// 编译器为flags生成的被动状态规则，继承相同过滤条件的已登记规则场景。
// 只解析已有声明，不按构筑ID特判，不修改内容或测量弹性。
for(const aspect of newAspects)if(aspect.parts.flags){const declared=aspect.parts.rules.find(r=>JSON.stringify(r.filter)===JSON.stringify(aspect.parts.flagFilter??{}));if(declared&&mechanismTargetScenes[declared.id])mechanismTargetScenes[aspect.id+'-state']=mechanismTargetScenes[declared.id];}
const rule=(source:string,key:string,trigger:EffectRule['trigger'],action:unknown,when:unknown[]=[],extra:Record<string,unknown>={}):EffectRule=>effectRuleSchema.parse({id:source+'-'+key,name:'待生成100%',description:'待生成100%',source,tier:1,trigger,chance:1,icd:0,filter:{},when,action,scale:[],vfxKey:'player/ward',...extra});
const buff=(mods:Record<string,number>,duration=30)=>({type:'buff',duration,maxStacks:1,mods});
/** 设计初值，不试跑战斗、不从目标反推。每个新增规则由身份条件或身份触发限定。 */
export function createMechanismAspects(raw:NewAspect[]):NewAspect[]{
 const aspects=structuredClone(raw),get=(id:string)=>{const a=aspects.find(a=>a.id===id);if(!a)throw Error('缺失词条 '+id);return a;};
 for(const a of aspects)if(mechanismAspectIds.has(a.id)){
  a.parts.rules=a.parts.rules.filter(r=>['aspect-st-ember-burn','aspect-tr-headhunter:26','aspect-tr-tempo:30','aspect-df-burst:37'].includes(r.id));
  a.parts.patches=[];
 }
 {
  const a=get('aspect-st-ember'),when=[{kind:'target_status',statuses:['burn']}];
  a.parts.rules.push(rule(a.id,'burning-hit','passive',{type:'amplify',ratio:.2,against:[]},when,{filter:{categories:['direct']}}),rule(a.id,'spread','kill',{type:'spread',statuses:['burn'],radius:3,count:3},when),rule(a.id,'ember-shield','hit',{type:'shield',ref:'maxHp',ratio:.15,duration:90},when,{icd:90,filter:{categories:['direct']}}));
 }
 {
  const a=get('aspect-st-permafrost');
  a.parts.rules.push(rule(a.id,'cold-hit','passive',{type:'amplify',ratio:.2,against:[]},[{kind:'target_status',statuses:['freeze','slow']}]),rule(a.id,'frost-guard','hurt',{type:'nova',ref:'attack',at:'self',ratio:.05,radius:3,damageType:'cold',status:{kind:'freeze',duration:45,strength:0,scope:'hit',cleanse:true} },[],{icd:180}));
 }
 {
  const a=get('aspect-mv-tailwind');delete a.parts.statMultipliers?.dodge;
  a.parts.rules.push(rule(a.id,'dash-strike','dash',{...buff({damageMult:.2},90),consume:'nextHit',flags:{forceCrit:true}}),rule(a.id,'moving-evasion','passive',buff({dodge:.15}),[{kind:'self_state',state:'moving',value:0}]));
 }
 {
  const a=get('aspect-tf-whirl');a.parts.patches=[{skills:['whirl'],ops:[{path:'damage',op:'mul',value:1.6},{path:'mechanics.schedule',op:'set',value:{hits:4,interval:15,followCaster:true,interruptOnMove:false}},{path:'weapons',op:'set',value:['sword','hammer','axe']}]}];
  a.parts.rules.push(rule(a.id,'crowd-area','passive',{type:'amplify',ratio:.2,against:[]},[{kind:'crowd',op:'gte',value:3,radius:4},{kind:'skill',tags:['area'] }]),rule(a.id,'whirl-armor','hit',{type:'status',status:'armor_down',duration:90,strength:.2,ratio:0,ref:'hit'},[{kind:'skill',skills:['whirl']}]),rule(a.id,'whirl-guard','cast',buff({damageReduction:.15},60),[{kind:'skill',skills:['whirl']}]));
 }
 {
  const a=get('aspect-tf-knife');a.parts.patches=[{skills:['throwing_knife','fan_of_knives'],scalePeriodicBudget:true,ops:[{path:'mechanics.projectile.orbit',op:'set',value:{duration:90,radius:1.5,interval:15,speed:.14}},{path:'mechanics.targeting',op:'set',value:'self'},{path:'mechanics.projectile.collisionRadius',op:'set',value:1},{path:'damage',op:'mul',value:.1}]}];
  a.parts.rules.push(rule(a.id,'bleeding-hit','passive',{type:'amplify',ratio:.2,against:[]},[{kind:'target_status',statuses:['bleed']}]),rule(a.id,'crowd-evasion','passive',buff({dodge:.15}),[{kind:'crowd',op:'gte',value:3,radius:4}]));
 }
 {
  const a=get('aspect-tr-tempo'),identity=a.parts.rules[0];
  a.parts.rules.push(rule(a.id,'tempo-recovery','interval',buff({cooldownRecovery:.2},90),[{kind:'self_state',state:'buff',id:identity.id}],{every:180}),rule(a.id,'mana-shield','mana_spent',{type:'shield',ref:'maxHp',ratio:.15,duration:90},[],{every:50}));
 }
 {
  const a=get('aspect-df-burst');
  a.parts.rules.push(rule(a.id,'block-counter','block',{type:'nova',ref:'hit',ratio:.2,radius:3,damageType:'physical',at:'self'}),rule(a.id,'shield-guard','passive',{type:'reduce',ratio:.15},[{kind:'self_state',state:'shield'}]));
 }
 {
  const a=get('aspect-tr-headhunter');
  a.parts.rules.push(rule(a.id,'healthy-hit','passive',{type:'amplify',ratio:.2,against:[]},[{kind:'target_hp',op:'gte',value:.9}]),rule(a.id,'opening-critical','passive',buff({critMultiplier:.2}),[{kind:'combat_time',op:'lt',value:3}]),rule(a.id,'elite-shield','kill_elite',{type:'shield',ref:'maxHp',ratio:.15,duration:90}));
 }
 refreshAspectDescriptions(aspects,mechanismAspectIds);return aspects;
}
