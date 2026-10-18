import {writeFile,readFile} from 'node:fs/promises';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import {get,put} from './content.ts';
import {normalizeToBand,median} from './math.ts';
import {gearAffixConfig} from '../../packages/rules/affix-generator.ts';
import {statDefinition} from '../../packages/contracts/stats.ts';
import {refreshAspectDescriptions} from '../../packages/content/aspect-description.ts';
import {save,readJson,review,data,stamp,decision} from './io.ts';
export async function deriveNormalization(output=review+'/S3',apply=false,auditPath=review+'/S2/audit-summary.json'){
 const audit=await readJson(auditPath),sources:Record<string,any>={},changes:SpineChange[]=[],residuals:any[]=[];
 const source=async(file:string)=>sources[file]??=await readJson(file);
 const add=async(file:string,path:(string|number)[],after:any,basis:string)=>{const s=await source(file),before=get(s,path);if(JSON.stringify(before)===JSON.stringify(after))return;changes.push({file,path,before:structuredClone(before),after,basis});put(s,path,after);};
 for(const row of audit.rows){
  if(row.inBand||row.functional||['词缀','主属性'].includes(row.category))continue;
  if(row.observed===null||row.observed<=0||row.center<=0){residuals.push({...row,reason:'缺有效P配对或净P/中位数非正；不得用绝对值作为正预算或估计跨零弹性'});continue;}
  if(row.value===null||row.elasticity===null||Math.abs(row.elasticity)<1e-6){residuals.push({...row,reason:row.value===null?'当前契约没有独立可调主数值':'实测弹性为零或缺失；禁止估计'});continue;}
  const file=row.file,s=await source(file),path=row.path,before=get(s,path),coefficient=row.category==='技能';
  const old=coefficient?before:row.value;
  let next;try{next=normalizeToBand(old,row.observed,row.center,row.band,row.elasticity,row.step);}catch(e){residuals.push({...row,reason:String(e)});continue;}
  const parent=get(s,path.slice(0,-1)),value=typeof parent.max==='number'&&parent.perStillSecond?Math.min(next.value,parent.max):next.value;if(!Number.isFinite(value)||value<=0){residuals.push({...row,reason:'设计步长无法给出正数'});continue;}
  await add(file,path,value,`${auditPath}宿主=${row.host}；实测=${row.observed}，组中位=${row.center}，带±${row.band}，e=${row.elasticity}；边缘=${next.edge}，新值=旧值×(边缘/实测)^(1/e)，步长${row.step}`);
 }
 // 词缀和主属性用对应物品等级档的实测属性权重定价；上下界同比缩放。
 const weights=(await readJson(data+'/stat-weights.json')).rows;
 for(const kind of ['pool','mainStats'] as const){const entries=gearAffixConfig[kind],tiers=kind==='pool'?[1,2,3]:[8];for(const tier of tiers){
  const level=tier===1?20:tier===2?20:50,rows=entries.map((entry:any,index)=>({entry,index,weight:weights.find((w:any)=>w.level===level&&w.stat===entry.stat)?.powerWeight??0})).filter(({entry}:any)=>kind!=='pool'||entry.tier===tier);
  const value=(e:any)=>kind==='pool'?(e.minValue+e.maxValue)/2:e.t8,prices=rows.map(r=>r.weight*value(r.entry)).filter(v=>Math.abs(v)>=Math.log(1.01)),center=prices.length?median(prices):0;
  for(const row of rows){const observed=row.weight*value(row.entry);if(Math.abs(observed)<Math.log(1.01))continue;if(observed<=0||center<=0){residuals.push({file:'packages/content/gear-affixes.json',kind,index:row.index,observed,center,reason:'带符号属性定价非正，不能当正预算比例归一'});continue;}const edge=Math.max(center*.9,Math.min(center*1.1,observed));if(edge===observed)continue;const ratio=edge/observed;
   for(const key of kind==='pool'?['minValue','maxValue']:['t1','t8']){const raw=(row.entry as any)[key]*ratio,step=statDefinition(row.entry.stat)?.unit==='flat'?1:.05,after=Number((Math.max(step,Math.round(raw/step)*step)).toFixed(4));await add('packages/content/gear-affixes.json',[kind,row.index,key],after,`M6同档属性定价；L${level}实测P权重${row.weight}×值，实测${observed}，中位${center}，带边缘${edge}；区间同比${ratio}；flat沿用正式randomInt整数域`);}
  }
 }}
 // 描述与该计划中的参数一起生成；不依赖重新导入磁盘模块。
 if(sources['packages/content/aspects.json']){const file='packages/content/aspects.json',before=structuredClone(sources[file]);const ids=new Set(changes.filter(c=>c.file===file).map(c=>sources[file][c.path[0]].id));try{refreshAspectDescriptions(sources[file],ids);for(let i=0;i<before.length;i++){if(before[i].description!==sources[file][i].description)changes.push({file,path:[i,'description'],before:before[i].description,after:sources[file][i].description,basis:'M6真实参数重新生成说明'});for(let j=0;j<before[i].parts.rules.length;j++)for(const key of ['name','description'])if(before[i].parts.rules[j][key]!==sources[file][i].parts.rules[j][key])changes.push({file,path:[i,'parts','rules',j,key],before:before[i].parts.rules[j][key],after:sources[file][i].parts.rules[j][key],basis:'M6规则参数重新生成说明'});}}catch(e){await decision('非参考词条描述生成器覆盖不足','统一说明生成器需要扩展；本计划先保留残差并拒绝未同步描述的词条应用：'+String(e),'tools/spine/normalize.ts');for(let i=changes.length-1;i>=0;i--)if(changes[i].file===file){residuals.push({...changes[i],reason:'尚无完整参数说明生成器'});changes.splice(i,1);}}}
 await save(output+'/plan.json',{...stamp(),changes,residuals});await save(output+'/normalization-summary.json',{...stamp(),changes:changes.length,residuals});
 return applySpinePlan('.',changes,spineSchemas,{apply,output});
}
