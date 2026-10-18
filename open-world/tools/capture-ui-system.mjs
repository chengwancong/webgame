import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const phase=process.argv[2]??'baseline',origin='http://127.0.0.1:8612';
const folder=resolve('../.design/global-ui-system'),out=resolve(folder,'screenshots');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={phase,errors:[],screens:[]};
page.on('pageerror',error=>report.errors.push(String(error)));
const viewports=[{width:1280,height:720},{width:1024,height:576},{width:768,height:1024},{width:1600,height:900},{width:1920,height:1080},{width:375,height:812}];
async function capture(name){for(const viewport of viewports){await page.setViewportSize(viewport);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const filename=`${phase}-${name}-${viewport.width}x${viewport.height}.png`;await page.mouse.move(1,1);await page.screenshot({path:resolve(out,filename)});const details=await page.evaluate(()=>{const root=document.querySelector('#modal [role=dialog],#modal .panel,#modal .task-window'),r=root?.getBoundingClientRect();return {bounds:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,fonts:root?[...new Set([...root.querySelectorAll('h1,h2,h3,p,button')].map(node=>{const s=getComputedStyle(node);return [node.tagName,s.fontSize,s.fontWeight,s.color].join('/');}))]:[],loading:root?.textContent?.includes('正在读取')};});report.screens.push({name,...viewport,filename,...details});}await page.setViewportSize(viewports[0]);}
try{
 await page.goto(origin);await page.locator('#username').waitFor();await capture('login');
 await page.locator('#username').fill('ui_system_'+Date.now().toString(36));await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await capture('create');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.waitForLoadState('networkidle');await capture('hud');
 for(const id of ['bag','character','skills','appearance','progression','tasks','settings']){
  await page.locator(`[data-action=panel][data-id=${id}]`).first().click();await page.waitForFunction(id=>window.awInspect().panel===id,id);await page.waitForLoadState('networkidle');if(id==='bag')await page.locator('#preview[data-seq]').waitFor();if(id==='progression')await page.locator('.progression-content').waitFor();if(id==='tasks')await page.locator('.task-list-row').first().waitFor();await capture(id);
  await page.locator('#modal [data-action=close]').first().click();
 }
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(folder,phase+'-audit.json'),JSON.stringify(report,null,2));
 const images=report.screens.filter(s=>s.width===1280&&s.height===720);let gallery=`<!doctype html><meta charset="utf-8"><title>${phase} 页面盘点</title><style>body{background:#081c2d;color:#f7e6c8;font:16px sans-serif;padding:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{display:block;width:100%;margin-top:6px}h1{font-size:26px}</style><h1>${phase} · 1280×720 页面盘点</h1><div class="grid">`;
 for(const image of images)gallery+=`<figure><figcaption>${image.name}</figcaption><img src="screenshots/${image.filename}"></figure>`;gallery+='</div>';await writeFile(resolve(folder,phase+'-gallery.html'),gallery);
 console.log(JSON.stringify({phase,screens:report.screens.length,errors:report.errors,error:report.error}));
}
