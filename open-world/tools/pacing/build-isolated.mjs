import {cp,mkdir,mkdtemp,readFile,writeFile,symlink,open,rm,rmdir,lstat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,relative,basename} from 'node:path';
import {spawn} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..'),args=process.argv.slice(2),out=resolve(root,args.find(a=>a.startsWith('--out='))?.slice(6)??'.qa/pacing/build'),stampOnly=args.includes('--stamp-only'),keep=args.includes('--keep')&&!stampOnly;
await mkdir(out,{recursive:true});await mkdir(join(root,'.qa'),{recursive:true});
let work,source,passed=false;
const location=join(out,'build-location.json');
if(stampOnly){
 const saved=JSON.parse(await readFile(location,'utf8'));work=resolve(saved.work);source=resolve(saved.source);
 if(saved.tool!=='pacing-isolated-build'||saved.root!==root||saved.out!==out||source!==join(work,'source'))throw Error('构建来源或所有权不匹配');
}else{
 work=await mkdtemp(join(root,'.qa/pacing-build-'));source=join(work,'source');await mkdir(source);
 await writeFile(location,JSON.stringify({tool:'pacing-isolated-build',root,out,work,source},null,2)+'\n');
}
function verifyWork(){if(!work.startsWith(join(root,'.qa')+'\\')&&!work.startsWith(join(root,'.qa')+'/')||!basename(work).startsWith('pacing-build-'))throw Error('拒绝操作未验证的构建目录');}
verifyWork();if((await lstat(work)).isSymbolicLink())throw Error('拒绝使用链接构建目录');
const marker=join(work,'pacing-build-owner.json');
if(stampOnly){const owner=JSON.parse(await readFile(marker,'utf8'));if(owner.tool!=='pacing-isolated-build'||owner.out!==out||owner.root!==root)throw Error('拒绝接管其他构建');}
else await writeFile(marker,JSON.stringify({tool:'pacing-isolated-build',out,root}));
const exclude=new Set(['node_modules','.qa','.git','dist','.vite','.vite-copy','source-before']);
try{
 if(stampOnly)for(const file of ['packages/contracts/index.ts','packages/content/aspects.json'])await cp(join(root,file),join(source,file));
 else{
  for(const folder of ['apps','packages','assets','config','tools','tests','docs'])await cp(join(root,folder),join(source,folder),{recursive:true,dereference:true,filter:path=>!relative(root,path).split(/[\\/]/).some(part=>exclude.has(part))});
  for(const file of ['package.json','pnpm-lock.yaml','tsconfig.json'])await cp(join(root,file),join(source,file));
  await symlink(join(root,'node_modules'),join(source,'node_modules'),'junction');
 }
 const command=stampOnly?['exec','vite','build','--config','apps/web/vite.config.ts']:['build'];
 const log=await open(join(out,stampOnly?'version-build.log':'build.log'),'w'),child=spawn(process.platform==='win32'?'pnpm.cmd':'pnpm',command,{cwd:source,env:{...process.env,VIPS_CONCURRENCY:'1',UV_THREADPOOL_SIZE:'1'},stdio:['ignore',log.fd,log.fd],windowsHide:true,shell:process.platform==='win32'});await log.close();
 const code=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);});if(code!==0)throw Error('正式构建失败，见 '+out);
 const {readdir}=await import('node:fs/promises'),files=[];async function scan(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await scan(path);else if(/\.(js|html)$/.test(entry.name))files.push(path);}}await scan(join(source,'apps/web/dist'));
 const forbidden=['pacing-panel','pacing-lab-panel','data-pacing','/api/pacing/view','节奏实验'],hits=[];
 const rules=(await readFile(join(source,'packages/contracts/index.ts'),'utf8')).match(/rules:'([^']+)'/)?.[1];if(!rules)throw Error('没有找到构建规则版本');let rulesIncluded=false;
 for(const path of files){const text=await readFile(path,'utf8');rulesIncluded||=text.includes(rules);for(const term of forbidden)if(text.includes(term))hits.push({file:relative(source,path),term});}
 if(hits.length)throw Error('正式包残留实验入口：'+JSON.stringify(hits));if(!rulesIncluded)throw Error('正式包未包含实际规则版本');
 await writeFile(join(out,'build.json'),JSON.stringify({passed:true,command:stampOnly?'pnpm build + B6最终vite构建':'pnpm build',isolated:true,source:work,files:files.length,forbidden,hits,rules,rulesIncluded,fullBuildPassed:true,finalVersionBuild:stampOnly},null,2)+'\n');passed=true;
 console.log(JSON.stringify({passed:true,files:files.length,hits,rules,retained:keep}));
}finally{
 verifyWork();
 if(keep&&passed)await writeFile(join(out,'build-cleanup.json'),JSON.stringify({temporary:true,retained:work,pendingFinalVersionBuild:true},null,2)+'\n');
 else{
  // 先移除自身创建的依赖链接，绝不递归进入共享依赖目录。
  if(existsSync(join(source,'node_modules')))await rmdir(join(source,'node_modules'));
  await rm(work,{recursive:true});if(existsSync(work))throw Error('自有构建目录未清理');
  await writeFile(join(out,'build-cleanup.json'),JSON.stringify({temporary:true,removed:work,bytes_after:0},null,2)+'\n');
 }
}
