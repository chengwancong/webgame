/** High-density monster source cutouts. All pixels come from reviewed, grid-recovered design drafts. */
import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import {Pixels,root,publicRoot,candidateRoot} from './px0-art.mjs';
export {Pixels,root,publicRoot,candidateRoot};export const work=path.join(root,'.runtime/pixel-coherence/monsters');
const master=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8'));export const ramps=master.ramps;
const colors=Object.values(ramps).flat(),rgb=colors.map(c=>Buffer.from(c.slice(1),'hex')),memo=new Map(),cache=new Map();
export function quant(r,g,b){const key=(r<<16)|(g<<8)|b;if(memo.has(key))return memo.get(key);let best=0,d=Infinity;for(let n=0;n<rgb.length;n++){const c=rgb[n],v=2*(c[0]-r)**2+3*(c[1]-g)**2+(c[2]-b)**2;if(v<d){d=v;best=n;}}memo.set(key,colors[best]);return colors[best];}
export function clean(p){const source=Buffer.from(p.data);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const k=(y*p.width+x)*4;if(!source[k+3])continue;let neighbor=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<p.width&&y+dy>=0&&y+dy<p.height&&source[((y+dy)*p.width+x+dx)*4+3])neighbor=true;if(!neighbor)p.dot(x,y,null);}return p;}
export const designs={
 'dusk-blade':{weapon:'sword',side:-1,grip:[.29,.70],zone:[[.16,.59],[.38,.60],[1,.85],[1,.97],[.50,.91],[.16,.76]]},
 'dusk-gunner':{weapon:'gun',grip:[.73,.67],zone:[[.66,.55],[1,.55],[1,.94],[.70,.83]]},
 'dusk-weaver':{weapon:'staff',grip:[.77,.59],zone:[[.73,.19],[1,.19],[1,1],[.74,1]]},
 'wind-hound':{kind:'wolf'},
 'dock-scavenger':{weapon:'hook',grip:[.76,.65],zone:[[.70,.57],[1,.57],[1,.93],[.72,.93]]},
 'ember-worker':{weapon:'hammer',grip:[.74,.64],zone:[[.69,.55],[1,.55],[1,.95],[.71,.95]]},
 'ore-loader':{weapon:'sword',side:-1,grip:[.22,.69],zone:[[.05,.62],[.32,.60],[.62,.82],[.51,.92],[.12,.78]]},
 'frozen-watch':{weapon:'sword',side:-1,grip:[.29,.68],zone:[[.11,.60],[.35,.58],[1,.87],[1,.98],[.30,.84]]},
 'moss-warden':{weapon:'hook',grip:[.78,.57],zone:[[.72,.15],[1,.15],[1,1],[.73,1]]},
 'pollen-caller':{weapon:'staff',grip:[.78,.56],zone:[[.72,.04],[1,.04],[1,1],[.73,1]]},
 'rift-lurker':{weapon:'hook',grip:[.78,.57],zone:[[.72,.12],[1,.12],[1,1],[.73,1]]},
 'rift-caller':{weapon:'orb',grip:[.83,.54],zone:[[.76,.25],[1,.25],[1,.68],[.76,.68]]},
 'bone-sentinel':{weapon:'sword',side:-1,grip:[.18,.52],zone:[[.03,0],[.30,0],[.30,.77],[.03,.77]]},
 'oath-acolyte':{weapon:'greatsword',side:-1,grip:[.23,.53],zone:[[.02,0],[.36,0],[.36,.82],[.02,.82]]},
 raider:{weapon:'claws',grip:[.82,.64],zone:[[.74,.48],[1,.48],[1,.90],[.75,.90]]},
 artillery:{weapon:'gun',grip:[.82,.65],zone:[[.73,.25],[1,.25],[1,1],[.73,1]]},
 'port-vanguard':{weapon:'greatsword',side:-1,grip:[.26,.60],zone:[[.12,.49],[.44,.51],[.42,1],[.10,1]]},
 'fog-quartermaster':{weapon:'staff',grip:[.84,.58],zone:[[.78,.01],[1,.01],[1,1],[.78,1]]},
 'core-extractor':{weapon:'hammer',side:-1,grip:[.31,.58],zone:[[.12,.48],[.48,.48],[.47,1],[.10,1]]},
 'ice-patrol':{weapon:'spear',grip:[.85,.56],zone:[[.80,0],[1,0],[1,1],[.80,1]]},
 'rift-marshal':{weapon:'orb',side:-1,grip:[.36,.36],zone:[[.12,.15],[.51,.15],[.51,.50],[.12,.50]]},
 vilo:{weapon:'greatsword',grip:[.88,.42],zone:[[.78,.28],[1,.28],[1,1],[.78,1]]},
 cyclops:{weapon:'hammer',grip:[.81,.56],zone:[[.74,.38],[1,.38],[1,1],[.74,1]]},
 hunter:{weapon:'bow',grip:[.86,.55],zone:[[.80,0],[1,0],[1,1],[.80,1]]},
 dragon:{kind:'dragon'},
 'frost-queen':{weapon:'staff',grip:[.85,.55],zone:[[.78,0],[1,0],[1,1],[.78,1]]},
 'abyss-lord':{weapon:'greatsword',grip:[.82,.43],zone:[[.76,.17],[1,.17],[1,1],[.76,1]],wings:true},
 mimic:{kind:'mimic'},
};
export function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function bbox(p){let x0=p.width,y0=p.height,x1=-1,y1=-1;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function feet(p,b,kind){const y0=Math.max(b.y,Math.floor(b.y+b.h*.91)),segments=[];let run;for(let x=b.x;x<b.x+b.w;x++){let area=0,lastY=0;for(let y=y0;y<b.y+b.h;y++)if(p.data[(y*p.width+x)*4+3]){area++;lastY=Math.max(lastY,y);}if(area){if(!run)run={x0:x,x1:x,area:0,y:0};run.x1=x;run.area+=area;run.y=Math.max(run.y,lastY);}else if(run){segments.push(run);run=undefined;}}if(run)segments.push(run);segments.sort((a,b)=>b.area-a.area);const limit=kind==='wolf'?4:2,selected=segments.slice(0,limit).filter((s,i)=>!i||s.area>segments[0].area*.20);if(!selected.length)return[b.x+b.w/2,b.y+b.h-1];return[(Math.min(...selected.map(s=>s.x0))+Math.max(...selected.map(s=>s.x1)))/2,Math.max(...selected.map(s=>s.y))];}
export async function sourceDesign(name){if(cache.has(name))return cache.get(name);const folder=path.join(work,'sources',name),{data,info}=await sharp(path.join(folder,'grid.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(info.width,info.height);data.copy(p.data);for(let i=0;i<data.length;i+=4){p.data[i+3]=data[i+3]>=128?255:0;if(p.data[i+3])Buffer.from(quant(data[i],data[i+1],data[i+2]).slice(1),'hex').copy(p.data,i);}clean(p);const b=bbox(p),def=designs[name],foot=feet(p,b,def.kind);const result={name,p,b,def,foot,sourceHeight:foot[1]-b.y+1,folder};cache.set(name,result);return result;}
export function themed(c,theme,active=false){const group=theme==='frost'?'water':theme==='leaf'?'leaf':theme==='rift'?'arcane':theme==='ember'?'fire':theme==='gold'?'copper':undefined;if(group){for(const r of [ramps.navy,ramps.ink,ramps.earth]){const i=r.indexOf(c);if(i>=2&&i<=4)return ramps[group][Math.min(5,i+(active?1:0))];}}if(active)for(const r of [ramps.water,ramps.arcane,ramps.fire]){const i=r.indexOf(c);if(i>=2)return r[Math.min(5,i+1)];}return c;}
export async function staticDesign(name,height,frame,anchor,theme){const src=await sourceDesign(name);if(src.sourceHeight+1<height)throw Error(name+': native source too small '+src.sourceHeight+' < '+height);const ratio=height/src.sourceHeight,p=new Pixels(frame,frame);for(let y=0;y<frame;y++)for(let x=0;x<frame;x++){const sx=Math.floor((x+.5-anchor[0])/ratio+src.foot[0]),sy=Math.floor((y+.5-anchor[1])/ratio+src.foot[1]);if(sx<0||sx>=src.p.width||sy<0||sy>=src.p.height)continue;const i=(sy*src.p.width+sx)*4;if(src.p.data[i+3])p.dot(x,y,themed('#'+src.p.data.subarray(i,i+3).toString('hex'),theme));}return clean(p);}
if(process.argv[1]?.endsWith('fine-monsters-art.mjs')){fs.mkdirSync(path.join(work,'native'),{recursive:true});for(const name of ['frost-queen','abyss-lord','dragon','port-vanguard','fog-quartermaster','core-extractor','ice-patrol','rift-marshal','vilo'])await(await staticDesign(name,208,320,[160,296])).save(path.join(work,'native',name+'-208.png'));console.log('Nine high-density native boss design frames ready');}
