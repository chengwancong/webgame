import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
import {storyPlans} from './island-story-plans.mjs';
const root='G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world';
const names=['wind','mist','forge','frost','rift','dragon'],index=Number(process.argv[2]??1)-1,island=names[index];if(!island)throw Error('Island1–6 required');
const source=JSON.parse(await fs.readFile(root+'/config/json/world.json','utf8'));
const catalogues=await Promise.all(['open-world.v1.json','open-world-five.v1.json'].map(async f=>JSON.parse(await fs.readFile(root+'/packages/asset-manifest/'+f,'utf8'))));
const all=catalogues.flatMap(c=>c.assets),local=all.filter(a=>a.island===island||a.island==='shared'||!a.island&&index===0),pool=category=>local.filter(a=>a.category===category),asset=(category,n=0)=>{const a=pool(category)[n%pool(category).length];if(!a)throw Error('Missing '+island+'/'+category);return a.id;};
const budgets=JSON.parse(await fs.readFile(root+'/docs/reviews/open-world-m2-m4/W3/numeric-refresh/camp-health-targets.json','utf8')).rows;
const measuredPath=process.argv.find(a=>a.startsWith('--calibrate='))?.slice(12),measured=measuredPath?JSON.parse(await fs.readFile(measuredPath,'utf8')):null;
const monster=JSON.parse(await fs.readFile(root+'/packages/content/monsters.json','utf8'));
const parent='ss-map-'+island,region=parent,prefix='ow-'+island,previous='ss-field-'+island;
const zoneNames=[['落风坡','船台湾','风车高地','旧码头','岸线崖','船坞要塞'],['雾铃渡口','邮路林道','三邮站谷','树冠步道','溪谷便道','军需营'],['熔渣码头','输能管廊','冷却阀区','矿道','炉顶检修台','岛心大厅'],['冰锚湾','冻舰坟场','观测站高地','冰隙','舰桥甲板','星盘室'],['沉星滩头','难民营地','炮台通道','裂隙通道','供能厅','界桥前庭'],['龙骨海岸','誓约庭','旧祭道','机库','航网节点群','中枢入口']][index];
const levelBands=[[[1,2],[2,4],[3,4],[4,5],[5,7],[7,8]],[[8,9],[10,12],[9,11],[12,13],[13,14],[14,15]],[[15,16],[15,16],[16,18],[18,19],[18,20],[20,21]],[[21,22],[21,23],[23,25],[24,25],[25,26],[26,27]],[[27,28],[27,29],[29,30],[29,31],[31,31],[32,32]],[[32,33],[32,34],[34,35],[34,35],[35,36],[36,37]]][index];
const centres=[{x:125,y:185},{x:125,y:335},{x:256,y:350},{x:385,y:325},{x:385,y:185},{x:256,y:155}],cells=[[0,0],[0,1],[1,1],[2,1],[2,0],[1,0]],landing={x:88,y:205};
const fresh=Object.fromEntries(Object.keys(source).filter(k=>k!=='source').map(k=>[k,[]]));
const add=(table,row)=>fresh[table].push(row),placed=(z,id,x,y)=>({id,region,zone:prefix+'-z'+(z+1),x,y});
add('islands',{id:prefix+'-island',region,island:parent,artIsland:island,chapter:index+1,name:['风栖岛','雾铃岛','赤炉岛','霜镜岛','沉星岛','龙眠岛'][index],width:512,height:512,seed:5107+index,landing,landRadius:[225,225],rockCount:35,decorationsPerZone:35,backdrop:'ss-scene-sky'});
centres.forEach((c,z)=>{const [cx,cy]=cells[z];add('zones',{id:prefix+'-z'+(z+1),region,name:zoneNames[z],rect:{x:cx*512/3,y:cy*256,w:512/3,h:256},levelBand:levelBands[z],theme:island,ground:asset('ground',z),banner:asset('zone-banner',z)});});
add('roads',{id:prefix+'-road-main',region,points:[landing,...centres],widthCells:4,theme:island});
const waypointResource=asset('travel');
centres.forEach((c,z)=>{add('waypoints',{...placed(z,prefix+'-wp'+(z+1),c.x,c.y),name:zoneNames[z]+'航标',resource:waypointResource,kind:z===0?'landing':z===5?'boss':'outpost'});add('outposts',{...placed(z,prefix+'-outpost'+(z+1),c.x+4,c.y),name:zoneNames[z]+'前哨',resource:asset('outpost',z),waypoint:prefix+'-wp'+(z+1)});});
for(const [i,p]of [{x:240,y:260},{x:315,y:250}].entries())add('waypoints',{...placed(p.y>=256?2:5,prefix+'-wp'+(i+7),p.x,p.y),name:'中央航标'+(i+1),resource:waypointResource,kind:'field'});
const plan=storyPlans[island],landmarks=plan?[['landing',0,landing,'登陆点'],...plan.sites.map(p=>[p.key,p.zone-1,{x:p.x,y:p.y},p.name])]:[['landing',0,landing,'登陆点'],['outpost',1,centres[1],'前哨'],['objective',1,{x:142,y:318},'引擎'],['clue',3,{x:365,y:338},'求救信号'],['route-fork',4,{x:357,y:213},'分岔口'],['route-a',4,{x:370,y:170},'崖路'],['route-b',3,{x:400,y:302},'码头便道'],['gate',5,{x:260,y:132},'世界机关'],['boss-entry',5,{x:270,y:116},'首领入口']];
for(const [id,z,p,name]of landmarks)add('landmarks',{...placed(z,prefix+'-landmark-'+id,p.x,p.y),key:id,name,kind:id==='gate'?'gate':id==='boss-entry'?'boss':'story',resource:asset(id==='boss-entry'?'boss-gate':'landmark',z)});
add('gates',{id:'gate-'+island,map:region,zone:prefix+'-z6',landmark:'gate',prop:asset('landmark',4),openedProp:asset('boss-gate'),openWhen:prefix+'-boss-cleared',guards:[{template:'ow-elite-'+island,rank:'elite',count:1},{template:'ow-mon-'+island+'-2',rank:'normal',count:2}],opened_message:['船坞闸门已打开','雾墙已消散','炉心隔热门已开启','冰封舱门已开启','界桥封锁已解除','航网屏障已关闭'][index]});
// Twenty-five camp centres per authored zone. The navigation generator protects
// these exact sites and all interactive points from decorative blockers.
for(let z=0;z<6;z++){
 const [cx,cy]=cells[z],candidates=[];
 for(let y=cy*256+24;y<(cy+1)*256-16;y+=17)for(let x=cx*512/3+18;x<(cx+1)*512/3-14;x+=17){
  if(((x-256)/219)**2+((y-256)/219)**2>=.92)continue;
  if(Math.hypot(x-landing.x,y-landing.y)<15)continue;
  if(landmarks.some(([,a,p])=>a===z&&Math.hypot(x-p.x,y-p.y)<10)||centres.some(p=>Math.hypot(x-p.x,y-p.y)<10))continue;
  candidates.push({x:Math.round(x),y:Math.round(y)});
 }
 if(candidates.length<25)throw Error('Insufficient camp sites '+z);
 // Spread sites throughout the zone rather than taking its first grid row.
 const picked=Array.from({length:25},(_,n)=>candidates[Math.floor(n*candidates.length/25)]);
 const alreadyAccepted=measured?.acceptance?.find(r=>r.zone===prefix+'-z'+(z+1))?.engagementPassed===true;
 const densityTarget=index===0&&process.argv.includes('--density-tune')&&[3,5].includes(z)?40:index===0?30:measured&&!alreadyAccepted?35:25;
 if(densityTarget>25)for(const p of candidates){if(picked.length>=densityTarget)break;if(picked.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=10))picked.push(p);}
 picked.forEach((p,n)=>{
  const elite=n<25&&n%5===0,pack=[{template:'ow-mon-'+island+'-1',rank:'normal',count:2},{template:elite?'ow-elite-'+island:'ow-mon-'+island+'-2',rank:elite?'elite':'normal',count:elite?1:2},...(elite?[{template:'ow-mon-'+island+'-2',rank:'normal',count:1}]:[])];
  const stage=index*3+Math.min(3,Math.floor(z/2)+1),targets={...budgets.find(b=>b.stage===stage).roleHealth},roles={swarm:0,normal:0,ranged:0};let health=0;
  // One permitted tuning pass: retain the one-shot swarm line and population;
  // give the first zone's ordinary members more of the group health budget.
  if(index===0&&z===0)targets.normal=Math.ceil(targets.normal*1.5);
  if(measured&&!alreadyAccepted){const observed=measured.rows.find(r=>r.report.zone.id===prefix+'-z'+(z+1))?.report.summary.normalTtkSeconds;if(!(observed>0))throw Error('Missing actual normal-role TTK for zone '+z);const level=(levelBands[z][0]+levelBands[z][1])/2,targetTtk=2.5*(.28+.72*Math.exp(-(level-1)/16));targets.normal=Math.ceil(targets.normal*targetTtk/observed);targets.ranged=Math.ceil(targets.ranged*targetTtk/observed);}
  for(const group of pack){const role=monster.templates.find(t=>t.id===group.template).role;roles[role]+=group.count;health+=targets[role]*group.count*monster.ranks[group.rank].hp;}
  add('camps',{...placed(z,prefix+'-camp-'+(z+1)+'-'+(n+1),p.x,p.y),radius:4,pack,respawnSeconds:90,budget:{count:4,health:Math.ceil(health),attackScale:1/4,roles:Object.fromEntries(Object.entries(roles).filter(([,n])=>n)),healthWeights:targets}});
 });
}
for(let i=0;i<3;i++){const z=i*2,c=centres[z];add('patrols',{id:prefix+'-patrol'+(i+1),region,zone:prefix+'-z'+(z+1),path:[{x:c.x-14,y:c.y+15},{x:c.x+18,y:c.y+15},{x:c.x+18,y:c.y+28}],template:'ow-elite-'+island,rank:'elite',speed:2.8,respawnSeconds:120,radius:4});}
if(index===0){const signal={x:365,y:338},closest=fresh.camps.filter(c=>c.zone===prefix+'-z4').sort((a,b)=>Math.hypot(a.x-signal.x,a.y-signal.y)-Math.hypot(b.x-signal.x,b.y-signal.y))[0];const site=Array.from({length:32},(_,n)=>({x:Math.round(signal.x+11*Math.cos(n*Math.PI/16)),y:Math.round(signal.y+11*Math.sin(n*Math.PI/16))})).find(p=>fresh.camps.every(c=>c===closest||Math.hypot(c.x-p.x,c.y-p.y)>=10));if(!site)throw Error('Signal camp cannot keep the authored spacing');Object.assign(closest,site);}
for(let i=0;i<2;i++){const z=2+i*2,c=centres[z];add('rares',{id:prefix+'-rare'+(i+1),region,zone:prefix+'-z'+(z+1),name:monster.templates.find(t=>t.id==='ow-rare-'+island+'-'+(i+1)).name,spots:[{x:c.x-30,y:c.y-18},{x:c.x+22,y:c.y-16},{x:c.x+12,y:c.y+33}],template:'ow-rare-'+island+'-'+(i+1),cooldownMinutes:20,affixes:[2,3],resource:'ow-rare-'+island+'-'+(i+1),loot:'field-rare'});}
for(let z=0;z<6;z++){
 const c=centres[z],kind=['defend','waves','horde'][z%3],normal={template:'ow-mon-'+island+'-1',rank:'normal',count:kind==='horde'?10:3},waves=Array.from({length:3},(_,w)=>[normal,...(kind==='horde'&&w===2?[{template:'ow-elite-'+island,rank:'elite',count:1}]:[])]);
 add('events',{...placed(z,prefix+'-event'+(z+1),c.x+(z===0?20:-18),c.y+23),name:zoneNames[z]+({defend:'守住补给',waves:'清退侵军',horde:'清扫怪潮'})[kind],kind,definition:'field-event',resource:asset('camp',z),markerResource:'ow-symbol-event',activeResource:asset('camp',(z+1)),cooldownResource:asset('camp',(z+2)),startEffect:'ow-fx-activate',successEffect:'ow-fx-arrive',failureEffect:'ow-fx-depart',radius:22,cooldownSeconds:600,durationSeconds:kind==='defend'?90:120,waveIntervalSeconds:kind==='horde'?10:20,waves,objectiveHp:kind==='defend'?4000:undefined,loot:'field-event'});
}
for(let n=0;n<25;n++){const z=n%6,c=centres[z],angle=Math.floor(n/6)*1.1;add('chests',{...placed(z,prefix+'-chest'+(n+1),Math.round(c.x+Math.cos(angle)*32),Math.round(c.y+Math.sin(angle)*32)),loot:'field-chest',resource:asset('chest',0),openResource:asset('chest',1)});}
for(let n=0;n<3;n++){const z=n*2,c=centres[z];add('dungeonEntrances',{...placed(z,prefix+'-entrance'+(n+1),c.x+23,c.y-18),dungeon:'field-'+island+'-'+(n+1),resource:asset('entrance',n),stage:index*3+n+1});}
const mark=(key,z,p,resource=asset('landmark',z))=>add('landmarks',{...placed(z,prefix+'-landmark-'+key,p.x,p.y),key,name:key,kind:'story',resource});
for(let z=0;z<6;z++){
 const c=centres[z],camp=fresh.camps.filter(p=>p.zone===prefix+'-z'+(z+1)).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0],chest=fresh.chests[z],event=fresh.events[z];
 mark(prefix+'-resident'+(z+1),z,{x:c.x+4,y:c.y+4},asset('outpost',z));mark(prefix+'-side-clue'+(z+1),z,{x:c.x+20,y:c.y-28},asset('camp',z));mark(prefix+'-camp-clue'+(z+1),z,camp,asset('camp',z));mark(prefix+'-chest-landmark'+(z+1),z,chest,chest.resource);mark(prefix+'-event-landmark'+(z+1),z,event,event.resource);
}
fresh.dungeonEntrances.forEach((entry,i)=>mark(prefix+'-entry-landmark'+(i+1),i*2,entry,entry.resource));
const gate=fresh.gates[0],closed=fresh.landmarks.find(l=>l.key==='gate');closed.until=prefix+'-gate-opened';add('landmarks',{...closed,id:prefix+'-landmark-gate-open',key:'gate-open',resource:gate.openedProp,when:prefix+'-gate-opened',until:undefined});
for(const [id,kind,z,p]of [['life-'+island+'-1','life',0,{x:140,y:142}],['life-'+island+'-2','life',3,{x:374,y:373}],['core-'+island,'core',2,{x:281,y:392}],['core-'+island+'-deep','core',5,{x:292,y:104}]])add('objects',{...placed(z,id,p.x,p.y),name:kind==='life'?'生命星晶':'星核',kind,resource:'ss-prop-core',...(kind==='core'?{when:'hardmode'}:{})});
if(index===0){fresh.camps.filter(c=>c.zone===prefix+'-z6').forEach(c=>c.until=prefix+'-boss-cleared');const fort=fresh.outposts[5];fort.when=prefix+'-boss-cleared';fort.waypoint=prefix+'-wp9';add('waypoints',{...placed(5,prefix+'-wp9',centres[5].x+4,centres[5].y),name:'船坞友方前哨',resource:waypointResource,kind:'outpost',when:prefix+'-boss-cleared'});}
if(plan){
 const declaration=fresh.gates[0],at=plan.sites.find(p=>p.key==='gate');declaration.zone=prefix+'-z'+at.zone;
 if(island==='mist'){fresh.camps.filter(c=>c.zone===prefix+'-z6').forEach(c=>c.until=prefix+'-boss-cleared');fresh.outposts[5].when=prefix+'-boss-cleared';fresh.outposts[5].name='邮路补给站';}
 if(island==='rift'){fresh.camps.filter(c=>c.zone===prefix+'-z3').forEach((c,i)=>{if(i%2===0)c.until=prefix+'-boss-cleared';});add('merchants',{...placed(1,prefix+'-refugee-merchant',133,339),npc:'ow-npc-rift-7',name:'难民补给商',resource:'ow-npc-rift-7',service:'forge',when:prefix+'-boss-cleared'});}
 const requiredCamp=plan.sites.find(p=>p.key==='camp-edge');if(requiredCamp){const camp=fresh.camps.filter(c=>c.zone===prefix+'-z'+requiredCamp.zone).sort((a,b)=>Math.hypot(a.x-requiredCamp.x,a.y-requiredCamp.y)-Math.hypot(b.x-requiredCamp.x,b.y-requiredCamp.y))[0];const clue=fresh.landmarks.find(l=>l.key==='camp-edge');clue.x=camp.x;clue.y=camp.y;}
}
const mappings={'分区':'zones','营地':'camps','巡逻':'patrols','稀有':'rares','传送点':'waypoints','入口':'dungeonEntrances','事件':'events','宝箱':'chests','地标':'landmarks','门':'gates','岛屿':'islands','道路':'roads','前哨':'outposts','物件':'objects','商人':'merchants'};
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/世界.xlsx'));
for(const [name,fields]of [['地标',[['key','string','地图地标ID']]],['门',[['openedProp','string','开启资源'],['openWhen','string','自动开门条件']]],['传送点',[['unlockWhen','string','自动解锁条件']]]]){
 const sh=wb.worksheets.getItem(name),existing=sh.getUsedRange().values[1].filter(Boolean);
 for(const [key,type,label]of fields)if(!existing.includes(key)){const col=existing.length;sh.getRangeByIndexes(0,col,3,1).values=[[label],[key],[type]];existing.push(key);}
}
for(const [name,key]of Object.entries(mappings)){
 const sh=wb.worksheets.getItem(name),used=sh.getUsedRange().values,fields=used[1].filter(x=>x!==null&&x!==''),types=used[2];
 const old=source[key].filter(r=>r.region!==region&&r.map!==region&&r.region!==previous&&r.map!==previous),rows=[...old,...fresh[key]].map(r=>({...r}));
 if(index===5){const formalRegions=new Set([...source.islands.filter(i=>i.region!==region).map(i=>i.region),region]);if(key==='camps'){for(const camp of rows)if(camp.until==='ow-global-war-over')delete camp.until;for(const map of formalRegions){const candidates=rows.filter(c=>c.region===map&&!c.until).sort((a,b)=>a.id.localeCompare(b.id));for(const camp of candidates.slice(0,Math.floor(candidates.length*3/10)))camp.until='ow-global-war-over';}}if(key==='waypoints')for(const waypoint of rows)if(formalRegions.has(waypoint.region))waypoint.unlockWhen='ow-global-war-over';}
 const cells=rows.map(r=>fields.map((f,i)=>r[f]===undefined?null:types[i]==='json'?JSON.stringify(r[f]):r[f]));
 const height=Math.max(used.length-3,cells.length);if(height)sh.getRangeByIndexes(3,0,height,fields.length).values=Array.from({length:height},(_,i)=>cells[i]??Array(fields.length).fill(null));
}
await fs.mkdir(root+'/docs/reviews/open-world-m2-m4/W'+(index+4),{recursive:true});
const exported=await SpreadsheetFile.exportXlsx(wb);await exported.save(root+'/config/excel/世界.xlsx');
await fs.writeFile(root+'/docs/reviews/open-world-m2-m4/W'+(index+4)+'/world-authoring.json',JSON.stringify({island,region,source:'docs/open-world-content-plan.md §1–§2; numeric-refresh/camp-health-targets.json',counts:Object.fromEntries(Object.entries(fresh).map(([k,v])=>[k,v.length])),phaseAndTasksPending:true},null,2));
console.log(JSON.stringify({island,region,counts:Object.fromEntries(Object.entries(fresh).map(([k,v])=>[k,v.length]))}));
