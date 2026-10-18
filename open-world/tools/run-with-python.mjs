/** 为本次子进程提供真实Python与python3别名，退出后清理自有临时目录。 */
import {mkdir,mkdtemp,copyFile,realpath,writeFile,rm} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute,delimiter} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const root=await realpath(resolve(import.meta.dirname,'..')),[python,output,...command]=process.argv.slice(2);
if(!python||!output||!command.length)throw Error('用法：node tools/run-with-python.mjs Python路径 本地输出目录 命令及参数');
const out=resolve(root,output),outRelative=relative(root,out);if(outRelative.startsWith('..')||isAbsolute(outRelative))throw Error('输出目录必须在仓库中');
await mkdir(join(root,'.qa'),{recursive:true});await mkdir(out,{recursive:true});const work=await mkdtemp(join(root,'.qa','crafting-python-'));
try{
 await copyFile(resolve(python),join(work,'python3.exe'));
 const pythonHome=execFileSync(python,['-c','import sys; print(sys.base_prefix)'],{encoding:'utf8',windowsHide:true}).trim(),env={...process.env,AW_PYTHON:resolve(python),PYTHONHOME:pythonHome,PYTHONDONTWRITEBYTECODE:'1',PATH:[work,dirname(resolve(python)),process.env.PATH??''].join(delimiter)};
 const version=execFileSync(join(work,'python3.exe'),['--version'],{env,encoding:'utf8',windowsHide:true}).trim();
 await writeFile(join(out,'environment.json'),JSON.stringify({python:resolve(python),version,command},null,2)+'\n');
 const windowsCommand=process.platform==='win32'&&command[0].endsWith('.cmd'),executable=windowsCommand?'cmd.exe':command[0]==='node'?process.execPath:command[0],args=windowsCommand?['/d','/c',...command]:command.slice(1);
 const child=spawn(executable,args,{cwd:root,env,stdio:'inherit',windowsHide:true});process.exitCode=Number(await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);}));
}finally{
 const target=await realpath(work),inside=relative(join(root,'.qa'),target);if(inside.startsWith('..')||isAbsolute(inside)||!inside.startsWith('crafting-python-'))throw Error('拒绝清理未证明归属的目录');
 await rm(target,{recursive:true});await writeFile(join(out,'cleanup.json'),JSON.stringify({shimRemoved:true,exitCode:process.exitCode??0})+'\n');
}
