/** 原测试逐字复制到自有目录，修复Windows python3商店别名；不改测试/断言/共享证据。 */
import {mkdtemp,mkdir,readFile,writeFile,copyFile,symlink,rmdir,rm,open} from 'node:fs/promises';
import {resolve,join,relative,dirname,basename,delimiter} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startDatabase,root} from '../runtime.mjs';
const python=process.argv[2];if(!python)throw Error('必须提供实际Python可执行文件绝对路径');
const out=resolve(root,'docs/reviews/numeric-spine-20261013/S8/python-retry');await mkdir(out,{recursive:true});
const work=await mkdtemp(join(root,'.qa/spine-python-')),links=[],files=['world-island-quest-config.test.ts','world-phase-config.test.ts','world-production.database.test.ts'];let db;
const verify=()=>{if(relative(join(root,'.qa'),work).startsWith('..')||!basename(work).startsWith('spine-python-'))throw Error('拒绝清理未验证目录');};
const hashes=[];let code=1;
try{
 await writeFile(join(work,'owner.json'),JSON.stringify({tool:'numeric-spine-python-retry',root,out}));
 for(const folder of ['node_modules','packages','apps','tools','config','assets']){const path=join(work,folder);await symlink(join(root,folder),path,'junction');links.push(path);}
 await mkdir(join(work,'tests'));const fixtures=join(work,'tests/fixtures');await symlink(join(root,'tests/fixtures'),fixtures,'junction');links.push(fixtures);
 for(const file of [...files,'review-path.ts']){const source=join(root,'tests',file),target=join(work,'tests',file);await copyFile(source,target);const a=await readFile(source),b=await readFile(target);if(!a.equals(b))throw Error('测试复制不一致');hashes.push({file,sha256:createHash('sha256').update(a).digest('hex')});}
 await writeFile(join(work,'package.json'),JSON.stringify({type:'module',private:true}));
 await writeFile(join(work,'vitest.config.mjs'),'export default '+JSON.stringify({cacheDir:join(work,'.vite'),test:{maxWorkers:1,fileParallelism:false}})+';\n');
 const shim=join(work,'python-bin');await mkdir(shim);await copyFile(resolve(python),join(shim,'python3.exe'));
 const pythonHome=execFileSync(python,['-c','import sys; print(sys.base_prefix)'],{encoding:'utf8',windowsHide:true}).trim();
 const env={...process.env,AW_PYTHON:resolve(python),PYTHONHOME:pythonHome,PYTHONDONTWRITEBYTECODE:'1',PATH:[shim,dirname(resolve(python)),process.env.PATH??''].join(delimiter),AW_REVIEW_ROOT:join(out,'world-reviews')};
 const shimVersion=execFileSync(join(shim,'python3.exe'),['--version'],{env,encoding:'utf8',windowsHide:true}).trim();
 db=await startDatabase({temporary:true,reap:false});if(db.port===8612)throw Error('拒绝8612');
 env.AW_DATABASE_URL=db.dsn;
 await writeFile(join(out,'environment.json'),JSON.stringify({temporary:true,port:db.port,work,python:resolve(python),pythonHome,shimVersion,unmodifiedTests:hashes,method:'原测试逐字复制，自有cwd内写证据；python3.exe为实际解释器副本，全部检查器和World/PG真实运行'},null,2)+'\n');
 const log=await open(join(out,'tests.log'),'w'),child=spawn(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run','--config',join(work,'vitest.config.mjs'),'--maxWorkers=1','--no-file-parallelism',...files.map(f=>'tests/'+f)],{cwd:work,env,stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();
 code=Number(await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);}));
 try{await copyFile(join(work,'docs/reviews/open-world-m2-m4/W4/config-deliberate-breaks.json'),join(out,'config-deliberate-breaks.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(join(out,'test-result.json'),JSON.stringify({passed:code===0,exitCode:code,unmodifiedTests:hashes},null,2)+'\n');
}finally{
 const database=db?await db.stop():{notStarted:true};verify();const owner=JSON.parse(await readFile(join(work,'owner.json'),'utf8'));if(owner.tool!=='numeric-spine-python-retry'||owner.root!==root)throw Error('目录所有权不匹配');
 for(const path of links.reverse())await rmdir(path);await rm(work,{recursive:true});
 await writeFile(join(out,'cleanup.json'),JSON.stringify({database,removedWorkspace:work},null,2)+'\n');
}
process.exitCode=code;
