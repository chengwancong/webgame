// Owns only this acceptance run: independent PostgreSQL, historical sources,
// two Vite previews and API processes. Never adopts the normal 8612 database.
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,cp,symlink,writeFile,readFile,open,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {createServer} from 'vite';
import {startDatabase,freePort,stopChild,waitFor,registerApi,root} from './runtime.mjs';
const out=resolve(root,process.env.AW_COPY_REVIEW_DIR??'docs/reviews/copy-voice-20261009');
await mkdir(out,{recursive:true});
const db=await startDatabase({temporary:true});
const before=resolve(db.work,'before/open-world'),owner=new Pool({connectionString:db.dsn});
let oldApi,newApi,oldWeb,newWeb,closing=false;
const production=resolve(db.work,'production');
async function api(cwd,dsn,port,url,name){
 const log=await open(resolve(out,name+'.log'),'a');
 const process=spawn(globalThis.process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd,env:{...globalThis.process.env,AW_DATABASE_URL:dsn,AW_API_PORT:String(port),AW_TEST_LOGIN:'1',AW_FIELD_QA:'0',AW_ORIGINS:url+',http://127.0.0.1:'+port,AW_STATIC_ROOT:production},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});
 await log.close();await waitFor(`http://127.0.0.1:${port}/api/health`,process);return process;
}
async function stop(){
 if(closing)return;closing=true;
 await newWeb?.close();await oldWeb?.close();await stopChild(newApi);await stopChild(oldApi);await owner.end();
 const cleanup=await db.stop();await writeFile(resolve(out,'cleanup.json'),JSON.stringify(cleanup,null,2));
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void stop().then(()=>process.exit()));
try{
 await mkdir(before,{recursive:true});
 for(const dir of ['apps/api/src','apps/web/src','packages','config/json'])await cp(resolve(root,dir),resolve(before,dir),{recursive:true,filter:src=>!src.replaceAll('\\','/').includes('/node_modules')});
 for(const file of ['vite.config.ts','token-media.ts',...(await readdir(resolve(root,'apps/web'))).filter(f=>f.endsWith('.html'))])await cp(resolve(root,'apps/web',file),resolve(before,'apps/web',file));
 if(!process.argv.includes('--current-baseline')){
 const archive=resolve(db.work,'before.tar');
 const archived=spawnSync('git',['archive','--format=tar','--output',archive,'7956a4f','open-world/apps/web/src','open-world/apps/web/index.html','open-world/packages/simulation/combat-review.ts','open-world/apps/api/src/dungeon-diagnostics.ts','open-world/apps/api/src/stage-key-preview.ts','open-world/apps/api/src/stage-key-pools.json','open-world/apps/api/src/stage-key-service.ts','open-world/packages/rules/world-tier.ts','open-world/packages/contracts/open-world.ts','open-world/packages/content/world-tiers.json','open-world/packages/contracts/dungeons.ts'],{cwd:resolve(root,'..'),encoding:'utf8',windowsHide:true});
 if(archived.status!==0)throw Error(archived.stderr);
 const extracted=spawnSync('tar',['-xf',archive,'-C',resolve(db.work,'before')],{encoding:'utf8',windowsHide:true});if(extracted.status!==0)throw Error(extracted.stderr);
 // Historical dungeon contracts predate the public retry tier field.
 const oldDungeon=resolve(before,'apps/api/src/dungeon-service.ts');
 await writeFile(oldDungeon,(await readFile(oldDungeon,'utf8')).replace('challengeTier:s.tier,',''));
 // Keep the existing task-list integration compatible; reverse only this batch's
 // system labels. Quest and dialogue content remains the shared Excel export.
 const tasks=await readFile(resolve(root,'apps/web/src/task-panel.ts'),'utf8');
 await writeFile(resolve(before,'apps/web/src/task-panel.ts'),tasks.replaceAll('领取中','处理中').replaceAll('看新任务','查看刚入档任务 ›').replaceAll('重新连接','恢复连接并核对'));
 }
 await symlink(resolve(root,'node_modules'),resolve(before,'node_modules'),'junction');
 await symlink(resolve(root,'apps/web/public'),resolve(before,'apps/web/public'),'junction');
 for(const name of ['copy_before','copy_regression','copy_regression_short','copy_regression_earned'])await owner.query('CREATE DATABASE '+name);
 const ports={beforeApi:await freePort(),afterApi:await freePort(),beforeWeb:await freePort(),afterWeb:await freePort()};
 const urls={before:`http://127.0.0.2:${ports.beforeWeb}`,after:`http://127.0.0.2:${ports.afterWeb}`};
 const beforeDsn=db.dsn.replace('/postgres','/copy_before');
 oldApi=await api(before,beforeDsn,ports.beforeApi,urls.before,'api-before');
 newApi=await api(root,db.dsn,ports.afterApi,urls.after,'api-after');await registerApi(db,newApi);
 const preview=async(cwd,port,apiPort)=>{
  const web=await createServer({configFile:resolve(cwd,'apps/web/vite.config.ts'),cacheDir:resolve(cwd,'.vite-copy'),server:{host:'127.0.0.2',port,strictPort:true,fs:{allow:[cwd,root]},proxy:{'/api':{target:`http://127.0.0.1:${apiPort}`,ws:true}}}});await web.listen();return web;
 };
 oldWeb=await preview(before,ports.beforeWeb,ports.beforeApi);newWeb=await preview(root,ports.afterWeb,ports.afterApi);
 const info={currentBaseline:process.argv.includes('--current-baseline'),ownerPid:process.pid,work:db.work,dsn:db.dsn,beforeDsn,before,production,ports,urls};
 await writeFile(resolve(out,'host.json'),JSON.stringify(info,null,2));
 await writeFile(resolve(out,'host-control.json'),JSON.stringify({reload:0,stop:false}));
 console.log('COPY_GUI_READY '+JSON.stringify({urls,dsn:db.dsn,production}));
 let revision=0;
 while(!closing){
  const control=JSON.parse(await readFile(resolve(out,'host-control.json'),'utf8'));
  if(control.stop)break;
  if(control.reload!==revision){await stopChild(newApi);newApi=await api(root,db.dsn,ports.afterApi,urls.after,'api-after');await registerApi(db,newApi);revision=control.reload;console.log('API_RELOADED '+revision);}
  await new Promise(r=>setTimeout(r,500));
 }
}finally{await stop();}
