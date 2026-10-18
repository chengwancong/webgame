import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {build} from 'vite';
import {boot,group,out,root,json} from './pipeline.mjs';
await mkdir(join(out,'preview'),{recursive:true});
for(const f of ['index.html','preview.js'])await copyFile(join(group,'preview',f),join(out,'preview',f));
await build({configFile:false,root,logLevel:'error',build:{lib:{entry:join(group,'hero-preview.js'),formats:['es'],fileName:()=> 'hero-preview.js'},outDir:join(out,'sources'),emptyOutDir:false,minify:true,target:'esnext'}});
const ctx=await boot(),errors=[],checks=[];ctx.page.on('pageerror',e=>errors.push(e.message));
try{
 await ctx.page.goto(ctx.base+'/art/starsea/pets/preview/index.html');await ctx.page.waitForFunction(()=>window.pa1?.ready||window.pa1Error,{},{timeout:60000});
 const error=await ctx.page.evaluate(()=>window.pa1Error);if(error)throw Error(error);
 const tag=process.argv.includes('--pilot')?'pilot':'final';
 if(tag==='final'){
  const playback=[];
  for(const speed of ['1','1.3','1.6'])for(const variant of ['young','variant-b','variant-d']){
   await ctx.page.selectOption('#action','move');await ctx.page.selectOption('#speed',speed);await ctx.page.selectOption('#variant',variant);await ctx.page.evaluate(()=>window.pa1.resume());
   const states=await ctx.page.evaluate(async()=>{const result=[];for(let i=0;i<32;i++){await new Promise(r=>setTimeout(r,60));result.push(window.pa1.state());}return result;});
   const ids=[...new Set(states.flatMap(s=>s.frames.map(f=>f.id)))];const unique=Object.fromEntries(ids.map(id=>[id,new Set(states.flatMap(s=>s.frames.filter(f=>f.id===id).map(f=>f.index))).size]));
   if(ids.length!==18||Object.values(unique).some(n=>n<8))throw Error('Playback did not animate all 18 sprites');
   playback.push({speed,variant,wallSamples:states.length,uniqueFrames:unique});
  }
  await json(join(group,'evidence/live-playback-validation.json'),{headless:false,pass:true,playback});
 }
 for(const action of ['idle','idle2','move','attack','knock','skill']){
  await ctx.page.selectOption('#action',action);await ctx.page.selectOption('#speed',action==='move'?'1.6':'1');
  await ctx.page.evaluate(()=>window.pa1.setTime(.24));
  await ctx.page.screenshot({path:join(group,'evidence',tag+'-'+action+'.png'),fullPage:true});checks.push(await ctx.page.evaluate(()=>window.pa1.state()));
 }
 await ctx.page.selectOption('#action','move');await ctx.page.selectOption('#speed','1.6');await ctx.page.check('#sockets');await ctx.page.click('#mirror');
 for(const variant of ['young','variant-b','variant-d']){await ctx.page.selectOption('#variant',variant);await ctx.page.evaluate(()=>window.pa1.setTime(.35));await ctx.page.screenshot({path:join(group,'evidence',tag+'-mirrored-'+variant+'.png'),fullPage:true});checks.push(await ctx.page.evaluate(()=>window.pa1.state()));}
 await ctx.page.selectOption('#action','idle');await ctx.page.selectOption('#speed','1');await ctx.page.selectOption('#variant','young');await ctx.page.uncheck('#sockets');await ctx.page.click('#mirror');await ctx.page.evaluate(()=>window.pa1.setTime(0));
 await ctx.page.screenshot({path:join(group,'evidence',tag+'-overview.png'),fullPage:true});
 await ctx.page.keyboard.press('Tab');const keyboard=await ctx.page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));
 await json(join(group,'evidence',tag+'-browser-check.json'),{errors,checks,keyboard,headless:false,browser:'visible Chrome hardware GL'});
 if(errors.length)throw Error(errors.join('\n'));console.log(tag,'visible preview passed',checks.length,'states');
}finally{await ctx.close();}
