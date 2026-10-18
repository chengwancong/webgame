/** 仅本次子进程使用真实python3；不修改系统PATH或商店别名。 */
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,dirname,relative,delimiter} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..'),[python,output,...command]=process.argv.slice(2);
if(!python||!output||!command.length)throw Error('用法：with-python.mjs 实际Python路径 本期输出目录 node命令及参数');
const out=resolve(root,output);if(!relative(resolve(root,'docs/reviews/numeric-spine-20261013'),out)||relative(resolve(root,'docs/reviews/numeric-spine-20261013'),out).startsWith('..'))throw Error('必须使用本期子目录');
await mkdir(out,{recursive:true});await mkdir(join(root,'.qa'),{recursive:true});const work=await mkdtemp(join(root,'.qa/spine-python-command-'));
try{
 await copyFile(resolve(python),join(work,'python3.exe'));
 const pythonHome=execFileSync(python,['-c','import sys; print(sys.base_prefix)'],{encoding:'utf8',windowsHide:true}).trim();
 const env={...process.env,AW_PYTHON:resolve(python),PYTHONHOME:pythonHome,PYTHONDONTWRITEBYTECODE:'1',PATH:[work,dirname(resolve(python)),process.env.PATH??''].join(delimiter)};
 const version=execFileSync(join(work,'python3.exe'),['--version'],{env,encoding:'utf8',windowsHide:true}).trim();
 await writeFile(join(out,'python-environment.json'),JSON.stringify({python:resolve(python),version,pythonHome,command,temporaryShim:work},null,2)+'\n');
 const child=spawn(command[0]==='node'?process.execPath:command[0],command.slice(1),{cwd:root,env,stdio:'inherit',windowsHide:true});
 process.exitCode=Number(await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);}));
}finally{
 if(relative(join(root,'.qa'),work).startsWith('..')||!work.includes('spine-python-command-'))throw Error('拒绝清理未验证的解释器目录');
 await rm(work,{recursive:true});await writeFile(join(out,'python-cleanup.json'),JSON.stringify({removed:work,remainingBytes:0},null,2)+'\n');
}
