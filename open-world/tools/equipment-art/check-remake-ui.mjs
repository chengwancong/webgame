// Additional real-window and delivery-gallery checks after the asset hash acceptance.
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const review=resolve('../docs/reviews/open-world/equipment-icons-chibi-20261004');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('http://127.0.0.1:8611');await page.locator('#username').waitFor();
 await page.locator('#username').fill('art_ui_20261004');
 await page.getByRole('button',{name:'进入游戏',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#hero-name')||window.awInspect?.().loggedIn);
 if(await page.locator('#hero-name').count())await page.getByRole('button',{name:'进入营地',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 await page.waitForLoadState('networkidle');
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();
 await page.waitForFunction(()=>window.awInspect?.().panel==='bag');
 const images=await page.locator('#modal img').evaluateAll(images=>Promise.all(images.map(async image=>{await image.decode();const box=image.getBoundingClientRect();return{src:image.getAttribute('src'),natural:[image.naturalWidth,image.naturalHeight],display:[box.width,box.height]};})));
 assert(images.length>0);assert(images.every(image=>image.natural.every(value=>value>0)));
 const bounds=await page.locator('#modal .panel').boundingBox();assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1280&&bounds.y+bounds.height<=720);
 await page.screenshot({path:resolve(review,'published/inventory-1280x720.png')});
 await page.keyboard.press('Escape');
 const gallery=await browser.newPage({viewport:{width:1280,height:900}});
 gallery.on('pageerror',error=>errors.push(String(error)));
 await gallery.goto(pathToFileURL(resolve(review,'final/all-equipment.html')).href);
 await gallery.locator('#family').selectOption('wand');assert.equal(await gallery.locator('section:visible').count(),9);
 await gallery.locator('#series').selectOption('primal');assert.equal(await gallery.locator('section:visible').count(),3);
 await gallery.locator('#tier').selectOption('T2');assert.equal(await gallery.locator('section:visible').count(),1);assert.equal(await gallery.locator('.tile:visible').count(),6);
 await gallery.locator('#gray').click();assert(await gallery.locator('body').evaluate(body=>body.classList.contains('mono')));
 assert.deepEqual(errors,[]);
 await writeFile(resolve(review,'published/ui-result.json'),JSON.stringify({ok:true,productionOrigin:'http://127.0.0.1:8611',inventoryVisible:true,inventoryImages:images,panelBounds:bounds,galleryFilters:{familySets:9,seriesSets:3,tierSets:1,parts:6,grayToggle:true},errors},null,2)+'\n');
 console.log(JSON.stringify({ok:true,inventoryImages:images.length,galleryFilters:true,errors:0}));
}finally{await browser.close();}
