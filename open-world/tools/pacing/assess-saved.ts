import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assessPacingMatrix} from './validate.ts';
const dir=resolve(process.argv.find(a=>a.startsWith('--in='))?.slice(5)??'.qa/pacing/latest'),file=resolve(dir,'validation.json'),report=JSON.parse(await readFile(file,'utf8'));
report.matrix=assessPacingMatrix(report.matrix);report.bdPassed=report.matrix.every((r:any)=>r.scenePassed&&r.budgetPassed&&r.mechanismPassed&&!r.failures.length);report.accepted=report.bdPassed&&report.calendarPassed&&!report.errors.length;
report.limits=report.limits.map((s:string)=>s.startsWith('机制规则须')?'机制规则须在预先声明的目标场景、全部三个种子中真实触发；不追加任何战斗。':s);
await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({recomputedOnly:true,samples:report.samples,bdPassed:report.bdPassed}));
