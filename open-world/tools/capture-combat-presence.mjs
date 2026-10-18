import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {skillCatalog} from '../packages/content/index.ts';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const phase=process.argv[2]??'after',folder=resolve('../docs/reviews/open-world/combat-presence-20261004');await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
const samples=new Set(['cut','dual_strike','whirl','blade_fury','rush','cleave','ground_slam','fireball','arcane_missile','frost_bolt','dark_arrow','lightning_bolt','nova','meteor','ember','gravity_well','vortex','barrage','rain_of_arrows','ward','mend','time_stop','war_cry']);
const selected=process.argv.find(a=>a.startsWith('--skills='))?.slice(9).split(',');
const inspect=()=>{const q=window.awCombatQA();return {selected:q.selected,casting:q.casting,tick:q.tick,release:q.release,impacts:q.impacts,hero:q.hero,enemies:q.enemies,paused:q.paused,metrics:q.metrics,pose:q.attachments.pose,points:q.attachments.points,effects:q.attachments.effects};};
try{
 if(process.argv.includes('--resume')){const partial=JSON.parse(await readFile(resolve(folder,`${phase}-partial.json`),'utf8'));cases.push(...partial.cases);}
 await page.goto('http://127.0.0.1:8612/combat-art-qa.html');await page.waitForFunction(()=>window.awCombatQA?.().attachments.effects?.ready);
 for(const skill of skillCatalog){
  if(selected&&!selected.includes(skill.id))continue;
  if(cases.some(c=>c.id===skill.id))continue;
  await page.locator(`[data-skill="${skill.id}"]`).click();await page.waitForFunction(id=>{const q=window.awCombatQA?.();return q?.selected===id&&q.tick>=2&&q.attachments.wardrobe?.ready&&!q.attachments.wardrobe.pending;},skill.id);
  await page.evaluate(()=>{document.querySelector('#cast').click();document.querySelector('#pause').click();});const first=await page.evaluate(inspect),states=[];
  for(let n=0;n<=skill.windup+30;n++){
   const q=await page.evaluate(inspect);states.push(q);if(samples.has(skill.id)&&q.release>0&&[2,8,20].includes(q.tick-q.release))await page.screenshot({path:resolve(folder,`${phase}-${skill.id}-${q.tick-q.release}.png`),clip:{x:290,y:140,width:840,height:510}});
   if(n===skill.windup+30)break;await page.evaluate(()=>document.querySelector('#frame').click());await page.waitForFunction(t=>window.awCombatQA?.().tick>t,q.tick);
  }
  assert.ok(first.casting,skill.id+' starts');assert.ok(states.some(s=>s.release>0),skill.id+' releases');assert.ok(states.some(s=>s.effects.pool.active>0),skill.id+' has visuals');assert.ok(states.every(s=>!s.effects.errors.length),skill.id+' registered materials');
  const last=states.at(-1);await page.waitForTimeout(50);const frozen=await page.evaluate(inspect);assert.equal(frozen.tick,last.tick);assert.deepEqual(frozen.effects.images,last.effects.images);cases.push({id:skill.id,kind:skill.kind,startTick:first.tick,states,pauseStable:true});
  if(cases.length%10===0)console.log(JSON.stringify({phase,completed:cases.length,total:skillCatalog.length}));
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(folder,`${phase}.json`),JSON.stringify({phase,cases,errors},null,2));console.log(JSON.stringify({phase,cases:cases.length,errors,folder}));
}catch(e){await writeFile(resolve(folder,`${phase}-partial.json`),JSON.stringify({phase,cases,errors,error:String(e.stack)},null,2));throw e;}finally{await browser.close();}
