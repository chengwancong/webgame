import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {root} from './runtime.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';

const origin=process.env.AW_MINI_ORIGIN??'http://127.0.0.1:8612';
const evidence=join(root,'../docs/reviews/open-world/mini-hero-integration-20261002');
await mkdir(evidence,{recursive:true});
const report={passed:false,origin,checks:[],errors:[],limits:['Headless Edge uses a software GPU; native GPU performance is not certified.','This release reskins the two starter body sets. Other clothing and unsupported weapon sets retain their existing renderer.']};
const before=await persistenceSnapshot();let browser,page;
try{
 const health=await(await fetch(origin+'/api/health')).json(),content=await(await fetch(origin+'/api/content')).json();
 const declaration=(await readFile(join(root,'packages/contracts/index.ts'),'utf8')).match(/export const versions=\{([^}]+)\}/)?.[1];assert(declaration);
 const expected=Object.fromEntries([...declaration.matchAll(/(client|protocol|rules|assets|db):(?:'([^']+)'|(\d+))/g)].map(match=>[match[1],match[2]??Number(match[3])]));
 assert.deepEqual(health.versions,expected);assert.deepEqual(health.versions,content.versions);assert.equal(health.ok,true);report.versions=health.versions;
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:720}});page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 const nativeRequests=[];page.on('response',response=>{if(response.url().includes('/art/mini-hero/'))nativeRequests.push({url:new URL(response.url()).pathname,status:response.status()});});
 // Freeze only this test's module graph; do not disconnect another player's browser.
 await page.routeWebSocket('**',()=>{});
 const inspect=()=>page.evaluate(()=>window.awInspect());
 const ready=()=>page.waitForFunction(()=>window.awInspect?.().attachments?.wardrobe?.ready&&!window.awInspect().attachments.wardrobe.pending,{timeout:60000});
 const native=()=>page.waitForFunction(()=>window.awInspect?.().attachments?.pose?.frame?.startsWith('mini-'),{timeout:60000});
 await page.goto(origin);
 report.entryScripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(node=>node.src));
 const account='mini_'+randomUUID().replaceAll('-','').slice(0,14);report.account=account;
 await page.locator('#username').fill(account);await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('藏蓝旅人');await page.locator('[data-action=create]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().panel==='');await ready();await native();
 const initial=await inspect();assert.equal(initial.blocked,false);assert.equal(initial.attachments.wardrobe.family,'sword');assert(initial.attachments.wardrobe.errors.length===0);
 await page.waitForFunction(()=>document.querySelector('.who img')?.src.startsWith('data:image/png'));
 assert((await page.locator('.who img').getAttribute('src')).length>1000);
 await page.screenshot({path:join(evidence,'camp-1280x720.png')});report.checks.push({name:'real-account-only-login-camp-avatar',appearance:initial.snapshot.resolvedAppearance,diagnostics:initial.attachments.wardrobe});

 await page.getByRole('button',{name:'外观',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect().appearancePreview.ready&&!window.awInspect().appearancePreview.pending&&window.awInspect().appearancePreview.frame.startsWith('mini-'));
 const preview=await inspect();assert.equal(preview.appearancePreview.key,initial.attachments.wardrobe.key);
 await page.locator('[data-action=appearance-motion][data-id=attack]').click();await page.waitForTimeout(250);
 await page.screenshot({path:join(evidence,'appearance-attack-1280x720.png')});
 await page.locator('[data-action=appearance-play]').click();await page.waitForTimeout(80);const pausedPreview=(await inspect()).appearancePreview;await page.waitForTimeout(150);assert.deepEqual((await inspect()).appearancePreview.sockets,pausedPreview.sockets);
 await page.locator('[data-action=appearance-facing]').click();await page.waitForTimeout(80);const mirrored=(await inspect()).appearancePreview;
 assert.equal(mirrored.flip,!pausedPreview.flip);for(const name of ['chest','hand','weapon','muzzle']){assert(Math.abs(mirrored.sockets[name].x+pausedPreview.sockets[name].x-384)<1e-5);assert(Math.abs(mirrored.sockets[name].y-pausedPreview.sockets[name].y)<1e-5);}
 await page.screenshot({path:join(evidence,'appearance-mirror-1280x720.png')});await page.keyboard.press('Escape');report.checks.push({name:'same-skin-preview-pause-and-mirrored-sockets',preview:pausedPreview,mirrored});

 await page.getByRole('button',{name:'打开人物',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.doll-hero')?.src.startsWith('data:image/png'));
 await page.screenshot({path:join(evidence,'character-figure-1280x720.png')});await page.keyboard.press('Escape');
 const equip=async base=>{
  const state=await inspect(),gear=state.snapshot.gear.find(g=>g.base===base);assert(gear,base+' missing');
  await page.getByRole('button',{name:'背包',exact:true}).click();await page.locator('[data-action=bag-category][data-id=equipment]').click();await page.locator(`[data-action=bag-select][data-id="gear:${gear.id}"]`).click();await page.locator(`[data-action=bag-character][data-id="${gear.id}"]`).click();
  // Other chats can cause the shared development API to reload. Retry only a
  // failed read quote through its actual UI; never retry an equipment write here.
  for(let attempt=0;attempt<3;attempt++){
   await page.locator(`[data-action=equip][data-id="${gear.id}"]`).click();
   await page.waitForFunction(()=>{const box=document.querySelector('.gear-comparison-box'),button=box?.querySelector('[data-action=gear-compare-confirm]');return button&&!button.disabled||box?.textContent.includes('无法读取装备对比');});
   if(!await page.locator(`[data-action=gear-compare-confirm][data-id="${gear.id}"]`).isDisabled())break;
   assert(attempt<2,'Equipment read quote failed after real UI retries');await page.locator('[data-action=gear-compare-close]').first().click();await page.waitForTimeout(750);
  }
  await page.locator(`[data-action=gear-compare-confirm][data-id="${gear.id}"]`).click();
  await page.waitForFunction(id=>window.awInspect().snapshot.equipment.weapon===id,gear.id);await page.keyboard.press('Escape');if((await inspect()).panel)await page.keyboard.press('Escape');await ready();return gear;
 };
 await equip('bow');await page.waitForFunction(()=>window.awInspect().attachments.wardrobe.family==='bow'&&window.awInspect().attachments.pose.frame.startsWith('wardrobe-'));
 const bow=await inspect();assert.equal(bow.attachments.wardrobe.parts.weapon,'400104');await page.screenshot({path:join(evidence,'equipped-bow-preserved.png')});
 await equip('blade');await native();const returned=await inspect();assert.equal(returned.attachments.wardrobe.parts.weapon,'100011');assert.equal(returned.snapshot.gold,initial.snapshot.gold);assert.equal(returned.snapshot.material,initial.snapshot.material);
 report.checks.push({name:'actual-equipment-native-legacy-native-switch-without-weapon-substitution',bow:bow.attachments.wardrobe,restored:returned.attachments.wardrobe});

 await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');const right=await inspect();await page.keyboard.down('a');await page.waitForTimeout(300);await page.keyboard.up('a');const left=await inspect();assert.notEqual(left.hero.facing,right.hero.facing);report.checks.push({name:'real-game-movement-and-facing',right:right.attachments.wardrobe,left:left.attachments.wardrobe});
 await page.keyboard.press('Space');await page.waitForTimeout(100);const paused=await inspect();await page.waitForTimeout(200);const still=await inspect();assert.equal(still.tick,paused.tick);assert.equal(still.attachments.wardrobe.frame,paused.attachments.wardrobe.frame);assert.deepEqual(still.attachments.points,paused.attachments.points);await page.keyboard.press('Space');report.checks.push({name:'battle-clock-pause-freezes-native-physics-and-sockets',tick:paused.tick,diagnostics:paused.attachments.wardrobe});

 const town=content.regions.find(r=>r.id==='town');await page.locator('[data-action=guide][data-id=portal]').click();
 await page.waitForFunction(portal=>{const h=window.awInspect().hero.position;return Math.hypot(h.x-portal.x,h.y-portal.y)<3;},town.portal,{timeout:90000});
 await page.keyboard.press('e');await page.waitForFunction(()=>window.awInspect().panel==='travel');await page.locator('[data-action=travel-mode][data-id=explore]').click();await page.locator('[data-action=travel-region][data-id=meadow]').click();await page.locator('[data-action=travel-select][data-id=meadow]').click();await page.locator('[data-action=travel-depart][data-id=meadow]').click();
 await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');await native();await page.locator('[data-action=mode][data-id=auto]').click();
 const combat=[];let photographed=false;const until=Date.now()+12000;
 while(Date.now()<until){const state=await inspect();combat.push({tick:state.tick,hp:state.hero.hp,action:state.hero.action,frame:state.attachments.wardrobe.frame,cast:state.attachments.cast,points:state.attachments.points,effects:state.attachments.effects,damageNumbers:state.attachments.damageNumbers});if(!photographed&&state.attachments.cast){await page.screenshot({path:join(evidence,'real-meadow-combat-1280x720.png')});photographed=true;}if(state.panel==='battle-result'&&state.hero.hp<=0)break;await page.waitForTimeout(60);}
 assert(combat.some(s=>s.cast),'No real cast observed');assert(combat.some(s=>s.damageNumbers.totalCreated>0),'No actual damage event observed');assert(combat.every(s=>s.frame.startsWith('mini-')),'Native renderer lost during combat');
 await page.getByRole('button',{name:'回城',exact:true}).click();await page.waitForFunction(()=>window.awInspect().region==='town'&&window.awInspect().panel==='');await native();
 const saved=await inspect();await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');await native();const restored=await inspect();
 for(const field of ['id','level','gold','xp','material','gear','equipment','appearance','progress'])assert.deepEqual(restored.snapshot[field],saved.snapshot[field],`Session restore changed ${field}`);
 await page.screenshot({path:join(evidence,'restored-camp-1280x720.png')});report.checks.push({name:'real-combat-damage-return-and-existing-session-restore',combat,restored:{id:restored.snapshot.id,revision:restored.snapshot.revision,appearance:restored.attachments.wardrobe},metrics:restored.metrics});
 report.nativeRequests=nativeRequests;assert(nativeRequests.length>=4);assert(nativeRequests.every(r=>r.status===200||r.status===304));assert.deepEqual(report.errors,[]);
 const after=await persistenceSnapshot();report.persistence={before:persistenceSummary(before),after:persistenceSummary(after),...verifyPersistence(before,after)};report.passed=true;
 console.log(JSON.stringify({passed:true,versions:report.versions,checks:report.checks.map(c=>c.name),errors:report.errors}));
}catch(error){report.error=error.stack;await page?.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await browser?.close();await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));}
