import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cpus,totalmem} from 'node:os';
import fastify from 'fastify';
import serveStatic from '@fastify/static';
import {sourceVersion} from './source-version.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
let base=arg('--base','http://127.0.0.1:8612');let staticServer;const staticRoot=arg('--root',null);if(staticRoot){staticServer=fastify();await staticServer.register(serveStatic,{root:resolve(staticRoot)});base=await staticServer.listen({host:'127.0.0.1',port:0});}
const field=process.argv.includes('--field'),seconds=Number(arg('--seconds',field?600:30)),warmup=Number(arg('--warmup',20)),width=Number(arg('--width',1280)),height=Number(arg('--height',720));
if(!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid sample duration');
const out=resolve('.design/open-world-m0');await mkdir(out,{recursive:true});
const report={passed:false,started:new Date().toISOString(),source:await sourceVersion(),machine:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramBytes:totalmem()},browser:'Google Chrome, headless real WebGL',viewport:[width,height],seed:37,warmupSeconds:warmup,sampleSeconds:seconds,cases:[],limits:['Headless Chrome on this desktop; not evidence for a middle-range laptop','QA-controlled character and targets; no drops, material output, boss win rate or economic progression is measured','100/150-enemy cases are stress characterization; the required horde gate is 60 enemies plus 40 effects','Frame acceptance uses rolling P95; individual startup and OS stalls are also recorded by scene diagnostics']};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-precise-memory-info']});
report.browserVersion=browser.version();
try{
 for(const horde of field?[0]:[60,100,150]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];page.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()});});
  const started=Date.now();await page.goto(`${base}/world-graybox.html?width=${width}&height=${height}${horde?'&horde='+horde:''}`,{timeout:60000});
  try{await page.waitForFunction(()=>window.awGraybox?.().tick>0&&window.awGraybox().metrics.terrain?.pendingChunks===0,null,{timeout:60000});}catch(error){report.bootstrap={errors,requests,state:await page.evaluate(()=>window.awGraybox?.()).catch(()=>null)};throw error;}
  const loadMs=Date.now()-started,gpu=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?{renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),vendor:gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}:{renderer:gl.getParameter(gl.RENDERER)};});
  await page.waitForTimeout(warmup*1000);await page.screenshot({path:resolve(out,`graybox-${horde||'field'}-${width}-start.png`)});
  const samples=[],end=Date.now()+seconds*1000;let nextUpdate=Date.now()+30000;
  while(Date.now()<end){await page.waitForTimeout(1000);const state=await page.evaluate(()=>window.awGraybox());samples.push(state);if(Date.now()>=nextUpdate){console.log(JSON.stringify({mode:horde?'horde-'+horde:'field',elapsedSeconds:samples.length,tick:state.tick,kills:state.kills,p95Ms:state.metrics.p95,chunks:state.metrics.terrain.chunks,heapBytes:state.memory}));nextUpdate=Date.now()+30000;}}
  await page.screenshot({path:resolve(out,`graybox-${horde||'field'}-${width}-end.png`)});
  const p95=Math.max(...samples.map(s=>s.metrics.p95)),memory=samples.map(s=>s.memory).filter(Number.isFinite),median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)],third=Math.max(1,Math.floor(memory.length/3)),early=memory.length?median(memory.slice(0,third)):null,late=memory.length?median(memory.slice(-third)):null;
  const result={horde:horde||null,mode:horde?'horde':'auto-field',required:field||horde===60,loadMs,gpu,versions:samples[0]?.versions,samples:samples.length,frameP95MaxMs:p95,equivalentFps:1000/p95,logicP95MaxMs:Math.max(...samples.map(s=>s.metrics.logic_p95)),sceneP95MaxMs:Math.max(...samples.map(s=>s.metrics.scene_p95)),heap:{earlyMedianBytes:early,lateMedianBytes:late,growthBytes:early===null?null:late-early,stable:early===null?null:late-early<=Math.max(16*1024*1024,early*.2)},errors,requests,passed:!errors.length&&!requests.length&&p95<=20&&loadMs<=5000&&(!field||seconds>=600&&early!==null&&late-early<=Math.max(16*1024*1024,early*.2)),data:samples};
  report.cases.push(result);await writeFile(resolve(out,field?`field-browser-${width}.json`:`horde-browser-${width}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({...result,data:undefined}));await page.close();
 }
 report.sourceAfter=await sourceVersion();report.sourceStable=report.source.sha256===report.sourceAfter.sha256;report.passed=report.sourceStable&&report.cases.filter(c=>c.required).every(c=>c.passed);
}catch(error){report.error=error.stack;console.error(error.stack);}finally{await browser.close();await staticServer?.close();report.completed=new Date().toISOString();await writeFile(resolve(out,field?`field-browser-${width}.json`:`horde-browser-${width}.json`),JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
