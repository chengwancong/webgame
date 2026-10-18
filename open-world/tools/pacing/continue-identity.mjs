import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),base='docs/reviews/pacing-identity-20261013',out=resolve(root,base);
const load=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
async function progress(batch,text,next){const file=resolve(out,'progress.md');let s=await readFile(file,'utf8');s=s.replace('- [ ] '+batch,'- [x] '+batch+'：'+text).replace(/状态：[^\n]+/,'状态：'+batch+' 已完成，连续执行下一步。');s=s.slice(0,s.indexOf('```powershell'))+'```powershell\n'+next+'\n```\n';await writeFile(file,s);}
async function run(command,args,log,expectedNumericFailure=false){await mkdir(resolve(out,log,'..'),{recursive:true});const handle=await open(resolve(out,log),'w');const child=spawn(command,args,{cwd:root,stdio:['ignore',handle.fd,handle.fd],windowsHide:true,shell:command.endsWith('.cmd')});await handle.close();const code=await new Promise((yes,no)=>{child.once('error',no);child.once('exit',yes);});if(code&&!expectedNumericFailure)throw Error('命令失败，先排查并继续：'+command+' '+args.join(' ')+'，见 '+log);}
async function validation(batch,from,log,timeline=false){await run('pnpm.cmd',['pacing:validate',...(timeline?['--timeline-only']:[]),'--out='+from],log,true);const data=await load(from+'/validation.json');if(data.errors.length||data.samples.naturalRoutes!==3||!timeline&&data.samples.controlledCombats!==240)throw Error('验证运行未完整，禁止视为数值残差：'+from);return data;}
async function plan(batch,from,adjust=false,recenter=false){const dir=base+'/'+batch;await run('pnpm.cmd',['pacing:derive',...(adjust?['--adjust']:[]),...(recenter?['--recenter']:[]),'--from='+from,'--out='+dir],batch+'/derive.log');await run('pnpm.cmd',['pacing:derive','--apply','--plan','--out='+dir],batch+'/apply.log');return load(dir+'/derive.json');}
// 该驱动只从已完成C3基线继续一次；中断后严格按progress.md恢复，禁止重启整条链。
const baseline=await load(base+'/C3/baseline/validation.json');if(baseline.errors.length||baseline.samples.controlledCombats!==240||baseline.samples.naturalRoutes!==3)throw Error('C3基线不完整');
await run('npx.cmd',['tsx','tools/pacing/diagnose-identity.ts'],'C0/diagnosis.log');
await run('pnpm.cmd',['pacing:marginals','--from='+base+'/C3/baseline','--out='+base+'/C3/marginals'],'C3/marginals.log');
const marginals=await load(base+'/C3/marginals/marginals.json');
await progress('C3',`三种子240场完整/消融；升级中位数${baseline.virtualMinutes}；${marginals.knobs.length}旋钮各一次扰动，锚点已冻结。`,'pnpm pacing:derive --from='+base+'/C3/baseline --out='+base+'/C4');
let decisions=await readFile(resolve(out,'decisions.md'),'utf8');for(const row of baseline.matrix)for(const c of row.mechanismChecks)if(!c.passed)decisions+='\n| 2026-10-13 | C3 '+row.bd+' '+c.rule+'目标场景未覆盖 | '+JSON.stringify(c.diagnostics)+'；结构已冻结，记录残差，不改结构、不重跑 | C3/baseline/validation.json |';await writeFile(resolve(out,'decisions.md'),decisions+'\n');
const first=await plan('C4',base+'/C3/baseline');await progress('C4',`唯一推导已应用，${first.changes.length}处参数/描述差量；uncontrollable ${first.uncontrollable.length}项。`,'pnpm pacing:validate --out='+base+'/C5/validation');
const fifth=await validation('C5',base+'/C5/validation','C5/validation.log');const adjustment=await plan('C5/adjust',base+'/C5/validation',true);await progress('C5',`三种子验证；唯一战斗调整已应用，${adjustment.changes.length}处差量，未改经验曲线。`,'pnpm pacing:validate --out='+base+'/C6/validation');
const sixth=await validation('C6',base+'/C6/validation','C6/validation.log');let timeline=sixth;
if(Math.abs(sixth.virtualMinutes/240-1)>.05){await plan('C6/recenter',base+'/C6/validation',true,true);timeline=await validation('C6',base+'/C6/timeline','C6/timeline.log',true);}
await writeFile(resolve(out,'C6/numeric-result.json'),JSON.stringify({combat:sixth.matrix.map(r=>({bd:r.bd,budget:r.budget,budgetPassed:r.budgetPassed,scenePassed:r.scenePassed,mechanismPassed:r.mechanismPassed})),calendar:timeline.calendarRange},null,2)+'\n');
let s=await readFile(resolve(out,'progress.md'),'utf8');s=s.replace(/状态：[^\n]+/,'状态：C6数值复验与唯一升级重定中心已完成，执行全量回归与正式构建。');s=s.slice(0,s.indexOf('```powershell'))+'```powershell\nnode tools/pacing/run-tests.mjs '+base+'/C6 --all\nnpx tsc --noEmit -p tsconfig.json\nnode tools/pacing/build-isolated.mjs --out='+base+'/C6/build --keep\n```\n';await writeFile(resolve(out,'progress.md'),s);
await run(process.execPath,['tools/pacing/run-tests.mjs',base+'/C6','--all'],'C6/test-driver.log');
await run('npx.cmd',['tsc','--noEmit','-p','tsconfig.json'],'C6/tsc.log');
await run(process.execPath,['tools/pacing/build-isolated.mjs','--out='+base+'/C6/build','--keep'],'C6/build-driver.log');
await progress('C6',`三种子复验；升级最终中位数${timeline.virtualMinutes}，范围${timeline.calendarRange.min}–${timeline.calendarRange.max}；全量回归、tsc、隔离正式构建通过。`,'完成C7报告、ow-69→ow-70统一升级与差量提交');
console.log('C3→C6串行执行完成。');
