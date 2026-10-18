// 星潮海主线真浏览器探针：只通过玩家可见的按钮与按键推进任务，记录每一步的任务状态变化。
// 运行：node tools/probe-quest.mjs [账号] [秒数] [截图路径]
import {chromium} from 'playwright';
const origin=process.env.AW_ORIGIN??'http://127.0.0.1:8612',account=process.argv[2]??'quest_'+Date.now().toString(36),budget=Number(process.argv[3]??240)*1000,shot=process.argv[4]??'screenshots/probe-quest.png';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],log=[];
page.on('pageerror',e=>errors.push('page: '+e));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
page.on('response',async r=>{if(!r.url().includes('/api/'))return;const path=new URL(r.url()).pathname;if(r.status()>=400)errors.push(`${at()} ${r.status()} ${path} ${(await r.text().catch(()=>'')).slice(0,160)}`);else if(r.request().method()==='POST'&&!/combat\/report|control\/renew/.test(path))log.push(`${at()} POST ${path} ${r.status()}`);});
let t0=Date.now();const at=()=>((Date.now()-t0)/1000).toFixed(0)+'s';
const click=async sel=>{try{const b=page.locator(sel).first();if(await b.count()&&await b.isVisible()&&await b.isEnabled({timeout:1000})){await b.click({timeout:2000}).catch(()=>{});return true;}}catch{}return false;};
try{
 await page.goto(origin);await page.locator('#username').fill(account);await page.locator('#username').press('Enter');
 const create=page.getByRole('button',{name:'进入营地',exact:true});await Promise.race([create.waitFor({timeout:8000}).then(()=>create.click()),page.waitForFunction(()=>window.awInspect?.().loggedIn,null,{timeout:8000})]).catch(()=>{});
 await page.waitForFunction(()=>window.awInspect?.().metrics.frames>30,null,{timeout:60000}).catch(()=>{});
 const islands=['ss-map-wind','ss-map-mist','ss-map-forge','ss-map-frost','ss-map-rift','ss-map-dragon'];let lastPhase='',lastMsg='',last='',lastGo=0,blockedSince=0,lastAction='',lowHp=1e9;
 while(Date.now()-t0<budget){
  const s=await page.evaluate(()=>{if(!window.awInspect?.().loggedIn)return null;const s=window.awInspect(),v=s.snapshot?.starseaView;return{panel:s.panel,blocked:s.blocked,region:s.region,gate:s.bossPortal,hero:s.hero.position,hp:s.hero.hp,enemies:s.enemies,level:s.snapshot?.level,result:!!s.battleResult,task:v?.task?.id,step:v?.step,chapter:v?.chapter?.n,features:v?.features,mode:s.mode,lastError:s.lastError,low:!!document.querySelector('#starsea-hud .starsea-hud-level.is-low')};}).catch(()=>null);
  if(!s){const make=page.getByRole('button',{name:'进入营地',exact:true});if(await make.isVisible().catch(()=>false)){await make.click().catch(()=>{});log.push(`${at()} create character`);await page.waitForTimeout(3000);continue;}if(await page.getByRole('button',{name:/接管/}).first().isVisible().catch(()=>false)){await page.getByRole('button',{name:/接管/}).first().click().catch(()=>{});log.push(`${at()} takeover`);}if(!log.at(-1)?.endsWith('page reloading'))log.push(`${at()} page reloading`);await page.waitForTimeout(2000);continue;}
  const key=`${s.task}|${s.step?.op}|${s.step?.label}|${s.step?.count}/${s.step?.need}|${s.region}|L${s.level}`;
  if(key!==last){log.push(`${at()} ${key}`);last=key;}
  if(s.hp>0&&s.hp<lowHp-40){lowHp=s.hp;log.push(`${at()} hp ${Math.round(s.hp)} enemies ${s.enemies}`);}else if(s.hp>lowHp+80)lowHp=s.hp;
  if(s.blocked){if(!blockedSince)log.push(`${at()} blocked: ${s.lastError}`);blockedSince||=Date.now();if(Date.now()-blockedSince>5000&&await click('[data-action=recover]')){log.push(`${at()} recover clicked`);await page.waitForTimeout(3000);}if(Date.now()-blockedSince>60000){const why=await page.evaluate(()=>[...document.querySelectorAll('.toast,[role=status],[role=alert],.notice,.ui-toast')].map(e=>e.textContent?.trim()).filter(Boolean).join(' | '));log.push(`${at()} BLOCKED for 60s: ${why}`);break;}await page.waitForTimeout(500);continue;}blockedSince=0;
  if(!s.task&&s.chapter==null){log.push('campaign complete');break;}
  if(s.result){const msg=await page.locator('.result-message').innerText().catch(()=>'');if(msg!==lastMsg){log.push(`${at()} result: ${msg.replace(/\s+/g,' ')} hp=${s.hp} after=${lastAction}`);lastMsg=msg;}const info=await page.evaluate(()=>{const b=document.querySelector('[data-action=result-return]');const s=window.awInspect();return {phase:s.battleResult?.phase,btn:b?.outerHTML.slice(0,200),panel:s.panel,blocked:s.blocked};});if(info.phase!==lastPhase){log.push(`${at()} ${JSON.stringify(info)}`);lastPhase=info.phase;}if(!await click('[data-action=result-return]'))await page.keyboard.press('Escape');await page.waitForTimeout(500);continue;}
  if(s.panel==='starsea-chart'){const target=s.low?islands[s.chapter-1]:s.step?.map;if(!(target&&await click(`[data-action=starsea-sail][data-id="${target}"]`)))await page.keyboard.press('Escape');await page.waitForTimeout(1500);continue;}
  if(s.panel==='starsea-talk'){if(!await click('[data-action=starsea-talk]')&&!await click('[data-action=starsea-line]')&&!await click('[data-action=starsea-skip]'))await page.keyboard.press('Escape');await page.waitForTimeout(400);continue;}
  if(s.panel){log.push(`${at()} closing panel ${s.panel}`);await page.keyboard.press('Escape');await page.waitForTimeout(400);continue;}
  if(s.hp<=0){log.push(`${at()} hero down`);break;}
  // 低于推荐等级：回到本章岛屿开全自动历练；岛上清空后重新进入开始新一轮。
  if(s.low&&s.step?.op==='boss'){const island=islands[s.chapter-1];
   if(s.region!==island||s.enemies===0){if(Date.now()-lastGo>4000){lastGo=Date.now();await click('#starsea-hud [data-action=starsea-chart]');lastAction=at()+' grind-chart';}}
   else if(s.mode!=='auto'){await click('[data-action=hud-mode-toggle]');await page.waitForTimeout(200);if(await click('[data-action=mode][data-id=auto]'))log.push(`${at()} auto on ${island}`);}
   await page.waitForTimeout(1000);continue;}
  const point=s.step?.points?.find(p=>!p.done),near=point&&s.region===s.step.map&&Math.hypot(s.hero.x-point.x,s.hero.y-point.y)<2.5;
  // 首领步骤：先寻路到本岛首领门，再按 E 进入（任务栏不直传首领场）。
  if(s.step?.op==='boss'&&s.region!==s.step.map&&s.gate&&Math.hypot(s.hero.x-s.gate.x,s.hero.y-s.gate.y)<3){await page.keyboard.press('e');lastAction=at()+' E gate';await page.waitForTimeout(1500);continue;}
  if(near&&['interact','talk','choose'].includes(s.step.op)){await page.keyboard.press('e');lastAction=at()+' E';await page.waitForTimeout(600);continue;}
  if(Date.now()-lastGo>4000&&(s.step?.op!=='wave'||!near)){lastGo=Date.now();if(await click('#starsea-hud [data-action=starsea-goto]'))lastAction=at()+' goto';else if(await click('#starsea-hud [data-action=starsea-sail]'))lastAction=at()+' sail';else if(await click('#starsea-hud [data-action=starsea-chart]'))lastAction=at()+' chart';}
  await page.waitForTimeout(700);
 }
 await page.screenshot({path:shot});
 console.log(JSON.stringify({account,log,errors:[...new Set(errors)].slice(0,30)},null,1));
}finally{await browser.close();}
