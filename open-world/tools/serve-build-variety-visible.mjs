// Disposable fixtures and a real API for the visible Codex browser. This tool
// does not launch, hide or automate a browser, and never writes to the live DB.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {startDatabase,freePort,child,registerApi,stopChild,waitFor} from './runtime.mjs';
import {makeGearByBase} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
const out=resolve('docs/reviews/build-variety-rs-20261006/visible');await mkdir(out,{recursive:true});
const db=await startDatabase({temporary:true}),port=await freePort(),origin=`http://localhost:${port}`,dist=resolve(db.work,'visible-client');let api,pool;
async function build(){const p=child(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',dist],{},{stdio:['ignore','ignore','inherit']});if(await new Promise(r=>p.once('exit',r))!==0)throw Error('Visible client build failed');}
async function start(){api=child(process.execPath,['--import','tsx','tools/build-variety-visible-api.mjs'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_STATIC_ROOT:dist,AW_VISIBLE_WORK:db.work},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(origin+'/api/health',api);}
const report={origin,username:'bv_visible_rs_20261006',scope:'controlled level/wallet/gear fixture; meadow normal target HP200000, attack0, distance1.8; actual visible browser login, activation, equipment and battle commands; not natural progression or balance measurement',versions};
async function request(path,body,cookie){const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});if(!r.ok)throw Error(path+': '+await r.text());return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
let closing=false;async function close(){if(closing)return;closing=true;await stopChild(api);await pool?.end();report.cleanup=await db.stop();await writeFile(out+'/server.json',JSON.stringify(report,null,2)+'\n');process.exit(process.exitCode??0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
try{
 await build();await start();pool=new Pool({connectionString:db.dsn,max:1});
 const login=await request('session/login',{username:report.username}),created=await request('character',{name:'流派实机验收'},login.cookie);report.character=created.data.id;
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[report.character])).rows[0].state;delete state.starsea;state.story={version:1,legacyAccess:true,events:{},choices:{}};state.level=50;state.gold=10000000;state.material=100000;state.lastRegion='town';state.progress.safe='town';state.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];
 report.originalGear=structuredClone(state.gear);report.weapons=['standard-sword-t1-weapon','standard-hammer-t1-weapon','standard-axe-t1-weapon','bow','standard-staff-t1-weapon','standard-hidden-t1-weapon','standard-wand-t1-weapon'].map(base=>makeGearByBase(base,randomUUID()));state.gear.push(...report.weapons);
 const armor=state.gear.find(g=>g.id===state.equipment.armor);armor.affixes=[{id:'controlled-hp',name:'受控生命',stat:'hp',tier:3,value:100000,description:'受控生命 +100000'},{id:'controlled-mana',name:'受控能量',stat:'mana',tier:3,value:10000,description:'受控能量 +10000'}];state.revision++;state.build++;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,report.character]);await writeFile(out+'/server.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ready:true,origin,username:report.username,versions,commands:['reload','stop']}));
 // Keep the fixture supervisor alive even if an executor closes its stdin;
 // otherwise other QA runs correctly reap it as an orphan during API reload.
 setInterval(()=>{},1000);
 const input=createInterface({input:process.stdin});let queue=Promise.resolve();input.on('line',line=>{queue=queue.then(async()=>{if(line.trim()==='stop')return close();if(line.trim()==='reload'){await stopChild(api);await build();await start();console.log(JSON.stringify({ready:true,origin,reloaded:true}));}}).catch(e=>console.error(e));});await new Promise(()=>{});
}catch(e){console.error(e);process.exitCode=1;await close();}
