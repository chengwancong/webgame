import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolveTargets} from './targets.ts';
const python=process.env.AW_PYTHON??'python';
if(process.argv.includes('--export')){
 for(const args of [['-X','utf8','tools/spine/workbook.py'],['-X','utf8','tools/config-export.py']]){const run=spawnSync(python,args,{stdio:'inherit',windowsHide:true});if(run.status!==0)throw Error('目标导出失败');}
}
const check=spawnSync(python,['-X','utf8','tools/config-export.py','--check'],{stdio:'inherit',windowsHide:true});if(check.status!==0)throw Error('Excel/JSON不一致');
const data=JSON.parse(await readFile('config/json/spine-targets.json','utf8')),result=resolveTargets(data.targets);
await writeFile('docs/reviews/numeric-spine-20261013/S0/targets-summary.json',JSON.stringify({rows:result.selected.length,locked:result.selected.filter(r=>r.locked).length,conflicts:result.conflicts,source:data.source,command:'pnpm spine:targets'},null,2)+'\n');
console.log('主干目标校验通过：'+result.selected.length+'行，冲突'+result.conflicts.length+'项');
