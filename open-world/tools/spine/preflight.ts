/** S0 只读盘点：只写本期证据目录，不写任何运行内容、Excel或数据库。 */
import {readFile,writeFile,mkdir,readdir,copyFile,access} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {versions} from '../../packages/contracts/index.ts';
import {skillCatalog} from '../../packages/content/index.ts';
import {skillWeapons} from '../../packages/content/skill-weapons.ts';
import {skillTags} from '../../packages/content/skill-tags.ts';
import {newAspects} from '../../packages/content/aspects.ts';
import {effectAtomById} from '../../packages/content/effect-atoms.ts';
import {setEffects} from '../../packages/content/set-effects.ts';
import {talentDefinitions,paragonDefinitions} from '../../packages/content/deep-progression.ts';
import {gearAffixConfig} from '../../packages/rules/affix-generator.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {buildVarietyProfiles} from '../build-variety-builds.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {resolveTargets,type SpineTarget} from './targets.ts';
export const root=resolve(import.meta.dirname,'../..'),repo=resolve(root,'..');
export const review=resolve(root,'docs/reviews/numeric-spine-20261013');
const git=(...args:string[])=>execFileSync('git',['-c','core.quotePath=false',...args],{cwd:repo,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}).trimEnd();
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const json=async(file:string)=>JSON.parse(await readFile(resolve(root,file),'utf8'));
const save=async(file:string,value:unknown)=>writeFile(resolve(review,file),JSON.stringify(value,null,2)+'\n');
const text=async(file:string,value:string)=>writeFile(resolve(review,file),value+'\n');
async function walk(folder:string):Promise<string[]>{const list:string[]=[];for(const e of await readdir(resolve(root,folder),{withFileTypes:true})){const p=folder+'/'+e.name;if(e.isDirectory())list.push(...await walk(p));else if(/\.(json|ts|xlsx)$/.test(e.name))list.push(p);}return list;}
export async function prerequisites(){const log=git('log','--format=%H %s','--grep=pacing-identity:'),all=git('log','--all','--format=%H %s','--grep=pacing-identity:');return {passed:log.length>0,commitMatches:log.split('\n').filter(Boolean),allBranchMatches:all.split('\n').filter(Boolean),head:git('rev-parse','HEAD'),versions,blocker:log?'无':'第7节硬阻塞6：当前分支历史尚无 pacing-identity: 提交'};}
export async function preflight(){
 try{await access(resolve(review,'S0/workspace-baseline.json'));throw Error('S0基线已存在；按progress.md恢复，禁止覆盖初始快照。只重建目标草稿使用 --targets-draft。');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await mkdir(resolve(review,'S0'),{recursive:true});await mkdir(resolve(review,'S0/source-before'),{recursive:true});
 const pre=await prerequisites();await save('S0/prerequisites.json',pre);
 const status=git('status','--porcelain=v1','-uall','--','open-world/packages','open-world/config','open-world/apps/api/src','open-world/package.json','open-world/tools/config-export.py','AGENTS.md'),files=await walk('packages/content');
 files.push(...await walk('config'),...await walk('packages/rules'),...await walk('packages/contracts'));
 files.push('package.json','tools/config-export.py','apps/api/src/app.ts','apps/api/src/stage-key-pools.json','apps/api/src/field-loot.json');
 const entries=[];
 for(const file of [...new Set(files)]){
  const bytes=await readFile(resolve(root,file)),path='open-world/'+file;
  const line=status.split('\n').find(s=>s.endsWith(path));
  entries.push({file,sha256:hash(bytes),status:line?.slice(0,2)??'已跟踪且无改动'});
  const dest=resolve(review,'S0/source-before',file);await mkdir(resolve(dest,'..'),{recursive:true});await copyFile(resolve(root,file),dest);
 }
 await save('S0/workspace-baseline.json',{captured:new Date().toISOString(),...pre,files:entries});
 await text('S0/git-status-before.txt',status);
 await text('S0/external-numeric-files.md','# 外部未提交数值文件\n\n本期只读当前工作树。以下状态和哈希为开始时快照，不纳入本期提交。\n\n| 文件 | Git状态 | SHA256 |\n|---|---|---|\n'+entries.filter(e=>e.status!=='已跟踪且无改动').map(e=>`| ${e.file} | ${e.status} | ${e.sha256} |`).join('\n'));
 const legacyFiles=['.design/standard-player-20261005/model.json','.design/starsea-balance-20261005/model.json','.design/numeric-flow-20261006/flow.json','docs/reviews/open-world-m2-m4/W3/key-source-basis.json','docs/reviews/open-world-m2-m4/W3/stage-aoe-hits.json'];
 const models=[];
 for(const file of legacyFiles){try{const bytes=await readFile(resolve(root,file)),v=JSON.parse(bytes.toString()),stamp=v.meta?.versions??v.versions??null;models.push({file,sha256:hash(bytes),versions:stamp,stale:!stamp||Object.entries(versions).some(([k,value])=>stamp[k]!==value)});}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;models.push({file,versions:null,stale:true,missing:true});}}
 const tools=(await readdir(resolve(root,'tools'))).filter(f=>/\.(ts|mjs|py)$/.test(f)),writers=[];
 for(const file of tools){const source=await readFile(resolve(root,'tools',file),'utf8');if(!/(writeFile|write_text|json.dump|open\([^\n]+['"]w)/.test(source))continue;
  const outputs=[...new Set([...source.matchAll(/(?:packages\/content|apps\/api\/src|config\/json)\/[\w./-]+\.json/g)].map(m=>m[0]))];
  const inputs=[...new Set([...source.matchAll(/(?:\.design|docs\/reviews|config\/json)\/[\w./-]+\.json/g)].map(m=>m[0]))];
  if(outputs.length)writers.push({tool:'tools/'+file,outputs,inputs});
 }
 await save('S0/numeric-sources.json',{versions,models,writers});
 await text('numeric-sources.md','# 数值来源与过期输入\n\n扫描顶层工具的字面量写入路径；动态路径工具仍需在接入主干时人工复核。schema版本不等于测量规则版本。\n\n## 模型输入\n\n| 文件 | 版本戳 | 是否过期 |\n|---|---|---|\n'+models.map(m=>`| ${m.file} | ${JSON.stringify(m.versions)} | ${m.stale?'是':'否'} |`).join('\n')+'\n\n## 数值文件与写入者\n\n| 文件 | 写入工具 | 模型输入 |\n|---|---|---|\n'+writers.flatMap(w=>w.outputs.map(o=>`| ${o} | ${w.tool} | ${w.inputs.join('、')||'代码常量或配置；未声明测量版本'} |`)).join('\n'));
 const {counts,hosts}=await writeCensus();
 const targetCount=await writeTargetDraft();
 console.log(JSON.stringify({pre,counts,sourceModels:models.length,staleModels:models.filter(m=>m.stale).length,targets:targetCount,hosts:hosts.length}));
}
export async function writeCensus(){
 const choose=(weapons:readonly string[],skills:readonly string[]=[],tags:readonly string[]=[])=>{
  const direct=buildVarietyProfiles.find(p=>skills.some(id=>p.skills.includes(id)));
  const family=buildVarietyProfiles.find(p=>weapons.includes(p.weapon));
  const tag=buildVarietyProfiles.find(p=>p.skills.some(id=>skillTags(skillCatalog.find(s=>s.id===id)!).some(t=>tags.includes(t))));
  const host=direct??family??tag;
  return {host:host?.id??'标准人:'+ (weapons[0]??'sword'),basis:direct?'共享技能族':family?'共享武器族':tag?'共享技能标签':'无匹配宿主，按默认裁决使用该武器族标准人'};
 };
 const partsHost=(weapons:readonly string[],parts:any,tags:readonly string[]=[])=>{
  const atoms=parts.atoms.map((a:any)=>effectAtomById.get(a.id)),filters=[...parts.rules,...atoms.filter(Boolean)].map((r:any)=>r.filter),patches=parts.patches;
  return choose(weapons,[...patches.flatMap((p:any)=>p.skills??[]),...filters.flatMap((f:any)=>f.skills??[])],[...tags,...patches.flatMap((p:any)=>p.tags??[]),...filters.flatMap((f:any)=>f.tags??[])]);
 };
 const skills=skillCatalog.map(s=>{const functional=s.damage<=0||['heal','shield'].includes(s.kind);return {id:s.id,name:s.name,category:['spell','support'].includes(s.category)?'法术':'武技',role:functional?'功能':s.cooldown<=30?'填充':s.cooldown<=180?'核心':s.cooldown<=600?'冷却':'大招',shape:functional?'功能':s.kind==='zone'&&s.duration>0?'持续':['single','projectile'].includes(s.kind)&&s.radius<=.5?'单体':'范围',cooldownSeconds:s.cooldown/30,cost:s.cost,...choose(skillWeapons[s.id]??[],[s.id])};});
 const hosts=[...skills.map(s=>({type:'技能',id:s.id,host:s.host,basis:s.basis})),
  ...newAspects.map(a=>({type:'词条',id:a.id,...partsHost(a.weapons,a.parts)})),
  ...setEffects.map(s=>({type:'套装',id:s.id,...choose([s.family])}))];
 const inscriptions=await json('packages/content/inscriptions.json');
 const counts={skills:skills.length,aspects:newAspects.length,nonReferenceAspects:newAspects.filter(a=>!pacingProfiles.some(p=>p.aspect===a.id)).length,sets:setEffects.length,affixRows:gearAffixConfig.pool.length,mainStats:gearAffixConfig.mainStats.length,talents:talentDefinitions.length,paragon:paragonDefinitions.length,inscriptionAtoms:new Set(Object.values(inscriptions.slots).flat() as string[]).size,inscriptionSlotEntries:(Object.values(inscriptions.slots).flat() as string[]).length,monsterTemplates:monsterContent.templates.length,dungeons:dungeonContent.definitions.length};
 await save('S0/census.json',{versions,counts,skills,hosts});
 await text('census.md','# 当前工作树内容盘点\n\n'+Object.entries(counts).map(([k,v])=>`- ${k}：${v}`).join('\n')+'\n\n技能冷却按30帧/秒推断；无伤害归功能。技能形态为初始分组，召唤语义与小组并组待S2审计确认，不把无实测条目标为预算达标。\n\n| 技能 | 名称 | 系别 | 角色 | 形态 | 冷却秒 | 宿主 |\n|---|---|---|---|---|---:|---|\n'+skills.map(s=>`| ${s.id} | ${s.name} | ${s.category} | ${s.role} | ${s.shape} | ${s.cooldownSeconds.toFixed(2)} | ${s.host} |`).join('\n'));
 await text('S0/hosts.md','# 内容宿主对照\n\n| 类别 | 内容 | 宿主 | 依据 |\n|---|---|---|---|\n'+hosts.map(h=>`| ${h.type} | ${h.id} | ${h.host} | ${h.basis} |`).join('\n'));
 return {counts,hosts};
}
export async function writeTargetDraft(){
 const pacing=await json('config/json/pacing-targets.json'),rows:SpineTarget[]=[];
 const add=(key:string,levels:string,value:number,unit:string,source:SpineTarget['source'],reference:string,locked=false,date='2026-10-13')=>rows.push({key,levels,value,unit,source,reference,locked,date});
 for(const m of pacing.milestones){if(m.kind==='level')add(m.id,String(m.level),m.targetMinutes,'虚拟分钟','用户',`config/excel/节奏目标.xlsx milestones 第${m._row}行`,true,'2026-10-10');else{add(m.id+'.arrival',String(m.level),m.level,'等级','用户',`config/excel/节奏目标.xlsx milestones 第${m._row}行`,true,'2026-10-10');add(m.id+'.kill',String(m.level),m.bossKillSeconds,'秒','用户',`config/excel/节奏目标.xlsx milestones 第${m._row}行`,true,'2026-10-10');add(m.id+'.wall',String(m.level),m.wallMinutes,'虚拟分钟','用户',`config/excel/节奏目标.xlsx milestones 第${m._row}行`,true,'2026-10-10');}}
 for(const b of pacing.builds)for(const scene of ['single','clear','elite','survival','safety'])add((b.id==='weights'?'weights.':b.id+'.')+scene,'50',b[scene],b.id==='weights'?'权重':'比值','用户',`config/excel/节奏目标.xlsx builds 第${b._row}行`,true,'2026-10-10');
 add('buildBudget','50',1,'比值','用户','config/excel/节奏目标.xlsx：构筑预算 1.0±5%',true,'2026-10-10');
 add('buildBudgetBand','50',.05,'比例','用户','config/excel/节奏目标.xlsx settings：tolerance',true,'2026-10-10');
 for(const key of ['mainGoal','hardLimit']){const setting=pacing.settings.find((s:any)=>s.id===key);add('level50.'+key,'50',setting.value,'虚拟分钟','用户','config/excel/节奏目标.xlsx settings 第'+setting._row+'行',true,'2026-10-10');}
 const band=pacing.settings.find((s:any)=>s.id==='targetBand');for(const [i,key]of ['min','max'].entries())add('level50.band.'+key,'50',band.value[i],'虚拟分钟','用户','config/excel/节奏目标.xlsx settings 第'+band._row+'行',true,'2026-10-10');
 const flow=await json('.design/numeric-flow-20261006/flow.json');
 for(const stage of flow.stages)for(const key of ['push','farm'])add('stage.'+stage.index+'.'+key,String(stage.level),stage[key],'分钟','文档','docs/open-world-numeric-flow.md §3；flow.json stages['+(stage.index-1)+'].'+key,false,'2026-10-06');
 add('weaponParity','10/20/30/40/50',.15,'差距上限','文档','numeric-spine-rebalance-handoff-20261013.md M4');
 for(const [key,value]of Object.entries({skill:.1,aspect:.15,set:.15,affix:.1,talent:.15,paragon:.15,inscription:.15}))add('band.'+key,'1–60',value,'比例','文档','numeric-spine-rebalance-handoff-20261013.md M1预算带');
 const resolved=resolveTargets(rows);
 await save('S0/spine-targets-draft.json',{source:'config/excel/节奏目标.xlsx（尚未写入主干目标页）',status:'前置硬阻塞下的目标草稿，不可用于应用',targets:resolved.selected,pending:['野外六段一刀线/TTK/TTD：待S2当前标准人实测及设计步长取整'],conflicts:resolved.conflicts});
 await text('targets-conflicts.md','# 目标冲突清单\n\n本轮导入 '+rows.length+' 条已有目标，机械重复量冲突 '+resolved.conflicts.length+' 条；尚未完成跨量约束可满足性验证。锁定用户目标逐字保留，未进行设计步长取整。\n\n主干目标页尚未写入。野外和危险度目标按第6节裁决等待当前标准人实测，不以旧模型填入。');
 return rows.length;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){if(process.argv.includes('--targets-draft'))console.log('目标草稿行数：'+await writeTargetDraft());else if(process.argv.includes('--census'))console.log(JSON.stringify((await writeCensus()).counts));else await preflight();}
