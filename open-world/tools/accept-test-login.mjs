import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const evidence=resolve('../docs/reviews/open-world/internal-login-20260930');await mkdir(evidence,{recursive:true});
const db=await startDatabase({temporary:true});let api,web,browser;const errors=[];
try{
 const test=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--no-file-parallelism','tests/test-login.test.ts','tests/database.test.ts'],{env:{...process.env,AW_DATABASE_URL:db.dsn},encoding:'utf8'});console.log(test.stdout,test.stderr);assert.equal(test.status,0);
 const apiPort=await freePort(),webPort=await freePort(),origin=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:origin});await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_API_PORT:String(apiPort),AW_WEB_PORT:String(webPort)});await waitFor(origin,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));await page.goto(origin);await page.getByRole('button',{name:'进入游戏',exact:true}).waitFor();assert.equal(await page.locator('#password').count(),0);await page.screenshot({path:resolve(evidence,'login.png')});
 await page.locator('#username').fill('browser_test');await page.locator('#username').press('Enter');await page.locator('#hero-name').waitFor();await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn===true);const first=await page.evaluate(()=>window.awInspect().snapshot.id);
 await page.evaluate(async()=>{await fetch('/api/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});});await page.reload();await page.getByRole('button',{name:'进入游戏',exact:true}).waitFor();await page.locator('#username').fill('browser_test');await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn===true);assert.equal(await page.evaluate(()=>window.awInspect().snapshot.id),first);assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({passed:true,checks:['development defaults to account-only','username-only UI','Enter login','new account and character','same account restores character','concurrent login','password preservation','normal mode requires password','production guard'],errors},null,2));
}finally{await browser?.close();await stopChild(web);await stopChild(api);const cleanup=await db.stop();await writeFile(resolve(evidence,'cleanup-'+Date.now()+'.json'),JSON.stringify(cleanup,null,2));console.log(cleanup);}
