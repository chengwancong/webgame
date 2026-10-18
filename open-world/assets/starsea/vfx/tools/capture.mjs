import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const root=resolve(import.meta.dirname,'../../../..'),local=resolve(root,'assets/starsea/vfx'),pub=resolve(root,'apps/web/public/art/starsea/vfx'),manifest=JSON.parse(await readFile(resolve(local,'manifest.json'),'utf8'));
const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}}),records=[];const only=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
await mkdir(resolve(pub,'evidence'),{recursive:true});
try{await page.goto(server.origin+'/art/starsea/vfx/preview.html?effect=ss-fx-b01-lance');await page.waitForFunction(()=>starseaVfxQA.ready,{timeout:30000});
for(const asset of manifest.assets.filter(a=>!only||only.includes(a.id))){
 const result=await page.evaluate(id=>starseaVfxQA.capture(id,{speed:1,phase:id==='ss-fx-b03-flame',sockets:true}),asset.id),bytes=Buffer.from(result.base64,'base64'),name=asset.id+'-full-cycle.webm';await writeFile(resolve(local,'evidence',name),bytes);await copyFile(resolve(local,'evidence',name),resolve(pub,'evidence',name));
 const record={id:asset.id,file:'assets/starsea/vfx/evidence/'+name,url:'/art/starsea/vfx/evidence/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...result};delete record.base64;records.push(record);console.log(JSON.stringify({id:asset.id,bytes:bytes.length,frames:result.frames.length,totalTicks:result.totalTicks,speed:1}));await writeFile(resolve(local,'evidence/dynamic-captures.json'),JSON.stringify(records,null,2)+'\n');
}
for(const mode of ['death','phase-end']){
 const result=await page.evaluate(mode=>starseaVfxQA.capture('ss-fx-b03-flame',{speed:1,phase:true,mode,sockets:true}),mode),bytes=Buffer.from(result.base64,'base64'),name='ss-fx-b03-flame-'+mode+'.webm';await writeFile(resolve(local,'evidence',name),bytes);await copyFile(resolve(local,'evidence',name),resolve(pub,'evidence',name));const record={id:'ss-fx-b03-flame',mode,file:'assets/starsea/vfx/evidence/'+name,url:'/art/starsea/vfx/evidence/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...result};delete record.base64;record.secondaryStopped=result.frames.filter(f=>f.tick>=result.cancelTick).every(f=>f.secondary===0);records.push(record);console.log(JSON.stringify({id:'ss-fx-b03-flame',mode,frames:result.frames.length,secondaryStopped:record.secondaryStopped}));
}
await writeFile(resolve(local,'evidence/dynamic-captures.json'),JSON.stringify(records,null,2)+'\n');await writeFile(resolve(pub,'evidence/dynamic-captures.json'),JSON.stringify(records,null,2)+'\n');
}finally{await browser.close();await server.close();}
