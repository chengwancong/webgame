import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {createServer} from 'vite';
import {startDatabase,freePort,stopChild,waitFor,registerApi,root} from '../runtime.mjs';
const out=resolve(root,'docs/reviews/pacing-tool-20261010/P4-gui');await mkdir(out,{recursive:true});const db=await startDatabase({temporary:true});
const production=resolve(db.work,'production'),ports={api:await freePort(),web:await freePort(),prodApi:await freePort()},url='http://127.0.0.2:'+ports.web,prodUrl='http://127.0.0.1:'+ports.prodApi,owner=new Pool({connectionString:db.dsn});
let api,prodApi,web,closing=false;
const report=resolve(root,'docs/reviews/pacing-tool-20261010/P4/validation/validation.json');
async function serve(prod=false){const port=prod?ports.prodApi:ports.api,dsn=prod?db.dsn.replace('/postgres','/pacing_production'):db.dsn,log=await open(resolve(out,prod?'production-api.log':'api.log'),'a'),p=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:dsn,AW_API_PORT:String(port),AW_ORIGINS:prod?prodUrl:url+',http://127.0.0.1:'+port,AW_STATIC_ROOT:production,AW_TEST_LOGIN:prod?'0':'1',AW_FIELD_QA:'0',NODE_ENV:prod?'production':'development',AW_ISOLATED:'1',AW_PACING_LAB:prod?'0':'1',AW_PACING_REPORT:report},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();await waitFor('http://127.0.0.1:'+port+'/api/health',p);return p;}
async function stop(){if(closing)return;closing=true;await web?.close();await stopChild(api);await stopChild(prodApi);await owner.end();await writeFile(resolve(out,'cleanup.json'),JSON.stringify(await db.stop(),null,2));}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void stop().then(()=>process.exit()));
try{
 await owner.query('CREATE DATABASE pacing_production');api=await serve();await registerApi(db,api);prodApi=await serve(true);await registerApi(db,prodApi,'productionApi');
 web=await createServer({configFile:resolve(root,'apps/web/vite.config.ts'),define:{'import.meta.env.VITE_PACING_TOOL':JSON.stringify('1')},cacheDir:resolve(db.work,'vite'),server:{host:'127.0.0.2',port:ports.web,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:'+ports.api,ws:true}}}});await web.listen();
 await writeFile(resolve(out,'host.json'),JSON.stringify({ownerPid:process.pid,work:db.work,dsn:db.dsn,productionDsn:db.dsn.replace('/postgres','/pacing_production'),ports,url,prodUrl,production,report},null,2));await writeFile(resolve(out,'control.json'),'{"reload":0,"stop":false}');console.log('PACING_GUI_READY '+url);let revision=0;
 while(!closing){const control=JSON.parse(await readFile(resolve(out,'control.json'),'utf8'));if(control.stop)break;if(control.reload!==revision){await stopChild(api);await stopChild(prodApi);api=await serve();await registerApi(db,api);prodApi=await serve(true);await registerApi(db,prodApi,'productionApi');revision=control.reload;console.log('PACING_API_RELOADED '+revision);}await new Promise(r=>setTimeout(r,500));}
}finally{await stop();}
