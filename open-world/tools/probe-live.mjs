// 对正在运行的本地服务做一次真实浏览器探针：登录、等待场景帧、截图并输出错误。
// 运行：node tools/probe-live.mjs [账号] [截图路径]
import {chromium} from 'playwright';
const origin=process.env.AW_ORIGIN??'http://127.0.0.1:8612',account=process.argv[2]??'probe_'+Date.now().toString(36),shot=process.argv[3]??'screenshots/probe-live.png';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],pending=new Map();
page.on('pageerror',e=>errors.push('page: '+e));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.type()+': '+m.text().slice(0,300));});
page.on('request',r=>pending.set(r,r.url()));page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>{pending.delete(r);errors.push('failed: '+r.url());});
try{
 await page.goto(origin);await page.locator('#username').fill(account);await page.locator('#username').press('Enter');
 const create=page.getByRole('button',{name:'进入营地',exact:true});await Promise.race([create.waitFor({timeout:8000}).then(()=>create.click()),page.waitForFunction(()=>window.awInspect?.().loggedIn,null,{timeout:8000})]).catch(()=>{});
 const started=Date.now();await page.waitForFunction(()=>window.awInspect?.().metrics.frames>30,null,{timeout:60000}).catch(()=>{});
 const state=await page.evaluate(()=>{const s=window.awInspect();return{loggedIn:s.loggedIn,region:s.region,hero:s.hero.position,enemies:s.enemies,metrics:s.metrics,level:s.snapshot?.level,starsea:s.snapshot?.starseaView?.step,hud:document.getElementById('starsea-hud')?.innerText};});
 await page.screenshot({path:shot});
 console.log(JSON.stringify({account,waitMs:Date.now()-started,state,errors:errors.slice(0,30),pending:[...pending.values()].slice(0,20)},null,1));
}finally{await browser.close();}
