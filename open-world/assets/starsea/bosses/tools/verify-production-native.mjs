import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './preview-server.mjs';
const server=await createServer({configFile:false,root:join(root,'apps/web'),publicDir:join(root,'apps/web/public'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[root]}},logLevel:'error'});await server.listen();
const origin='http://127.0.0.1:'+server.httpServer.address().port,report={passed:false,actualRenderer:'apps/web/src/mini-native-renderer.ts:MiniNativePreview',ids:[],errors:[],limits:['Isolated Vite + real production renderer; no persistent services, player accounts or gameplay writes.','Headless software GPU, not a hardware performance result.']};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/@fs/'+root.replaceAll('\\','/')+'/assets/starsea/bosses/tools/native-qa.html');await page.waitForFunction(()=>window.bossProductionQA?.imported,{timeout:45000});
 const manifest=JSON.parse(await readFile(join(root,'assets/starsea/bosses/manifest.json'),'utf8'));
 for(const asset of manifest.assets){
  const bundles=[{profile:asset.runtime.profile,action:'attack'},...Object.values(asset.actions.skills).flatMap(s=>[{profile:s.profiles.default,action:'skill'},{profile:s.profiles['phase-active'],action:'skill'}]),...['phase-enter','phase-active','phase-end'].map(state=>({profile:asset.states[state].profile,action:'idle'}))];
  const item={id:asset.id,checks:[],deathPhaseCombinations:[]};
  for(const bundle of bundles){
   const load=await page.evaluate(async({asset,profile})=>window.bossProductionQA.load(asset,profile),{asset,profile:bundle.profile});assert.equal(load.ready,true,asset.id+' production profile rejected');assert.deepEqual(load.errors,[]);
   const left=await page.evaluate(({a})=>window.bossProductionQA.pose(a,.35,-1),{a:bundle.action});const right=await page.evaluate(({a})=>window.bossProductionQA.pose(a,.35,1),{a:bundle.action});
   assert(left.pixels.alpha>1000);assert.equal(left.native.version,'4.2.43');assert.equal(left.native.displayScale,150/left.native.referenceHeight);assert.deepEqual(left.sockets.feet,{x:420,y:240});
   for(const name of ['hand','weapon','muzzle','chest']){assert(Math.abs(left.sockets[name].x+right.sockets[name].x-840)<1e-6);assert(Math.abs(left.sockets[name].y-right.sockets[name].y)<1e-6);}
   const p=await page.evaluate(()=>window.bossProductionQA.portrait());assert(p.success&&p.alpha>1000,asset.id+' same-subject native portrait failed');
   const q=JSON.parse(await readFile(join(root,'apps/web/public'+bundle.profile),'utf8')),motion=q.weapons[asset.id].actions[bundle.action];
   if(motion.impactTime!==undefined){const release=await page.evaluate(({a})=>window.bossProductionQA.pose(a,0,-1,{elapsed:.8,windup:.8,recovery:.4}),{a:bundle.action});assert(Math.abs(release.native.mappedTime-motion.impactTime)<1e-7);assert(Math.abs(release.native.sourceTime-motion.impactTime)<1/60+1e-7);}
   item.checks.push({profile:bundle.profile,action:bundle.action,ready:true,alpha:left.pixels.alpha,native:left.native,mirror:true,portrait:p,castSync:motion.impactTime!==undefined});
  }
  for(const state of ['default','phase-enter','phase-active','phase-end']){
   const profile=state==='default'?asset.runtime.profile:asset.states[state].profile;await page.evaluate(async({asset,profile})=>window.bossProductionQA.load(asset,profile),{asset,profile});
   const death=await page.evaluate(()=>window.bossProductionQA.pose('death',1.1,-1));assert.equal(death.native.sourceAnimation,'SS_death');assert(death.pixels.alpha>1000);assert.deepEqual(death.sockets.feet,{x:420,y:240});
   item.deathPhaseCombinations.push({state,profile,death});
  }
  report.ids.push(item);console.log(asset.id+': '+item.checks.length+' real MiniNativePreview profiles + portraits + cast clock mapping');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;await page.evaluate(()=>window.bossProductionQA.dispose());
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}finally{await browser.close();await server.close();await writeFile(join(root,'assets/starsea/bosses/evidence/production-native.json'),JSON.stringify(report,null,2)+'\n');}
