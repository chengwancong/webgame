// Compiled-client and live-service acceptance. Controlled fixtures stay in an isolated database.
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {startDatabase,root,freePort,child,stopChild,registerApi,waitFor} from './runtime.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
import {versions,gearSchema} from '../packages/contracts/index.ts';
import {makeGearByBase} from '../packages/rules/index.ts';
import {applyItemPower,stageForItemLevel} from '../packages/rules/item-power.ts';
import {affixDefinitions,maxAffixTierForItemLevel} from '../packages/rules/affix-generator.ts';

const out=resolve(root,'docs/reviews/build-variety-r0-20261006');await mkdir(out,{recursive:true});
const report={ok:false,versions,viewport:{width:1280,height:720},scope:'real Chrome, compiled client, HTTP, isolated PostgreSQL; live managed login and saved-instance audit',errors:[],rerolls:[]};
let database,server,browser,pool,page,lastLease;
async function login(origin,username){
 await page.goto(origin);await page.locator('#username').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-action=login]').disabled);assert.equal(await page.locator('#password').count(),0);
 await page.locator('#username').fill(username);await page.getByRole('button',{name:'进入游戏',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#hero-name')||window.awInspect?.().loggedIn);
 if(await page.locator('#hero-name').count())await page.getByRole('button',{name:'进入营地',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&!window.awInspect().processing&&!['login','create','takeover'].includes(window.awInspect().panel));await page.waitForLoadState('networkidle');
 return page.evaluate(()=>window.awInspect().snapshot);
}
try{
 const live='http://127.0.0.1:8612';const liveHealth=await(await fetch(live+'/api/health')).json(),liveContent=await(await fetch(live+'/api/content')).json();assert.deepEqual(liveHealth.versions,versions);assert.deepEqual(liveContent.versions,versions);report.liveHealth=liveHealth;
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:report.viewport});
 page.on('response',async response=>{if(new URL(response.url()).pathname==='/api/control'&&response.ok()){try{lastLease=(await response.json()).lease_id;}catch{}}});
 page.on('pageerror',error=>report.errors.push(String(error)));page.on('response',response=>{if(response.status()>=400&& !response.url().endsWith('/api/character'))report.errors.push(response.status()+' '+response.url());});
 if(process.argv.includes('--live-only')){
  const prior=JSON.parse(await readFile(resolve(out,'isolated-browser.json'),'utf8'));assert.deepEqual(prior.versions,versions);assert.equal(prior.isolatedOldInstancesUnchanged,true);assert.equal(prior.rerolls.length,2);assert.deepEqual(prior.errors,[]);assert(prior.rerolls.every(r=>r.status===200&&r.repeatIdentical&&r.ledgerEntries===1&&r.restored));report.rerolls=prior.rerolls;report.isolatedOldInstancesUnchanged=true;report.isolatedEvidenceReused=true;
 }else{
 database=await startDatabase({temporary:true});const port=await freePort(),origin='http://127.0.0.1:'+port;
 const log=await open(resolve(out,'isolated-api.log'),'w');server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_TEST_LOGIN:'1'},{stdio:['ignore',log.fd,log.fd]});await log.close();await registerApi(database,server);await waitFor(origin+'/api/health',server);
 assert.deepEqual((await(await fetch(origin+'/api/content')).json()).versions,versions);
 pool=new Pool({connectionString:database.dsn,max:2});
 const initial=await login(origin,'r0_browser_'+Date.now().toString(36)),id=initial.id,state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 delete state.story;delete state.starsea;state.level=50;state.gold=100000;state.material=10000;state.progress.safe='town';state.lastRegion='town';state.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];
 const old=gearSchema.parse(makeGearByBase('standard-sword-t1-weapon',randomUUID()));old.ilvl=45;old.stage=8;old.rank=3;old.locked=true;old.affixes=[{id:'legacy-speed',name:'移动速度',stat:'speed',tier:3,value:72,description:'移动速度 +72'}];
 const targets=[1,45].map(level=>{const gear=gearSchema.parse(makeGearByBase('standard-sword-t1-weapon',randomUUID()));gear.quality='rare';return applyItemPower(gear,level);});state.gear.push(old,...targets);const before=state.gear.map(g=>gearSchema.parse(g));await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&!window.awInspect().processing&&window.awInspect().panel!=='login');await page.waitForLoadState('networkidle');
 for(const gear of targets){
  await page.waitForFunction(()=>!window.awInspect().processing);const lease=(await pool.query('SELECT lease FROM ow_controls WHERE character=$1',[id])).rows[0].lease,current=await page.evaluate(async()=>{const r=await fetch('/api/character');return r.json();}),body={command_id:randomUUID(),revision:current.revision,lease_id:lease,gear_id:gear.id};
  const request=()=>page.evaluate(async body=>{const response=await fetch('/api/gear/reroll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,value:await response.json()};},body);
  const response=await request();assert.equal(response.status,200);const receipt=response.value,next=receipt.snapshot,item=next.gear.find(g=>g.id===gear.id);assert.equal(next.gold,current.gold-100);assert.equal(next.material,current.material-10);assert.equal(next.revision,current.revision+1);
  for(const a of item.affixes){const entry=affixDefinitions.find(e=>e.stat===a.stat&&e.tier===a.tier);assert(entry);assert(a.tier<=maxAffixTierForItemLevel(gear.ilvl));const factor=['attack','armor','hp'].includes(a.stat)?stageForItemLevel(gear.ilvl).scale:1;assert(a.value>=(factor===1?entry.minValue:Math.round(entry.minValue*factor)));assert(a.value<=(factor===1?entry.maxValue:Math.round(entry.maxValue*factor)));}
  assert.deepEqual((await request()).value,receipt);assert.equal((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[id,body.command_id])).rows[0].n,1);
  await page.reload();await page.waitForFunction(revision=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.revision>=revision&&!window.awInspect().processing&&window.awInspect().panel!=='login',next.revision);await page.waitForLoadState('networkidle');const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.deepEqual(restored.gear.find(g=>g.id===gear.id),item);assert.deepEqual(restored.gear.find(g=>g.id===old.id),old);
  report.rerolls.push({ilvl:gear.ilvl,stage:gear.stage,quality:gear.quality,status:response.status,command:body.command_id,before:gear.affixes,after:item.affixes,cost:receipt.delta,repeatIdentical:true,ledgerEntries:1,restored:true});
 }
 const final=await page.evaluate(()=>window.awInspect().snapshot);for(const g of before.filter(g=>!targets.some(t=>t.id===g.id)))assert.deepEqual(final.gear.find(x=>x.id===g.id),g);report.isolatedOldInstancesUnchanged=true;
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();await page.screenshot({path:resolve(out,'compiled-reroll-restored-bag.png')});
 assert.deepEqual(report.errors,[]);await writeFile(resolve(out,'isolated-browser.json'),JSON.stringify({versions,rerolls:report.rerolls,isolatedOldInstancesUnchanged:true,errors:report.errors},null,2)+'\n');
 }
 await page.context().clearCookies();await login(live,'qa_build_variety_r0');
 // The real authenticated command changes only this QA character's location.
 if((await page.evaluate(()=>window.awInspect().region))!=='ss-map-port'){
  assert(lastLease);const returned=await page.evaluate(async lease=>{const current=await(await fetch('/api/character')).json(),body={command_id:crypto.randomUUID(),revision:current.revision,lease_id:lease,region:'ss-map-port'},r=await fetch('/api/location',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,command:body.command_id,receipt:await r.json()};},lastLease);assert.equal(returned.status,200);report.liveReturn={method:'authenticated HTTP location command in browser session',status:returned.status,command:returned.command};
 }else report.liveReturn={method:'resumed saved camp location'};
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='ss-map-port'&&!window.awInspect().processing);await page.waitForLoadState('networkidle');const liveState=await page.evaluate(()=>window.awInspect().snapshot);await page.screenshot({path:resolve(out,'live-camp.png')});
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='ss-map-port'&&!window.awInspect().processing);await page.waitForLoadState('networkidle');const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(restored.id,liveState.id);assert.deepEqual(restored.gear,liveState.gear);report.liveLogin={accountOnly:true,region:'ss-map-port',restored:true,clientVersion:versions.client};
 const previous=JSON.parse(await readFile(resolve(root,'.runtime/build-variety-r0/persistence-before.json'),'utf8')),after=await persistenceSnapshot();report.persistence=verifyPersistence(previous,after);report.persistenceBefore=persistenceSummary(previous);report.persistenceAfter=persistenceSummary(after);
 const nextCharacters=new Map(after.tables.ow_characters.map(c=>[c.id,c]));for(const c of previous.tables.ow_characters){const next=nextCharacters.get(c.id);assert.deepEqual(next.state.gear,c.state.gear,'Existing saved gear changed');assert.deepEqual(next.state.warehouse,c.state.warehouse,'Existing warehouse gear changed');}
 report.liveOldGearFieldsUnchanged=true;assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack);report.diagnostics=await page?.evaluate(()=>{const x=window.awInspect?.();return x?{region:x.region,panel:x.panel,processing:x.processing,loggedIn:x.loggedIn,blocked:x.blocked,lastError:x.lastError}:null;}).catch(()=>null);process.exitCode=1;await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}
finally{await browser?.close();await pool?.end();await stopChild(server);if(database)report.cleanup=await database.stop();await writeFile(resolve(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
