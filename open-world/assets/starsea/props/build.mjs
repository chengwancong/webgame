import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'../../..'),base=join(root,'assets/starsea/props'),pub=join(root,'apps/web/public/art/starsea/props');
const req=JSON.parse(await readFile(join(root,'docs/starsea/requirements.json'),'utf8'));
let review;try{review=JSON.parse(await readFile(join(base,'evidence/producer-review.json'),'utf8'));}catch{}
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(pub,{recursive:true});await mkdir(join(base,'source'),{recursive:true});
const heights={key:64,cargo:110,letter:64,postal:105,binding:64,pipe:92,valve:120,core:150,engine:135,log:76,observatory:155,testimony:74,supply:132,node:145,bridge:200,contract:70,sign:64,refugee:78,'faction-alliance':64,'faction-workshop':64,'faction-dragon':64,'faction-dusk':64,'star-chart':180,'world-chart':420};
const alternate={cargo:{opened:'opened'},binding:{released:'released'},pipe:{broken:'broken'},valve:{broken:'broken'},engine:{damaged:'damaged'}};
const selectedSource={engine:'engine-v2','engine-damaged':'engine-damaged-v2','valve-broken':'valve-broken-v2'};
const annotations={decoded:'同一实体图；文书译读或航钥解码记录由剧情UI显示',recorded:'同一实体图；邮站记录已核验',verified:'同一实体图；证词核验记录',signed:'同一实体图；签署记录由UI显示',evacuated:'行囊与灯已迁離，显示撤离记录；未新增人形角色'};
const svg=(body,w=128,h=128)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="#4d5b5e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const icons={
 'sign':svg('<path d="M30 111V19M30 24Q66 27 98 57L32 67Z" fill="#71b8b4"/><path d="M41 40Q58 42 69 48" stroke="#d3ede8"/><path d="M17 111H61" stroke="#c7a260"/>'),
 'faction-alliance':svg('<circle cx="64" cy="64" r="29" fill="#e7dcb8"/><path d="M64 13V34M107 39L88 49M107 89L88 79M64 115V94M21 89L40 79M21 39L40 49" stroke="#529e9e" stroke-width="13"/><circle cx="64" cy="64" r="11" fill="#76c0b5"/>'),
 'faction-workshop':svg('<path d="M42 21L58 15L65 30L84 34L95 26L107 43L96 54L100 74L114 82L106 99L88 96L73 109L69 122L48 119L46 102L30 94L14 99L8 78L22 68L24 49L14 38L27 21L42 27Z" fill="#d5b771"/><path d="M43 45L63 24L85 47L65 67Z" fill="#eee5cc"/><path d="M67 59L36 97" stroke="#966d43" stroke-width="12"/>'),
 'faction-dragon':svg('<path d="M23 35Q9 71 38 91L49 54Z M105 35Q119 71 90 91L79 54Z" fill="#ddc991"/><path d="M22 89Q64 115 106 89" stroke="#75b7b9" stroke-width="11"/><path d="M49 54Q64 43 79 54L73 79H55Z" fill="#efe5c6"/>'),
 'faction-dusk':svg('<path d="M62 56L17 31L26 65L10 74L45 86L58 70L54 98L71 95L67 72L83 87L116 73L101 64L110 31L72 54L65 32Z" fill="#a398b4"/><path d="M31 59L49 69M98 59L79 69" stroke="#d6e7e5"/>'),
};
const nodes=[{id:'ss-map-wind',name:'风栖岛',chapter:1,x:85,y:215},{id:'ss-map-mist',name:'雾铃岛',chapter:2,x:205,y:105},{id:'ss-map-forge',name:'赤炉岛',chapter:3,x:325,y:290},{id:'ss-map-frost',name:'霜镜岛',chapter:4,x:460,y:110},{id:'ss-map-rift',name:'沉星岛',chapter:5,x:580,y:285},{id:'ss-map-dragon',name:'龙眠岛',chapter:6,x:710,y:175}];
const mapBody=`<rect x="8" y="8" width="784" height="404" rx="24" fill="#f5f1e5" stroke="#ddd2b6"/><path d="M36 320Q160 275 285 332T755 325M36 60Q170 14 310 65T755 45" stroke="#9ec6c5" opacity=".45"/>${nodes.slice(1).map((n,i)=>`<path d="M${nodes[i].x} ${nodes[i].y}Q${(nodes[i].x+n.x)/2} ${(nodes[i].y+n.y)/2-35} ${n.x} ${n.y}" stroke="#c4a25c" stroke-dasharray="8 9"/>`).join('')}${nodes.map(n=>`<ellipse cx="${n.x}" cy="${n.y}" rx="33" ry="21" fill="#c9ded4"/><path d="M${n.x-11} ${n.y-6}L${n.x} ${n.y-27}L${n.x+13} ${n.y-4}Z" fill="#a4bbad"/><circle cx="${n.x}" cy="${n.y}" r="5" fill="#cba562"/>`).join('')}`;
icons['world-chart']=svg(mapBody,800,420);
const stars=[[45,93],[90,50],[133,125],[190,35],[240,104],[286,60]];
for(const state of ['fragmented','aligned'])icons['star-chart-'+state]=svg(`<rect x="9" y="9" width="302" height="162" rx="12" fill="#f2ead4" stroke="#cdb78a"/>${stars.slice(1).map((p,i)=>`<path d="M${stars[i][0]} ${stars[i][1]}Q${(stars[i][0]+p[0])/2} ${(stars[i][1]+p[1])/2-20} ${p[0]} ${p[1]}" stroke="#7aaab1" ${state==='fragmented'?'stroke-dasharray="3 11" opacity=".32"':''}/>`).join('')}${stars.map(([x,y])=>`<path d="M${x} ${y-7}L${x+4} ${y-2}L${x+8} ${y}L${x+3} ${y+3}L${x} ${y+8}L${x-3} ${y+3}L${x-8} ${y}L${x-3} ${y-2}Z" fill="#d4b86a" stroke-width="2"/>`).join('')}`,320,180);
for(const [id,data] of Object.entries(icons)){await writeFile(join(base,'source','ss-prop-'+id+'.svg'),data);await writeFile(join(pub,'ss-prop-'+id+'.svg'),data);}
const fileInfo=async(path)=>{const b=await readFile(path);let meta={};if(/\.(png|svg)$/.test(path)){const d=await sharp(b).metadata();meta={width:d.width,height:d.height,alpha:d.hasAlpha||path.endsWith('.svg')};}return {path:path.slice(root.length+1).replaceAll('\\','/'),sha256:hash(b),bytes:b.length,...meta};};
const assets=[];
for(const requirement of req.props){
 const short=requirement.id.slice(8),vector=short==='star-chart'||Boolean(icons[short]);
 const keys=short==='star-chart'?['star-chart-fragmented','star-chart-aligned']:[short,...Object.values(alternate[short]??{}).map(v=>short+'-'+v)];
 const sprites={};const files=[];
 for(const key of keys){
  if(vector){const p=join(base,'source','ss-prop-'+key+'.svg');files.push(await fileInfo(p),await fileInfo(join(pub,'ss-prop-'+key+'.svg')));const d=await sharp(p).metadata();sprites[key]={file:'/art/starsea/props/ss-prop-'+key+'.svg',width:d.width,height:d.height};continue;}
  const sourceKey=selectedSource[key]??key,p=join(base,'source','ss-prop-'+sourceKey+'.png'),bytes=await readFile(p),metadata=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
  if(!metadata.hasAlpha||stats.channels[3].min!==0||stats.channels[3].max<250)throw Error('Unusable transparent source '+key);
  const data=await sharp(bytes).trim({threshold:8}).resize({width:512,height:512,fit:'inside'}).extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const out=join(pub,'ss-prop-'+key+'.png');await writeFile(out,data);const d=await sharp(data).metadata();sprites[key]={file:'/art/starsea/props/ss-prop-'+key+'.png',width:d.width,height:d.height,alphaPadding:8};
  files.push(await fileInfo(p),await fileInfo(join(base,'source','ss-prop-'+sourceKey+'.json')),await fileInfo(out));
 }
 const states={};
 for(const state of requirement.states){const key=short==='star-chart'?'star-chart-'+state:alternate[short]?.[state]?short+'-'+alternate[short][state]:short;
  const pulse=['responding','flowing','running','stable','overload','active','stabilizing'].includes(state);
  states[state]={kind:short==='world-chart'?'chart':'sprite',...sprites[key],anchor:vector?[.5,.5]:[.5,(sprites[key].height-8)/sprites[key].height],displayHeight:heights[short],visible:state!=='evacuated',annotation:annotations[state]??(alternate[short]?.[state]?'独立手绘状态图':pulse?'实体底图＋程序能量状态层':'实体静态图'),imageDifference:Boolean(alternate[short]?.[state])||short==='star-chart',light:pulse?{kind:'program-status-light',center:[.5,.5],radius:short==='key'?8:12,color:state==='overload'?'danger':'energy',period:state==='stabilizing'?.4:1.4}:null};
  if(short==='bridge'&&state==='open')states[state].portal={kind:'program-star-current',bounds:[.32,.16,.36,.6],role:'decorative-only; never a damage or collision boundary'};
  if(['dim','offline','disabled','inactive'].includes(state))states[state].material={kind:'runtime-filter',saturation:.35,brightness:.78};
  if(states[state].light)states[state].light.center=({key:[.5,.72],pipe:[.5,.5],valve:[.5,.18],core:[.5,.36],engine:[.28,.49],observatory:[.5,.35],supply:[.5,.34],node:[.5,.24]}[short]??[.5,.5]);
 }
 // Physical state pairs keep the same footprint width. A lid/detached pin may change total height.
 if(alternate[short]){const baseSprite=sprites[short],referenceWidth=heights[short]*(baseSprite.width-16)/(baseSprite.height-16);
  for(const s of Object.values(states)){s.referenceScale=referenceWidth/(s.width-16);s.displayHeight=(s.height-16)*s.referenceScale;s.referenceFootprint={kind:'visible-body-width',width:referenceWidth,sourcePixels:[8,s.width-8],foot:[.5,(s.height-8)/s.height],policy:'Same body width and fixed foot; total open/damaged bounds may differ.'};}
 }
 const first=states[requirement.states[0]],primary=files.find(f=>f.path.startsWith('assets/')&&/\.(png|svg)$/.test(f.path));
 const runtime={kind:'prop',file:first.file,states,displayHeight:heights[short],anchor:first.anchor,...(short==='world-chart'?{chartNodes:nodes,interaction:'static-node-selection; no free-flight or persistent unlocks'}:{})};
 const producerVerified=review?.passed===true&&review.runtimeHashes?.[requirement.id]===hash(Buffer.from(JSON.stringify(runtime)))&&files.every(f=>review.files.some(p=>p.path===f.path&&p.sha256===f.sha256));
 const uses=req.chapters.flatMap(c=>c.tasks.filter(t=>t.resources.includes(requirement.id)).map(t=>t.id));
 assets.push({id:requirement.id,name:requirement.name,type:'prop',chapters:requirement.chapter,uses,source:{mode:'new',path:primary.path,sha256:primary.sha256,tool:vector?'code-native SVG symbol/chart':'image_gen.imagegen',adjustments:vector?['Native UI/diagram vector paths; text, locks and selection owned by DOM.']:['Technical alpha trim, proportional import resize, 8px padding; no painted pixel edits.','Physical variants keep one calibrated visible-body width and fixed foot, not equal overall heights.','Engine and broken-valve v2 are reference-preserving imagegen edits; prior drafts retained.']},files,runtime,actions:{},states,dependencies:vector?['project-ui-tokens']:[],status:producerVerified?'producer-reviewed':'producer-review-pending',notes:['Resource only. Quest persistence, collision and chapter unlocks are not implemented.','Knowledge/verification states honestly reuse physical sprite with DOM annotation.'],producerReview:{passed:producerVerified,report:'assets/starsea/props/evidence/producer-review.json',rootAcceptance:'pending'}});
}
const manifest={schemaVersion:1,group:'props',version:'starsea-20261003-props-v1',designVersion:req.version,assets,limitations:['Static hand-painted physical props with separate physical variants. Light and portal layers are explicitly program effects.','SVG signs and charts are native UI/diagram assets; no generated UI panel skin.','No character, monster, effect or map source overwritten by this group.']};
await writeFile(join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(pub,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({props:assets.length,states:assets.reduce((n,a)=>n+Object.keys(a.states).length,0),sprites:Object.values(icons).length+assets.reduce((n,a)=>n+(a.source.tool==='image_gen.imagegen'?Object.values(a.runtime.states).filter(s=>s.imageDifference).length+1:0),0),version:manifest.version}));
