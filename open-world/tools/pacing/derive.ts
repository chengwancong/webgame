import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {versions} from '../../packages/contracts/index.ts';
import {resolveMonsterContent} from '../../packages/content/monsters.ts';
import {newAspectSchema} from '../../packages/content/aspects.ts';
import {deepProgressionConfigSchema} from '../../packages/content/deep-progression.ts';
import {stageKeyPoolSchema} from '../../apps/api/src/stage-key-pools.ts';
import {deriveMechanismPlan,pacingWritableFiles,at,put,type PacingChange} from './derive-model.ts';
export async function applyPacingChanges(root:string,changes:PacingChange[],apply=false){
 if(!apply)return {applied:false,files:[] as string[]};
 const files=[...new Set(changes.map(c=>c.file))];for(const file of files)if(!(pacingWritableFiles as readonly string[]).includes(file))throw Error('不允许写入该配置：'+file);
 const contents=Object.fromEntries(await Promise.all(files.map(async file=>[file,JSON.parse(await readFile(resolve(root,file),'utf8'))]))),counts=Object.fromEntries(files.map(file=>[file,file.endsWith('aspects.json')?contents[file].length:file.endsWith('stage-key-pools.json')?contents[file].pools.length:null]));
 for(const c of changes){if(JSON.stringify(at(contents[c.file],c.path))!==JSON.stringify(c.before))throw Error('Configuration changed since derivation: '+c.file+' '+c.path.join('.'));put(contents[c.file],c.path,c.after);}
 for(const [file,value]of Object.entries<any>(contents)){
  if(file.endsWith('monsters.json'))resolveMonsterContent(value);
  else if(file.endsWith('aspects.json')){newAspectSchema.array().parse(value);if(value.length!==counts[file]||new Set(value.map((a:any)=>a.id)).size!==value.length)throw Error('词条身份或数量变化');}
  else if(file.endsWith('deep-progression.json'))deepProgressionConfigSchema.parse(value);
  else if(file.endsWith('stage-key-pools.json')){stageKeyPoolSchema.array().parse(value.pools);if(value.pools.length!==counts[file])throw Error('钥匙池数量变化');}
 }
 for(const [file,value]of Object.entries<any>(contents))await writeFile(resolve(root,file),JSON.stringify(value,null,2)+'\n');return {applied:true,files};
}
export async function readAspectBasis(root:string,from:string){
 for(const path of [resolve(root,from,'aspects-before.json'),resolve(root,from,'../aspects-before.json')]){
  try{const aspects=newAspectSchema.array().parse(JSON.parse(await readFile(path,'utf8')));for(const target of pacingTargets.builds.filter(t=>t.profile))if(!aspects.some(a=>a.id===target.profile!.aspect))throw Error('机制快照缺少构筑词条：'+target.id);return aspects;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 throw Error('验证目录缺少机制参数快照；拒绝按空基线推导，请先生成完整验证。');
}
export async function runPacingDerive(args=process.argv.slice(2)){
 const root=resolve(import.meta.dirname,'../..'),out=resolve(root,args.find(a=>a.startsWith('--out='))?.slice(6)??'.qa/pacing/latest'),from=args.find(a=>a.startsWith('--from='))?.slice(7)??'.qa/pacing/baseline',load=async(file:string)=>JSON.parse(await readFile(resolve(root,file),'utf8'));await mkdir(out,{recursive:true});
 if(args.includes('--apply')&&args.includes('--plan')){const plan=await load(out+'/derive.json'),result=await applyPacingChanges(root,plan.changes,true);await writeFile(resolve(out,'apply.json'),JSON.stringify({...result,rules:versions.rules},null,2)+'\n');console.log(JSON.stringify(result));return plan;}
 const validation=await load(from+'/validation.json'),combat=args.includes('--recenter')?{}:await load(from+'/combat/bd-measurements.json');if(validation.versions.rules!==versions.rules)throw Error('规则版本与输入实测不匹配，拒绝旧版数据');if(args.includes('--adjust')&&validation.seeds?.length!==3)throw Error('调整必须使用三种子实测');
 if(!args.includes('--adjust'))combat.aspectsBefore=await readAspectBasis(root,from);
 const sources=Object.fromEntries(await Promise.all(pacingWritableFiles.map(async file=>[file,await load(file)]))),plan=deriveMechanismPlan(pacingTargets,validation,combat,sources,{adjustment:args.includes('--adjust'),recenter:args.includes('--recenter')}),{next,...review}=plan,result=await applyPacingChanges(root,plan.changes,args.includes('--apply'));
 await writeFile(resolve(out,'derive.json'),JSON.stringify({...review,...result,versions:{before:versions.rules,after:versions.rules},input:from},null,2)+'\n');
 await writeFile(resolve(out,'changes.md'),'# '+plan.mode+'\n\n规则版本保持'+versions.rules+'，仅C7统一升级。\n\n| 文件 | 路径 | 前 | 后 | 依据 |\n|---|---|---|---|---|\n'+plan.changes.map(c=>`| ${c.file} | ${c.path.join('.')} | ${JSON.stringify(c.before)} | ${JSON.stringify(c.after)} | ${c.reason} |`).join('\n')+'\n\n'+plan.notes.join('\n')+'\n');if(args.includes('--adjust'))await writeFile(resolve(out,'adjust.md'),'# 唯一调整\n\n'+(args.includes('--recenter')?'只改整数经验需求，战斗旋钮保持。':'只动未达标构筑；继续使用C3实测弹性，本次不做位移校正、不追加测量。')+'\n');console.log(JSON.stringify({changes:plan.changes.length,...result,out}));return plan;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await runPacingDerive();
