import {worldProgressSchema} from '../packages/contracts/open-world.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';
import {makeGear} from '../packages/rules/index.ts';
import {starseaIslands,starseaBossMaps} from '../packages/content/starsea/index.ts';
import {features,npcs,tasks as questRows} from '../packages/content/task-tables.ts';
import {versions} from '../packages/contracts/index.ts';
import {hits,length} from './copy-voice-scan.ts';

const dir=resolve(process.env.AW_COPY_REVIEW_DIR??'docs/reviews/copy-voice-20261009'),host=JSON.parse(await readFile(resolve(dir,'host.json'),'utf8'));
const phase=process.argv.includes('--before')?'before':'after',origin=process.argv.includes('--production')?'http://127.0.0.1:'+host.ports.afterApi:host.urls[phase];
const out=resolve(dir,'evidence');await mkdir(out,{recursive:true});
const pool=new Pool({connectionString:phase==='before'?host.beforeDsn:host.dsn});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--window-size=1280,800','--use-gl=angle']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();page.setDefaultTimeout(30000);
const checks:any[]=[],errors:string[]=[],result:any={phase,origin,viewport:[1280,720],headless:false,ok:false,checks,errors};
page.on('pageerror',e=>errors.push(String(e)));
const state=()=>page.evaluate(()=>(window as any).awInspect());
const ready=()=>page.waitForFunction(()=>(window as any).awInspect?.().loggedIn&&!(window as any).awInspect().processing);
const profile=process.argv.includes('--gear')?'gear':process.argv.includes('--dungeon-failure')?'dungeon-failure':process.argv.includes('--island')?'island':process.argv.includes('--help')?'help':process.argv.includes('--keys')?'keys':process.argv.includes('--entries')?'entries':process.argv.includes('--ui')?'ui':process.argv.includes('--battles')?'battles':'all';result.profile=profile;const prior=process.argv.includes('--production')?JSON.parse(await readFile(resolve(dir,'after-battles-browser.json'),'utf8')):null;const id=prior?.username??('copy_voice_'+phase+'_'+Date.now().toString(36));result.username=id;let starter:any,starterEquipment:any;
async function shot(name:string,keepPointer=false){
 if(!keepPointer)await page.mouse.move(1,1);if(['failure-island','failure-dungeon','success'].includes(name))await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('toast')!).opacity)<.01);await page.waitForTimeout(180);
 const text=await page.locator('body').innerText();
 if(phase==='after'&&host.currentBaseline){
  if(['failure-island','failure-dungeon','success'].includes(name)){
   assert.equal(await page.locator('.hero-flavour,.result-phase').count(),0);assert(!text.includes('返回地点'));
   await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.battle-result img')].every(i=>i.complete&&i.naturalWidth>0));
   const box=await page.locator('.battle-result').boundingBox();assert(box&&box.y>=0&&box.y+box.height<=721,'result within stage');
  }
  if(name==='failure-island'){assert.equal(await page.locator('.review-key').count(),0);assert(await page.locator('.review-fatal__art').count()>0);assert.equal(await page.locator('.review-advice__art').count(),3);const body=await page.locator('.loot-body').boundingBox();assert(body&&body.height<100,'zero reward space compact');}
  if(name==='success'){assert(text.includes('首次通关奖励已领取'));assert(text.includes('风车地窖钥匙碎片'));assert(!text.includes('雾铃树穴钥匙碎片'));}
  if(name==='dungeons'){const card=await page.locator('.dungeon-card[data-id=field-wind-1]').innerText();assert(card.includes('推荐 Lv'));assert(card.includes('碎片'));assert.equal(await page.locator('.dungeon-mode-badges').count(),0);}
  if(name==='sea-difficulty'){const colors=await page.locator('.sea-row__tag').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color}));assert.deepEqual(colors,{bg:'rgb(50, 115, 86)',text:'rgb(255, 255, 255)'});checks.push({name:'current-tier-green-white',...colors});}
 }

 const found=hits(text);
 const bounds=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,panels:[...document.querySelectorAll<HTMLElement>('.panel,.confirm-box,.battle-result')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.right,r.bottom];})})).catch(()=>({overflow:false,panels:[]}));
 const longButtons=await page.locator('button[data-ui=button]:not(.ui-button--icon):not(.ui-button--keycap):visible .ui-button__label').evaluateAll(a=>a.map(e=>(e as HTMLElement).innerText)).then(a=>a.map(t=>t.trim()).filter(t=>length(t)>6));
 await page.screenshot({path:resolve(out,phase+'-'+name+'.png')});await writeFile(resolve(out,phase+'-'+name+'.txt'),text);
 checks.push({name,banned:found,longButtons,bounds});
 if(phase==='after'){assert.deepEqual(found,[],name+': '+found.join(','));assert.deepEqual(longButtons,[],name+' action label length');}
 assert(!bounds.overflow,name+' document overflow');
 console.log('SHOT '+phase+' '+name);
}
async function close(){let quiet=0;for(let n=0;n<120;n++){if(!(await state()).panel){if(++quiet>=4)return;await page.waitForTimeout(250);continue;}quiet=0;const popup=page.locator('#modal [data-action=starsea-complete]:visible').first(),button=page.locator('#modal [data-action=close]:visible').first();if(await popup.count())await popup.click();else if(await button.count())await button.click();else await page.keyboard.press('Escape');await page.waitForTimeout(200);}throw Error('Could not drain queued dialogue or close the current panel');}
async function walk(point:{x:number;y:number}){await page.evaluate(p=>(window as any).awQaGo(p.x,p.y),point);await page.waitForFunction(p=>{const h=(window as any).awInspect().hero.position;return Math.hypot(h.x-p.x,h.y-p.y)<=0.5;},point);}
async function talk(npc:string){await close();const v=await state(),p=v.snapshot.starseaView.npcPositions.find((p:any)=>p.npc===npc&&p.map===v.region)??npcs.find(n=>n.id===npc);assert(p,'NPC position '+npc);await walk({x:p.x,y:p.y+4});const h=(await state()).hero.position,x=640+(p.x-p.y-h.x+h.y)*32,y=375+(p.x+p.y-h.x-h.y)*18;for(const offset of [135,120,150,160,100,50]){await page.mouse.click(x,y-offset);await page.waitForTimeout(350);if((await state()).panel==='starsea-talk')return;}throw Error('NPC visible hit area did not open dialogue: '+npc);}

async function open(panel:string){await close();const direct=page.locator(`[data-action=panel][data-id="${panel}"]:visible`).first();if(await direct.count()){for(let n=0;n<10&&(await state()).panel!==panel;n++){await ready();if(phase==='before'&&panel==='region-map'){await direct.focus();await page.keyboard.press('Enter');}else await direct.click();await page.waitForTimeout(120);}}else if(panel==='travel'){const v=await state(),content=await(await page.request.get(origin+'/api/content')).json(),point=content.regions.find((r:any)=>r.id===v.region).portal;assert(point,'port portal');await walk(point);await page.keyboard.press('e');}else if(panel==='dungeons'){const forge=npcs.find(n=>n.campaign==='starsea'&&n.service_feature==='forge');assert(forge);await talk(forge.id);await page.locator('[data-action=stage-key-open]').click();}else throw Error('No visible entry for '+panel);await page.waitForFunction(p=>(window as any).awInspect().panel===p,panel==='travel'?'starsea-chart':panel);await ready();}

async function seed(kind='surfaces'){
 await close();const current=await state();
 const row=(await pool.query('SELECT c.state,a.username FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE c.id=$1',[current.snapshot.id])).rows[0];
 assert.equal(row.username,id);const s=row.state;ensureProgression(s);s.gear=structuredClone(starter);s.equipment=structuredClone(starterEquipment);
 s.level=60;s.gold=100000;s.material=10000;s.lastRegion='ss-map-port';s.starsea.features=[...new Set([...s.starsea.features,...features.map(f=>f.id),'forge','talents','dungeons','grid','aspects','summons','professions','inventory','skills'])];
 for(const q of questRows.filter(q=>q.series==='onboarding')){if(!s.starsea.done.includes(q.id))s.starsea.done.push(q.id);delete s.starsea.quests[q.id];}s.starsea.tracked=null;
 s.starsea.islands=[...starseaIslands];s.starsea.bosses=[...starseaBossMaps];s.starsea.wave=null;
 s.starsea.location={map:'ss-map-port',x:20,y:20};delete s.starsea.completion;
 s.world=worldProgressSchema.parse(s.world??{});s.world.worldTier=1;s.world.unlockedWorldTier=6;s.world.activeKeyStage=4;s.world.activeKeyTier=1;s.world.stageKeys??={};s.world.stageKeys['stage:4']={stage:4,materials:6,obtained:[]};
 for(const m of progressionConfig.materials)s.progression.materials[m.id]=10000;
 delete s.dungeon;
 if(!s.gear.some((g:any)=>g.id==='cc000000-0000-4000-8000-000000000001')){const g=makeGear(0,'cc000000-0000-4000-8000-000000000001');g.id='cc000000-0000-4000-8000-000000000001';g.attack=40;s.gear.push(g);}
 if(kind==='sea-scroll'){s.world.unlockedWorldTier=99;s.world.hardmodeBosses=[...starseaBossMaps];s.starsea.hardmode=true;}
 if(kind==='outpost'){const point=worldTables.waypoints.find(p=>p.region==='ss-map-wind'&&p.kind==='outpost')!;s.lastRegion=point.region;s.starsea.location={map:point.region,x:point.x,y:point.y};for(const g of s.gear){g.armor=10000;g.attack=10000;}}
 if(kind==='island-death'){s.level=1;s.starsea.bosses=[];s.lastRegion=starseaBossMaps[0];s.starsea.location={map:s.lastRegion,x:20,y:20};s.skills=['cut'];s.skillRanks={cut:1};for(const g of s.gear){g.attack=0;g.armor=0;g.affixes=[];}}
 if(kind==='victory')while(s.gear.length<current.snapshot.capacity)s.gear.push({...s.gear[0],id:randomUUID()});
 if(kind==='dungeon-death'||kind==='victory'){s.starsea.bosses=[...starseaBossMaps];s.progression.talents={};s.progression.paragon=[];s.level=kind==='victory'?60:10;for(const g of s.gear){g.attack=kind==='victory'?10000:0;g.armor=kind==='victory'?10000:0;g.affixes=[];}s.skills=['cut'];s.skillRanks={cut:1};}
 s.revision++;s.build++;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);await page.reload();await ready();
 await page.waitForFunction(revision=>(window as any).awInspect().snapshot.revision>=revision,s.revision);
}
async function dungeon(outcome:'failure'|'success',toastOnly=false){
 await seed(outcome==='failure'?'dungeon-death':'victory');await open('dungeons');
 await page.locator('[data-action=dungeon-category][data-id=normal]').click();
 await page.locator('[data-action=dungeon-select][data-id=field-wind-1]').click();
 await page.locator('[data-action=dungeon-enter]').click();
 await page.waitForFunction(()=>(window as any).awInspect().dungeon?.status==='running',null,{timeout:60000});
 const toggle=page.locator('[data-action=hud-mode-toggle]');if(await toggle.count()){await toggle.click();await page.locator(`[data-action=mode][data-id=${outcome==='failure'?'manual':'auto'}]`).click();}
 if(outcome==='failure'){await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());await page.keyboard.press('Space');await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('toast')!).opacity)>0);await shot('toast');const v=await state(),enemy=v.dungeon.battle.data.enemies.find((e:any)=>e.alive),h=v.hero.position,p={x:enemy.position.x+2,y:enemy.position.y+1};await page.mouse.click(640+(p.x-p.y-h.x+h.y)*32,375+(p.x+p.y-h.x-h.y)*18);}
 if(toastOnly){const tick=(await state()).dungeon.tick;await page.waitForFunction(t=>(window as any).awInspect().dungeon?.tick>t,tick);checks.push({name:'space-toast-keeps-dungeon-running'});await page.locator('[data-action=hud-dungeon-exit]').click();await page.locator('[data-action=hud-dungeon-exit-confirm]').click();await page.waitForFunction(()=>(window as any).awInspect().region==='ss-map-port'&&!(window as any).awInspect().dungeon);return;}
 const deadline=Date.now()+180000;
 while(Date.now()<deadline){const v=await state(),d=v.dungeon;if(['failed','success','abandoned','closed'].includes(d?.status))break;if(d?.checkpoint){const ready=page.locator('[data-action=dungeon-ready]:enabled');if(await ready.count())await ready.first().click();const next=page.locator('[data-action=dungeon-next]:enabled');if(await next.count())await next.first().click();}await page.waitForTimeout(250);}
 assert.equal((await state()).dungeon?.status,outcome==='failure'?'failed':'success','real dungeon outcome');
 await page.locator('.result-title h1').waitFor();await shot(outcome==='failure'?'failure-dungeon':'success');
 if(outcome==='failure'&&phase==='after'){
  const advice=page.locator('.review-advice__button');assert(await advice.count()>0);
  await advice.first().click();await page.waitForFunction(()=>(window as any).awInspect().panel==='skills'||(window as any).awInspect().panel==='progression'||(window as any).awInspect().panel==='character'||(window as any).awInspect().panel==='bag');checks.push({name:'failure-advice-opens-real-page'});assert.equal((await state()).region,'ss-map-port');
 }
}
try{
 await page.goto(origin);await page.locator('#username').fill(id);await page.locator('[data-action=login]').click();
 await page.waitForFunction(()=>!!document.querySelector('[data-action=create]')||(window as any).awInspect?.().loggedIn);
 if(await page.locator('[data-action=create]').count()){await page.locator('#hero-name').fill('文案验收');await page.locator('[data-action=create]').click();}
 await ready();const initial=await state();result.account=initial.snapshot.id;starter=structuredClone(initial.snapshot.gear);starterEquipment=structuredClone(initial.snapshot.equipment);result.fixture={gear:starter,equipment:starterEquipment};await shot(process.argv.includes('--production')?'production-login':'login');
 if(process.argv.includes('--probe')){result.state=await state();result.buttons=await page.locator('button:visible').evaluateAll(a=>a.map(e=>({text:e.textContent,action:(e as HTMLElement).dataset.action,id:(e as HTMLElement).dataset.id})));result.ok=true;}
 else if(process.argv.includes('--production')){assert.equal(initial.snapshot.id,prior.account,'production preserves the existing character');assert.equal(initial.snapshot.gear.length,prior.finalInventoryCount,'production preserves the actual inventory');await page.reload();await ready();await page.waitForFunction(()=>(window as any).awInspect().metrics.terrain?.ready);assert.equal((await state()).snapshot.id,prior.account);assert.equal((await state()).snapshot.gear.length,prior.finalInventoryCount);checks.push({name:'existing-character-and-inventory-preserved-through-session-restore'});await shot('production-session-restored');const health=await(await page.request.get(origin+'/api/health')).json(),content=await(await page.request.get(origin+'/api/content')).json();assert.deepEqual(health.versions,content.versions);assert.deepEqual(health.versions,versions);result.versions=health.versions;result.ok=true;}
 else{
  if(profile==='dungeon-failure')await dungeon('failure');
  if(profile==='gear'){await seed();await open('bag');const id='cc000000-0000-4000-8000-000000000001';await page.locator(`[data-action=bag-select][data-id="gear:${id}"]`).click();await ready();const character=page.locator(`[data-action=bag-character][data-id="${id}"]`);if(await character.count()){await character.click();await page.waitForFunction(()=>(window as any).awInspect().panel==='character');}await page.locator(`[data-action=equip][data-id="${id}"]`).click();await page.locator('.gear-comparison-stats .ui-stat').first().waitFor({state:'visible'});await page.locator('.gear-set-change').scrollIntoViewIfNeeded();await shot('equipment-compare-set');}
  if(profile==='island'){await seed('island-death');await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=auto]').click();await page.waitForFunction(()=>(window as any).awInspect().battleResult?.phase==='ready',null,{timeout:120000});await shot('failure-island');}
  if(profile==='help'){await seed();await open('skills');const help=page.locator('.skill-school .ui-help');await help.hover();await help.locator('.ui-help__text').waitFor({state:'visible'});const geometry=await help.locator('.ui-help__text').evaluate(e=>{const r=e.getBoundingClientRect();return {within:r.y>=0&&r.bottom<=700,painted:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}});assert(geometry.within&&geometry.painted,'school help is painted within the panel');checks.push({name:'school-help-painted',...geometry});await shot('skill-school-help',true);}
  if(profile==='keys'){await seed();await open('dungeons');await page.locator('[data-action=dungeon-category][data-id=normal]').click();await page.locator('[data-action=dungeon-select][data-id=field-mist-1]').click();await page.locator('.stage-key-progress').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('key-recipe');await page.locator('[data-action=stage-key-preview]').first().click();await page.locator('.stage-key-preview').waitFor();await shot('key-preview');if(phase==='after')await dungeon('failure',true);}
  if(profile==='entries'){await seed();await open('dungeons');await shot('dungeons');const navigator=npcs.find(n=>n.service_panel==='sea-difficulty')!;await talk(navigator.id);await page.locator(`[data-action=starsea-service][data-id=${navigator.id}]`).click();await page.waitForFunction(()=>(window as any).awInspect().panel==='sea-difficulty');await shot('sea-npc-entry');}
  if(profile!=='battles'&&profile!=='entries'&&profile!=='keys'&&profile!=='help'&&profile!=='island'&&profile!=='gear'&&profile!=='dungeon-failure'){
  await seed();await shot('hud');
  await open('bag');await page.locator('[data-action=bag-select][data-id="gear:cc000000-0000-4000-8000-000000000001"]').click();await ready();await shot('bag');
  await page.mouse.move(1,1);await page.locator('[data-action=bag-select][data-id="gear:cc000000-0000-4000-8000-000000000001"]').hover();await page.mouse.move(1,1);await page.waitForTimeout(120);await page.locator('[data-action=bag-select][data-id="gear:cc000000-0000-4000-8000-000000000001"]').hover();await page.locator('#tooltip[aria-busy=false]').waitFor({state:'visible'});await shot('equipment-tip',true);await page.mouse.move(1,1);
  const character=page.locator('[data-action=bag-character][data-id="cc000000-0000-4000-8000-000000000001"]');if(await character.count()){await character.click();await page.waitForFunction(()=>(window as any).awInspect().panel==='character');}
  await page.locator('[data-action=equip][data-id="cc000000-0000-4000-8000-000000000001"]').click();await page.locator('.gear-comparison-box').waitFor();await page.locator('.gear-comparison-stats .ui-stat').first().waitFor({state:'visible'});if(phase==='after')assert(await page.locator('.gear-comparison-stats .ui-stat').count()>0);if(phase==='after')await page.locator('.gear-comparison-stats .gear-verdict').waitFor();await shot('equipment-compare');await page.locator('[data-action=gear-compare-close]').first().click();

  if(phase==='after'||host.currentBaseline){await open('skills');await shot('skills');if(host.currentBaseline&&phase==='after'){const help=page.locator('.skill-school .ui-help');await help.hover();await help.locator('.ui-help__text').waitFor({state:'visible'});await shot('skill-school-help',true);}await open('progression');await page.locator('[data-action=progression-group][data-id=talents]').click();await shot('talents');}
  await open('settings');await shot('settings');
  await open('tasks');await shot('tasks');if(host.currentBaseline){if(phase==='after'){const goal=await page.locator('.objective-copy').innerText();const text=await page.locator('.task-window').innerText();assert.equal(text.split(goal).length-1,1,'one visible goal');assert.equal(await page.locator('.desk-chain').count(),0);assert(!text.includes('前往发现点或人物身边接取'));}await page.locator('[data-action=quest-status][data-id=pending]').click();await shot('task-pending');}
  await open('travel');await shot('chart');if(host.currentBaseline&&phase==='after'){const help=page.locator('.starsea-island-line .ui-help').first();await help.hover();await help.locator('.ui-help__text').waitFor({state:'visible'});await shot('chart-crystal-help',true);}
  if(phase==='after'||host.currentBaseline){await page.locator('[data-action=panel][data-id=sea-difficulty]').click();await shot('sea-difficulty');await page.locator('.sea-detail__numbers summary').click();await shot('sea-difficulty-expanded');await page.locator('.sea-row.is-locked').first().click();await shot('sea-difficulty-locked');await page.locator('[data-action=sea-tier-pick][data-id="2"]').click();await page.locator('[data-action=world-tier][data-id="2"]').click();await page.waitForFunction(()=>(window as any).awInspect().snapshot.world.worldTier===2);await shot('sea-toast');}
  else{await open('region-map');await shot('sea-difficulty');checks.push({name:'legacy-tier-entry-not-mounted',note:'7956a4f contains world-tier-view but presentation never calls it; capture the real old region map.'});}
  await open('dungeons');await shot('dungeons');
  await page.locator('[data-action=dungeon-category][data-id=normal]').click();await page.locator('[data-action=dungeon-select][data-id=field-mist-1]').click();await page.locator('.stage-key-progress').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('key-recipe');
  await page.locator('[data-action=stage-key-preview]').first().click();await page.locator('.stage-key-preview').waitFor();await shot('key-preview');
  if(phase==='after'){
   const navigator=npcs.find(n=>n.service_panel==='sea-difficulty')!;await talk(navigator.id);await page.locator(`[data-action=starsea-service][data-id=${navigator.id}]`).click();await page.waitForFunction(()=>(window as any).awInspect().panel==='sea-difficulty');await shot('sea-npc-entry');
   await seed('sea-scroll');await open('travel');await page.locator('[data-action=panel][data-id=sea-difficulty]').click();await page.locator('.sea-row[data-id="97"]').scrollIntoViewIfNeeded();const scroll=await page.locator('.sea-list').evaluate(e=>e.scrollTop);await page.locator('.sea-row[data-id="97"]').click();await page.locator('.sea-row[data-id="97"][aria-pressed=true]').waitFor();const next=await page.locator('.sea-list').evaluate(e=>e.scrollTop);assert(scroll>0&&Math.abs(next-scroll)<2,'sea difficulty preserves scroll');assert.equal(await page.locator('.sea-row').count(),100);checks.push({name:'sea-scroll-preserved',before:scroll,after:next});await shot('sea-scroll');
  }
  }
  if(profile!=='ui'&&profile!=='entries'&&profile!=='keys'&&profile!=='help'&&profile!=='island'&&profile!=='gear'&&profile!=='dungeon-failure'){
  await close();await seed('island-death');
  await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=auto]').click();
  await page.waitForFunction(()=>(window as any).awInspect().battleResult?.phase==='ready',null,{timeout:120000});await shot('failure-island');
  if(phase==='after'){const armor=page.locator('.review-advice__button[data-id="forge:armor"]');if(await armor.count()){await armor.click();await page.waitForFunction(()=>(window as any).awInspect().panel==='character');const current=await state(),name=current.snapshot.gear.find((g:any)=>g.id===current.snapshot.equipment.armor).name;await page.locator('.gear-detail .bag-detail-heading h3').filter({hasText:name}).waitFor();await shot('advice-armor');}else{await page.locator('.review-advice__button').first().click();await page.waitForFunction(()=>(window as any).awInspect().panel!=='battle-result');}assert.equal((await state()).region,'ss-map-port');checks.push({name:'island-advice-returns-and-opens-destination'});await close();}else{await page.locator('[data-action=result-return]').click();await page.waitForFunction(()=>(window as any).awInspect().region==='ss-map-port'&&!(window as any).awInspect().battleResult);await close();}
  await dungeon('failure');
  // Ended-instance returns are completed before reseeding the next isolated fixture.
  const back=page.locator('[data-action=dungeon-return]');if(await back.count())await back.click();
  await dungeon('success');
  if(phase==='after'){
   const previous=(await state()).dungeon;assert(await page.locator('.review-key').count()>0,'success retains key progress');
   await page.locator('[data-action=dungeon-retry]').click();await page.waitForFunction(old=>(window as any).awInspect().dungeon?.id!==old&&(window as any).awInspect().dungeon?.status==='running',previous.id,{timeout:60000});
   const retry=(await state()).dungeon;assert.equal(retry.definition.id,previous.definition.id);assert.equal(retry.challengeTier,previous.challengeTier);
   const recorded=(await(await page.request.get(origin+'/api/dungeons/'+previous.id+'/result')).json()).instance;assert.equal(recorded.outcome,'success');assert.deepEqual(recorded.self.gains,previous.self.gains);checks.push({name:'retry-starts-new-instance-preserves-definition-tier-and-prior-loot'});
   await page.locator('[data-action=hud-dungeon-exit]').click();await page.locator('[data-action=hud-dungeon-exit-confirm]').click();await page.waitForFunction(()=>(window as any).awInspect().region==='ss-map-port'&&!(window as any).awInspect().dungeon);
  }else{await page.locator('[data-action=dungeon-return]').click();await page.waitForFunction(()=>(window as any).awInspect().region==='ss-map-port'&&!(window as any).awInspect().dungeon);}
  await close();await shot('hud-full');const full=await state();checks.push({name:'real-capacity',count:full.snapshot.gear.length,capacity:full.snapshot.capacity});await open('bag');await shot('bag-full');result.finalInventoryCount=(await state()).snapshot.gear.length;
  }
  result.ok=true;
 }
 assert.deepEqual(errors,[]);
}catch(e){result.error=String((e as Error).stack??e);result.lastState=await state().catch(()=>null);result.visibleText=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:resolve(out,phase+'-failure.png')}).catch(()=>{});process.exitCode=1;console.error(result.error);}
finally{await writeFile(resolve(dir,phase+(process.argv.includes('--production')?'-production':profile==='all'?'':'-'+profile)+'-browser.json'),JSON.stringify(result,null,2));await browser.close();await pool.end();console.log(JSON.stringify({phase,ok:result.ok,checks:checks.length,error:result.error}));}
