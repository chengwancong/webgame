import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {join} from 'node:path';import {group,root,library,sharp,json,record} from './pipeline.mjs';import {pets,colors} from './r2-definitions.mjs';
const index=JSON.parse(await readFile(join(group,'sources/r2-parts-index.json'),'utf8'));
const only=process.argv[2]?.split(',');
const num={c:22,d:33,e:44};
function role(family,stage,n){if(/TX|glow/i.test(n))return 'effect';if(family==='A7'){if(n==='tou')return 'head';if(n==='yan')return 'eye';if(n==='xiaba')return 'jaw';if(/^pi[12]$/.test(n))return 'lid';if(n==='shenti')return 'body';if(/^xv|jijiao/.test(n))return 'horn';if(/^jia\d|jiao|pu|qi|bi3|bi6|shoubi/.test(n))return 'fin';return 'limb';}const i=Number(n.replace('long',''))-num[stage];return i===1?'head':i===2?'jaw':i===6?'body':[0,10].includes(i)?'fin':[5,9].includes(i)?'foot':'limb';}
function hsv(r,g,b){const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d?max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4:0;return [(h*60+360)%360,max?d/max:0,max/255];}
function material(p,stage,role,n,x,y,w,h,r,g,b){const [hue,s,v]=hsv(r,g,b);if(v<.23)return 5;const U=x/w,V=y/h;
 if(role==='effect')return v>.75?15:14;if(role==='horn'&&p.family==='A7'&&stage==='d')return v>.65?9:1;if(role==='horn')return v>.65?17:v>.4?18:8;if(role==='lid')return v>.7?9:0;
 const isA7=p.family==='A7',cold=hue>155&&hue<320,warm=hue<75||hue>340;
 if(role==='fin'){
  if(isA7){if(/jia[1-4]$/.test(n)&&U>.87&&v>.65)return 17;return v>.86?17:v>.60?2:v>.4?3:1;}
  // Original wing bones stay dark; broad membrane planes remain distinct from scales.
  return v>.83?10:v>.59?2:v>.38?3:1;
 }
 let belly=false;
 if(isA7){belly=role==='body'&&(stage==='c'?(s<.32&&v>.62):(warm&&s<.8&&v>.60&&U>.68));if(role==='body'&&((stage==='c'&&warm&&s>.4)||(stage==='d'&&cold&&V<.6)||(stage==='e'&&hue>275&&hue<340)))return v>.88?17:v>.58?2:3;}
 else belly=role==='body'&&(stage==='e'?(hue>30&&hue<80&&v>.55):cold);
 if(belly)return v>.8?4:7;
 if(role==='head'){
  const horn=isA7?U<.6&&V<.43:stage==='c'?U>.34&&U<.7&&V<.35:U<.28&&V<.42||U>.56&&U<.78&&V<.39;
  if(horn&&v<.6)return 18;
 }
 if(s<.18&&v>.82)return 17;
 return v>.85?9:v>.63?0:v>.42?1:8;
}
function simplify(pts,e=.55){if(pts.length<3)return pts;const a=pts[0],b=pts.at(-1),dx=b[0]-a[0],dy=b[1]-a[1];let max=0,at=0;for(let i=1;i<pts.length-1;i++){const p=pts[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),v=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(v>max){max=v;at=i;}}return max>e?[...simplify(pts.slice(0,at+1),e).slice(0,-1),...simplify(pts.slice(at),e)]:[a,b];}
function pathRuns(labels,w,h,which){const edges=new Map(),has=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&labels[y*w+x]===which,add=(x,y,a,b)=>{const k=x+','+y;if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);};for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(has(x,y)){if(!has(x,y-1))add(x,y,x+1,y);if(!has(x+1,y))add(x+1,y,x+1,y+1);if(!has(x,y+1))add(x+1,y+1,x,y+1);if(!has(x-1,y))add(x,y+1,x,y);}let d='';while(edges.size){const start=edges.keys().next().value,pts=[start.split(',').map(Number)];let k=start;for(let n=0;n<w*h*8;n++){const list=edges.get(k);if(!list?.length)break;const p=list.pop();if(!list.length)edges.delete(k);pts.push(p);k=p.join(',');if(k===start)break;}if(pts.length>3){const q=simplify(pts);d+='M'+q.map(p=>p.join(',')).join('L')+'Z';}}return d;}
function details(p,stage,r,n,w,h,c){const poly=(d,fill,stroke='',sw=1)=>`<path d="${d.replace(/([\d.]+),([\d.]+)/g,(_,x,y)=>`${(+x*w).toFixed(2)} ${(+y*h).toFixed(2)}`)}" fill="${fill}" ${stroke?`stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`;let body='',ornament='';
 if(r==='jaw'){body=poly('M0.02,0.52 Q0.38,0.42 0.75,0.44 Q0.94,0.41 0.98,0.52 Q0.91,0.83 0.53,0.88 Q0.16,0.93 0.02,0.52Z',c[4],c[5],1.3)+poly('M0.04,0.52 Q0.48,0.58 0.96,0.51','none',c[1],1.4)+poly('M0.12,0.72 Q0.5,0.87 0.82,0.72','none',c[7],1.8);return {body,ornament,replace:true};}
 if(r==='eye'){body=`<rect width="${w}" height="${h}" fill="${c[6]}"/><ellipse cx="${w*.55}" cy="${h*.52}" rx="${h*.4}" ry="${h*.4}" fill="${c[16]}"/><circle cx="${w*.55}" cy="${h*.52}" r="${h*.22}" fill="${c[5]}"/><circle cx="${w*.48}" cy="${h*.3}" r="${h*.11}" fill="white"/><circle cx="${w*.64}" cy="${h*.71}" r="${h*.065}" fill="white"/>`;return {body,ornament,replace:true};}
 if(r==='head'){
  if(p.family==='A10'){
   const [u,v]=stage==='c'?[.59,.58]:stage==='d'?[.5,.62]:[.62,.64],ew=w*.25,eh=h*.14,x=w*u,y=h*v;
   // Neutral cheek and brow planes replace the old angry/slit eye without shortening the snout.
   body+=`<path d="M${x-ew*.9} ${y-eh*.9}Q${x} ${y-eh*1.35} ${x+ew*.9} ${y-eh*.1}L${x+ew*.8} ${y+eh}Q${x-ew*.8} ${y+eh*1.1} ${x-ew*.9} ${y-eh*.9}Z" fill="${c[0]}"/>`;
   body+=`<path d="M${x-ew*.55} ${y}Q${x} ${y-eh*.85} ${x+ew*.56} ${y-.1*eh}Q${x} ${y+eh*.78} ${x-ew*.55} ${y}Z" fill="${c[6]}" stroke="${c[5]}" stroke-width="1.15"/><circle cx="${x+ew*.08}" cy="${y}" r="${eh*.43}" fill="${c[16]}"/><circle cx="${x+ew*.08}" cy="${y}" r="${eh*.22}" fill="${c[5]}"/><circle cx="${x}" cy="${y-eh*.25}" r="${eh*.14}" fill="white"/>`;
   body+=poly(`M${u-.13},${v-.13} Q${u},${v-.2} ${u+.13},${v-.1}`,'none',c[9],2.5);
   body+=poly('M0.69,0.79 Q0.83,0.84 0.91,0.76','none',c[5],1.25);
  }else{
   const [u,v]=stage==='c'?[.708,.616]:stage==='d'?[.768,.783]:[.775,.737];
   body+=poly(`M${u-.14},${v-.13} Q${u-.02},${v-.19} ${u+.11},${v-.08}`,'none',c[9],2.4);
   body+=poly(`M${u+.03},${Math.min(.95,v+.17)} Q0.9,${Math.min(.96,v+.2)} 0.97,${Math.min(.92,v+.12)}`,'none',c[5],1.2);
   body+=poly('M0.81,0.87 Q0.91,0.91 0.98,0.85 L0.99,0.98 L0.83,0.98Z',c[4]);
  }
 }
 if(r==='body'){
  body+='<g clip-path="url(#belly)">';for(const y of [.38,.5,.62,.74,.86])body+=poly(`M0.64,${y} Q0.85,${y+.09} 1,${y-.02}`,'none',c[7],Math.max(1.1,w*.009));body+='</g>';
  body+='<g clip-path="url(#back)">';for(const [x,y]of [[.4,.55],[.5,.61],[.6,.55],[.7,.63]])body+=poly(`M${x-.035},${y-.02} Q${x},${y+.045} ${x+.035},${y-.02}`,'none',c[1],1.2);body+='</g>';
  // Small embedded ember seal, A and B share this so ornament quantity cannot carry the species.
  ornament+=poly('M0.83,0.48 Q0.81,0.51 0.815,0.54 Q0.84,0.56 0.855,0.535 Q0.86,0.52 0.845,0.505 L0.84,0.525Z',c[14],c[12],.9);
 }
 if(r==='fin'||r==='body'&&p.family==='A7'){
  body+='<g clip-path="url(#fin)">';for(const [x,y]of [[.15,.24],[.37,.13],[.6,.1]])body+=poly(`M0.84,0.86 Q${x+.2},0.5 ${x},${y}`,'none',c[3],1.25);body+=poly('M0.18,0.23 Q0.42,0.08 0.71,0.13','none',c[10],1.2);body+='</g>';
 }
 if(p.style==='B'){
  if(r==='head'){const u=p.family==='A10'?.22:.42,v=p.family==='A10'?.3:.39;ornament+=poly(`M${u-.05},${v-.03} L${u+.07},${v+.015} L${u+.065},${v+.065} L${u-.05},${v+.02}Z`,c[11],c[12],.8)+poly(`M${u-.04},${v-.025} L${u+.065},${v+.02}`,'none',c[13],1.2);}
  if(r==='body'){ornament=poly('M0.76,0.46 L0.84,0.41 L0.94,0.48 L0.93,0.65 L0.85,0.72 L0.76,0.64Z',c[11],c[12],1)+poly('M0.78,0.49 L0.84,0.44 L0.91,0.49','none',c[13],1.7)+poly('M0.79,0.61 L0.85,0.66 L0.91,0.6','none',c[12],1.7)+ornament;}
  if(r==='limb'&&p.family==='A10'&&Number(n.replace('long',''))===num[stage]+3)ornament+=poly('M0.16,0.18 L0.46,0.12 L0.78,0.28 L0.68,0.49 L0.39,0.55 L0.17,0.4Z',c[11],c[12],1.1)+poly('M0.2,0.23 L0.45,0.17 L0.7,0.3','none',c[13],2)+poly('M0.44,0.26 L0.54,0.34 L0.44,0.44 L0.35,0.35Z',c[14],c[12],1);
  if(r==='fin')ornament+=poly('M0.04,0.15 Q0.33,0.03 0.65,0.1 L0.65,0.16 Q0.33,0.1 0.1,0.24Z',c[11],c[12],.65)+poly('M0.07,0.15 Q0.33,0.06 0.61,0.11','none',c[13],1.2);
  if(r==='horn')ornament+=poly('M0.23,0.7 L0.7,0.7 L0.7,0.76 L0.23,0.76Z',c[11],c[12],.65);
 }
 return {body,ornament};
}
async function pack(name,dir,parts,kind='paint'){await mkdir(dir,{recursive:true});const width=2048,tiles=[];let x=4,y=4,row=0,atlas=`${name}.png\nsize: ${width},HEIGHT\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`;for(const p of parts){const w=p.w*2,h=p.h*2;if(x+w+4>width){x=4;y+=row+4;row=0;}tiles.push({input:p[kind],left:x,top:y});atlas+=`${p.region}\n rotate: false\n xy: ${x}, ${y}\n size: ${w}, ${h}\n orig: ${w}, ${h}\n offset: 0, 0\n index: -1\n`;x+=w+4;row=Math.max(row,h);}const height=2**Math.ceil(Math.log2(y+row+4));await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(tiles).png().toFile(join(dir,name+'.png'));await writeFile(join(dir,name+'.atlas'),atlas.replace('HEIGHT',height));await copyFile(join(library,name,name+'.json'),join(dir,name+'.json'));}
for(const p of pets.filter(p=>!only||only.includes(p.key))){const records=[];for(const stage of p.stages){const name='guai'+p.family+stage,dir=join(group,'sources',p.key,name);await mkdir(join(dir,'parts'),{recursive:true});const packed=[],c=colors(p);
 for(const part of index.filter(x=>x.name===name)){const n=part.region.split('/').at(-1),r=role(p.family,stage,n),original=await sharp(part.original.path).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=original.info.width,h=original.info.height,labels=new Uint8Array(w*h),alpha=Buffer.alloc(w*h*4);labels.fill(255);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;let a=original.data[i+3];if(p.family==='A10'&&stage==='e'&&r==='head'&&x/w>.28&&x/w<.73&&y/h>.745)a=0;alpha[i]=alpha[i+1]=alpha[i+2]=255;alpha[i+3]=a;if(a>8)labels[y*w+x]=material(p,stage,r,n,x,y,w,h,...original.data.subarray(i,i+3));}
  for(let pass=0;pass<2;pass++){const prev=labels.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const id=prev[y*w+x];if(id===255||id===5)continue;const count=new Map();for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const n=prev[(y+dy)*w+x+dx];if(n!==255&&n!==5)count.set(n,(count.get(n)??0)+1);}const best=[...count.entries()].sort((a,b)=>b[1]-a[1])[0];if(best?.[1]>=5)labels[y*w+x]=best[0];}}
  const paths=Array.from({length:c.length},(_,i)=>pathRuns(labels,w,h,i)),defs=`<defs><clipPath id="belly"><path d="${paths[4]+paths[7]}"/></clipPath><clipPath id="back"><path d="${paths[0]+paths[1]+paths[9]}"/></clipPath><clipPath id="fin"><path d="${paths[2]+paths[3]+paths[10]+paths[17]}"/></clipPath></defs>`,detail=details(p,stage,r,n,w,h,c),base=detail.replace?'':`<rect width="${w}" height="${h}" fill="${c[0]}"/>`+paths.map((d,i)=>d?`<path d="${d}" fill="${c[i]}"/>`:'').join(''),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w*4}" height="${h*4}" viewBox="0 0 ${w} ${h}">${defs}${base}${detail.body}${detail.ornament}</svg>`;
  let mask=await sharp(alpha,{raw:{width:w,height:h,channels:4}}).resize(w*2,h*2).png().toBuffer();
  const raster=await sharp(Buffer.from(svg)).resize(w*2,h*2).png().toBuffer(),paint=detail.replace&&r==='jaw'?raster:await sharp(raster).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  const ornamentSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w*4}" height="${h*4}" viewBox="0 0 ${w} ${h}">${detail.ornament}</svg>`,ornament=await sharp(await sharp(Buffer.from(ornamentSvg)).resize(w*2,h*2).png().toBuffer()).composite([{input:paint,blend:'dest-in'}]).png().toBuffer();
  let bodyMask=await sharp(paint).ensureAlpha().raw().toBuffer();for(let i=0;i<bodyMask.length;i+=4){bodyMask[i]=bodyMask[i+1]=bodyMask[i+2]=255;if(r==='effect')bodyMask[i+3]=0;}bodyMask=await sharp(bodyMask,{raw:{width:w*2,height:h*2,channels:4}}).png().toBuffer();
  const file=join(dir,'parts',part.region.replaceAll('/','__'));await writeFile(file+'.svg',svg);await writeFile(file+'.png',paint);packed.push({region:part.region,w,h,paint,ornament,bodyMask});records.push({...part,role:r,output:await record(file+'.png'),vectorSource:await record(file+'.svg'),method:'Native color-region boundaries redrawn as hard editable vector planes, anatomical eye/jaw/belly/wing detailing; source alpha and canvas preserved except exposed teeth removed',reference:'evidence/r2-imagegen-anatomy-reference.png'});
 }
 await pack(name,dir,packed);await pack(name,join(group,'evidence/r2-mask-sources',p.key,'ornament',name),packed,'ornament');await pack(name,join(group,'evidence/r2-mask-sources',p.key,'body',name),packed,'bodyMask');console.log(p.key,stage,packed.length,'2x parts');
 }await json(join(group,'sources',p.key+'-parts.json'),records);}
