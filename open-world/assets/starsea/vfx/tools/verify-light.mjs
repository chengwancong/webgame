import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {strict as assert} from 'node:assert';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import {buildReferenceFixture} from '../../../../apps/web/public/art/starsea/vfx/reference-fixtures.mjs';
const root=resolve(import.meta.dirname,'../../../..'),local=resolve(root,'assets/starsea/vfx'),pub=resolve(root,'apps/web/public/art/starsea/vfx'),manifest=JSON.parse(await readFile(resolve(local,'manifest.json'),'utf8'));
const s=await serve(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}}),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{await page.goto(s.origin+'/art/starsea/vfx/preview.html?effect=ss-fx-b04-lance');await page.waitForFunction(()=>starseaVfxQA.ready,{timeout:30000});
for(const a of manifest.assets.filter(a=>a.runtime.fixture.kind==='projectile'))for(const background of ['snow','port']){
 const f=buildReferenceFixture(a),tick=f.windupTicks+Math.max(1,f.flight/2),d=await page.evaluate(({id,tick,background})=>starseaVfxQA.pose(id,tick,{background,facing:1,sockets:false}),{id:a.id,tick,background});assert.deepEqual(d.renderer.errors,[]);assert(d.renderer.commands.some(c=>c.name==='projectile'));assert(a.runtime.clips.projectile.components.every(c=>c.kind==='static-fragment'));
 const file=a.id+'-'+background+'.png';await page.screenshot({path:resolve(local,'evidence',file)});await copyFile(resolve(local,'evidence',file),resolve(pub,'evidence',file));const isolated=await page.evaluate(background=>starseaVfxQA.compareCore(background),background),isolatedFile=a.id+'-'+background+'-isolated.png';await writeFile(resolve(local,'evidence',isolatedFile),Buffer.from(isolated.png.split(',')[1],'base64'));await copyFile(resolve(local,'evidence',isolatedFile),resolve(pub,'evidence',isolatedFile));delete isolated.png;assert(isolated.changedPixels>=24,'Invisible entity pixels '+a.id+'/'+background);assert(isolated.strongContrastPixels>=12,'Weak entity contour '+a.id+'/'+background);records.push({id:a.id,background,tick,file:'assets/starsea/vfx/evidence/'+file,url:'/art/starsea/vfx/evidence/'+file,entityBlend:'source-over',entityParts:a.runtime.clips.projectile.components.map(c=>({part:c.part,width:c.width,height:c.height,tint:c.tint})),isolated:{...isolated,file:'assets/starsea/vfx/evidence/'+isolatedFile},rendererErrors:d.renderer.errors,pixelHash:d.pixelHash});
}
assert.deepEqual(errors,[]);await writeFile(resolve(local,'evidence/light-backgrounds.json'),JSON.stringify({passed:true,viewport:[1280,720],referenceOnly:true,backgrounds:'Token PanelRaised white snow / Panel ivory port; source-over entity, independent decorative animation',records,errors},null,2)+'\n');await copyFile(resolve(local,'evidence/light-backgrounds.json'),resolve(pub,'evidence/light-backgrounds.json'));console.log(JSON.stringify({passed:true,projectiles:records.length/2,lightCases:records.length,errors}));
}finally{await browser.close();await s.close();}
