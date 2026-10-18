import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {root} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';
import {regions} from '../packages/content/index.ts';
const campaignBalance=regions.filter(r=>r.id!=='town'&&!r.boss).map(r=>({area:r.id}));
import {rewardFor,dropProfileFor,scaleWorldGear} from '../apps/api/src/economy.ts';
import {gearBases} from '../packages/rules/index.ts';
const allDrops=process.argv.includes('--all-drops');
const base='http://127.0.0.1:8612',folder=process.env.AW_FIRST_CHAPTER_EVIDENCE??join(root,'../docs/reviews/open-world/starter-difficulty-20261001');
await mkdir(folder,{recursive:true});let browser,pool,page;
const report={ok:false,base,checks:[],errors:[]};
try{
 const health=await (await fetch(base+'/api/health')).json(),content=await (await fetch(base+'/api/content')).json();
 assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');
 const boss=content.regions.find(r=>r.id==='meadow-boss').spawns[0];assert.equal(boss.hp,1000);assert.equal(boss.attack,20);report.versions=health.versions;report.boss=boss;
 for(const row of campaignBalance){for(const region of content.regions.filter(r=>r.id===row.area||r.id===row.area+'-boss'))for(const spawn of region.spawns){const expected=regions.find(r=>r.id===region.id).spawns.find(s=>s.id===spawn.id);assert.deepEqual(spawn,expected);}}report.checks.push('actual-api-all-six-area-combat-values-match-source');
 const lines=(await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/);pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${Number(lines[3])}/postgres`});
 pool.on('error',error=>report.errors.push('Database connection interrupted: '+error.message));
 const saved=(await pool.query('SELECT id,state FROM ow_characters ORDER BY id')).rows;report.existingCharacters=saved.length;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('balance_'+randomUUID().replaceAll('-','').slice(0,18));await page.locator('[data-action=login]').click();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 report.checks.push('actual-service-account-only-login-enters-camp');const before=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(before.level,1);assert.equal(before.gold,0);assert.equal(before.material,0);
 await page.locator('[data-action=guide][data-id=portal]').click();const townPortal=content.regions.find(r=>r.id==='town').portal;
 await page.waitForFunction(p=>Math.hypot(window.awInspect().hero.position.x-p.x,window.awInspect().hero.position.y-p.y)<4,townPortal,{timeout:30000});await page.keyboard.press('e');
 if(allDrops){
  report.dropPreviews=[];
  for(const row of campaignBalance)for(const dungeon of [false,true]){
   const regionId=row.area+(dungeon?'-boss':'');await page.locator(`[data-action=travel-mode][data-id=${dungeon?'dungeon':'explore'}]`).click();await page.locator(`[data-action=travel-region][data-id=${row.area}]`).click();await page.locator(`[data-action=travel-select][data-id=${regionId}]`).click();
   await page.waitForFunction(id=>document.querySelector('.destination-card.is-selected')?.getAttribute('data-id')===id&&!document.querySelector('.travel-drops[aria-busy=true]')&&Boolean(document.querySelector('.drop-note')),regionId,{timeout:15000});
   const preview=await (await page.request.get(base+'/api/travel/'+regionId+'/drops')).json(),note=await page.locator('.drop-note').innerText();assert.equal(note,preview.note);assert.equal(preview.ruleset_version,versions.rules);
   if(dungeon){const gain=rewardFor(regionId,'boss');for(const key of ['gold','xp','material'])assert.deepEqual(preview.rewards[key],{min:gain[key],max:gain[key]});}
   for(const equipment of preview.equipment){const original=gearBases.find(g=>g.base===equipment.base),expected=scaleWorldGear(original,dropProfileFor(regionId));assert.equal(equipment.attack,expected.attack);assert.equal(equipment.armor,expected.armor);}
   const tip=JSON.parse(await page.locator('.travel-drop-item').first().getAttribute('data-tip'));assert.ok(tip.rows.some(row=>row[0]==='攻击'&&row[1]===String(preview.equipment[0].attack)));
   const rect=await page.locator('.drop-note').boundingBox();assert.ok(rect&&rect.width>0&&rect.height>0);report.dropPreviews.push({region:regionId,rewards:preview.rewards,equipment:preview.equipment,note});
   if(regionId==='meadow'||regionId==='dragonbone-boss')await page.screenshot({path:join(folder,regionId+'-drop-preview.png')});
  }
  report.checks.push('actual-browser-all-twelve-drop-previews-match-server-rates-and-income');
  await page.locator('[data-action=travel-region][data-id=meadow]').click();
 }
 await page.locator('[data-action=travel-mode][data-id=explore]').click();await page.locator('[data-action=travel-select][data-id=meadow]').click();await page.locator('[data-action=travel-depart]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow');
 await page.locator('[data-action=mode][data-id=auto]').click();await page.waitForFunction(()=>window.awInspect().snapshot.bossAccess['meadow-boss'].eligible,{},{timeout:45000});report.field=await page.evaluate(()=>({hp:window.awInspect().hero.hp,level:window.awInspect().snapshot.level,kills:window.awInspect().snapshot.progress.regionKills.meadow,elites:window.awInspect().snapshot.progress.regionElites.meadow}));report.checks.push('full-field-start-unlocks-first-boss');
 await page.locator('[data-action=guide][data-id=boss]').click();const portal=content.regions.find(r=>r.id==='meadow').bossPortal;
 await page.waitForFunction(p=>Math.hypot(window.awInspect().hero.position.x-p.x,window.awInspect().hero.position.y-p.y)<3,portal,{timeout:45000});await page.keyboard.press('e');await page.locator('[data-action=boss]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow-boss');
 const start=await page.evaluate(()=>({tick:window.awInspect().tick,hp:window.awInspect().hero.hp,mode:window.awInspect().mode}));assert.equal(start.mode,'semi');
 await page.waitForFunction(()=>window.awInspect().snapshot.progress.bosses.includes('meadow-boss'),{},{timeout:60000});
 await page.waitForFunction(()=>!window.awInspect().blocked&&window.awInspect().enemies===0,{},{timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('.stop')?.textContent?.includes('战利品尚未确认'),{},{timeout:5000});
 const victory=await page.evaluate(()=>window.awInspect());assert.equal(victory.blocked,false);assert.ok(victory.hero.hp>0);assert.ok(victory.snapshot.progress.regions.includes('forest'));assert.ok(victory.snapshot.gear.every(g=>g.rank===0));assert.ok(Object.values(victory.snapshot.skillRanks).every(rank=>rank===1));
 report.victory={mode:victory.mode,hp:victory.hero.hp,hpMax:victory.snapshot.stats.hp,seconds:(victory.tick-start.tick)/30,level:victory.snapshot.level,bosses:victory.snapshot.progress.bosses};await page.screenshot({path:join(folder,'local-service-victory.png')});report.checks.push('initial-gear-semi-auto-boss-victory-unlocks-forest');
 const reward=(await pool.query("SELECT data FROM ow_rewards WHERE character=$1 AND source LIKE 'meadow-boss:%' ORDER BY id",[victory.snapshot.id])).rows[0]?.data;assert.equal(reward.gear.quality,'rare');report.checks.push('first-boss-rare-reward-persisted');
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(restored.id,before.id);assert.deepEqual(restored.progress.bosses,victory.snapshot.progress.bosses);assert.equal(restored.gold,victory.snapshot.gold);assert.equal(restored.level,victory.snapshot.level);report.checks.push('session-and-earned-progress-restored-after-refresh');
 for(const prior of saved)assert.deepEqual((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[prior.id])).rows[0]?.state,prior.state,'Existing character changed: '+prior.id);report.checks.push('existing-player-saves-preserved');
 assert.deepEqual(report.errors,[]);assert.deepEqual((await (await fetch(base+'/api/health')).json()).versions,versions);report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;await page?.screenshot({path:join(folder,'local-service-failure.png')}).catch(()=>{});}
finally{await browser?.close();await pool?.end();await writeFile(join(folder,'local-service.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
