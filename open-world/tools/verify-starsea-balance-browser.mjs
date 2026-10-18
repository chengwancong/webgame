// Real UI on the managed preview. Fixture grants affect only this run's new QA
// character; first-island kills/respawn are exercised with its natural starter.
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './runtime.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const base='http://127.0.0.1:8612',folder=join(root,'.design/starsea-balance-20261005');await mkdir(folder,{recursive:true});
const resume=process.env.AW_STARSEA_BALANCE_RESUME==='1',prior=resume?JSON.parse(await readFile(join(folder,'browser.json'),'utf8')):null;
const report={ok:false,started:new Date().toISOString(),account:prior?.account??'qa_ssbal_'+Date.now().toString(36),character:prior?.character,viewport:[1280,720],errors:[],failedRequests:[],stages:prior?.stages??[],previousAttempts:[...(prior?.previousAttempts??[]),...(prior?.error?[{error:prior.error,hero:prior.failureState?.hero,completed:prior.completed}]:[])]};
let browser,page,pool;const inspect=()=>page.evaluate(()=>window.awInspect()),shot=name=>page.screenshot({path:join(folder,name+'.png')});
const click=async selector=>{const el=page.locator(selector).first();if(await el.isVisible().catch(()=>false)&&await el.isEnabled()){await el.click();return true;}return false;};
async function dismiss(){for(let t=0;t<24;t++){await page.waitForTimeout(150);const s=await inspect();if(!s.panel){await page.waitForTimeout(200);if(!(await inspect()).panel)return;continue;}if(!await click('[data-action=starsea-complete]'))await page.keyboard.press('Escape');await page.waitForTimeout(250);}assert(!(await inspect()).panel,'Dialogue did not close');}
async function mode(id){await dismiss();await page.locator('[data-action=hud-mode-toggle]').click();await page.locator(`[data-action=mode][data-id=${id}]`).click();await page.waitForFunction(id=>window.awInspect().mode===id,id);}
function screen(p,h){return {x:640+(p.x-h.x-p.y+h.y)*32,y:375+(p.x-h.x+p.y-h.y)*18};}
async function walk(goal,tolerance=.8){
 const {findPath}=await import('../packages/simulation/navigation.ts'),{starseaRegions}=await import('../packages/content/starsea/index.ts');
 for(let i=0;i<180;i++){
  const s=await inspect();if(s.panel){await dismiss();continue;}const h=s.hero.position,d=Math.hypot(goal.x-h.x,goal.y-h.y);if(d<tolerance)return;
  const route=findPath(starseaRegions.find(r=>r.id===s.region),h,goal),p=route.find(p=>Math.hypot(p.x-h.x,p.y-h.y)>.3);assert(p,'No walkable route to '+JSON.stringify(goal));
  const dx=p.x-h.x,dy=p.y-h.y,sx=dx-dy,sy=dx+dy,keys=[];
  if(Math.abs(sx)>=Math.abs(sy)/2.414)keys.push(sx>0?'KeyD':'KeyA');
  if(Math.abs(sy)>=Math.abs(sx)/2.414)keys.push(sy>0?'KeyS':'KeyW');
  for(const key of keys)await page.keyboard.down(key);
  await page.waitForTimeout(Math.max(70,Math.min(200,Math.hypot(dx,dy)/6*1000)));
  for(const key of keys)await page.keyboard.up(key);
 }
 throw Error('UI walk did not reach '+JSON.stringify(goal));
}
async function sail(region){
 await dismiss();const s=await inspect();
 const {starseaRegions}=await import('../packages/content/starsea/index.ts');
 const portal=starseaRegions.find(r=>r.id===s.region).portal;
 if(region==='ss-map-port'&&s.region!=='ss-map-port'){
  await mode('manual');await walk({x:portal.x+3.2,y:portal.y},.3);await dismiss();await page.keyboard.press('KeyE');
 }else{
  const {walkable}=await import('../packages/simulation/navigation.ts'),r=starseaRegions.find(r=>r.id===s.region),npcs=s.snapshot.starseaView?.port??[];
  const points=Array.from({length:32},(_,i)=>({x:portal.x+3.3*Math.cos(i*Math.PI/16),y:portal.y+3.3*Math.sin(i*Math.PI/16)})).filter(p=>walkable(r,p));
  const clearance=p=>Math.min(...npcs.map(n=>Math.hypot(n.x-p.x,n.y-p.y)));
  const goal=points.sort((a,b)=>clearance(b)-clearance(a))[0];assert(goal);
  await walk(goal,.4);await dismiss();await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.awInspect().panel==='starsea-chart',null,{timeout:10000});
  const island=region.startsWith('ss-map-boss-')?'ss-map-wind':region;
  await page.locator(`[data-action=starsea-chart-pick][data-id=${island}]`).click();await page.locator(`[data-action=starsea-sail][data-id=${region}]`).click();
 }
 await page.waitForFunction(region=>window.awInspect().region===region,region,{timeout:30000});await dismiss();
}
try{
 const before=await persistenceSnapshot(),health=await(await fetch(base+'/api/health')).json(),content=await(await fetch(base+'/api/content')).json();assert.deepEqual(health.versions,content.versions);assert.equal(health.auth_mode,'account-only');report.versions=health.versions;
 const {versions}=await import('../packages/contracts/index.ts');assert.deepEqual(health.versions,versions);
 const lines=(await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split('\n');pool=new Pool({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres'});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>report.errors.push(e.stack??String(e)));page.on('response',r=>{if(r.status()>=400&&!([401,404].includes(r.status())&&r.url().endsWith('/api/character')))report.failedRequests.push({url:r.url(),status:r.status()});});
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('[data-action=login]')&&!document.querySelector('[data-action=login]').disabled);assert.equal(await page.locator('input[type=password]').count(),0);
 await page.locator('#username').fill(report.account);await page.locator('[data-action=login]').click();if(!resume)await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn,null,{timeout:60000});await dismiss();
 if(!resume){await page.waitForFunction(()=>window.awInspect().enemyState.length>0,null,{timeout:60000});await mode('manual');
 const initial=await inspect();report.character=initial.snapshot.id;assert.equal(initial.snapshot.level,1);await shot('new-character-wind');
 const h=initial.hero.position,foe=initial.enemyState.filter(e=>e.alive&&!e.boss&&e.level<=2).sort((a,b)=>(['ranged','shaman','artillery'].includes(a.kind)?0:100)-(['ranged','shaman','artillery'].includes(b.kind)?0:100)+Math.hypot(a.position.x-h.x,a.position.y-h.y)-Math.hypot(b.position.x-h.x,b.position.y-h.y))[0];assert(foe,'No level 1–2 landing foe');
 const distance=Math.hypot(foe.position.x-h.x,foe.position.y-h.y),goal={x:foe.position.x+(h.x-foe.position.x)*7/distance,y:foe.position.y+(h.y-foe.position.y)*7/distance};
 await walk(goal);await mode('manual');await page.waitForTimeout(1200);let current=await inspect(),target=current.enemyState.find(e=>e.id===foe.id);const startDistance=Math.hypot(target.position.x-current.hero.position.x,target.position.y-current.hero.position.y);
 console.log(JSON.stringify({stage:'approach-ready',mode:current.mode,hp:current.hero.hp,hero:current.hero.position,target,skills:current.snapshot.skills,distance:startDistance,lastError:current.lastError}));
 assert(startDistance>3&&startDistance<=11,'Approach fixture is outside the intent window: '+startDistance);
 const point=screen(target.position,current.hero.position);await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>window.awInspect().castIntent!==null,null,{timeout:3000});const intent=await inspect();await shot('cut-approach-intent');assert.equal(intent.castIntent.skill,'cut');assert.equal(intent.castIntent.targetId,foe.id);
 await page.waitForFunction(id=>window.awInspect().enemyState.find(e=>e.id===id)?.hp<window.awInspect().enemyState.find(e=>e.id===id)?.maxHp,foe.id,{timeout:8000});const hit=await inspect();assert.equal(hit.castIntent,null);assert(!hit.lastError.includes('超出施放距离'));report.stages.push({name:'manual-cut-approach',distance:startDistance,from:current.hero.position,to:hit.hero.position,target:foe.id});
 const killStart=hit.tick;await mode('semi');await page.waitForFunction(id=>window.awInspect().enemyState.find(e=>e.id===id)?.alive===false,foe.id,{timeout:20000});const killed=await inspect();report.stages.push({name:'natural-starter-kill',level:killed.snapshot.level,secondsAfterFirstContact:(killed.tick-killStart)/30});await shot('first-kill');
 // Finish nearby pack so the respawn wait has no unrelated attack pressure.
 // Stop beside the landing, outside the portal's interaction radius. Clicking
 // the landing itself correctly returns to port and ends the current World.
 await page.waitForTimeout(8000);await mode('manual');await walk({x:initial.hero.position.x+6,y:initial.hero.position.y},.8);await dismiss();await mode('manual');await shot('respawn-wait-far');
 const id=report.character,death=(await pool.query('SELECT killed_at FROM ow_kills WHERE character=$1 AND source=$2',[id,foe.id])).rows[0];assert(death,'Natural kill was not committed');const due=new Date(death.killed_at).getTime()+75000;
 while(Date.now()<due-500){await page.waitForTimeout(Math.min(5000,due-500-Date.now()));const s=await inspect();assert(!s.enemyState.some(e=>e.id===foe.id+'~r1'),'Respawn happened early');assert(!s.blocked,s.lastError);}
 await page.waitForFunction(id=>window.awInspect().enemyState.some(e=>e.id===id+'~r1'&&e.alive),foe.id,{timeout:35000});const revived=await inspect();report.stages.push({name:'real-75-second-respawn',elapsed:(Date.now()-new Date(death.killed_at).getTime())/1000,original:foe.id,respawn:foe.id+'~r1'});await shot('respawn-r1');
 const beforeGold=revived.snapshot.gold,revivedFoe=revived.enemyState.find(e=>e.id===foe.id+'~r1');await walk({x:revivedFoe.position.x-4,y:revivedFoe.position.y});await mode('semi');await page.waitForFunction(id=>window.awInspect().enemyState.find(e=>e.id===id+'~r1')?.alive===false,foe.id,{timeout:25000});await page.waitForFunction(gold=>window.awInspect().snapshot.gold>gold,beforeGold,{timeout:10000});report.stages.push({name:'respawn-reward',goldBefore:beforeGold,goldAfter:(await inspect()).snapshot.gold});await shot('respawn-reward');
 await sail('ss-map-port');await shot('camp-login');const camp=await inspect();await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='ss-map-port',null,{timeout:60000});assert.equal((await inspect()).snapshot.id,id);report.stages.push({name:'camp-session-restore',level:camp.snapshot.level});await shot('camp-restored');
 }
 // Controlled expected builds for the two requested boss levels. No quest or
 // reward success is forged: movement, damage, kills and receipts remain real.
 const {expectedCharacter}=await import('./starsea-balance-model.ts'),{bossLevels,islandBands,starseaRegions}=await import('../packages/content/starsea/index.ts');
 const id=report.character;assert(id);
 for(const L of [islandBands[0][1],bossLevels[0]].filter(L=>!process.env.AW_STARSEA_BALANCE_BOSS_LEVEL||L===Number(process.env.AW_STARSEA_BALANCE_BOSS_LEVEL))){
  const old=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state,c=expectedCharacter(L,1);c.id=id;c.name=old.name;c.revision=old.revision+1;c.build=old.build+1;c.lastRegion='ss-map-port';c.starsea.chapter=1;c.starsea.task=4;c.starsea.openingComplete=true;
  await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[c,id]);await page.reload();await page.waitForFunction(L=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.level===L&&window.awInspect().region==='ss-map-port',L,{timeout:60000});await dismiss();await sail('ss-map-boss-1');await mode('manual');
  const boss=starseaRegions.find(r=>r.id==='ss-map-boss-1').spawns[0];await walk({x:boss.x-6,y:boss.y});await mode('auto');await shot('boss-L'+L+'-start');
  const start=await inspect(),tick=start.tick;await page.waitForFunction(()=>window.awInspect().battleResult?.phase==='ready',null,{timeout:160000});const result=await inspect();if(L===bossLevels[0]){assert(result.battleResult.data.success,'Boss defeat failed at same-level L'+L);assert(result.hero.hp>0);}
  report.stages.push({name:'controlled-boss',strategy:'manual-approach-then-auto',startingHp:start.hero.hp/start.snapshot.stats.hp,success:result.battleResult.data.success,level:L,skills:result.snapshot.skills,ranks:result.snapshot.skillRanks,seconds:(result.tick-tick)/30,hpLeft:result.hero.hp/result.snapshot.stats.hp,receipt:result.battleResult.data});await shot('boss-L'+L+(result.battleResult.data.success?'-win':'-loss'));
  await page.locator('[data-action=result-return]').click();await page.waitForFunction(()=>window.awInspect().region==='ss-map-port',null,{timeout:30000});
 }
 const after=await persistenceSnapshot();report.before=persistenceSummary(before);report.after=persistenceSummary(after);
 if(resume){before.tables.ow_characters=before.tables.ow_characters.filter(c=>c.id!==id);after.tables.ow_characters=after.tables.ow_characters.filter(c=>c.id!==id);report.controlledQaCharacterExcluded=id;}
 report.persistence=verifyPersistence(before,after);assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.ok=true;
}catch(e){report.error=e.stack??String(e);process.exitCode=1;console.error(e);if(page){const s=await inspect().catch(()=>null);if(s){report.failureState={hero:s.hero,mode:s.mode,panel:s.panel,lastError:s.lastError,castIntent:s.castIntent,enemyState:s.enemyState,tick:s.tick,blocked:s.blocked};console.log(JSON.stringify({failureState:report.failureState}));}}await shot('browser-failure').catch(()=>{});}
finally{await browser?.close();await pool?.end();report.completed=new Date().toISOString();await writeFile(join(folder,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,account:report.account,stages:report.stages.map(s=>s.name),error:report.error}));}
