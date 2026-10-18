import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const stage=process.argv[2]??'before',out=resolve('docs/reviews/ui-game-feel-20261005',stage);
const finalStage=stage==='after'||stage==='graphic-after';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720},storageState:'.qa/ui-game-feel/session.json'});
page.setDefaultTimeout(15000);
const report={stage,origin:'http://127.0.0.1:8612/',windows:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
page.on('requestfailed',r=>{if(r.url().includes('/api/'))console.log('request failed',r.url(),r.failure());});
const windows=stage.startsWith('component-')?['bag','skills']:stage.startsWith('page-')?[stage.slice(5)]:['bag','character','skills','progression','appearance','tasks','dungeons','travel','settings'];
async function open(id){
 for(let attempt=0;attempt<30;attempt++){
  await page.evaluate(id=>{const button=document.createElement('button');button.dataset.action='panel';button.dataset.id=id;document.body.append(button);button.click();button.remove();},id);
  await page.waitForTimeout(250);
  if(await page.evaluate(id=>window.awInspect().panel===id,id))break;
 }
 await page.waitForFunction(id=>window.awInspect().panel===id,id);
 await page.locator('#modal .panel, #modal .task-window').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#modal .ui-state--loading'),null,{timeout:30000});
 if(id==='progression'||id==='appearance'){
  const retry=page.locator(`#modal [data-action=${id}-refresh]`);if(await page.locator('#modal .ui-state--error').count()&&await retry.count()){await retry.first().click();await page.waitForFunction(()=>!document.querySelector('#modal .ui-state--loading'),null,{timeout:30000});}
  await page.locator(id==='progression'?'.progression-library':'.appearance-catalog').waitFor({timeout:30000});
 }
 if(id==='bag')await page.waitForFunction(()=>document.querySelector('#preview')?.getAttribute('aria-busy')!=='true',null,{timeout:30000});
 await page.waitForTimeout(600);
 await page.waitForFunction(id=>window.awInspect?.().panel===id&&document.querySelector('#modal .panel, #modal .task-window'),id);
}
function measure(){
 const root=document.querySelector('#modal .panel, #modal .task-window'),sizes={};let grey=0,total=0,emphasisNodes=0;
 const toRgb=h=>{const n=parseInt(h.slice(1),16);return `rgb(${n>>16&255}, ${n>>8&255}, ${n&255})`;};
 const greyRgb=['--color-text-secondary','--color-text-disabled'].map(key=>toRgb(getComputedStyle(document.documentElement).getPropertyValue(key).trim()));
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()) {const text=node.textContent.trim();if(!text)continue;const el=node.parentElement;if(!el.getBoundingClientRect().width)continue;const cs=getComputedStyle(el),size=parseFloat(cs.fontSize);sizes[size]=(sizes[size]??0)+text.length;total+=text.length;if(greyRgb.includes(cs.color))grey+=text.length;if(size>=20&&!el.closest('.ui-panel-head'))emphasisNodes++;}
 const small=Object.entries(sizes).filter(([key])=>+key<=13).reduce((sum,[,value])=>sum+value,0),r=root.getBoundingClientRect();
 return {small:Math.round(small/total*100),grey:Math.round(grey/total*100),emphasisNodes,sizes,total,viewport:[innerWidth,innerHeight],bounds:[r.left,r.top,r.right,r.bottom],documentOverflow:document.documentElement.scrollWidth>innerWidth};
}
try {
 await page.goto(report.origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.awInspect);
 await page.waitForFunction(()=>window.awInspect().loggedIn||window.awInspect().panel==='takeover');
 if(await page.locator('[data-action=takeover]').count())await page.locator('[data-action=takeover]').click();
 for(let n=0;n<3;n++){try{await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='',null,{timeout:15000});break;}catch(e){if(await page.locator('[data-action=takeover]:not(:disabled)').count())await page.locator('[data-action=takeover]').click();else if(n===2)throw e;}}
 await page.waitForTimeout(2000);
 report.character=await page.evaluate(()=>({id:window.awInspect().snapshot.id,level:window.awInspect().snapshot.level,region:window.awInspect().region}));
 for(const id of windows){
  await open(id);const metrics=await page.evaluate(measure);const shot=resolve(out,`${id}-1280x720.png`);await page.mouse.move(1,1);await page.screenshot({path:shot});report.windows.push({id,...metrics,screenshot:shot});console.log(JSON.stringify({id,...metrics}));
  if(finalStage)for(const [width,height] of [[1024,768],[375,812]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const responsive=await page.evaluate(measure);await page.screenshot({path:resolve(out,`${id}-${width}x${height}.png`)});report.windows.push({id,...responsive});}
  await page.setViewportSize({width:1280,height:720});
 }
 report.versions=await page.evaluate(async()=>({health:await(await fetch('/api/health')).json(),content:(await(await fetch('/api/content')).json()).versions}));
 report.ok=report.errors.length===0&&(!finalStage||report.windows.every(w=>w.small<=35&&w.grey<=40&&w.emphasisNodes>=1&&!w.documentOverflow&&w.bounds[0]>=0&&w.bounds[1]>=0&&w.bounds[2]<=w.viewport[0]+1&&w.bounds[3]<=w.viewport[1]+1));
 if(!report.ok&&finalStage)process.exitCode=1;
}catch(error){report.ok=false;report.failure=String(error.stack);process.exitCode=1;await page.screenshot({path:resolve(out,'failure.png')});console.error(error);}
finally{await page.setViewportSize({width:1280,height:720});await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
