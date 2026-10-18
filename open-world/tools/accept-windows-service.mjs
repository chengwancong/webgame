// This deliberately interrupts this checkout's local service to verify recovery.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
import {chromium} from 'playwright';
import {root,processIdentity} from './runtime.mjs';

if(process.platform!=='win32')throw Error('Windows service acceptance requires Windows.');
const evidence=join(root,'../docs/reviews/open-world/windows-service-20260930');await mkdir(evidence,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms)),report={date:new Date().toISOString(),checks:[],errors:[]};
const record=(name,result)=>{report.checks.push({name,...result});console.log(name,JSON.stringify(result));};
async function state(){try{return JSON.parse(await readFile(join(root,'.runtime/service/state.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function status(){const s=await state();if(!s)return null;try{return await (await fetch(`http://127.0.0.1:${s.port}/status`,{headers:{authorization:`Bearer ${s.token}`},signal:AbortSignal.timeout(2500)})).json();}catch{return null;}}
async function ready(predicate=()=>true){for(let n=0;n<180;n++){const s=await status();if(s?.phase==='running'&&predicate(s))return s;await delay(250);}throw Error('Service recovery timed out');}
function manage(action){const result=spawnSync(process.execPath,['tools/local-service.mjs',action],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;}
async function databaseSnapshot(){
 const lines=(await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split('\n');
 const client=new Client({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres'});await client.connect();
 try{
  const id=(await client.query('SELECT system_identifier FROM pg_control_system()')).rows[0].system_identifier;
  const tables={};for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger']){
   const rows=(await client.query(`SELECT row_to_json(t)::text AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows;
   tables[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
  }return {cluster:id,tables};
 }finally{await client.end();}
}
try{
 const initial=await ready(),before=await databaseSnapshot();record('initial-http-and-database',{phase:initial.phase,database:before});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];const failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!(r.status()===401&&new URL(r.url()).pathname==='/api/character'))failures.push({url:r.url(),status:r.status()});});
  await page.goto('http://127.0.0.1:8612/');await page.locator('#username').waitFor();await page.waitForTimeout(2000);
  assert.ok(await page.locator('canvas').count()>0);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  await page.screenshot({path:join(evidence,'login-1280x720.png')});record('chrome-page',{canvas:true,pageErrors:errors,failedResponses:failures});
 }finally{await browser.close();}
 const catalog=JSON.parse(await readFile(join(root,'packages/asset-manifest/catalog.json'),'utf8'));
 const ui=JSON.parse(await readFile(join(root,'packages/asset-manifest/ui.v2.json'),'utf8'));
 const paths=[...Object.keys(catalog.actors).flatMap(key=>[`/art/${key}.png`,`/art/${key}.json`]),...Object.values(ui.assets).map(asset=>asset.path),'/art/NotoSansSC.ttf'];
 for(const path of paths)assert.equal((await fetch('http://127.0.0.1:8612'+path)).status,200,path);
 record('served-resources',{count:paths.length});
 const apiPid=initial.components.api;assert.ok(processIdentity(apiPid).includes('apps/api/src/main.ts'));process.kill(apiPid,'SIGKILL');
 const recovered=await ready(s=>s.components.api!==apiPid);assert.deepEqual(await databaseSnapshot(),before);record('api-crash-recovery',{oldPid:apiPid,newPid:recovered.components.api,restarts:recovered.restarts,dataUnchanged:true});
 const parent=await state();assert.ok(processIdentity(parent.pid).includes('windows-service-runner.mjs'));process.kill(parent.pid,'SIGKILL');
 const supervisor=await ready(s=>s.pid!==parent.pid);assert.deepEqual(await databaseSnapshot(),before);record('supervisor-crash-recovery',{oldPid:parent.pid,newPid:supervisor.pid,dataUnchanged:true});
 manage('stop');assert.equal(await state(),null);await access(join(root,'.runtime/dev/data/PG_VERSION'));
 try{await access(join(root,'.runtime/dev/data/postmaster.pid'));assert.fail('Database still has a PID file');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const url of ['http://127.0.0.1:8611/api/health','http://127.0.0.1:8612/']){
  let available=false;try{available=(await fetch(url,{signal:AbortSignal.timeout(1500)})).ok;}catch{}assert.equal(available,false);
 }record('graceful-stop',{httpStopped:true,databaseStopped:true,dataRetained:true});
 const builtUi=spawnSync('python3',['-X','utf8','tools/build_ui_v2.py'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(builtUi.status,0,builtUi.stderr);
 const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(built.status,0,built.stderr);record('release-build',{ok:true});
 manage('start');await ready();assert.deepEqual(await databaseSnapshot(),before);record('start-after-build',{dataUnchanged:true});
 manage('restart');await ready();assert.deepEqual(await databaseSnapshot(),before);record('explicit-restart',{dataUnchanged:true});
 report.ok=true;
}catch(e){report.ok=false;report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{
 // Keep the user's service available even if an acceptance assertion fails.
 if((await status())?.phase!=='running')try{manage('start');}catch(e){report.errors.push('Restore service: '+e.message);}
 await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2)+'\n');
}
