import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {versions} from '../packages/contracts/index.ts';

const origin=process.env.AW_UI_QA_ORIGIN??'http://127.0.0.1:8612';
const out=resolve('../docs/reviews/open-world/character-six-parts-20261001');await mkdir(out,{recursive:true});
const report={ok:false,versions,checks:[],errors:[]};let browser,page;
const parts=['weapon','armor','helmet','boots','necklace','ring'];
const record=(name,data={})=>report.checks.push({name,...data});
try{
 const health=await(await fetch(origin+'/api/health')).json(),content=await(await fetch(origin+'/api/content')).json();
 assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(origin);await page.locator('#username').fill('six_parts_'+Date.now().toString(36));assert.equal(await page.locator('#password').count(),0);
 await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('[data-action=create]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const initial=await page.evaluate(()=>({id:window.awInspect().snapshot.id,gear:window.awInspect().snapshot.gear}));
 await page.locator('[data-action=panel][data-id=bag]').click();
 const slots=page.locator('.doll-stage [data-action=filter-slot]');assert.equal(await slots.count(),6);
 assert.deepEqual((await slots.evaluateAll(nodes=>nodes.map(n=>n.dataset.id))).sort(),[...parts].sort());
 const geometry=()=>slots.evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect(),s=getComputedStyle(node),image=node.querySelector('img'),i=image?.getBoundingClientRect();return{id:node.dataset.id,x:b.x,y:b.y,width:b.width,height:b.height,border:s.borderWidth,padding:s.padding,image:i?[i.width,i.height]:null};}));
 const stable=(before,after)=>{for(const a of before){const b=after.find(x=>x.id===a.id);for(const key of ['x','y','width','height'])assert(Math.abs(a[key]-b[key])<.1,`${a.id} ${key} shifted`);assert.equal(a.border,b.border);assert.equal(a.padding,b.padding);if(a.image&&b.image)assert.deepEqual(a.image,b.image);}};
 const baseGeometry=await geometry();for(const box of baseGeometry){assert(box.x>=0&&box.y>=0&&box.x+box.width<=1280&&box.y+box.height<=720);}
 for(let a=0;a<baseGeometry.length;a++)for(let b=a+1;b<baseGeometry.length;b++){const x=baseGeometry[a],y=baseGeometry[b];assert(x.x+x.width<=y.x||y.x+y.width<=x.x||x.y+x.height<=y.y||y.y+y.height<=x.y,'Equipment slots overlap');}
 record('six-parts-visible', {geometry:baseGeometry});await page.screenshot({path:resolve(out,'initial-1280x720.png')});
 for(const part of ['helmet','boots','ring']){
  const button=page.locator(`.doll-stage [data-action=filter-slot][data-id=${part}]`);await button.focus();await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.grid24 .gear-card').count(),0);
  assert.equal(await page.locator('.gear-detail [data-action=equip]').count(),0);
  const emptyMessage=await page.locator('.gear-detail [role=status]').textContent();assert(emptyMessage.includes({helmet:'头盔',boots:'鞋子',ring:'戒指'}[part])&&emptyMessage.includes('暂无'));
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.id),part);stable(baseGeometry,await geometry());
 }
 await page.screenshot({path:resolve(out,'empty-ring-1280x720.png')});record('empty-parts-and-keyboard',{parts:['helmet','boots','ring'],focusPreserved:true});
 async function reset(){await page.locator('[data-action=gear-slot][data-id=""]').click();}
 async function equip(base,slot){
  await reset();const gear=initial.gear.find(g=>g.base===base);await page.locator(`.grid24 [data-action=select][data-id="${gear.id}"]`).click();
  await page.locator('.gear-detail [data-action=equip]').click();await page.locator('[data-action=gear-compare-confirm]').click();
  await page.waitForFunction(({slot,id})=>window.awInspect().snapshot.equipment[slot]===id,{slot,id:gear.id});return gear;
 }
 const charm=await equip('charm','accessory');
 await page.waitForFunction(id=>document.querySelector('.doll-stage [data-id=necklace]')?.getAttribute('data-equipment-tip')===id,charm.id);
 stable(baseGeometry,await geometry());await page.locator('.doll-stage [data-id=necklace]').click();
 assert.equal(await page.locator('.grid24 .gear-card').count(),1);assert.equal(await page.locator('.grid24 .gear-card').getAttribute('data-id'),charm.id);
 const core=await equip('core','core');await page.waitForFunction(()=>window.awInspect().snapshot.stats.effects.includes('burn'));
 assert.equal(await slots.count(),6);assert.equal(await page.locator('.doll-stage [data-id=ring]').getAttribute('data-equipment-tip'),null);
 // The legacy control is deliberately outside the six character part slots.
 const legacy=page.locator('.doll [data-action=filter-slot][data-id=core]');await legacy.waitFor();await legacy.click();
 assert.equal(await page.locator('.grid24 .gear-card').count(),2);assert.equal(await page.evaluate(()=>window.awInspect().snapshot.equipment.core),core.id);
 record('legacy-equipment-preserved',{necklace:charm.id,legacyCore:core.id,coreEffect:'burn'});
 await reset();const afterEquip=await geometry();stable(baseGeometry,afterEquip);
 for(const part of parts){await page.locator(`.doll-stage [data-id=${part}]`).click();stable(afterEquip,await geometry());}
 await reset();
 for(const gear of initial.gear){await page.locator(`.grid24 [data-action=select][data-id="${gear.id}"]`).click();stable(afterEquip,await geometry());}
 await page.locator('.doll-stage [data-id=necklace]').hover();
 await page.waitForFunction(name=>{const tip=document.querySelector('#tooltip');return tip&&getComputedStyle(tip).display!=='none'&&tip.getAttribute('aria-busy')==='false'&&tip.querySelector('h3')?.textContent.includes(name);},charm.name);
 await page.keyboard.press('Escape');await page.locator('#tooltip').waitFor({state:'hidden'});assert.equal(await page.locator('.panel[data-panel=bag]').count(),1);
 record('equipment-tooltip',{hoverStillWorks:true,escapeClosesOnlyTip:true,slotClickDoesNotBlockFilters:true});
 await page.locator('.panel[data-panel=bag] .panel-head h2').click();await page.mouse.move(10,10);await page.locator('#tooltip').waitFor({state:'hidden'});await page.screenshot({path:resolve(out,'final-1280x720.png')});
 const equipped=await page.evaluate(()=>window.awInspect().snapshot.equipment);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(restored.id,initial.id);assert.deepEqual(restored.gear,initial.gear);assert.deepEqual(restored.equipment,equipped);
 await page.locator('[data-action=panel][data-id=bag]').click();assert.equal(await slots.count(),6);assert.deepEqual(report.errors,[]);
 record('selection-and-reload',{stableGeometry:true,sameCharacter:true,inventoryPreserved:true,equipmentPreserved:true});
 await page.setViewportSize({width:768,height:1024});await slots.last().scrollIntoViewIfNeeded();
 const narrow=await geometry();assert(narrow.every(b=>b.width>0&&b.height>0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const scrolled=await page.locator('.bag-v2').evaluate(node=>{node.scrollTop=Math.min(120,node.scrollHeight-node.clientHeight);return node.scrollTop;});
 assert(scrolled>0,'Narrow layout must allow scrolling to inventory controls');
 await page.locator(`.grid24 [data-action=select][data-id="${initial.gear.find(g=>g.base==='bow').id}"]`).click();
 assert(Math.abs(await page.locator('.bag-v2').evaluate(node=>node.scrollTop)-scrolled)<1,'Item selection resets character panel scrolling');
 record('narrow-scroll-preserved',{scrollTop:scrolled});await page.locator('.bag-v2').evaluate(node=>node.scrollTop=0);
 await page.screenshot({path:resolve(out,'narrow-768x1024.png')});record('narrow-six-parts',{viewport:[768,1024],visibleParts:narrow.length});
 await page.setViewportSize({width:1280,height:720});report.ok=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;console.error(error);await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}
finally{await browser?.close();await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,evidence:out}));}
