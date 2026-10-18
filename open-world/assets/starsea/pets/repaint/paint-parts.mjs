// Hand-authored contour/colour corrections to imagegen drafts, permitted by PA2 §3 and §7.
// Coordinates remain in each original part's pixel space; raster output is exactly 2x.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {group,library,sharp,json,record,sha} from './pipeline.mjs';
const style=+(process.argv[2]??1),parts=JSON.parse(await readFile(join(group,'sources/parts-index.json'),'utf8')),palette=JSON.parse(await readFile(join(group,'sources/palette.json'),'utf8')),eyes=JSON.parse(await readFile(join(group,'sources/eye-alignment.json'),'utf8'));
const draft=join(group,'sources',`style${style}-imagegen.png`),draftRecord=await record(draft),records=[];
const line=1.6;
const smooth='M96 40 C97 27 89 16 77 11 L73 4 L69 10 C58 5 49 6 40 9 L32 6 L33 12 C22 17 15 24 11 34 L6 37 L10 42 C5 52 6 65 13 75 L11 80 L17 80 C25 92 39 96 52 95 L59 98 L62 94 C82 92 96 77 97 61 C98 53 98 47 96 40 Z';
const scallop='M96 42 Q101 35 95 30 Q98 23 90 21 Q91 13 81 13 Q77 4 69 9 Q62 3 55 8 Q46 3 40 11 Q31 7 27 15 Q18 14 16 23 Q8 25 11 33 Q3 39 9 46 Q3 54 10 60 Q5 69 14 74 Q12 83 22 85 Q25 94 35 92 Q43 100 51 94 Q61 101 68 93 Q79 95 83 86 Q94 85 93 75 Q101 69 96 61 Q102 52 96 46 Q98 44 96 42 Z';
function bodySVG(p){const w=p.width,h=p.height,path=style===2?scallop:smooth,stroke=line*100/w;
 const shadow='M9 34 C17 43 14 66 31 76 C45 89 67 85 90 72 L102 105 L-5 105 L-5 30 Z';
 const face=eyes[p.stage].eyeUV.map(([u,v])=>{const x=u*w,y=v*h;return `<path d="M${x-2.7},${y+.5} Q${x},${y-2.1} ${x+2.7},${y+.5}" fill="none" stroke="${palette.outline}" stroke-width="${line}" stroke-linecap="round"/>`;}).join('');
 const blush=eyes[p.stage].eyeUV.map(([u,v])=>`<ellipse cx="${u*w-1}" cy="${v*h+5.4}" rx="2.7" ry="1.4" fill="${palette.blush}"/>`).join('');
 return `<defs><clipPath id="body"><path d="${path}"/></clipPath><filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.1"/></filter></defs><g transform="scale(${w/100} ${h/100})"><path d="${path}" fill="${palette.body}"/><g clip-path="url(#body)"><path d="${shadow}" fill="${palette.shadow}" ${style===3?'filter="url(#soft)"':''}/>${style===2?`<path d="M34 70 Q58 62 79 71 Q91 84 69 90 Q46 98 34 82 Z" fill="${palette.belly}"/>`:''}</g><path d="${path}" fill="none" stroke="${palette.outline}" stroke-width="${stroke}" stroke-linejoin="round"/></g>${face}${blush}`;
}
function partSVG(p){const w=p.width,h=p.height;
 if(p.name==='tou')return bodySVG(p);
 if(p.name==='yan')return [.25,.82].map(u=>{const x=u*w,y=h*.5;return `<ellipse cx="${x}" cy="${y}" rx="5.7" ry="5" fill="${palette.body}"/><ellipse cx="${x}" cy="${y}" rx="1.9" ry="2.5" fill="${palette.outline}"/><circle cx="${x-.55}" cy="${y-.8}" r=".45" fill="${palette.highlight}"/>`;}).join('');
 if(/jiao|jao/.test(p.name)){const d=`M3 ${h-3} C${w*.20} ${h*.49},${w*.55} 4,${w-3} 3`;return `<path d="${d}" fill="none" stroke="${palette.outline}" stroke-width="5.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${palette.cyan}" stroke-width="2" stroke-linecap="round"/>`;}
 if(/^er/.test(p.name)){const d=p.name==='er1'?`M3 2 Q${w*.46} ${h*.19} ${w-2} ${h*.53} Q${w*.65} ${h*.77} ${w*.46} ${h-2} Q2 ${h*.82} 3 2Z`:`M${w-3} 2 Q${w*.45} ${h*.19} 2 ${h*.60} Q${w*.24} ${h*.88} ${w*.55} ${h-2} Q${w-1} ${h*.80} ${w-3} 2Z`;return `<defs><clipPath id="ear"><path d="${d}"/></clipPath><filter id="soft"><feGaussianBlur stdDeviation=".7"/></filter></defs><path d="${d}" fill="${palette.cyan}"/><g clip-path="url(#ear)"><path d="M${w*.38} ${h*.35} Q${w*.40} ${h*.8} ${w*.7} ${h} L0 ${h}Z" fill="${palette.cyanShadow}" ${style===3?'filter="url(#soft)"':''}/></g><path d="${d}" fill="none" stroke="${palette.outline}" stroke-width="${line}" stroke-linejoin="round"/>`;}
 const d=({mao1:`M2 3 Q${w*.48} ${h*.57} ${w-2} ${h-3}`,mao2:`M2 ${h*.4} Q${w*.52} ${h*.58} ${w-2} 3`,mao3:`M2 ${h-3} Q${w*.5} ${h*.60} ${w-2} 3`,mao4:`M2 3 Q${w*.5} ${h*.55} ${w-2} ${h*.48}`})[p.name];
 return `<path d="${d}" fill="none" stroke="${palette.outline}" stroke-width="2.2" stroke-linecap="round"/>`;
}
for(const p of parts){const dir=join(group,'sources',`style${style}`,'guaiD1'+p.stage,'parts');await mkdir(dir,{recursive:true});const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${p.width*4}" height="${p.height*4}" viewBox="0 0 ${p.width} ${p.height}">${partSVG(p)}</svg>`;
 const vector=join(dir,p.name+'.svg'),png=join(dir,p.name+'.png');await writeFile(vector,svg);await sharp(Buffer.from(svg)).resize(p.width*2,p.height*2).png().toFile(png);
 records.push({...p,output:await record(png),handCorrection:await record(vector),imagegen:draftRecord,method:'imagegen design draft + hand re-trace in original part coordinate space; 4x rasterized then downsampled to 2x',reasons:['Generated cell geometry/face placement does not meet exact source UV registration','Manual common palette, single brown contour, identical point-eye positions','No skeleton/attachment edits; original canvas dimensions doubled']});
}
await json(join(group,'sources',`style${style}-parts.json`),{style,palette,outlineSourceWidth:line,records});
// Pack unchanged region names into an untrimmed 2x atlas. JSON is byte-identical to the original.
for(const stage of ['a','c','d']){const name='guaiD1'+stage,dir=join(group,'sources',`style${style}`,name),ps=records.filter(p=>p.stage===stage),width=512;let x=4,y=4,row=0,atlas=`${name}.png\nsize: 512,512\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`,imgs=[];
 for(const p of ps){const w=p.width*2,h=p.height*2;if(x+w+4>width){x=4;y+=row+4;row=0;}imgs.push({input:join(dir,'parts',p.name+'.png'),left:x,top:y});atlas+=`${name}/${p.name}\n rotate: false\n xy: ${x}, ${y}\n size: ${w}, ${h}\n orig: ${w}, ${h}\n offset: 0, 0\n index: -1\n`;x+=w+4;row=Math.max(row,h);}
 await sharp({create:{width:512,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(imgs).png().toFile(join(dir,name+'.png'));
 await writeFile(join(dir,name+'.atlas'),atlas);await writeFile(join(dir,name+'.json'),await readFile(join(library,name,name+'.json')));
}
console.log('style',style,'completed',records.length,'2x parts and 3 native texture packages');
