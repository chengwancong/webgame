import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {chromium} from 'playwright';
import {root,startDatabase,child,stopChild,freePort,waitFor,registerApi} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';

// Real browser + real API + temporary PostgreSQL: QA build enters the M0 graybox field,
// streams camps from /api/field/camps, fights with server-confirmed kills, survives reload.
const folder=join(root,'../docs/reviews/open-world/field-camps-20261006');await mkdir(folder,{recursive:true});
const region='ow-graybox-wind',report={date:new Date().toISOString(),source:await sourceVersion(),region,checks:[],errors:[],ok:false};let db,api,browser,pool,page,fieldCalls=0;
// A new hero's opening flow may still move it (starsea landing, talk panels); enter once it settles.
const enter=async()=>{for(let i=0;i<20;i++){await page.waitForFunction(()=>{const s=window.awInspect?.();return s?.loggedIn&&!s.processing;},{},{timeout:30000});if(await page.evaluate(()=>window.awInspect().panel))await page.keyboard.press('Escape');if(await page.evaluate(id=>window.awQaField(id),region)){await page.waitForTimeout(2000);if(await page.evaluate(id=>window.awInspect().region===id,region))return;}await page.waitForTimeout(500);}throw Error('QA field entry kept failing');};
const record=(name,result)=>{report.checks.push({name,...result});console.log(name,JSON.stringify(result));};
try{
 db=await startDatabase({temporary:true});const dist=resolve(db.work,'build');
 const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',dist],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
 // The graybox geometry must be a lazy chunk, never part of the game entry.
 const assets=await readdir(join(dist,'assets')),entry=assets.filter(f=>/^game-.*\.js$/.test(f));assert.ok(entry.length);
 for(const f of entry)assert.ok(!(await readFile(join(dist,'assets',f),'utf8')).includes('"boundary"'),'graybox map leaked into '+f);
 record('qa-build-lazy-field-chunk',{entry});
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:base,AW_STATIC_ROOT:dist,AW_TEST_LOGIN:'1',AW_FIELD_QA:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(base+'/api/health',api);
 pool=new Pool({connectionString:db.dsn});browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('request',r=>{if(r.url().includes('/api/field/camps'))fieldCalls++;});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')(report.console??=[]).push(m.text().slice(0,300));});page.on('response',async r=>{if(/\/api\/(permit|quest|travel)/.test(r.url()))(report.calls??=[]).push(r.url().replace(base,'')+' '+r.status()+' '+(r.status()>=400?await r.text().catch(()=>''):''));if(r.url().includes('/api/')&&r.status()>=400)(/^\/api\/character (401|404) /.test(r.url().replace(base,'')+' '+r.status()+' ')&&!report.loggedIn?report.preLogin??=[]:report.errors).push(r.url().replace(base,'')+' '+r.status()+' '+await r.text().catch(()=>''));});
 await page.goto(base);await page.locator('#username').fill('camp_'+randomUUID().replaceAll('-','').slice(0,20));await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('营地验收');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn);report.loggedIn=true;
 await enter();
 await page.waitForFunction(()=>window.awInspect().field.living>0,{},{timeout:30000});
 const entered=await page.evaluate(()=>{const s=window.awInspect();return {region:s.region,field:s.field,hero:s.hero.position};});assert.equal(entered.region,region);
 await page.screenshot({path:join(folder,'field-entered.png')});record('field-camps-streamed',entered);
 const id=await page.evaluate(()=>window.awInspect().snapshot.id),xp0=await page.evaluate(()=>window.awInspect().snapshot.xp);
 await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=auto]').click();
 await page.waitForFunction(()=>window.awInspect().snapshot.xp>0,{},{timeout:120000});
 // Keep fighting until one whole camp is cleared and the server marks the cycle.
 for(let i=0;i<120&&!(await pool.query('SELECT 1 FROM ow_camp_cycles WHERE character=$1 AND cleared_at IS NOT NULL',[id])).rowCount;i++)await page.waitForTimeout(1500);
 const kills=(await pool.query("SELECT count(*)::int n FROM ow_kills WHERE character=$1 AND source LIKE 'm0-wind-%'",[id])).rows[0].n;assert.ok(kills>0);
 const cycles=(await pool.query('SELECT camp,cycle,cleared_at FROM ow_camp_cycles WHERE character=$1 ORDER BY camp',[id])).rows;assert.ok(cycles.some(c=>c.cleared_at));
 await page.screenshot({path:join(folder,'field-auto-combat.png')});record('server-confirmed-camp-kills',{xpBefore:xp0,xpAfter:await page.evaluate(()=>window.awInspect().snapshot.xp),kills,camps:cycles.length,cleared:cycles.filter(c=>c.cleared_at).length});
 // Reconnect: kills stay settled, no killed member returns, cycles are not reissued.
 const killed=(await pool.query("SELECT source FROM ow_kills WHERE character=$1",[id])).rows.map(r=>r.source);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn,{},{timeout:30000});
 await enter();await page.waitForFunction(()=>window.awInspect().field.camps>0,{},{timeout:30000});
 const back=await page.evaluate(()=>window.awInspect().enemyState.filter(e=>e.alive).map(e=>e.id));assert.ok(!back.some(e=>killed.includes(e)));
 const again=(await pool.query('SELECT count(*)::int n FROM ow_camp_cycles WHERE character=$1',[id])).rows[0].n;
 record('reconnect-keeps-instances',{killedBefore:killed.length,killedReturned:0,cyclesBefore:cycles.length,cyclesAfter:again});
 // Waypoints, fog and zone banner: walk (normal pathing) to w7, activate with E, walk into
 // zone 1 (banner), activate w1, then travel back from the region map.
 await page.evaluate(()=>{window.__toasts=[];new MutationObserver(()=>window.__toasts.push(document.querySelector('#toast').textContent)).observe(document.querySelector('#toast'),{childList:true,characterData:true,subtree:true});});
 const walk=async(x,y)=>{for(let i=0;i<40;i++){if(await page.evaluate(([x,y])=>{const h=window.awInspect().hero.position;return Math.hypot(h.x-x,h.y-y)<=2.5;},[x,y]))return;await page.evaluate(([x,y])=>window.awQaGo(x,y),[x,y]);await page.waitForTimeout(3000);}throw Error(`could not walk to ${x},${y}`);};
 const activate=async id=>{await page.keyboard.press('KeyE');await page.waitForFunction(id=>window.awInspect().snapshot.starsea?.waypoints?.includes(id),id,{timeout:15000});};
 await walk(112,256);await activate('m0-wind-w7');
 await walk(85,128);await activate('m0-wind-w1');
 const zone=await page.evaluate(()=>({zone:window.awInspect().field.zone,toasts:window.__toasts.filter(t=>t.includes('风栖灰盒分区'))}));assert.equal(zone.zone,'m0-wind-z1');assert.ok(zone.toasts.length>0,'no zone banner');
 record('waypoints-activated-zone-banner',zone);
 // Travel is refused while camp members still chase the hero; let the fight end first
 // (the open map pauses the world).
 await page.waitForFunction(()=>!window.awInspect().field.inCombat,{},{timeout:90000});
 await page.locator('#minimapbox').click();await page.waitForSelector('[data-action=waypoint-travel]');
 const buttons=await page.locator('[data-action=waypoint-travel]').evaluateAll(b=>b.map(x=>x.dataset.id));assert.deepEqual(buttons.sort(),['m0-wind-w1','m0-wind-w7']);
 const fog=await page.evaluate(()=>{const e=window.awInspect().field.explored,bytes=atob(e);let n=0;for(const c of bytes)for(let v=c.charCodeAt(0);v;v>>=1)n+=v&1;return n;});assert.ok(fog>0&&fog<64*64);
 await page.screenshot({path:join(folder,'region-map-fog-waypoints.png')});
 const receipts0=(await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1',[id])).rows[0].n;
 await page.locator('[data-action=waypoint-travel][data-id=m0-wind-w7]').click();
 await page.waitForFunction(()=>{const h=window.awInspect().hero.position;return Math.hypot(h.x-112,h.y-256)<1;},{},{timeout:15000});
 const receipts1=(await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1',[id])).rows[0].n,saved=(await pool.query("SELECT state->'world'->'exploration'->>$2 e FROM ow_characters WHERE id=$1",[id,region])).rows[0].e;
 assert.equal(receipts1-receipts0,1);assert.ok(saved);
 await page.waitForTimeout(1500);await page.screenshot({path:join(folder,'waypoint-travel-arrived.png')});
 record('waypoint-travel',{buttons,exploredCells:fog,receipts:receipts1-receipts0,arrived:await page.evaluate(()=>window.awInspect().hero.position),savedFog:saved.length});
 assert.deepEqual(report.errors,[]);report.sourceAfter=await sourceVersion();report.ok=true;
}catch(error){report.errors.push(error.stack);if(page)report.lastState=await page.evaluate(()=>{const s=window.awInspect?.();return s&&{region:s.region,field:s.field,permitId:s.permitId,blocked:s.blocked,processing:s.processing,panel:s.panel,hero:s.hero?.position,tick:s.tick,paused:s.paused,enemies:s.enemyState?.length,toasts:window.__toasts,lastError:s.lastError};}).catch(e=>String(e));if(report.lastState)report.lastState.fieldCalls=fieldCalls;console.error(error,report.errors,report.lastState);if(page)await page.screenshot({path:join(folder,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();await pool?.end();await stopChild(api);if(db)report.cleanup=await db.stop();await writeFile(join(folder,'browser-result.json'),JSON.stringify(report,null,2)+'\n');}
