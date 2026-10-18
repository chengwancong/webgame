// Real browser, HTTP and PostgreSQL acceptance in a temporary database.
// Controlled wardrobe/crafting fixtures never modify the managed game's saves.
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {open,mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {startDatabase,root,freePort,child,stopChild,registerApi,waitFor} from './runtime.mjs';
import {makeGearByBase} from '../packages/rules/index.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {collectionRecipes} from '../packages/content/equipment-runtime.ts';
import {versions,gearSchema} from '../packages/contracts/index.ts';

const out=resolve(root,process.env.AW_EQUIPMENT_QA_OUT??'../docs/reviews/open-world/equipment-runtime-20261004/browser');await mkdir(out,{recursive:true});
const namesOnly=process.argv.includes('--names');
const result={ok:false,versions,scope:'compiled client, real HTTP service, isolated PostgreSQL; controlled established-character fixture, followed by actual crafting/equip/upgrade'+(namesOnly?' and saved name refresh':' and field combat'),errors:[]};
let database,server,browser,pool,page;
try{
 database=await startDatabase({temporary:true});
 assert.equal(dirname(resolve(database.work)),resolve(root,'.qa'));assert(basename(database.work).startsWith('run-'));
 const port=await freePort(),origin='http://127.0.0.1:'+port;result.origin=origin;
 const log=await open(resolve(out,'api.log'),'w');
 server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_TEST_LOGIN:'1'},{stdio:['ignore',log.fd,log.fd]});await log.close();await registerApi(database,server);await waitFor(origin+'/api/health',server);
 pool=new Pool({connectionString:database.dsn,max:4});
 const health=await (await fetch(origin+'/api/health')).json(),content=await (await fetch(origin+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(content.equipmentItems.length,324);assert(content.equipmentItems.every(item=>item.obtainable&&item.runtimeBase===item.id));
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>result.errors.push(String(error)));page.on('console',message=>{if(message.text().includes('API response validation failed')){result.validationErrors??=[];result.validationErrors.push(message.text());console.log(message.text());}});
 const username='equip_browser_'+Date.now().toString(36);await page.goto(origin);await page.locator('#username').waitFor();assert.equal(await page.locator('#password').count(),0);await page.locator('#username').fill(username);await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-name')||window.awInspect?.().loggedIn);
 if(await page.locator('#hero-name').count())await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.waitForLoadState('networkidle');
 const id=await page.evaluate(()=>window.awInspect().snapshot.id),row=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0],state=row.state;
 const oldGear=structuredClone(state.gear);delete state.story;delete state.starsea;state.level=9;state.gold=100000;state.material=10000;state.progress.safe='town';state.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];
 const bases=['weapon','armor','helmet','boots','necklace','ring'].map(part=>'primal-staff-t3-'+part);
 for(const base of bases){const gear=makeGearByBase(base,randomUUID());if(namesOnly){gear.name='原初·法杖·T3·'+({weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',necklace:'项链',ring:'戒指'})[base.split('-').at(-1)];gear.setName='原初·法杖·T3';}state.gear.push(gear);state.equipment[gear.slot]=gear.id;}
 for(const base of ['standard-sword-t2-helmet','omega-hammer-t3-boots','standard-hidden-t1-ring'])state.gear.push(makeGearByBase(base,randomUUID()));
 const core=state.gear.find(gear=>gear.base==='shield');core.locked=true;core.rank=2;state.equipment.core=core.id;
 const p=ensureProgression(state);p.professions.craft='smithing';p.professions.craftLevel=300;p.recipes=collectionRecipes.map(recipe=>recipe.id);for(const material of ['ore','leather','omega_fragment','boss_essence'])p.materials[material]=100000;state.revision++;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.level===9);await page.waitForLoadState('networkidle');
 if(namesOnly){const restored=await page.evaluate(()=>window.awInspect().snapshot);for(const base of bases){const old=state.gear.find(gear=>gear.base===base),item=equipmentItems.find(item=>item.id===base);assert.deepEqual(restored.gear.find(gear=>gear.id===old.id),gearSchema.parse({...old,name:item.name,setName:'长青誓约'}));}assert.equal(restored.gold,state.gold);assert.equal(restored.material,state.material);assert.deepEqual(restored.equipment,state.equipment);result.savedNamesRefreshed=true;result.savedRollsAndWalletPreserved=true;}
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();await page.waitForFunction(()=>window.awInspect().panel==='bag');await page.getByRole('button',{name:'人物',exact:true}).click();await page.waitForFunction(()=>window.awInspect().panel==='character');
 assert.equal(await page.locator('.character-slot').count(),6);assert.equal(await page.locator('.character-slot [data-equipment-tip]').count(),0); // Tips attach to the slot itself.
 assert.equal(await page.locator('.character-slot[data-equipment-tip]').count(),6);
 await page.screenshot({path:resolve(out,'character-six-slots-1280x720.png')});
 const artBounds=[];
 for(const part of ['helmet','boots','ring']){
  await page.locator(`[data-action=filter-slot][data-id=${part}]`).click();await page.locator('.character-candidate').first().waitFor();
  const candidates=await page.locator('.character-candidate').count();assert(candidates>=2);
  for(let index=0;index<2;index++){await page.locator('.character-candidate').nth(index).click();await page.waitForFunction(()=>document.querySelector('#preview')?.dataset.state==='ready');const box=await page.locator('.gear-detail .gear-art').boundingBox();assert(box);artBounds.push({part,index,width:box.width,height:box.height});}
  await page.locator('[data-action=character-chooser-close]').click();
 }
 for(const part of ['helmet','boots','ring']){const measurements=artBounds.filter(row=>row.part===part);assert.equal(measurements[0].width,measurements[1].width);assert.equal(measurements[0].height,measurements[1].height);}
 result.selectionGeometry=artBounds;await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.locator('#sysbar [data-action=panel][data-id=progression]').click();await page.waitForFunction(()=>window.awInspect().panel==='progression');await page.locator('[data-action=progression-group][data-id=reputation]').click();await page.locator('[data-action=progression-section][data-id=professions]').click();await page.locator('#progression-search').fill('长青誓约');assert.equal(await page.locator('.progression-entry').count(),6);
 if(namesOnly){for(const name of ['长青之杖','长青法衣','长青枝冠','苔纹长靴','古树叶坠','年轮之戒'])assert((await page.locator('.progression-library').innerText()).includes(name));await page.locator('#progression-search').fill('原初 法杖 T3');assert.equal(await page.locator('.progression-entry').count(),6);await page.locator('#progression-search').fill('年轮');assert.equal(await page.locator('.progression-entry').count(),1);await page.locator('#progression-search').fill('长青誓约');result.nameSetAndClassificationSearch=true;}
 await page.locator('[data-action=progression-item][data-id=forge-primal-staff-t3-ring]').click();await page.locator('#progression-operation').selectOption('recipe.craft:forge-primal-staff-t3-ring');
 const prior=await page.evaluate(()=>({gear:window.awInspect().snapshot.gear.map(gear=>gear.id),gold:window.awInspect().snapshot.gold,material:window.awInspect().snapshot.material}));
 await page.locator('[data-action=progression-confirm]').click();await page.waitForFunction(count=>window.awInspect().snapshot.gear.length===count+1,prior.gear.length);
 const crafted=await page.evaluate(prior=>window.awInspect().snapshot.gear.find(gear=>!prior.includes(gear.id)),prior.gear);assert.equal(crafted.base,'primal-staff-t3-ring');assert.equal(crafted.name,'年轮之戒');assert.equal(crafted.setName,'长青誓约');assert.equal(crafted.quality,'rare');assert(crafted.affixes.length>0);
 assert.equal(await page.evaluate(()=>window.awInspect().snapshot.gold),prior.gold-160);assert.equal(await page.evaluate(()=>window.awInspect().snapshot.material),prior.material);result.crafted={id:crafted.id,base:crafted.base,quality:crafted.quality};
 await page.screenshot({path:resolve(out,'craft-search-and-result-1280x720.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>window.awInspect().panel==='');await page.waitForLoadState('networkidle');
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();await page.getByRole('button',{name:'人物',exact:true}).click();await page.locator('[data-action=filter-slot][data-id=ring]').click();await page.locator(`[data-action=select][data-id="${crafted.id}"]`).click();await page.waitForFunction(()=>document.querySelector('#preview')?.dataset.state==='ready');await page.locator('[data-action=equip]').click();await page.getByRole('button',{name:'确认装备',exact:true}).click();await page.waitForFunction(id=>window.awInspect().snapshot.equipment.ring===id,crafted.id);
 const beforeUpgrade=await page.evaluate(()=>({gold:window.awInspect().snapshot.gold,material:window.awInspect().snapshot.material}));await page.locator('[data-action=upgrade]').click();await page.waitForFunction(id=>window.awInspect().snapshot.gear.find(gear=>gear.id===id)?.rank===1,crafted.id);
 assert.equal(await page.evaluate(()=>window.awInspect().snapshot.gold),beforeUpgrade.gold-35);assert.equal(await page.evaluate(()=>window.awInspect().snapshot.material),beforeUpgrade.material-2);await page.screenshot({path:resolve(out,'ring-equipped-upgraded-1280x720.png')});
 await page.reload();await page.waitForFunction(id=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.equipment.ring===id,crafted.id);assert.equal(await page.evaluate(id=>window.awInspect().snapshot.gear.find(gear=>gear.id===id).rank,crafted.id),1);assert.equal(await page.evaluate(()=>window.awInspect().snapshot.equipment.core),core.id);
 result.sessionRestore=true;result.oldCorePreserved=true;await page.waitForLoadState('networkidle');
 if(!namesOnly){
 await page.locator('#sysbar [data-action=panel][data-id=settings]').click();await page.locator('#auto-pickup').uncheck();await page.locator('#radius').fill('20');await page.locator('#radius').dispatchEvent('change');await page.keyboard.press('Escape');
 await page.locator('#minimapbox').click();await page.waitForFunction(()=>window.awInspect().panel==='region-map');await page.locator('[data-action=panel][data-id=travel]').click();await page.locator('[data-action=travel-depart]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=auto]').click();await page.waitForFunction(ids=>window.awInspect().snapshot.rewards.some(reward=>reward.region==='meadow'&&ids.includes(reward.gear.base)),equipmentItems.map(item=>item.id),{timeout:60000});
 const reward=await page.evaluate(ids=>window.awInspect().snapshot.rewards.find(reward=>reward.region==='meadow'&&ids.includes(reward.gear.base)),equipmentItems.map(item=>item.id));assert(equipmentItems.some(item=>item.id===reward.gear.base&&item.tier===1));result.fieldDrop={id:reward.id,gear:reward.gear.id,base:reward.gear.base,source:reward.source_id};
 await page.screenshot({path:resolve(out,'field-real-collection-drop-1280x720.png')});await page.locator('#sysbar [data-action=panel][data-id=settings]').click();await page.locator('#auto-pickup').check();await page.keyboard.press('Escape');await page.waitForFunction(id=>window.awInspect().snapshot.gear.some(gear=>gear.id===id),reward.gear.id,{timeout:30000});result.fieldDropClaimed=true;
 await page.reload();await page.waitForFunction(id=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.gear.some(gear=>gear.id===id),reward.gear.id);result.fieldDropRestored=true;
 }
 const final=await page.evaluate(()=>window.awInspect().snapshot);for(const old of oldGear)assert(final.gear.some(gear=>gear.id===old.id));result.oldGearIdsPreserved=true;
 result.catalogItems=324;result.craftingSearchItems=6;result.equipmentSlots=6;assert.deepEqual(result.errors,[]);result.ok=true;
}catch(error){result.error=String(error);result.stack=error.stack;if(page){result.state=await page.evaluate(()=>({panel:window.awInspect?.().panel,region:window.awInspect?.().region,loggedIn:window.awInspect?.().loggedIn,level:window.awInspect?.().snapshot?.level,body:document.body.innerText.slice(-1800)})).catch(()=>null);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();await pool?.end();await stopChild(server);if(database){assert.equal(dirname(resolve(database.work)),resolve(root,'.qa'));assert(basename(database.work).startsWith('run-'));result.cleanup=await database.stop();}await writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:result.ok,error:result.error,fieldDrop:result.fieldDrop,catalogItems:result.catalogItems,evidence:out}));}
