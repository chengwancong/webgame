import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {collectInventory} from './inventory.ts';
import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {regions} from '../../packages/content/index.ts';
import {Pixels,ramps,root,publicRoot,approve} from './px0-art.mjs';
import {Pen,paint as portPaint} from './px2-art.mjs';
const {leaf,wood,ink,navy,water,fire,copper,arcane,earth}=ramps;
const family=id=>/frost|tundra|snow|frozen/.test(id)?'frost':/rift|abyss|void/.test(id)?'rift':/forge|ember|lava/.test(id)?'forge':/dragon|bone/.test(id)?'dragon':/mist|moss|forest/.test(id)?'mist':'wind';
const stone=id=>family(id)==='frost'?navy:family(id)==='rift'?arcane:family(id)==='forge'?copper:earth;
const plant=id=>family(id)==='frost'?water:family(id)==='rift'?arcane:leaf;
export function terrainTile(kind,id,mask=15){
 const p=new Pixels(16,16),r=kind==='water'?water:kind==='plank'?wood:kind==='grass'?plant(id):stone(id);
 const dark=kind==='wall'&&!/wall-top/.test(id),shade=dark?1:kind==='grass'?2:2;p.rect(0,0,16,16,r[shade]);
 if(kind==='cobble'||kind==='wall')for(let y=0;y<16;y+=4)for(let x=(y%8?-4:0);x<16;x+=8){p.rect(x+1,y+1,6,3,r[dark?2:3]);p.rect(x+1,y+1,5,1,r[dark?3:4]);p.rect(x+5,y+2,2,2,r[dark?1:2]);}
 else if(kind==='plank')for(let y=0;y<16;y+=4){p.rect(0,y+1,16,3,r[2]);p.rect(0,y+1,16,1,r[3]);p.rect(y%8?4:12,y+2,2,1,r[0]);}
 else if(kind==='water'){p.rect(0,3,7,1,r[3]);p.rect(4,4,4,1,r[4]);p.rect(8,11,8,1,r[3]);p.rect(9,10,3,1,r[4]);}
 else{for(const [x,y] of [[2,3],[10,2],[6,9],[13,12],[0,14]]){p.rect(x,y,2,1,r[3]);p.rect(x+1,y+1,2,1,r[2]);}if(kind==='grass'){p.poly([[3,7],[4,5],[5,8],[7,6],[6,10],[4,10]],r[2]);p.poly([[11,15],[12,11],[13,15]],r[3]);}}
 if(!(mask&1))p.rect(0,0,16,1,r[0]);if(!(mask&2))p.rect(15,0,1,16,r[0]);if(!(mask&4))p.rect(0,15,16,1,r[0]);if(!(mask&8))p.rect(0,0,1,16,r[0]);return p;
}
function terrainKind(id){return /water|sea|ocean/.test(id)?'water':/plank|wood|deck/.test(id)?'plank':/road|path|pav|plaza|floor|tile|crypt/.test(id)?'cobble':/wall|rock|stone|cliff/.test(id)?'wall':/sand|dirt|soil|mud|detail/.test(id)?'dirt':'grass';}
function boulder(b,id,spire=false){const r=stone(id);b.poly(spire?[[18,94],[28,34],[47,6],[63,21],[77,66],[91,94]]:[[4,91],[13,57],[33,31],[61,26],[83,50],[97,89],[76,97],[22,97]],r[0]);b.poly(spire?[[22,91],[32,36],[47,11],[53,34],[42,88]]:[[9,88],[18,59],[35,36],[58,31],[77,52],[72,86],[31,92]],r[2]);b.poly(spire?[[32,38],[47,12],[52,35],[44,47]]:[[19,59],[35,37],[58,32],[64,43],[46,54],[31,61]],r[4]);b.poly([[61,53],[78,53],[91,87],[69,93]],r[1]);}
function tree(b,id){const l=plant(id);b.poly([[43,53],[57,53],[60,86],[74,96],[67,99],[30,99],[29,96],[41,86]],wood[0]);b.poly([[47,61],[53,59],[52,88],[40,96],[35,96],[46,85]],wood[3]);
 if(/pine|fir|cedar|spruce/.test(id)){for(const [x,y,w] of [[50,2,15],[49,18,25],[51,36,36],[49,53,44]]){b.poly([[x,y],[x-w,y+22],[x-w+4,y+26],[x-8,y+21],[x+4,y+28],[x+w,y+23],[x+w-7,y+20]],l[0]);b.poly([[x,y+3],[x-w+6,y+21],[x-7,y+17],[x+3,y+23],[x+w-5,y+22],[x+7,y+12]],l[2]);b.poly([[x-1,y+5],[x-11,y+15],[x-3,y+13],[x+2,y+17]],l[3]);}}
 else if(/dead|burn|dry/.test(id)){b.poly([[43,83],[44,36],[29,26],[19,7],[24,6],[34,22],[46,28],[51,5],[56,5],[55,39],[70,28],[77,10],[81,12],[75,34],[56,49],[55,86]],wood[1]);b.rect(48,41,3,40,wood[3]);}
 else{for(const [x,y,rx,ry] of [[31,30,23,23],[66,28,24,23],[49,16,23,15],[47,48,30,23],[19,50,17,17],[78,48,18,18]]){b.ellipse(x,y,rx,ry,l[0]);b.ellipse(x-2,y-3,rx-3,ry-4,l[2]);b.poly([[x-rx*.45,y-ry*.45],[x,y-ry*.6],[x+rx*.2,y-ry*.2],[x-rx*.2,y]],l[3]);}}
}
function bush(b,id){const l=plant(id);if(/reed|tuft|grass/.test(id)){for(const [x,y] of [[20,18],[39,4],[58,21],[78,8]]){b.poly([[46,96],[x-7,y+9],[x,y],[x+6,y+13],[51,91]],l[0]);b.poly([[47,92],[x,y+4],[x+2,y+15]],l[3]);if(/reed/.test(id))b.ellipse(x,y+6,4,13,earth[4]);}}
 else{for(const [x,y,r] of [[24,67,22],[47,45,27],[72,64,25],[49,78,23]]){b.ellipse(x,y,r,r*.7,l[0]);b.ellipse(x-2,y-3,r-3,r*.7-4,l[2]);b.ellipse(x-5,y-6,6,5,l[3]);}if(/berry/.test(id))for(const [x,y] of [[22,63],[48,45],[71,65],[52,79]]){b.ellipse(x,y,4,5,fire[2]);b.rect(x-1,y-2,2,1,fire[4]);}}
}
function flowers(b,id){const l=plant(id),c=/gold|yellow/.test(id)?copper:/blue/.test(id)?navy:ink;for(const [x,y] of [[24,58],[47,30],[71,53],[49,73]]){b.rect(x-1,y,2,27,l[1]);b.poly([[x,y+17],[x-12,y+9],[x-10,y+18],[x,y+24],[x+12,y+13]],l[2]);for(const [dx,dy] of [[-6,0],[6,0],[0,-6],[0,6]])b.ellipse(x+dx,y+dy,5,5,c[4]);b.ellipse(x,y,3,3,copper[3]);}}
function chest(b,id,opened=false){b.poly([[7,40],[66,25],[94,40],[94,84],[36,97],[7,82]],wood[0]);b.poly([[11,42],[65,30],[89,42],[89,80],[36,91],[11,78]],wood[2]);b.rect(24,42,6,45,copper[2]);b.rect(72,37,6,47,copper[3]);if(opened){b.poly([[8,40],[9,10],[67,2],[91,21],[92,40],[66,48]],wood[0]);b.poly([[13,36],[13,14],[65,8],[86,23],[86,36],[65,43]],wood[3]);b.poly([[20,43],[64,34],[83,44],[63,60],[31,57]],wood[0]);}else{b.poly([[7,40],[12,22],[26,13],[66,10],[87,24],[94,40],[65,53],[35,59]],wood[0]);b.poly([[12,38],[17,24],[28,18],[65,15],[82,27],[88,39],[64,48],[36,53]],wood[3]);b.poly([[31,17],[40,15],[48,51],[38,54]],water[2]);}b.rect(48,56,14,18,copper[1]);b.poly([[55,58],[60,64],[55,71],[50,64]],water[3]);}
function cliff(b,id){const r=stone(id);b.poly([[2,26],[44,7],[98,25],[98,75],[76,97],[20,90],[2,65]],r[0]);b.poly([[5,34],[46,19],[95,33],[94,73],[74,91],[21,84],[6,63]],r[2]);for(let x=13;x<92;x+=13){b.poly([[x,35],[x+7,33],[x+4,78],[x-1,81]],r[1]);b.rect(x,40,1,24,r[3]);}b.poly([[3,25],[44,8],[96,25],[76,45],[20,39]],r[4]);b.poly([[8,25],[44,12],[87,26],[73,37],[22,33]],r[5]);if(/moss|mist|wind/.test(id))b.poly([[7,27],[20,26],[27,34],[41,31],[49,39],[29,38],[18,34]],leaf[2]);}
function column(b,id){const r=stone(id);b.poly([[28,90],[27,20],[39,9],[65,10],[76,22],[74,88],[61,98],[39,98]],r[0]);b.poly([[32,86],[32,23],[43,15],[61,15],[68,25],[68,85],[59,91],[42,91]],r[2]);b.rect(34,27,7,53,r[4]);b.poly([[22,89],[41,81],[64,81],[81,89],[67,98],[34,98]],r[1]);b.rect(28,23,47,4,copper[2]);if(/crystal|beacon|waypoint|anchor|totem/.test(id)){b.poly([[36,22],[50,3],[66,21],[52,39]],water[0]);b.poly([[39,21],[49,7],[51,31]],water[4]);b.poly([[51,7],[62,21],[53,33]],water[2]);}}
function campfire(b,id){const r=stone(id);for(const [x,y] of [[17,82],[36,89],[60,90],[80,80],[63,72],[30,71]]){b.ellipse(x,y,13,8,r[0]);b.ellipse(x-2,y-2,10,5,r[3]);}b.poly([[28,79],[45,50],[39,27],[53,3],[62,25],[58,42],[75,56],[68,77],[50,87]],fire[0]);b.poly([[33,77],[49,50],[46,30],[54,12],[56,37],[52,50],[67,61],[62,76],[49,81]],fire[2]);b.poly([[43,75],[52,54],[50,44],[58,59],[56,77],[49,80]],fire[4]);b.rect(48,67,6,12,fire[5]);}
function fence(b){for(const x of [8,46,86]){b.rect(x,18,8,76,wood[0]);b.rect(x+1,20,4,71,wood[3]);b.poly([[x-1,19],[x+3,11],[x+9,19]],wood[2]);}for(const y of [32,65]){b.rect(5,y,90,8,wood[0]);b.rect(6,y+1,87,4,wood[3]);}}
function arch(b,id){const r=/bone|dragon/.test(id)?earth:stone(id);b.poly([[7,94],[8,37],[21,14],[40,4],[67,9],[89,30],[94,93],[72,97],[70,42],[59,29],[41,27],[29,42],[29,96]],r[0]);b.poly([[12,91],[13,39],[25,20],[41,10],[63,14],[83,33],[88,90],[77,92],[75,39],[61,23],[38,21],[24,40],[24,92]],r[3]);b.poly([[18,37],[29,23],[41,14],[60,17],[68,24],[39,24],[27,42]],r[5]);if(/gate|seal|closed/.test(id)&&!/open/.test(id)){for(const x of [36,48,60]){b.rect(x,33,3,57,copper[2]);}b.rect(31,55,40,4,copper[3]);}if(/bone|dragon/.test(id)){b.poly([[35,22],[31,10],[35,3],[43,15],[53,12],[63,5],[68,12],[65,27],[57,33],[43,31]],earth[2]);b.poly([[39,19],[43,17],[45,22],[40,24]],ink[0]);b.poly([[55,18],[61,16],[60,23],[55,24]],ink[0]);}}
function bridge(b,id){const r=/bone/.test(id)?earth:wood;for(let i=0;i<8;i++)b.poly([[4+i*8,39+i*3],[33+i*8,24+i*3],[42+i*8,31+i*3],[13+i*8,47+i*3]],r[2]);for(const [x,y] of [[7,37],[26,26],[75,62],[94,51]]){b.rect(x,y-12,4,32,r[0]);b.rect(x+1,y-11,2,28,r[4]);}b.poly([[8,30],[80,56],[80,60],[8,34]],r[1]);b.poly([[28,19],[97,44],[97,48],[28,23]],r[3]);}
function tent(b,id){const c=family(id)==='rift'?arcane:earth;b.poly([[4,91],[47,10],[57,10],[96,92],[78,98],[22,98]],c[0]);b.poly([[10,89],[48,15],[75,93],[24,93]],c[3]);b.poly([[51,15],[89,89],[79,94]],c[1]);b.poly([[46,48],[65,93],[28,93]],wood[0]);b.poly([[47,53],[57,89],[37,89]],wood[1]);b.rect(17,89,4,10,wood[2]);b.rect(81,88,4,10,wood[2]);b.poly([[30,32],[48,13],[59,35],[51,37],[45,27],[37,38]],water[2]);}
function sky(b,id){const r=/cave|crypt|abyss|rift/.test(id)?arcane:navy;b.rect(0,0,100,100,r[1]);b.poly([[0,48],[19,38],[32,44],[51,29],[69,38],[89,22],[100,30],[100,100],[0,100]],r[2]);b.poly([[0,68],[21,54],[42,66],[63,48],[82,59],[100,43],[100,100],[0,100]],r[3]);if(/cave|crypt/.test(id))for(let x=0;x<100;x+=13)b.poly([[x,0],[x+12,0],[x+7,28+x%13],[x+4,8]],r[0]);else{for(const [x,y] of [[15,15],[55,10],[76,29]])b.poly([[x,y+4],[x+5,y],[x+16,y],[x+22,y+6],[x+17,y+9],[x+2,y+9]],ink[4]);}}
function symbol(b,id){const r=stone(id),n=Number(id.split('-').at(-1))||1;b.poly([[50,3],[93,26],[93,74],[50,97],[7,74],[7,26]],r[0]);b.poly([[50,12],[84,31],[84,69],[50,87],[16,69],[16,31]],r[3]);b.poly([[50,24],[72,38],[72,62],[50,76],[28,62],[28,38]],navy[0]);for(let i=0;i<Math.min(n,6);i++)b.rect(34+i%3*12,38+Math.floor(i/3)*20,6,12,copper[3]);}
function gadget(b,id){
 if(/letter|contract|testimony|log|postal/.test(id)){b.poly([[15,18],[70,8],[89,23],[84,84],[28,96],[12,82]],wood[0]);b.poly([[20,22],[69,14],[82,26],[78,79],[29,88],[19,79]],earth[4]);for(let y=35;y<74;y+=10)b.rect(31,y,35,2,wood[2]);b.ellipse(57,76,8,8,fire[1]);}
 else if(/key/.test(id)){b.ellipse(35,25,23,20,copper[1]);b.ellipse(35,25,15,13,copper[4]);b.ellipse(35,25,8,7,navy[0]);b.poly([[43,39],[53,36],[79,85],[71,91],[62,75],[55,79],[51,71],[58,68]],copper[2]);b.rect(43,41,4,15,copper[4]);}
 else if(/binding/.test(id)){b.poly([[17,15],[62,8],[86,25],[80,76],[39,95],[13,75]],wood[1]);b.poly([[22,23],[58,18],[73,29],[68,64],[40,79],[22,65]],copper[2]);b.poly([[29,31],[55,26],[63,33],[60,57],[40,67],[30,57]],null);b.rect(39,38,25,4,copper[4]);}
 else if(/pipe/.test(id)){b.poly([[10,70],[11,32],[29,14],[70,14],[88,30],[87,49],[67,48],[67,37],[34,37],[34,71]],copper[0]);b.poly([[16,66],[17,35],[32,20],[68,20],[80,32],[80,42],[74,42],[73,30],[31,30],[25,37],[25,65]],copper[3]);b.ellipse(22,71,16,8,copper[1]);b.ellipse(22,70,9,4,wood[0]);}
 else if(/observatory|chart/.test(id)){b.rect(46,43,7,44,wood[1]);b.poly([[47,78],[20,96],[25,99],[52,87],[78,99],[82,95],[55,78]],wood[2]);b.poly([[23,38],[63,13],[86,22],[88,34],[49,58],[28,53]],copper[1]);b.poly([[29,39],[63,20],[79,25],[80,31],[47,51],[31,47]],water[2]);b.ellipse(29,45,9,11,copper[3]);b.ellipse(28,43,5,7,water[4]);}
 else{b.ellipse(50,87,36,9,ink[1]);b.poly([[20,83],[20,33],[35,17],[68,17],[80,32],[80,82],[64,94],[35,94]],copper[0]);b.poly([[26,79],[26,35],[38,23],[64,23],[73,35],[73,78],[61,86],[38,86]],copper[2]);b.ellipse(50,50,22,25,water[0]);b.ellipse(50,50,16,19,water[2]);b.ellipse(46,45,7,9,water[4]);b.rect(45,16,10,9,copper[3]);if(/broken/.test(id))b.poly([[51,24],[43,40],[55,53],[44,73],[52,86],[48,70],[60,52],[49,40],[57,24]],ink[0]);}
}
function shape(id,type){
 if(/^ss-prop-/.test(id)&&!/cargo|bridge|supply/.test(id))return /faction|sign/.test(id)?'symbol':/refugee/.test(id)?'person':'gadget';
 if(/backdrop|sky|horizon/.test(id))return 'sky';if(/flowers|flower/.test(id))return 'flowers';if(/tree|pine|oak|birch|dead-tree/.test(id))return 'tree';if(/bush|reed|tuft|herb|grass-clump/.test(id))return 'bush';
 if(/cliff|wall-straight|wall-corner/.test(id)||type==='boundary')return 'cliff';if(/boulder-arch|cave-entry|entrance|boss-gate|bone-gate|portal|world-seal/.test(id))return 'arch';if(/bridge|sky-dock|pier/.test(id))return 'bridge';
 if(/dragonbone|bone-pile|skeleton/.test(id))return 'bone';
 if(/campfire|brazier|flame/.test(id))return 'fire';if(/fence|barricade/.test(id))return 'fence';if(/tent/.test(id))return 'tent';if(/chest|cache|cargo|crate|barrel|supply|depot|warehouse/.test(id))return 'chest';
 if(/boulder|rocks|rubble|ore|ramp|ledge/.test(id))return 'rock';if(/beacon|waypoint|totem|spire|pillar|column|crystal|obelisk|monolith|anchor|drum|watch|signal|lamp|light-stand|light-wall/.test(id))return 'column';
 if(/airship|hull|wreck|ship/.test(id))return 'airship';if(/log|stump|fallen|plank/.test(id))return 'log';if(/workshop|foundry/.test(id)||/landmark-hub/.test(id)&&family(id)==='forge')return 'workshop';if(/flag|banner|zone-|symbol|rune|mark-/.test(id)||type==='zone-banner')return 'symbol';
 if(/hut|house|lodge|building|hall|hub|hangar|inn|outpost|residence|tower|market/.test(id)||['building','outpost'].includes(type))return 'house';if(/cart/.test(id))return 'cart';if(/(?:^|:)forge$/.test(id))return 'workshop';if(/(?:^|:)sign$/.test(id))return 'sign';if(/altar|dais|relic|feature|pool|stairs|step|well|shrine|gate|circle|ground-deco/.test(id)||type==='plane-kit')return 'altar';
 if(type==='nature')return 'bush';if(type==='camp')return 'chest';if(type==='landmark'||type==='event-prop')return 'column';return undefined;
}
export function draw(id,type,w,h,frame=''){
 const b=new Pen(w,h),s=shape(id,type);if(!s)throw Error('Explicit environment blueprint required: '+id+' / '+type);
 if(s==='tree')tree(b,id);else if(s==='bush')bush(b,id);else if(s==='flowers')flowers(b,id);else if(s==='rock')boulder(b,id,/spire/.test(id));else if(s==='cliff')cliff(b,id);else if(s==='column')column(b,id);else if(s==='fire')campfire(b,id);else if(s==='chest')chest(b,id,/open|done|broken/.test(frame+' '+id));else if(s==='fence')fence(b);else if(s==='arch')arch(b,id);else if(s==='bridge')bridge(b,id);else if(s==='tent')tent(b,id);else if(s==='sky')sky(b,id);else if(s==='symbol')symbol(b,id);else if(s==='gadget')gadget(b,id);else if(s==='person'){b.ellipse(50,25,13,16,skinColor());b.poly([[38,43],[61,43],[70,82],[59,96],[50,79],[42,96],[29,82]],navy[1]);}
 else if(s==='bone'){b.poly([[5,64],[23,57],[48,54],[68,59],[90,51],[94,58],[73,67],[48,62],[25,65],[7,72]],earth[2]);for(let x=20;x<78;x+=12){b.poly([[x,61],[x-8,45],[x-7,27],[x-2,24],[x-4,44],[x+4,60]],earth[4]);}b.poly([[73,56],[78,33],[88,27],[97,39],[96,58],[87,69]],earth[3]);b.poly([[83,38],[88,35],[91,43],[86,49]],ink[0]);}
 else if(s==='airship')return portPaint('ss-scene-airship',w,h);
 else if(s==='workshop')return portPaint('ss-scene-workshop-tier-2',w,h);
 else if(s==='cart')return portPaint('ss-scene-build-post-4',w,h);
 else if(s==='sign')return portPaint('ss-scene-build-post-2',w,h);
 else if(s==='house')return portPaint('ss-scene-house',w,h);
 else if(s==='log'){b.poly([[4,69],[16,44],[82,40],[97,55],[87,83],[19,88]],wood[0]);b.poly([[10,68],[20,49],[80,45],[91,56],[82,77],[21,82]],wood[2]);b.ellipse(21,66,12,15,wood[4]);b.ellipse(21,66,7,10,wood[2]);b.rect(36,55,43,2,wood[3]);}
 else{const r=stone(id);b.poly([[5,75],[42,56],[92,75],[92,88],[53,99],[5,89]],r[0]);b.poly([[9,75],[43,61],[87,75],[51,92]],r[3]);b.rect(35,27,27,42,r[0]);b.rect(38,29,20,35,r[2]);b.poly([[42,31],[48,15],[57,28],[51,40]],water[3]);}
 return b.finish();
}
const palette=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8'));
function skinColor(){return palette.ramps.skin[5];}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}},rows=collectInventory().filter(r=>r.batch==='PX5'||['ss-scene-tree','ss-scene-rocks'].includes(r.key)),outputs=new Map(),contact=new Pixels(1024,2048);let preview=0;
async function output(key,sourceFile,pixels,options){
 let file=sourceFile.replace('/art/','/art-pixel/').replace(/\.(webp|jpe?g|svg)$/i,'.png');const signature=JSON.stringify([options.frame,options.anchor,options.terrain,options.recipe,createHash('sha256').update(pixels.data).digest('hex')]);
 if(outputs.has(file)&&outputs.get(file)!==signature)file=file.replace('.png','-'+key.replace(/[^a-zA-Z0-9_-]/g,'-')+'.png');outputs.set(file,signature);
 const a=await approve(key,pixels,{file,original:[sourceFile],batch:'PX5',...options},candidate);Object.assign(a,options);return a;
}
for(const row of rows){
 const [host,variantName]=row.key.split(':variant:'),source=runtimeResources.get(host);if(!source)continue;const r=source.runtime,v=variantName?r.variants?.find(v=>v.id===variantName):undefined,file=v?.file??r.file;if(!file||!row.paths.some(p=>/\.(png|webp|jpe?g|svg)$/.test(p)))continue;
 const id=row.key,ground=['ground','road','plane-ground'].includes(source.type)&&!/backdrop|light-pool/.test(id),mask=source.type==='mask';
 if(ground){const kind=terrainKind(id+' '+file),tiles=new Pixels(256,16);for(let m=0;m<16;m++)tiles.stamp(terrainTile(kind,id,m),m*16,0);const a=await output(id,file,tiles,{kind:'tiles',frame:[16,16],anchor:[0,0],terrain:{kind,ramp:kind==='grass'?plant(id):kind==='water'?water:kind==='plank'?wood:stone(id)},recipe:'tools/pixel/px5-art.mjs#terrainTile'});continue;}
 const meta=fs.existsSync(path.join(publicRoot,file))?await sharp(path.join(publicRoot,file)).metadata():{width:r.width??128,height:r.height??128};
 const dw=v?.displayWidth??r.displayWidth??(r.displayHeight?r.displayHeight*(r.width??meta.width)/(r.height??meta.height):/backdrop|sky/.test(id)?1280:source.type==='zone-banner'?48:96),dh=r.displayHeight??dw*(r.height??meta.height)/(r.width??meta.width),w=Math.max(8,Math.round(dw/16)*8),h=Math.max(8,Math.round(dh/16)*8),origin=v?.anchor??r.anchor??[.5,1],anchor=[Math.round(origin[0]*w),Math.round(origin[1]*h)];
 if(mask){if(!fs.existsSync(path.join(publicRoot,file)))throw Error('Source geometry mask missing: '+file);const raw=await sharp(path.join(publicRoot,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(raw.info.width-1,Math.floor((x+.5)*raw.info.width/w)),sy=Math.min(raw.info.height-1,Math.floor((y+.5)*raw.info.height/h)),i=(sy*raw.info.width+sx)*4;if(raw.data[i+3]>=128&&raw.data[i]>=128)p.dot(x,y,skinColor());}await output(id,file,p,{frame:[w,h],anchor,baseOrigin:origin,recipe:'tools/pixel/px5-art.mjs#binary-geometry-mask'});continue;}
 const atlas=r.atlas&&fs.existsSync(path.join(publicRoot,r.atlas))?JSON.parse(fs.readFileSync(path.join(publicRoot,r.atlas),'utf8')):undefined,states=Object.values(r.states??{}).filter(s=>s&&typeof s==='object'),names=[...new Set([r.frame,...states.flatMap(s=>s.frames??[]),...Object.values(r.animations??{}).flatMap(a=>a.frames??[])].filter(Boolean))];
 const count=Math.max(1,names.length),cols=Math.min(count,8),sheet=new Pixels(w*cols,h*Math.ceil(count/cols)),frames={};
 for(let n=0;n<count;n++){const p=draw(id,source.type,w,h,names[n]??'');sheet.stamp(p,n%cols*w,Math.floor(n/cols)*h);if(names[n])frames[names[n]]={x:n%cols*w,y:Math.floor(n/cols)*h,w,h};}
 const mainSource=names.length&&r.image?r.image:file,a=await output(id,mainSource,sheet,{frame:[w,h],anchor,baseOrigin:origin,frames:names.length?frames:undefined,defaultFrame:names[0],recipe:'tools/pixel/px5-art.mjs#'+shape(id,source.type)});
 for(const size of r.variants??[])if(size.file===file&&size.displayWidth&&size.displayWidth<dw&&!size.mirrorX){
  const sw=Math.max(8,Math.round(size.displayWidth/16)*8),sh=Math.max(8,Math.round(dh*size.displayWidth/dw/16)*8),key=id+':size:'+size.id;
  const scaled=await output(key,file,draw(id,source.type,sw,sh,names[0]??''),{frame:[sw,sh],anchor:[Math.round(origin[0]*sw),Math.round(origin[1]*sh)],baseOrigin:origin,recipe:'tools/pixel/px5-art.mjs#'+shape(id,source.type)});scaled.original=[file+'#size:'+size.id];a.variants??=[];a.variants.push({maxWidth:(dw+size.displayWidth)/2,key});
 }
 for(const extra of row.paths.filter(p=>p!==mainSource&&/\.(png|webp|jpe?g|svg)$/.test(p))){const state=states.find(s=>s.file===extra),name=state?.frames?.[0]??path.posix.basename(extra,'.png');await output(id+':file:'+path.posix.basename(extra),extra,draw(id,source.type,w,h,name),{frame:[w,h],anchor,baseOrigin:origin,recipe:'tools/pixel/px5-art.mjs#'+shape(id,source.type)});}
 if(preview<128){const p=draw(id,source.type,w,h,names[0]??'');if(w<=120&&h<=120){contact.stamp(p,preview%8*128,Math.floor(preview/8)*128);preview++;}}
}
for(const [key,w] of [['unit-shadow',24],['unit-shadow:small',16]]){
 const p=new Pixels(w,8);for(let y=0;y<8;y++)for(let x=0;x<w;x++)if((x-(w-1)/2)**2/(w/2)**2+(y-3.5)**2/16<=1){p.dot(x,y,palette.shadow);p.data[(y*w+x)*4+3]=128;}
 const a=await output(key,`/art/runtime/${key.replace(':','-')}.png`,p,{frame:[w,8],anchor:[w/2,4],shadow:true,recipe:'tools/pixel/px5-art.mjs#half-opacity-shadow'});a.original=key==='unit-shadow'?['code:apps/web/src/scene.ts#unit-shadow']:[];if(key==='unit-shadow')a.variants=[{maxWidth:45,key:'unit-shadow:small'}];
}
const env=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/environment.v2.json'),'utf8'));
for(const [name,file] of Object.entries({grass:env.textures.grass,road:env.textures.road,...env.chapterGround})){
 const kind=terrainKind(name+' '+file),pixels=new Pixels(256,16);for(let m=0;m<16;m++)pixels.stamp(terrainTile(kind,name,m),m*16,0);await output('environment-ground:'+name,file,pixels,{kind:'tiles',frame:[16,16],anchor:[0,0],terrain:{kind,ramp:kind==='grass'?plant(name):stone(name)},recipe:'tools/pixel/px5-art.mjs#terrainTile'});
}
const atlasFrames={},regionTiles=[],lodgeWidths=regions.find(r=>r.id==='town')?.obstacles.map(o=>(o.w+o.h)*32)??[];
outputs.set(env.textures.props.replace('/art/','/art-pixel/'),'reserved-for-whole-atlas');
for(const [name,rect] of Object.entries(env.frames)){
 const sizes=[...new Set(name==='oak'?[125,180,240,275,285]:name==='rocks'?[76,120,150,170,180,240,275,285]:name==='lodge'?[256,...lodgeWidths]:[({portal:170,forge:132,lamp:52,cart:112,bridge:140,sign:66})[name]??96])].sort((a,b)=>a-b),largest=sizes.at(-1),origin=env.anchors[name]??[.5,1];let base;
 for(let n=sizes.length-1;n>=0;n--){const dw=sizes[n],w=Math.max(8,Math.round(dw/16)*8),h=Math.max(8,Math.round(dw*rect[3]/rect[2]/16)*8),key='world-props:'+name+(n===sizes.length-1?'':':size:'+dw),tile=draw(key,'prop',w,h);
  const asset=await output(key,env.textures.props,tile,{frame:[w,h],anchor:[Math.round(origin[0]*w),Math.round(origin[1]*h)],baseOrigin:origin,recipe:'tools/pixel/px5-art.mjs#'+shape(key,'prop')});asset.original=[env.textures.props+'#'+name+(n===sizes.length-1?'':':size:'+dw)];
  if(n===sizes.length-1){base=asset;regionTiles.push({name,tile});}else{base.variants??=[];base.variants.unshift({maxWidth:(dw+sizes[n+1])/2,key});}
 }
}
const aw=Math.max(...regionTiles.map(r=>r.tile.width)),ah=Math.max(...regionTiles.map(r=>r.tile.height)),packed=new Pixels(aw*3,ah*Math.ceil(regionTiles.length/3));
regionTiles.forEach(({name,tile},i)=>{packed.stamp(tile,i%3*aw,Math.floor(i/3)*ah);atlasFrames[name]={x:i%3*aw,y:Math.floor(i/3)*ah,w:tile.width,h:tile.height};});outputs.delete(env.textures.props.replace('/art/','/art-pixel/'));
await output('world-props',env.textures.props,packed,{frame:[aw,ah],anchor:[0,0],frames:atlasFrames,defaultFrame:'oak',recipe:'tools/pixel/px5-art.mjs#legacy-prop-atlas'});
for(const biome of ['wind','mist','forge','frost','rift','dragon'])for(const kind of ['grass','dirt','cobble','wall','plank','water']){
 const pixels=new Pixels(256,16);for(let mask=0;mask<16;mask++)pixels.stamp(terrainTile(kind,biome,mask),mask*16,0);const a=await output(`terrain:${biome}:${kind}`,`/art/terrain/${biome}/${kind}.png`,pixels,{kind:'tiles',frame:[16,16],anchor:[0,0],terrain:{kind,ramp:kind==='grass'?plant(biome):kind==='water'?water:kind==='plank'?wood:stone(biome)},recipe:'tools/pixel/px5-art.mjs#terrainTile'});a.original=[];
}
fs.copyFileSync(path.join(root,'packages/asset-manifest/pixel-terrain.json'),path.join(publicRoot,'art-pixel/terrain-mapping.json'));candidate.metadataFiles=['/art-pixel/terrain-mapping.json'];
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px5-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px5-contact.png'));console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,review:'.runtime/pixel-redraw/px5-contact.png'}));

}
