import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {effectRuleSchema} from '../../packages/contracts/effects.ts';
import {newAspects,newAspectSchema} from '../../packages/content/aspects.ts';
import {mechanismAspectIds} from './mechanisms.ts';
import {refreshAspectDescriptions} from '../../packages/content/aspect-description.ts';
import {mechanismKnobs,knobPath,put} from './derive-model.ts';
export function createIdentityAspects(raw= newAspects){const next=structuredClone(raw),get=(id:string)=>next.find(a=>a.id===id)!;
 const rule=(aspect:string,key:string,trigger:string,action:any,extra:any={})=>effectRuleSchema.parse({id:aspect+'-'+key,name:'待生成',description:'待生成',source:aspect,tier:1,trigger,chance:1,icd:0,filter:{},when:[],action,scale:[],vfxKey:'player/ward',...extra});
 for(const a of next)if(mechanismAspectIds.has(a.id)){a.parts.rules=a.parts.rules.filter(r=>!['dash-nova','block-shield','kill-refund'].some(key=>r.id.endsWith(key)));}
 const mobile=get('aspect-mv-tailwind');mobile.parts.rules.push(rule(mobile.id,'dash-nova','dash',{type:'nova',at:'self',ref:'attack',ratio:.5,radius:2,damageType:'physical'}));
 const arrows=get('aspect-tf-knife');arrows.parts.rules.find(r=>r.id.endsWith('bleeding-hit'))!.when=arrows.parts.rules.find(r=>r.id.endsWith('bleeding-hit'))!.when.filter(c=>c.kind!=='crowd');arrows.parts.rules.find(r=>r.id.endsWith('bleeding-hit'))!.when.push({kind:'crowd',op:'gte',value:3,radius:4});
 const echo=get('aspect-tr-tempo');echo.parts.rules.find(r=>r.id==='aspect-tr-tempo:30')!.startReady=true;
 // 同一节拍窗口内恢复必须在强化被消耗前就绪，默认其他interval不变。
 echo.parts.rules.find(r=>r.id.endsWith('tempo-recovery'))!.startReady=true;
 const bulwark=get('aspect-df-burst'),counter=bulwark.parts.rules.find(r=>r.id.endsWith('block-counter'))!;if(counter.action.type==='nova'){counter.action.at='target';counter.action.radius=0;counter.action.maxTargets=1;}
 bulwark.parts.rules.push(rule(bulwark.id,'block-shield','block',{type:'shield',ref:'maxHp',ratio:.1,duration:90},{icd:90}));
 const opening=get('aspect-tr-headhunter');opening.parts.rules.push(rule(opening.id,'kill-refund','kill',{type:'refund',mode:'longest',fraction:.3}));
 for(const a of next)if(mechanismAspectIds.has(a.id))a.parts.statMultipliers??={};
 for(const k of mechanismKnobs)put(next,knobPath(next,k),k.design);
 refreshAspectDescriptions(next,mechanismAspectIds);return newAspectSchema.array().parse(next);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){const file='packages/content/aspects.json',raw=JSON.parse(await readFile(file,'utf8'));await writeFile(file,JSON.stringify(createIdentityAspects(raw),null,2)+'\n');}
