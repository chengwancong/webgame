// Read the real local service, log in with an isolated QA account, and decode every published icon.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {versions,equipmentCatalogSchema,equipmentItemSchema} from '../../packages/contracts/index.ts';

const origin=process.env.AW_ART_QA_ORIGIN??'http://127.0.0.1:8612';
const checkCatalog=process.argv.includes('--catalog');
const out=resolve(process.env.AW_ART_QA_OUT??(checkCatalog?'../docs/reviews/open-world/equipment-item-catalog-20261001':'../docs/reviews/open-world/equipment-icons-handdrawn-20261001/published'));await mkdir(out,{recursive:true});
const library=JSON.parse(await readFile('assets/ui-source/v2/equipment-handdrawn/catalog.json','utf8'));
const health=await (await fetch(origin+'/api/health')).json(),content=await (await fetch(origin+'/api/content')).json();
assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');assert.equal(library.items.length,324);
const servedHashes=[];
for(let offset=0;offset<library.items.length;offset+=8){
 servedHashes.push(...await Promise.all(library.items.slice(offset,offset+8).map(async item=>{
  const response=await fetch(origin+item.path+'?v='+encodeURIComponent(versions.assets));assert.equal(response.status,200,item.id);
  const sha256=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');assert.equal(sha256,item.sha256,'Served artwork differs from reviewed source: '+item.id);return{id:item.id,sha256};
 })));
}
let catalog;
if(checkCatalog){
 catalog=equipmentCatalogSchema.parse(await (await fetch(origin+'/api/items')).json());
 const source=JSON.parse(await readFile('packages/content/equipment-catalog.json','utf8'));
 assert.deepEqual(catalog,source);assert.deepEqual(content.equipmentItems,catalog.items);
 for(const part of ['weapon','armor','helmet','boots','necklace','ring']){
  const item=catalog.items.findLast(i=>i.part===part),response=await fetch(origin+'/api/items/'+item.id);
  assert.equal(response.status,200);assert.deepEqual(equipmentItemSchema.parse(await response.json()),item);
 }
 assert.equal((await fetch(origin+'/api/items/unknown-item')).status,404);
 assert(catalog.items.every(i=>i.status==='registered'&&i.obtainable&&i.runtimeBase===i.id));
}
let browser,page;const errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#username').waitFor();assert.equal(await page.locator('#password').count(),0);
 await page.locator('#username').fill(process.env.AW_ART_QA_USERNAME??'equipment_art_'+Date.now().toString(36));await page.getByRole('button',{name:'进入游戏',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#hero-name')||window.awInspect?.().loggedIn);
 if(await page.locator('#hero-name').count())await page.getByRole('button',{name:'进入营地',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 await page.waitForFunction(()=>{const view=window.awInspect();return view.region===(view.snapshot.lastRegion??view.snapshot.progress.safe);});
 await page.waitForLoadState('networkidle');
 if(await page.locator('#modal.open').isVisible().catch(()=>false))await page.keyboard.press('Escape');
 if(await page.locator('[data-action=hud-mode-toggle]').isVisible().catch(()=>false)){await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=manual]').click();}
 const first=await page.evaluate(()=>{const s=window.awInspect();return{id:s.snapshot.id,region:s.region,safe:s.snapshot.progress.safe,resume:s.snapshot.lastRegion??s.snapshot.progress.safe};});assert.equal(first.region,first.resume);
 const priorGear=await page.evaluate(()=>window.awInspect().snapshot.gear);
 if(checkCatalog){
  const drops=await page.evaluate(async()=>await (await fetch('/api/travel/meadow/drops')).json());
  assert.deepEqual(drops.equipment.map(i=>i.base).sort(),[...catalog.items.filter(item=>item.tier===1).map(item=>item.runtimeBase),'blade','bow','charm','coat','core','shield'].sort());
  assert.deepEqual(priorGear.map(i=>i.base).sort(),['blade','bow','charm','coat','core','shield']);
 }
 const imageItems=catalog?catalog.items.map(item=>({id:item.id,path:library.items.find(asset=>asset.id===item.iconId).path})):library.items;
 const decoded=await page.evaluate(items=>Promise.all(items.map(async item=>{const image=new Image();image.src=item.path;await image.decode();return{id:item.id,size:[image.naturalWidth,image.naturalHeight]};})),imageItems);
 assert(decoded.every(i=>i.size[0]===256&&i.size[1]===256));
 await page.screenshot({path:resolve(out,'camp-1280x720.png')});
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 assert.equal(await page.evaluate(()=>window.awInspect().snapshot.id),first.id);assert.deepEqual(errors,[]);
 assert.deepEqual(await page.evaluate(()=>window.awInspect().snapshot.gear),priorGear);
 await writeFile(resolve(out,'result.json'),JSON.stringify({ok:true,origin,versions:health.versions,auth_mode:health.auth_mode,icons:decoded.length,sets:54,servedHashes,catalog:catalog?{items:catalog.items.length,lookupParts:6,unknownItemStatus:404,worldDropBasesUnchanged:true}:undefined,sessionRestore:true,gearPreserved:true,character:first,decoded,errors},null,2)+'\n');
 console.log(JSON.stringify({ok:true,icons:324,sets:54,versions:health.versions,accountOnly:true,sessionRestore:true,evidence:out}));
}catch(error){if(page){await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});const state=await page.evaluate(()=>{const view=window.awInspect?.();return{panel:view?.panel,region:view?.region,safe:view?.snapshot?.progress.safe,resume:view?.snapshot?.lastRegion,loggedIn:view?.loggedIn,body:document.body.innerText.slice(-1400)};}).catch(()=>null);await writeFile(resolve(out,'result.json'),JSON.stringify({ok:false,error:String(error),state,versions:health.versions,servedIcons:servedHashes.length,errors},null,2)+'\n');}throw error;}finally{await browser?.close();}
