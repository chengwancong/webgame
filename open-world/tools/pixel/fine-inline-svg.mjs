/** Ship actual inline artwork at its native UI size, using the existing reversible SVG substitution. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {symbol,taskSymbolNames} from '../../apps/web/src/task-symbols.ts';
import {travelIcon,travelIconNames,travelCompass} from '../../apps/web/src/travel-browser.ts';
import {victory,defeat,pending} from '../../apps/web/src/battle-result-emblems.ts';import {hudExitIcon} from '../../apps/web/src/hud-context.ts';
import {formArtHtml,staticFormArtKinds} from '../../apps/web/src/ui/form-art.ts';
import {graphicArtHtml,staticGraphicArtKinds} from '../../apps/web/src/ui/graphic-art.ts';
import {stateArtHtml,stateArtKinds} from '../../apps/web/src/ui/state-art.ts';
import {Pixels,root,candidateRoot,ramps} from './px0-art.mjs';import {checkAsset,checkManifest} from './check-pixel-art.mjs';
const work=path.join(root,'.runtime/pixel-coherence/inline-svg'),ink=ramps.ink[1],paper=ramps.ui[0],colors=Object.values(ramps).flat().map(c=>Buffer.from(c.slice(1),'hex'));
const css={
 '--border-width':'1','--border-edge':'2','--border-depth':'3',
 '--color-panel':paper,'--color-panel-raised':paper,'--color-panel-inset':ramps.ink[5],'--color-panel-selected':ramps.ui[2],'--color-panel-secondary':ramps.ink[4],
 '--color-background':paper,'--color-border':ramps.ink[4],'--color-border-strong':ink,'--color-border-subtle':ramps.ink[4],
 '--color-text-primary':ink,'--color-text-secondary':ramps.ink[3],'--color-text-disabled':ramps.ink[3],
 '--color-primary':ramps.ui[1],'--color-primary-top':ramps.ui[2],'--color-primary-pressed':ramps.ui[3],'--color-primary-border':ramps.copper[2],
 '--color-highlight':ramps.ui[1],'--color-bevel-light':paper,'--color-secondary-edge':ramps.ink[3],
 '--color-info':ramps.water[3],'--color-success':ramps.leaf[3],'--color-danger':ramps.fire[2],'--color-negative':ramps.fire[3],
};
export function inlineSvgRows(){
 const rows=[];function add(key,source,svg,size,lod=false){rows.push({key,source,svg,size,lod});}
 for(const id of taskSymbolNames)add('inline:task:'+id,'apps/web/src/task-symbols.ts#'+id,symbol(id),32,true);
 for(const id of travelIconNames)add('inline:travel:'+id,'apps/web/src/travel-browser.ts#travelIcon:'+id,travelIcon(id),24,true);
 add('inline:travel-compass','apps/web/src/travel-browser.ts#travelCompass',travelCompass(),100);
 for(const[id,svg]of Object.entries({victory,defeat,pending}))add('inline:result:'+id,'apps/web/src/battle-result-emblems.ts#'+id,svg,120);
 add('inline:hud-exit','apps/web/src/hud-context.ts#hudExitIcon',hudExitIcon,24,true);
 for(const id of staticFormArtKinds)add('inline:form:'+id,'apps/web/src/ui/form-art.ts#'+id,formArtHtml(id),16);
 const graphicSizes={'empty-slot':64,timer:16,'page-prev':20,'page-next':20,help:16};
 for(const id of staticGraphicArtKinds)add('inline:graphic:'+id,'apps/web/src/ui/graphic-art.ts#'+id,graphicArtHtml(id),graphicSizes[id],id==='empty-slot');
 for(const id of stateArtKinds)add('inline:state:'+id,'apps/web/src/ui/state-art.ts#'+id,stateArtHtml(id),48,true);
 return rows;
}
function resolveVars(svg,key){
 for(let i=0;i<8&&svg.includes('var(');i++)svg=svg.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\s*\)/g,(_,name,fallback)=>css[name]??fallback??ink);
 if(svg.includes('var('))throw Error('Unresolved native SVG token '+key);
 let color=ink;const taskTone={banner:ramps.copper[3],portal:ramps.arcane[3],feather:ramps.water[3],compass:ramps.navy[3],book:ramps.navy[2],chest:ramps.wood[3],clock:ink,check:ramps.leaf[3],hourglass:ramps.wood[3],alert:ramps.fire[2],diamond:ramps.water[3]};
 if(key.startsWith('inline:task:'))color=taskTone[key.split(':').at(-1)]??ink;
 if(key==='inline:travel:coin'||key==='inline:travel:xp')color=ramps.copper[3];if(key==='inline:travel:material')color=ramps.water[3];
 return svg.replaceAll('currentColor',color).replaceAll('stroke-linecap="round"','stroke-linecap="square"').replaceAll('stroke-linejoin="round"','stroke-linejoin="miter"');
}
export async function inlinePixels(row,size){
 let svg=resolveVars(row.svg,row.key);if(!svg.includes('xmlns='))svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 // SVG geometry is rasterized at each target resolution; no 32px bitmap is enlarged to100/120.
 svg=svg.replace('<svg ',`<svg width="${size}" height="${size}" `);
 const{data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==size||info.height!==size)throw Error('Unexpected inline viewport '+row.key);
 const p=new Pixels(size,size);for(let i=0;i<data.length;i+=4){if(data[i+3]<112)continue;let best=0,d=Infinity;for(let n=0;n<colors.length;n++){const c=colors[n],v=2*(c[0]-data[i])**2+3*(c[1]-data[i+1])**2+(c[2]-data[i+2])**2;if(v<d){d=v;best=n;}}colors[best].copy(p.data,i);p.data[i+3]=255;}
 const a=Buffer.from(p.data);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;if(!a[i+3])continue;let linked=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&y+dy>=0&&x+dx<size&&y+dy<size&&a[((y+dy)*size+x+dx)*4+3])linked=true;if(!linked)p.dot(x===size-1?x-1:x+1,y,'#'+a.subarray(i,i+3).toString('hex'));}
 return p;
}
export function inlineFileFor(key){return '/art-pixel/ui-code/inline-fine-v1/'+key.replaceAll(':','-')+'-'+createHash('sha256').update(key).digest('hex').slice(0,12)+'.png';}
export async function buildInlineSvg(){
 fs.mkdirSync(work,{recursive:true});const rows=inlineSvgRows(),out={schemaVersion:1,stage:[1280,720],canvas:[1280,720],palette:'/art-pixel/palette.json',assets:{}},keys=[],index=[],files=new Map(),contact=new Pixels(8*160,Math.ceil(rows.length/8)*160);let ordinal=0;
 for(const row of rows){index.push({key:row.key,paths:['code:'+row.source],category:'icon',batch:'PX8',source:'project inline static art',frame:[row.size,row.size]});
  for(const size of [row.size,...(row.lod?[16]:[])]){const compact=size===16&&row.size!==16,key=row.key+(compact?':16':''),p=await inlinePixels(row,size),file=inlineFileFor(key),canonical=file.toLowerCase();if(files.has(canonical))throw Error('Inline filename collision: '+files.get(canonical)+' / '+key);files.set(canonical,key);await p.save(path.join(candidateRoot,file));const a={file,original:compact?[]:['code:'+row.source],batch:'PX8',kind:'image',frame:[size,size],anchor:[Math.floor(size/2),Math.floor(size/2)],scale:1,sha256:createHash('sha256').update(fs.readFileSync(path.join(candidateRoot,file))).digest('hex'),provenance:{method:'authored-pixels',reviewed:true,recipe:'tools/pixel/fine-inline-svg.mjs; original project SVG semantic geometry at native target resolution; finite master palette and binary pixel cleanup'}};if(row.lod&&!compact)a.small=key+':16';const issues=await checkAsset(a,{publicRoot:candidateRoot});if(issues.length)throw Error(key+':'+JSON.stringify(issues));out.assets[key]=a;keys.push(key);contact.stamp(p,ordinal%8*160+(compact?140:4),Math.floor(ordinal/8)*160+4);}
  ordinal++;
 }
 const report=await checkManifest(out,{publicRoot:candidateRoot});if(!report.ok)throw Error('Post-write group validation: '+JSON.stringify(report));
 fs.writeFileSync(path.join(work,'candidates.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(work,'keys.json'),JSON.stringify(keys,null,2)+'\n');fs.writeFileSync(path.join(work,'source-index.json'),JSON.stringify(index,null,2)+'\n');fs.writeFileSync(path.join(work,'validation.json'),JSON.stringify({...report,uniqueFiles:files.size},null,2)+'\n');await contact.save(path.join(work,'fine-contact.png'));console.log(JSON.stringify({baseSymbols:rows.length,candidates:keys.length,uniqueFiles:files.size,postWriteIssues:report.issues.length}));
}
if(process.argv[1]?.endsWith('fine-inline-svg.mjs'))await buildInlineSvg();
