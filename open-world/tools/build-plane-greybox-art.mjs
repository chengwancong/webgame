// Plane scene greybox kit (箱庭位面灰盒件): SVG drawn here, rasterised by sharp.
// The PNGs are placeholders; the canvas, anchor and displayWidth of every part
// are the contract the painted kit must keep (docs/plane-art-handoff-20261018.md §2.3).
// Usage: node tools/build-plane-greybox-art.mjs
import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),scenes=JSON.parse(readFileSync(new URL('packages/content/plane-scenes.json',root),'utf8'));
const outDir='apps/web/public/art/open-world/plane-greybox',publicBase='/art/open-world/plane-greybox';
const palette={
 cave:{floor:'#dcc79c',floorDark:'#b89f76',path:'#ead8b0',wall:'#d6bf95',wallLow:'#ecdcb8',wallDark:'#a8916f',top:'#e4d0a6',lip:'#c9b088',cap:'#f1e3c2',line:'#4a3644',accent:'#7cc0ff',accentDark:'#2f5fa8',light:'#ffd77a',lightCore:'#fff3c4',pool:'255,226,150',moss:'#7fb38a',bg:'#1f2350',bgTop:'#121433'},
 crypt:{line:'#3a2f4e',floor:'#dccfb4',floorDark:'#c4b494',path:'#ece2ca',wall:'#9a8fb8',wallLow:'#b2a8cc',wallDark:'#655b8a',top:'#23264e',lip:'#474a85',cap:'#7d72a3',accent:'#e8b04a',accentDark:'#8a5a1e',light:'#ffb35c',lightCore:'#fff0c8',pool:'255,196,120',moss:'#8fae86',bg:'#1e2246',bgTop:'#11132c'},
 maze:{line:'#24414a',floor:'#cfd9c5',floorDark:'#b5c3aa',path:'#e1e8d4',wall:'#7fa59a',wallLow:'#9cc0b4',wallDark:'#4f7570',top:'#1e3042',lip:'#3c5a66',cap:'#5f8a80',accent:'#8ff0d8',accentDark:'#2f8f7c',light:'#9ff5e0',lightCore:'#eafff8',pool:'170,245,225',poolAlpha:.45,moss:'#6fa36a',bg:'#1b2a3c',bgTop:'#0f1a28'},
};
/** Sprites get the actors' soft dark outline: alpha dilated by 2px and flooded with the kit line colour. */
const outlined=(kit,body,shadow='')=>({body:shadow+`<g filter="url(#ol)">${body}</g>`,defs:`<filter id="ol" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="2" result="d"/><feFlood flood-color="${palette[kit].line}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`});
const svg=(w,h,body,defs='')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const pts=a=>a.map(p=>p.map(v=>Math.round(v*100)/100).join(',')).join(' ');
const poly=(a,fill,extra='')=>`<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;
function rand(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** Wall face strip 128×Hs (two 64px variants), sheared by the renderer onto each cell
 * edge and tiled upward from the floor line (bottom row). cave: chunky outlined stones,
 * Hs=256 so tall rock repeats; crypt/maze: brick courses with a cap, Hs = wall height. */
function wallStraight(kit,H){
 const c=palette[kit],r=rand(H*7+kit.length);
 if(kit==='cave'){
  // Irregular rock chunks: lit upper facet, shaded lower facet, dark outline; drawn again at ±Hs so the strip tiles vertically.
  let body='',defs='';const Hs=256;
  for(let v=0;v<2;v++){const ox=v*64;defs+=`<clipPath id="v${v}"><rect x="${ox}" y="0" width="64" height="${Hs}"/></clipPath>`;let g=`<rect x="${ox}" y="0" width="64" height="${Hs}" fill="${c.wallDark}"/>`;
   for(let k=0;k<16;k++){const cx=ox+8+r()*48,cy=r()*Hs,rx=14+r()*14,ry=12+r()*12,n=6,pts0=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r()*.5,q=.75+r()*.3;pts0.push([Math.cos(a)*rx*q,Math.sin(a)*ry*q]);}
    const tone=[c.wall,c.wallLow,c.wall,c.lip][Math.floor(r()*4)];
    for(const dy of [-Hs,0,Hs]){const P=pts0.map(([x,y])=>[cx+x,cy+y+dy]);g+=poly(P,tone,`stroke="${c.line}" stroke-width="2" stroke-linejoin="round"`)+poly([P[3],P[4],P[5],[cx,cy+dy+ry*.15]],c.cap,'opacity=".55"')+poly([P[0],P[1],P[2],[cx,cy+dy+ry*.1]],c.wallDark,'opacity=".45"');}}
   body+=`<g clip-path="url(#v${v})">${g}</g>`;}
  return {w:128,h:Hs,anchor:[0,1],displayWidth:128,svg:svg(128,Hs,body,defs)};
 }
 const course=kit==='crypt'?16:20,joint=kit==='crypt'?16:32;let body='';
 for(let v=0;v<2;v++){const ox=v*64;
  body+=`<rect x="${ox}" y="0" width="64" height="${H}" fill="${c.wall}"/>`;
  for(let h=course,row=0;h<H;h+=course,row++){const y=H-h;body+=`<line x1="${ox}" y1="${y}" x2="${ox+64}" y2="${y}" stroke="${c.line}" stroke-width="1.6" opacity=".75"/>`;
   for(let u=row%2?joint/2:joint;u<64;u+=joint)body+=`<line x1="${ox+u}" y1="${y}" x2="${ox+u}" y2="${y+course}" stroke="${c.line}" stroke-width="1.6" opacity=".7"/>`;
   for(let u=0;u<64;u+=joint)if(r()<.3)body+=`<rect x="${ox+u+2}" y="${y+2}" width="${joint-4}" height="${course-4}" fill="${r()<.5?c.wallLow:c.wallDark}" opacity=".35"/>`;}
  body+=`<rect x="${ox}" y="${H-10}" width="64" height="10" fill="${c.wallDark}" opacity=".6"/>`;
  body+=`<rect x="${ox}" y="0" width="64" height="12" fill="${c.cap}"/><line x1="${ox}" y1="12" x2="${ox+64}" y2="12" stroke="${c.line}" stroke-width="2"/>`;
  if(kit==='crypt'&&v===1)body+=`<rect x="${ox+24}" y="${H*.35}" width="16" height="26" rx="8" fill="${c.wallDark}" opacity=".6"/>`;
  if(kit==='maze')for(let u=4;u<62;u+=7+r()*8)body+=`<rect x="${ox+u-2.5}" y="10" width="5" height="${6+r()*(v?30:14)}" rx="2.5" fill="${c.moss}" opacity=".85"/>`;
 }
 return {w:128,h:H,anchor:[0,1],displayWidth:128,svg:svg(128,H,body)};
}
/** Block top texture (screen-space tile): flat colour with a few outlined slabs and pebbles. */
function wallTop(kit){
 const c=palette[kit],r=rand(kit.length*31);let body=`<rect width="256" height="256" fill="${kit==='cave'?c.top:c.lip}"/>`;
 for(let i=0;i<9;i++){const x=20+r()*216,y=20+r()*216,w=14+r()*22,h=8+r()*10;body+=`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${kit==='cave'?c.wallLow:c.cap}" opacity="${kit==='cave'?.5:.18}"/>`;}
 for(let i=0;i<6;i++){const x=20+r()*216,y=20+r()*216,seg=[[x,y]];for(let j=0;j<3;j++){const [px,py]=seg[seg.length-1];seg.push([px+8+r()*12,py+(r()-.5)*10]);}body+=`<polyline points="${pts(seg)}" fill="none" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`;}
 return {w:256,h:256,anchor:[0,0],displayWidth:256,mirror:true,svg:svg(256,256,body)};
}
function light(kit,H){
 const c=palette[kit],w=40,h=64,defs=`<radialGradient id="h"><stop offset="0" stop-color="${c.light}" stop-opacity=".75"/><stop offset="1" stop-color="${c.light}" stop-opacity="0"/></radialGradient>`;
 let body=`<circle cx="20" cy="30" r="19" fill="url(#h)"/>`;
 if(kit==='cave')body+=`<path d="M20 6 L20 18" stroke="#4a3a28" stroke-width="2"/><rect x="13" y="18" width="14" height="18" rx="3" fill="${c.light}" stroke="#5b4a3a" stroke-width="1.5"/><rect x="16" y="22" width="8" height="10" rx="2" fill="${c.lightCore}"/><rect x="11" y="15" width="18" height="4" rx="1" fill="#5b4a3a"/>`;
 else if(kit==='crypt')body+=`<path d="M14 40 L26 40 L22 50 L18 50 Z" fill="#6b5236" stroke="#3e2f1f"/><path d="M20 18 C27 26 26 34 20 40 C14 34 13 26 20 18 Z" fill="${c.light}"/><path d="M20 26 C23 30 23 35 20 39 C17 35 17 30 20 26 Z" fill="${c.lightCore}"/>`;
 else body+=`<polygon points="20,14 28,30 20,46 12,30" fill="${c.accent}" stroke="${c.accentDark}" stroke-width="1.5"/><polygon points="20,20 24,30 20,40 16,30" fill="${c.lightCore}"/>`;
 const o=outlined(kit,body.replace(/^<circle[^>]*\/>/,''),body.match(/^<circle[^>]*\/>/)[0]);return {w,h,anchor:[.5,30/h],displayWidth:w,svg:svg(w,h,o.body,defs+o.defs)};
}
function lightPool(kit){
 const c=palette[kit],defs=`<radialGradient id="p" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgb(${c.pool})" stop-opacity="${.85*(c.poolAlpha??1)}"/><stop offset=".5" stop-color="rgb(${c.pool})" stop-opacity="${.35*(c.poolAlpha??1)}"/><stop offset="1" stop-color="rgb(${c.pool})" stop-opacity="0"/></radialGradient>`;
 return {w:256,h:144,anchor:[.5,.5],displayWidth:256,svg:svg(256,144,`<ellipse cx="128" cy="72" rx="128" ry="72" fill="url(#p)"/>`,defs)};
}
/** Iso prism on a diamond footprint (half-width hw, centre cx,cy), z pixels tall. */
function prism(cx,cy,hw,z,top,left,right,stroke){const hh=hw*18/32,L=[cx-hw,cy],B=[cx,cy+hh],R=[cx+hw,cy],Tp=[cx,cy-hh],up=p=>[p[0],p[1]-z];
 return poly([L,B,up(B),up(L)],left,`stroke="${stroke}" stroke-width="1"`)+poly([B,R,up(R),up(B)],right,`stroke="${stroke}" stroke-width="1"`)+poly([up(L),up(B),up(R),up(Tp)],top,`stroke="${stroke}" stroke-width="1"`);}
function pillar(kit,H){
 const c=palette[kit],w=128,h=H+40+40,cx=64,cy=H+40;let body=`<ellipse cx="${cx}" cy="${cy+4}" rx="46" ry="22" fill="#000" opacity=".18"/>`;
 if(kit==='cave')body+=poly([[cx-30,cy],[cx-12,cy-H*.55],[cx-8,cy-H-30],[cx+6,cy-H-30],[cx+12,cy-H*.5],[cx+30,cy]],c.wall,`stroke="${c.wallDark}" stroke-width="1.5"`)+`<path d="M${cx-4} ${cy-6} L${cx-2} ${cy-H}" stroke="${c.line}" stroke-width="1.6" opacity=".7"/>`;
 else if(kit==='crypt')body+=prism(cx,cy,40,12,c.wallLow,c.wall,c.wallDark,c.wallDark)+prism(cx,cy-12,26,H,c.wallLow,c.wall,c.wallDark,c.wallDark)+prism(cx,cy-12-H,36,14,c.cap,c.wall,c.wallDark,c.wallDark);
 else body+=prism(cx,cy,34,H+10,c.wallLow,c.wall,c.wallDark,c.wallDark)+`<polygon points="${cx},${cy-H*.55-12} ${cx+6},${cy-H*.55} ${cx},${cy-H*.55+12} ${cx-6},${cy-H*.55}" fill="${c.accent}"/>`;
 const shadow=body.match(/^<ellipse[^>]*\/>/)[0],o=outlined(kit,body.slice(shadow.length),shadow);return {w,h,anchor:[.5,cy/h],displayWidth:w,svg:svg(w,h,o.body,o.defs)};
}
function prop(kit,part){
 const c=palette[kit],big=part.startsWith('prop-m'),w=big?96:64,h=w,cx=w/2,cy=h*.85,r=rand(part.length*13+kit.length);let body=`<ellipse cx="${cx}" cy="${cy}" rx="${w*.32}" ry="${w*.12}" fill="#000" opacity=".16"/>`;
 const crystal=(x,y,s)=>poly([[x-4*s,y],[x-2*s,y-14*s],[x,y-22*s],[x+2.5*s,y-13*s],[x+4*s,y]],c.accent,`stroke="${c.accentDark}" stroke-width="1"`);
 const key=kit+':'+part;
 if(key==='cave:prop-s1')body+=crystal(cx-8,cy,1)+crystal(cx+2,cy,1.4)+crystal(cx+10,cy,.9);
 else if(key==='cave:prop-s2')for(const [dx,s] of [[-10,1],[2,1.3],[12,.8]])body+=`<rect x="${cx+dx-2}" y="${cy-14*s}" width="4" height="${14*s}" fill="#e9e2cf"/><ellipse cx="${cx+dx}" cy="${cy-14*s}" rx="${8*s}" ry="${5*s}" fill="#5fd0c4" stroke="#2f7f86"/>`;
 else if(key==='cave:prop-s3')for(const [dx,dy,s] of [[-10,0,1],[6,-2,1.2],[0,-10,.9]])body+=`<ellipse cx="${cx+dx}" cy="${cy+dy-5*s}" rx="${10*s}" ry="${7*s}" fill="${c.wallLow}" stroke="${c.wallDark}"/>`;
 else if(key==='cave:prop-m1')body+=crystal(cx-14,cy,1.4)+crystal(cx,cy,2.4)+crystal(cx+14,cy,1.6);
 else if(key==='cave:prop-m3')body+=poly([[cx-22,cy],[cx-9,cy-40],[cx-3,cy-78],[cx+4,cy-52],[cx+12,cy-30],[cx+24,cy]],c.wall,`stroke="${c.wallDark}" stroke-width="1.5"`)+poly([[cx+8,cy],[cx+14,cy-22],[cx+20,cy]],c.wallLow,`stroke="${c.wallDark}"`);
 else if(key==='cave:prop-m2')body+=prism(cx,cy-6,26,20,'#a8865a','#8a6a45','#6d5235','#4a3a28')+`<circle cx="${cx-14}" cy="${cy-2}" r="5" fill="#4a3a28"/><circle cx="${cx+14}" cy="${cy-2}" r="5" fill="#4a3a28"/>`;
 else if(key==='crypt:prop-s1')body+=`<path d="M${cx-10} ${cy} C${cx-16} ${cy-16} ${cx-10} ${cy-26} ${cx} ${cy-26} C${cx+10} ${cy-26} ${cx+16} ${cy-16} ${cx+10} ${cy} Z" fill="#b98a5a" stroke="#6b4a2a"/><rect x="${cx-6}" y="${cy-31}" width="12" height="6" fill="#8a6a45"/>`;
 else if(key==='crypt:prop-s2')body+=`<rect x="${cx-12}" y="${cy-8}" width="24" height="8" fill="${c.wallLow}" stroke="${c.wallDark}"/>`+[-7,0,7].map(dx=>`<rect x="${cx+dx-2}" y="${cy-20}" width="4" height="12" fill="#f3ead6"/><ellipse cx="${cx+dx}" cy="${cy-23}" rx="2.5" ry="4" fill="${c.light}"/>`).join('');
 else if(key==='crypt:prop-m1')body+=prism(cx,cy-4,34,18,c.wallLow,c.wall,c.wallDark,c.wallDark)+prism(cx,cy-22,30,5,c.cap,c.wall,c.wallDark,c.wallDark);
 else if(key==='crypt:prop-m2')body+=prism(cx,cy,18,10,c.wallLow,c.wall,c.wallDark,c.wallDark)+`<path d="M${cx-9} ${cy-10} L${cx-7} ${cy-50} Q${cx} ${cy-62} ${cx+7} ${cy-50} L${cx+9} ${cy-10} Z" fill="${c.wallLow}" stroke="${c.wallDark}"/>`;
 else if(key==='crypt:prop-m3')body+=`<rect x="${cx-2}" y="${cy-50}" width="4" height="50" fill="#8a6a45"/><path d="M${cx-18} ${cy-44} Q${cx} ${cy-30} ${cx+18} ${cy-44}" stroke="#8a6a45" stroke-width="3" fill="none"/>`+[-18,0,18].map(dx=>`<rect x="${cx+dx-2}" y="${cy-56+(dx?0:-6)}" width="4" height="10" fill="#f3ead6"/><ellipse cx="${cx+dx}" cy="${cy-60+(dx?0:-6)}" rx="3" ry="5" fill="${c.light}"/>`).join('');
 else if(key==='maze:prop-s1')body+=`<ellipse cx="${cx}" cy="${cy-8}" rx="16" ry="10" fill="${c.wallLow}" stroke="${c.wallDark}"/><ellipse cx="${cx-3}" cy="${cy-14}" rx="10" ry="4" fill="${c.moss}"/>`;
 else if(key==='maze:prop-s2')body+=`<path d="M${cx-9} ${cy} L${cx-8} ${cy-28} Q${cx} ${cy-36} ${cx+8} ${cy-28} L${cx+9} ${cy} Z" fill="${c.wallLow}" stroke="${c.wallDark}"/><path d="M${cx} ${cy-24} L${cx+4} ${cy-16} L${cx} ${cy-8} L${cx-4} ${cy-16} Z" fill="${c.accent}"/>`;
 else if(key==='maze:prop-m1')body+=prism(cx,cy,22,10,c.wallLow,c.wall,c.wallDark,c.wallDark)+prism(cx,cy-10,14,34,c.wallLow,c.wall,c.wallDark,c.wallDark)+poly([[cx-14,cy-44],[cx+14,cy-50],[cx+6,cy-56]],c.wall);
 else throw Error('No greybox prop '+key);
 const shadow=body.match(/^<ellipse[^>]*\/>/)[0],o=outlined(kit,body.slice(shadow.length),shadow);return {w,h,anchor:[.5,.85],displayWidth:w,svg:svg(w,h,o.body,o.defs)};
}
function ground(kit,part){
 const c=palette[kit],path=part==='ground-path',base=path?c.path:c.floor,dark=path?c.floor:c.floorDark,r=rand(kit.length*97+part.length);
 if(kit==='cave'){
  let body=`<rect width="256" height="256" fill="${base}"/>`;
  // Packed earth: broad flat patches, a few flat outlined stones and pebbles, hairline cracks.
  for(let i=0;i<7;i++)body+=`<ellipse cx="${30+r()*196}" cy="${30+r()*196}" rx="${30+r()*40}" ry="${18+r()*20}" fill="${dark}" opacity=".22"/>`;
  for(let i=0;i<(path?2:4);i++){const x=20+r()*216,y=20+r()*216,w=14+r()*20;body+=`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w*.55}" fill="${c.path}" stroke="${c.line}" stroke-opacity=".35" stroke-width="2"/><path d="M${x-w*.5} ${y-w*.2} q${w*.5} -${w*.2} ${w} 0" stroke="#fff6dd" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".45"/>`;}
  for(let i=0;i<14;i++){const x=10+r()*236,y=10+r()*236,w=2.5+r()*3.5;body+=`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w*.65}" fill="${c.wallDark}" opacity=".55"/>`;}
  for(let i=0;i<4;i++){const x=20+r()*216,y=20+r()*216;body+=`<path d="M${x} ${y} l${10+r()*8} ${3+r()*4} l${6+r()*6} -${4+r()*4}" fill="none" stroke="${c.line}" stroke-width="1.4" stroke-linecap="round" opacity=".3"/>`;}
  return {w:256,h:256,anchor:[0,0],displayWidth:256,mirror:true,svg:svg(256,256,body)};
 }
 // Iso flagstones aligned to the cell lattice: corners at (32a,18b), a≡b (mod 2); maze stones span 2×2 cells.
 const s=kit==='maze'?2:1,hw=32*s,hh=18*s;let body=`<rect width="256" height="144" fill="${dark}"/>`;
 for(let a=-1;a<=256/hw+1;a++)for(let b=-1;b<=144/hh+1;b++){if((a+b)%2===0)continue;const cx=a*hw,cy=b*hh,k=((a%(256/hw)+256/hw)%(256/hw))*7+((b%(144/hh)+144/hh)%(144/hh))*3,shade=[0,.04,.08,.02,.06][k%5],m=1.6;
  body+=poly([[cx-hw+m,cy],[cx,cy-hh+m*.56],[cx+hw-m,cy],[cx,cy+hh-m*.56]],base,`opacity="${1-shade}"`);}
 return {w:256,h:144,anchor:[0,0],displayWidth:256,svg:svg(256,144,body)};
}
function backdrop(kit){
 const c=palette[kit],r=rand(kit.length*53);
 const defs=`<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bgTop}"/><stop offset=".55" stop-color="${c.bg}"/><stop offset="1" stop-color="${c.lip}"/></linearGradient><radialGradient id="v" cx=".5" cy=".55" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient><filter id="s"><feGaussianBlur stdDeviation="14"/></filter>`;
 let body=`<rect width="1280" height="720" fill="url(#b)"/>`;
 // Far rock masses and hanging ceiling silhouettes: depth, not sky.
 let far='';for(let x=-40;x<1320;x+=90+r()*80){const w=120+r()*160,h=120+r()*220;far+=poly([[x,720],[x+w*.2,720-h],[x+w*.55,720-h*1.1],[x+w,720]],c.top,'opacity=".55"');}
 let ceiling='';for(let x=-20;x<1300;x+=40+r()*50){const len=60+r()*140,w=18+r()*30;ceiling+=poly([[x,0],[x+w,0],[x+w*.5,len]],c.bgTop,'opacity=".9"');}
 body+=`<g filter="url(#s)">${far}</g>${ceiling}`;
 for(const [x,y,rad] of [[180,600,140],[1080,580,160],[640,690,200]])body+=`<circle cx="${x}" cy="${y}" r="${rad}" fill="${c.accent}" opacity=".08" filter="url(#s)"/>`;
 body+=`<rect width="1280" height="720" fill="url(#v)"/>`;
 return {w:1280,h:720,anchor:[0,0],displayWidth:1280,svg:svg(1280,720,body,defs)};
}

const contract={
 'ground-main':{placement:'tile',note:'屏幕空间平铺；地宫/迷宫的石板必须按 64×36 菱形格对齐，图块周期 256×144'},
 'ground-path':{placement:'tile',note:'主路线磨损地面，同 ground-main 的平铺规则'},
 'wall-straight':{placement:'texture',note:'正视墙面条带（左右两个 64 宽变体），程序斜切贴到每格的前面和右面（右面压冷色阴影），底行=地面线，向上平铺；cave 高 256 上下无缝（圆块岩石），crypt/maze 高=墙高；岩石/砖块自带深色描边，矮墩只取底部 14px'},
 'wall-top':{placement:'texture',note:'墙顶/岩块顶面贴图，无缝，屏幕空间平铺；平涂色块+少量描边裂纹，程序按离地面距离分档压暗到背景色并描轮廓'},
 'light':{placement:'face',note:'挂在面向镜头的墙面上，锚点=灯体中心'},
 'light-pool':{placement:'floor',note:'加色混合的落地光圈，中心锚点'},
 'pillar':{placement:'cell',note:'2×2 格柱子，锚点=占地中心；有碰撞，挡人时半透明'},
 'backdrop-near':{placement:'screen',note:'1280×720 屏幕固定背景：岩体深处，无天空/星/地平线'},
};
const assets=[];
for(const [kit,spec] of Object.entries(scenes.kits)){
 const H=spec.wallHeight,parts={'ground-main':ground(kit,'ground-main'),'ground-path':ground(kit,'ground-path'),'wall-straight':wallStraight(kit,H),'wall-top':wallTop(kit),'light':light(kit,H),'light-pool':lightPool(kit),'backdrop-near':backdrop(kit)};
 if(spec.profile==='block')parts.pillar=pillar(kit,H);
 for(const p of spec.foot)parts[p]={...prop(kit,p),role:'foot'};
 for(const p of spec.blockers)parts[p]={...prop(kit,p),role:'blocker'};
 mkdirSync(new URL(`${outDir}/${kit}/`,root),{recursive:true});
 for(const [part,art] of Object.entries(parts)){
  // Noise grounds are mirrored 2×2 so the repeat has no seam (the pattern is tiled in screen space).
  if(art.mirror){const half=await sharp(Buffer.from(art.svg)).png().toBuffer(),[flop,flip,both]=await Promise.all([sharp(half).flop().toBuffer(),sharp(half).flip().toBuffer(),sharp(half).flip().flop().toBuffer()]);
   art.svg=null;art.png=await sharp({create:{width:art.w*2,height:art.h*2,channels:4,background:'#0000'}}).composite([{input:half,left:0,top:0},{input:flop,left:art.w,top:0},{input:flip,left:0,top:art.h},{input:both,left:art.w,top:art.h}]).png().toBuffer();art.w*=2;art.h*=2;art.displayWidth=art.w;}
  const png=art.png?await sharp(art.png).png({compressionLevel:9}).toBuffer():await sharp(Buffer.from(art.svg)).png({compressionLevel:9}).toBuffer(),file=`${outDir}/${kit}/${part}.png`;writeFileSync(new URL(file,root),png);
  const ground=part.startsWith('ground-')||part.startsWith('wall-')||part==='backdrop-near',id=`ow-art-plane-${kit}-${part}`,meta=contract[part]??(art.role==='foot'?{placement:'ledge',note:'岩台摆件：立在第一排岩块顶上靠地面一侧，锚点=落地点；无碰撞（不在可走区）'}:{placement:'cell',note:'挡路摆件：占一格且有碰撞，锚点=格心落地点；挡人时半透明'});
  assets.push({id,name:`位面灰盒 · ${kit} · ${part}`,kind:ground?'ground':'sprite',category:ground?'plane-ground':'plane-kit',kit,part,status:'greybox',
   contract:{canvas:[art.w,art.h],anchor:art.anchor,displayWidth:art.displayWidth,wallHeight:H,...meta},
   files:[{path:file.replace('apps/web/public',''),sha256:createHash('sha256').update(png).digest('hex'),bytes:png.length,width:art.w,height:art.h}],
   runtime:{file:`${publicBase}/${kit}/${part}.png`,width:art.w,height:art.h,anchor:art.anchor,displayWidth:art.displayWidth,...(part.startsWith('ground-')||art.mirror?{tileSize:art.w}:{})}});
 }
}
writeFileSync(new URL('packages/asset-manifest/open-world-planes-greybox.v1.json',root),JSON.stringify({schemaVersion:1,scope:'plane-greybox',note:'灰盒占位：几何契约见 contract；正式图按同 ID、同画布、同锚点替换 runtime.file',assets},null,1)+'\n');
console.log('plane greybox:',assets.length,'parts');
