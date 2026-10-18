import {readFile,writeFile} from 'node:fs/promises';
import {effectRuleSchema} from '../../packages/contracts/effects.ts';
import {newAspects} from '../../packages/content/aspects.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {mechanismKnobs,knobPath,type MechanismKnob} from '../pacing/derive-model.ts';
import {describeAspectRule,refreshAspectDescriptions} from '../../packages/content/aspect-description.ts';
import {pacingBuildTargets,pacingWeights} from '../../packages/content/pacing-targets.ts';
import {referencePlayer} from './player.ts';
import {measured} from './measure.ts';
import {mapBench,spineScenes,type SpineScene} from './math.ts';
import {get,put} from './content.ts';
import {readJson,save,review,data,stamp,decision} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
export function supplementalKnobs(){return pacingProfiles.flatMap(p=>spineScenes.map(scene=>({bd:p.id,aspect:p.aspect,rule:p.aspect+'-spine-'+scene,kind:'rule' as const,path:scene==='survival'?['action','ratio']:scene==='safety'?['action','mods','dodge']:scene==='elite'?['action','mods','damageMult']:['action','ratio'],step:.05,min:.1,max:scene==='safety'?.45:scene==='survival'?.6:1.5,role:'mechanism' as const,design:.2,floor:.1,ceiling:scene==='safety'?.45:scene==='survival'?.6:1.5,scenes:[scene],scale:'log' as const,marginal:{},generic:false,unit:'比例',basis:'S3核心技能触发的身份机制；弹性待S4实测'})));}
export async function completeBuildStructure(output=review+'/S3',apply=false){
 const raw=await readJson('packages/content/aspects.json'),changes:SpineChange[]=[],knobs=supplementalKnobs();
 for(const profile of pacingProfiles){const i=raw.findIndex((a:any)=>a.id===profile.aspect),aspect=raw[i],rules=structuredClone(aspect.parts.rules);
  for(const scene of spineScenes){const id=aspect.id+'-spine-'+scene;if(rules.some((r:any)=>r.id===id))continue;
   const action=scene==='survival'?{type:'shield',ratio:.2,ref:'maxHp',duration:90}:scene==='safety'?{type:'buff',duration:90,maxStacks:1,mods:{dodge:.2}}:scene==='elite'?{type:'buff',duration:90,maxStacks:1,mods:{damageMult:.2}}:{type:'amplify',ratio:.2,against:[]};
   const when=scene==='single'?[{kind:'combat_time',op:'gte',value:3},{kind:'crowd',op:'lte',value:1,radius:12}]:scene==='clear'?[{kind:'crowd',op:'gte',value:3,radius:12}]:scene==='elite'?[{kind:'combat_time',op:'lt',value:3}]:[];
   const passive=scene==='single'||scene==='clear',rule=effectRuleSchema.parse({id,name:profile.name+'·'+({single:'独战',clear:'群攻',elite:'开场',survival:'施法护盾',safety:'施法闪避'})[scene],description:'待参数生成',source:aspect.id,tier:1,trigger:passive?'passive':'cast',chance:1,icd:0,filter:{skills:[...profile.skills]},when,action,scale:[],vfxKey:'player/'+profile.skills[0]});rule.description=describeAspectRule(rule);rules.push(rule);
  }
  if(JSON.stringify(rules)!==JSON.stringify(aspect.parts.rules)){changes.push({file:'packages/content/aspects.json',path:[i,'parts','rules'],before:aspect.parts.rules,after:rules,basis:'M7在S3窗口补核心技能身份条件机制：持续单挑/群敌/开场/施法护盾/施法闪避；专用性由S4真实弹性判定，不预宣称专用'});aspect.parts.rules=rules;}
 }
 const before=raw.map((a:any)=>a.description);refreshAspectDescriptions(raw,new Set(pacingProfiles.map(p=>p.aspect)));raw.forEach((a:any,i:number)=>{if(a.description!==before[i])changes.push({file:'packages/content/aspects.json',path:[i,'description'],before:before[i],after:a.description,basis:'S3身份机制参数的完整中文说明'});});
 const all=[...mechanismKnobs.filter(k=>!k.rule.includes('-spine-')).map(k=>({...k,floor:k.role==='identity'?Math.max(k.floor,k.design*.5):k.floor,source:'packages/content/aspects.json'})),...knobs.map(k=>({...k,source:'packages/content/aspects.json'}))];
 await save(data+'/build-knobs.json',{...stamp(),knobs:all});await save(output+'/structure-plan.json',{changes,knobs:all});return applySpinePlan('.',changes,spineSchemas,{apply,output:output+'/structure'});
}
/** 正规方程的带主元消元。只解实测局部雅可比，不搜索候选战斗。 */
export function solveLinear(matrix:number[][],rhs:number[]){const a=matrix.map((r,i)=>[...r,rhs[i]]),n=rhs.length;for(let j=0;j<n;j++){let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[pivot][j]))pivot=i;[a[j],a[pivot]]=[a[pivot],a[j]];if(Math.abs(a[j][j])<1e-12)continue;const d=a[j][j];for(let k=j;k<=n;k++)a[j][k]/=d;for(let i=0;i<n;i++)if(i!==j){const f=a[i][j];for(let k=j;k<=n;k++)a[i][k]-=f*a[j][k];}}return a.map((r,i)=>Math.abs(r[i])<1e-12?0:r[n]);}
export function assertContinuousSolve(rows:{key:string;error:number}[],builds:readonly string[]){const failed=rows.filter(r=>builds.includes(r.key.split('/')[0])&&(!Number.isFinite(r.error)||Math.abs(r.error)>=.02));if(failed.length)throw Error('实测轴存在超过2%的真实时序敏感性，拒绝将台阶输入用于牛顿求解：'+failed.map(r=>r.key).join('，'));}
export function newtonStep(knobs:any[],initial:number[],observed:Record<SpineScene,number>,target:Record<SpineScene,number>,mapping?:Partial<Record<SpineScene,number|null>>){
 const known=!mapping||spineScenes.every(s=>typeof mapping[s]==='number'&&mapping[s]!>0),m=(s:SpineScene)=>mapping?.[s]??1;
 const rows=spineScenes.map(scene=>knobs.map(k=>k.marginal[scene]??0)),weights=spineScenes.map(s=>pacingWeights[s]),errors=spineScenes.map(s=>Math.log(target[s]/observed[s])),budget=known?spineScenes.reduce((n,s)=>n+pacingWeights[s]*observed[s]*m(s),0):null;
 if(budget!==null&&Math.abs(budget-1)>.05){rows.push(knobs.map((_,i)=>spineScenes.reduce((n,s,j)=>n+pacingWeights[s]*observed[s]*m(s)*rows[j][i],0)/budget));weights.push(20);errors.push(-Math.log(budget));}
 const count=knobs.length,lhs=Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>rows.reduce((n,row,r)=>n+row[i]*weights[r]*row[j],i===j?1e-6:0))),rhs=initial.map((_,i)=>rows.reduce((n,row,r)=>n+row[i]*weights[r]*errors[r],0)),delta=solveLinear(lhs,rhs);
 const values=initial.map((v,i)=>{const k=knobs[i],raw=k.scale==='log'?v*Math.exp(delta[i]):v+delta[i],span=(k.ceiling-k.floor)*.5,lo=Math.max(k.floor,v-span),hi=Math.min(k.ceiling,v+span);return Number((Math.max(Math.ceil(lo/k.step)*k.step,Math.min(Math.floor(hi/k.step)*k.step,Math.round(raw/k.step)*k.step))).toFixed(4));});
 const predicted=Object.fromEntries(spineScenes.map(s=>[s,observed[s]*Math.exp(knobs.reduce((n,k,i)=>n+(k.marginal[s]??0)*(k.scale==='log'?Math.log(values[i]/initial[i]):values[i]-initial[i]),0))]));return {values,predicted,budgetBefore:budget,budgetAfter:known?spineScenes.reduce((n,s)=>n+pacingWeights[s]*predicted[s]*m(s),0):null,budgetKnown:known};
}
export async function measureBuildElasticities(output=review+'/S4'){
 const {knobs}=await readJson(data+'/build-knobs.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor,core=await readJson(review+'/S2/core-summary.json'),hp=core.standards.find((r:any)=>r.level===50).hp,rows:any[]=[];
 for(const profile of pacingProfiles){const {player}=referencePlayer(profile.id),base=await measured(output,profile.id+'-baseline',player,hp),mapped=mapBench(base.metrics,anchor);
  for(const knob of knobs.filter((k:any)=>k.bd===profile.id)){const path=knobPath(newAspects,knob),before=get(newAspects,path),move=knob.scale==='log'?Math.max(before*.2,2*knob.step):2*knob.step,after=Number((Math.max(knob.floor,Math.min(knob.ceiling,Math.round((before+move<=knob.ceiling?before+move:before-move)/knob.step)*knob.step))).toFixed(4));let arm;put(newAspects,path,after);try{arm=await measured(output,'knob-'+profile.id+'-'+rows.length,referencePlayer(profile.id).player,hp);}finally{put(newAspects,path,before);}
   const next=mapBench(arm.metrics,anchor),denom=knob.scale==='log'?Math.log(after/before):after-before;knob.marginal=Object.fromEntries(spineScenes.map(s=>[s,denom?Math.log(next[s]/mapped[s])/denom:0]));knob.basis='measured:S4 seeds=41,42,43 before='+before+' after='+after;knob.source='packages/content/aspects.json';rows.push({...knob,before,after,dedicated:Object.fromEntries(spineScenes.map(s=>[s,Math.abs(knob.marginal[s])>1e-6&&spineScenes.filter(o=>o!==s).every(o=>Math.abs(knob.marginal[s])>=2*Math.abs(knob.marginal[o]))]))});await save(output+'/elasticities.json',{...stamp(),knobs:rows});
  }
 }
 await save(data+'/build-knobs.json',{...stamp(),knobs:rows});await save(output+'/elasticities-summary.json',{...stamp(),knobs:rows,coverage:pacingProfiles.map(p=>({build:p.id,scenes:Object.fromEntries(spineScenes.map(s=>[s,rows.filter(k=>k.bd===p.id&&k.dedicated[s]).map(k=>k.rule)]))}))});return rows;
}
export async function solveBuilds(output=review+'/S4',steps=3,correction?:Record<string,Partial<Record<SpineScene,number|null>>>){
 const stability=await readJson(data+'/spine-measurement-stability.json');assertContinuousSolve(stability.aggregate,pacingProfiles.map(p=>p.id));
 if(steps>3)throw Error('测量台牛顿超过3步');const {knobs}=await readJson(data+'/build-knobs.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor,hp=anchor.r50*20;
 for(let step=1;step<=steps;step++){
  const raw=await readJson('packages/content/aspects.json'),changes:SpineChange[]=[],predictions=[];let done=true;
  for(const profile of pacingProfiles){const active=knobs.filter((k:any)=>k.bd===profile.id),base=await measured(output+'/step-'+step,profile.id,referencePlayer(profile.id).player,hp),observed=mapBench(base.metrics,anchor),goal=pacingBuildTargets.find(t=>t.id===profile.id)!;
   const target=Object.fromEntries(spineScenes.map(s=>[s,correction?.[profile.id]?.[s]===null?observed[s]:goal[s]/(correction?.[profile.id]?.[s]??1)])) as Record<SpineScene,number>,initial=active.map((k:any)=>get(raw,knobPath(raw,k))),solution=newtonStep(active,initial,observed,target,correction?.[profile.id]);done&&=spineScenes.every(s=>correction?.[profile.id]?.[s]!==null&&Math.abs(observed[s]/target[s]-1)<=goal.tolerance/2);
   active.forEach((k:any,i:number)=>{const path=knobPath(raw,k),before=initial[i],after=solution.values[i];if(after!==before){changes.push({file:'packages/content/aspects.json',path,before,after,basis:'M7实测雅可比加权最小二乘牛顿步'+step+'；'+k.basis+'；边界'+k.floor+'–'+k.ceiling+'；本步范围≤50%；预测预算'+solution.budgetAfter});put(raw,path,after);}});predictions.push({build:profile.id,observed,target,...solution});
  }
  const old=raw.map((a:any)=>a.description),ruleText=raw.map((a:any)=>a.parts.rules.map((r:any)=>({name:r.name,description:r.description})));refreshAspectDescriptions(raw,new Set(pacingProfiles.map(p=>p.aspect)));raw.forEach((a:any,i:number)=>{if(a.description!==old[i])changes.push({file:'packages/content/aspects.json',path:[i,'description'],before:old[i],after:a.description,basis:'牛顿步真实参数说明同步'});a.parts.rules.forEach((r:any,j:number)=>{for(const key of ['name','description'])if(r[key]!==ruleText[i][j][key])changes.push({file:'packages/content/aspects.json',path:[i,'parts','rules',j,key],before:ruleText[i][j][key],after:r[key],basis:'牛顿步规则参数说明同步'});});});
  await save(output+'/step-'+step+'/plan.json',{...stamp(),changes,predictions});if(done){await decision('牛顿提前结束 '+output,'全部预测场景进入tolerance一半；本步不再应用','S4');break;}
  await applySpinePlan('.',changes,spineSchemas,{apply:true,output:output+'/step-'+step});
  // 下一轮在同一进程中必须刷新实际运行目录，不用旧导入缓存产生假迭代。
  for(const c of changes)put(newAspects,c.path,c.after);
 }
}
