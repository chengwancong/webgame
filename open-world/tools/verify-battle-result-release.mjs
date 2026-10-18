import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {versions} from '../packages/contracts/index.ts';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const label=process.argv[2]??'battle-result',out=resolve('../docs/reviews/open-world/'+label+'-release');await mkdir(out,{recursive:true});
const report={ok:false,versions,checks:[],errors:[]},before=await persistenceSnapshot(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const username='br_release_'+Date.now().toString(36);let character;
try{
 const a=JSON.parse(await readFile('../.design/global-ui-system/release-source-'+label+'-before.json','utf8')),b=JSON.parse(await readFile('../.design/global-ui-system/release-source-'+label+'-after.json','utf8'));assert.equal(a.sha256,b.sha256);report.source=b;
 for(const port of [8611,8612]){
  const origin='http://127.0.0.1:'+port,context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  const health=await(await context.request.get(origin+'/api/health')).json(),content=await(await context.request.get(origin+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');
  await page.goto(origin);await page.locator('#username').fill(username);assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();
  if(!character){await page.locator('[data-action=create]').click();}
  await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel===''&&window.awInspect().region==='town');const s=await page.evaluate(()=>window.awInspect().snapshot);if(character)assert.equal(s.id,character);character=s.id;
  await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.deepEqual(restored,s);await page.screenshot({path:resolve(out,'release-camp-'+port+'.png')});
  assert.equal((await context.request.post(origin+'/api/logout',{data:{}})).status(),200);await context.close();report.checks.push({port,health:health.versions,accountOnly:true,sessionRestored:true});
 }
 const state=JSON.parse(await readFile('.runtime/service/state.json','utf8'));const response=await fetch('http://127.0.0.1:'+state.port+'/status',{headers:{authorization:'Bearer '+state.token},signal:AbortSignal.timeout(5000)});assert(response.ok);const service=await response.json();assert.equal(service.phase,'running');report.service={phase:service.phase,pid:service.pid,components:service.components};
 report.persistence={before:persistenceSummary(before),after:persistenceSummary(await persistenceSnapshot()),verification:verifyPersistence(before,await persistenceSnapshot())};assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(out,'release-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
