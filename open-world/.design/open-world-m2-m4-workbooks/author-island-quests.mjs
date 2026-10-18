import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
import {storyPlans} from './island-story-plans.mjs';
const root='G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world';
const n=Number(process.argv[2]),island=['wind','mist','forge','frost','rift','dragon'][n-1],plan=storyPlans[island];if(!plan)throw Error('Chapters 2–6 required');
const chapter='ss-c0'+n,map='ss-map-'+island,prefix='ow-'+island,out=root+'/docs/reviews/open-world-m2-m4/W'+(n+3),read=async f=>JSON.parse(await fs.readFile(root+'/config/json/'+f+'.json','utf8'));
const tasks=await read('tasks'),npcs=await read('npcs'),dialogue=await read('dialogue'),world=JSON.parse(await fs.readFile(root+'/.runtime/world-w'+(n+3)+'-world-draft.json','utf8'));
await fs.mkdir(out+'/source-before',{recursive:true});for(const f of ['tasks','npcs','dialogue','world'])try{await fs.writeFile(out+'/source-before/'+f+'.json',await fs.readFile(root+'/config/json/'+f+'.json'),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
const before=JSON.parse(await fs.readFile(out+'/source-before/tasks.json','utf8')),original=before.tasks.filter(t=>t.chapter===chapter&&t.id.startsWith(chapter+'-t')),total=original.reduce((v,t)=>v+(t.reward_xp??0),0),id=suffix=>chapter+'-'+suffix;
const storyOrder={2:['n01','t01','t02','t03','n02','t04','n03','t05','t06'],3:['n01','t01','t02','t03','n02','t04','t05','t06'],4:['n01','t01','t02','n02','t03','t04','t05','t06'],5:['t01','n01','t02','n02','t03','t04','t05','t06'],6:['n01','t01','t02','t03','t04','n02','t05','t06']}[n];
const authored=value=>value?.startsWith(prefix+'-')||value?.startsWith(chapter+'-n');
tasks.tasks=tasks.tasks.filter(t=>!authored(t.id));tasks.steps=tasks.steps.filter(t=>!authored(t.task));tasks.conditions=tasks.conditions.filter(c=>!authored(c.target)&&!original.some(t=>t.id===c.target));tasks.rumors=tasks.rumors.filter(r=>!authored(r.id));
npcs.npcs=npcs.npcs.filter(n=>!n.id.startsWith('ow-npc-'+island+'-'));npcs.positions=npcs.positions.filter(p=>!p.id.startsWith(prefix+'-'));
dialogue.lines=dialogue.lines.filter(l=>!authored(l.group));dialogue.triggers=dialogue.triggers.filter(t=>!authored(t.id));
const cond=(target,group,kind,value,path='fallback')=>tasks.conditions.push({target,group,kind,value:String(value),path});
const line=(group,seq,speaker,text,when)=>dialogue.lines.push({group,seq,speaker,text,...when?{when}:{}});
const row=suffix=>tasks.tasks.find(t=>t.id===id(suffix)),site=key=>world.landmarks.find(l=>l.region===map&&(l.key??l.id)===key),zone=key=>site(key)?.zone;
const step=(task,seq,op,key,label,extra={})=>({task,seq,op,map,landmark:key,zone:zone(key),key:op==='talk'?'npc:'+extra.npc:op==='gate'?'gate-'+island:'object:'+task+':'+seq,label,world_fact:['interact','clear_camp','reach_waypoint','gate','clear_dungeon','open_chest','complete_event'].includes(op),...extra});
const hardTotal=original.reduce((v,t)=>v+(t.reward_xp_hardmode??t.reward_xp??0),0);let remainder=total,hardRemainder=hardTotal;for(const old of original){const t=row(old.id.slice(chapter.length+1));t.reward_xp=Math.round((old.reward_xp??0)*.85);t.reward_xp_hardmode=Math.round((old.reward_xp_hardmode??old.reward_xp??0)*.85);remainder-=t.reward_xp;hardRemainder-=t.reward_xp_hardmode;t.zone=prefix+'-z'+plan.taskZones[t.id.slice(chapter.length+1)];delete t.pre;cond(t.id,1,'island',map);}
for(const t of tasks.tasks.filter(t=>t.chapter===chapter))t.order=storyOrder.indexOf(t.id.slice(chapter.length+1))+1;
for(const [i,branch]of plan.threads.entries())for(const [j,suffix]of branch.entries()){const t=row(suffix);if(!t)continue;t.thread=['A','B','C'][i];t.key_thread=(n===2&&i===1)||(n===4&&i===2)||((n===5||n===6)&&i===0);if(j){t.pre=id(branch[j-1]);t.accept_mode='none';cond(t.id,1,'task',t.pre,'guide');}}
for(const [i,entry]of plan.newTasks.entries()){
 const xp=Math.floor(remainder/plan.newTasks.length)+(i===plan.newTasks.length-1?remainder%plan.newTasks.length:0),t={id:id(entry.suffix),campaign:'starsea',chapter,order:storyOrder.indexOf(entry.suffix)+1,type:'side',title:entry.title,goal:entry.title+'，把消息记入航图。',series:'isle-'+n,thread:entry.thread,accept_mode:entry.mode,discover_landmark:entry.site,accept_npc:entry.npc,accept_map:map,accept_landmark:entry.site,giver:entry.npc,zone:zone(entry.site),abandonable:true,journal:true,reward_xp:xp,reward_gold:30,dialog_accept:id(entry.suffix)+':accept',dialog_complete:id(entry.suffix)+':complete',tags:['岛屿故事'],...(entry.pre?{pre:id(entry.pre)}:{})};
 t.reward_xp_hardmode=Math.floor(hardRemainder/plan.newTasks.length)+(i===plan.newTasks.length-1?hardRemainder%plan.newTasks.length:0);tasks.tasks.push(t);cond(t.id,1,'island',map);if(t.pre){cond(t.id,1,'task',t.pre,'guide');if(t.thread==='arrive')delete t.pre;}
 for(const [j,[op,key,z]]of entry.ops.entries()){
  const extra=op==='talk'?{npc:entry.npc}:op==='gate'?{gate:'gate-'+island}:op==='reach_waypoint'?{key:prefix+'-wp'+z}:{};
  if(op==='clear_camp'){const p=site(key),camp=world.camps.filter(c=>c.zone===prefix+'-z'+z).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!camp||Math.hypot(camp.x-p.x,camp.y-p.y)>12)throw Error('No nearby story camp '+key);extra.camp=camp.id;extra.key=camp.id;}
  tasks.steps.push(step(t.id,j+1,op,key,op==='gate'?'确认世界机关已打开':entry.title,extra));
 }
 line(t.dialog_accept,1,entry.npc,entry.thread==='arrive'?`先认清${world.islands.find(i=>i.region===map).name}的航标。这些地方各有消息，走哪条路都由你决定。`:`${entry.title}就在这里。你已经做过的事，我会照实记下。`);line(t.dialog_complete,1,entry.npc,entry.thread==='converge'?'线索已经汇在一起，门后的强敌由你决定何时挑战。':'这一段消息收到了。我们继续沿着航图走。');
}
// Real convergence groups preserve each chapter's mandatory revelation.
tasks.conditions=tasks.conditions.filter(c=>c.target!==id(plan.convergence));plan.groups.forEach((g,i)=>g.forEach(t=>cond(id(plan.convergence),i+1,'task',id(t),'guide')));
for(const [suffix,pre]of Object.entries(plan.chain??{})){row(suffix).pre=id(pre);cond(id(suffix),1,'task',id(pre),'guide');row(suffix).accept_mode='none';}
delete row('t06').pre;cond(id('t06'),1,'task',id('t05'),'guide');
for(const branch of plan.threads){const first=row(branch[0]);if(first?.accept_mode==='none')first.accept_mode=first.thread==='A'&&n===6?'talk':'discover';}
const retargeted=[];
for(const old of original){const t=row(old.id.slice(chapter.length+1)),suffix=t.id.slice(chapter.length+1),rows=tasks.steps.filter(s=>s.task===t.id),split=plan.splits[suffix];
 if(split){let point=0;for(const s of rows){s.landmark=split[Math.min(point,split.length-1)];s.point_count=1;s.point_index=0;if(s.op==='interact'||(n===6&&s.op==='battle'))point++;}}
 for(const s of rows){s.zone=t.zone;if(s.map===map){if(s.op==='choose')s.landmark='route-fork';else if(s.op==='route_battle')s.landmark='route-a';s.zone=zone(s.landmark)??t.zone;}if(s.op==='boss'){s.landmark=undefined;s.zone=t.zone;}
  if((n===3||n===6)&&suffix==='t04'&&s.op==='battle'){s.op='defend';s.defense='engine';}
  if(s.op==='battle'&&!(n===2&&suffix==='t03')&&!(n===3&&suffix==='t04')&&!(n===6&&suffix==='t04')){const at=site(s.landmark),camp=at&&world.camps.filter(c=>c.region===map&&c.zone===s.zone).sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y))[0];if(camp&&Math.hypot(camp.x-at.x,camp.y-at.y)<=12){s.op='clear_camp';s.camp=camp.id;s.key=camp.id;s.world_fact=true;delete s.enemies;delete s.count;retargeted.push({task:s.task,seq:s.seq,camp:camp.id,status:'待用户试玩确认'});}}
 }
 if(rows[0]?.map===map){t.discover_landmark=rows[0].op==='choose'?'route-fork':rows[0].landmark;t.accept_landmark=t.discover_landmark;t.accept_map=map;}
}
if(n===5){row('t01').accept_mode='arrive';row('t01').discover_landmark='landing';}
const residents=plan.locals,shorts=residents.map(s=>s.includes('·')?s.split('·')[1]:s),centres=[{x:125,y:185},{x:125,y:335},{x:256,y:350},{x:385,y:325},{x:385,y:185},{x:256,y:155}],zones=world.zones.filter(z=>z.region===map);
const budget={regional:Math.round(total*5/22),explore:Math.round(total/22),dungeon:Math.round(total/22)},distribute=(sum,i,count)=>Math.floor(sum/count)+(i===count-1?sum%count:0);
for(const [i,c]of centres.entries()){
 const z=i+1,npc='ow-npc-'+island+'-'+z,key=prefix+'-resident'+z,target=prefix+'-resident-visible'+z;
 cond(target,1,'zone',zones[i].id);cond(target,1,'level',Math.max(1,zones[i].levelBand[0]-2));
 npcs.npcs.push({id:npc,campaign:'starsea',name:residents[i],short:shorts[i],role:plan.themes[i]+'的区域人物',voice:'生活在本分区，讲眼前的事。',home_map:map,x:c.x+4,y:c.y+4,initial:false,idle:prefix+'-idle'+z});npcs.positions.push({id:prefix+'-resident-position'+z,npc,map,landmark:key,x:c.x+4,y:c.y+4,when:target});line(prefix+'-idle'+z,1,npc,plan.themes[i]+'这件事还记在这里。要是顺路，替我看看。');
 for(let variant=0;variant<2;variant++){
  const task=prefix+'-side-z'+z+'-'+(variant+1),title=variant===0?plan.themes[i]:'核对'+zones[i].name+'的记录',t={id:task,campaign:'starsea',chapter,order:100+z*2+variant,type:'side',title,goal:title+'，回来告诉'+shorts[i]+'。',giver:npc,accept_mode:'talk',accept_npc:npc,accept_map:map,accept_landmark:key,series:prefix+'-regional',zone:zones[i].id,abandonable:true,journal:true,dialog_accept:task+':accept',dialog_complete:task+':complete',reward_xp:distribute(budget.regional,i*2+variant,centres.length*2),reward_gold:20+z*5,tags:['区域支线'],region:map,area:zones[i].name,place:residents[i]};tasks.tasks.push(t);cond(task,1,'zone',t.zone);cond(task,1,'level',Math.max(1,zones[i].levelBand[0]-2));line(t.dialog_accept,1,npc,'顺路帮我'+title+'。这里的事不用等岛屿故事结束。');line(t.dialog_complete,1,npc,shorts[i]+'收好了你带回的消息，这片地方又能继续过日子。');
  if(variant===0){const camp=world.camps.filter(c=>c.zone===t.zone).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];tasks.steps.push(step(task,1,'clear_camp',prefix+'-camp-clue'+z,'清空附近营地',{camp:camp.id,key:camp.id}),step(task,2,'interact',prefix+'-side-clue'+z,title,{prop:'ss-prop-cargo'}));}else tasks.steps.push(step(task,1,'interact',prefix+'-side-clue'+z,title,{prop:'ss-prop-sign'}));
 }
 const explore=prefix+'-explore-z'+z;tasks.tasks.push({id:explore,campaign:'starsea',chapter,order:200+z,type:'side',title:'探索'+zones[i].name,goal:'认清航标，找到宝箱，完成本地事件。',accept_mode:'arrive',discover_landmark:key,zone:zones[i].id,series:prefix+'-exploration',dialog_accept:explore+':accept',dialog_complete:explore+':complete',reward_xp:distribute(budget.explore,i,centres.length),reward_gold:15,journal:true,abandonable:true,tags:['探索']});cond(explore,1,'zone',zones[i].id);line(explore+':accept',1,'player','先认清这里的航标、补给与事件。');line(explore+':complete',1,'player','这一片已经记在航图上。');
 tasks.steps.push(step(explore,1,'reach_waypoint',key,'激活航标',{key:prefix+'-wp'+z}),step(explore,2,'open_chest',prefix+'-chest-landmark'+z,'找到宝箱',{key:prefix+'-chest'+z}),step(explore,3,'complete_event',prefix+'-event-landmark'+z,'完成本地事件',{key:prefix+'-event'+z}));
 for(let b=1;b<=3;b++)tasks.tasks.push({id:prefix+'-bounty-z'+z+'-'+b,campaign:'starsea',order:b,type:'bounty',title:['清理侵扰','剿除精英','守住道路'][b-1],goal:['击退8只本区怪物','击退1只本区精英','击退15只本区怪物'][b-1],accept_mode:'board',zone:zones[i].id,series:prefix+'-bounty',pool:prefix+'-pool-z'+z,repeat_cooldown_seconds:600,cond_kind:'kills',cond_count:[8,1,15][b-1],elite:b===2,reward_gold:20*b});
}
for(const [i,entry]of world.dungeonEntrances.filter(d=>d.region===map).entries()){
 const z=i*2+1,task=prefix+'-dungeon-guide'+(i+1),npc='ow-npc-'+island+'-'+z,key=prefix+'-entry-landmark'+(i+1);tasks.tasks.push({id:task,campaign:'starsea',chapter,order:300+i,type:'side',title:'通往'+entry.dungeon+'的旧路',goal:'找到入口，完成首次通关。',giver:npc,accept_mode:'talk',accept_npc:npc,accept_map:map,accept_landmark:prefix+'-resident'+z,series:prefix+'-dungeon',zone:entry.zone,journal:true,abandonable:true,dialog_accept:task+':accept',dialog_complete:task+':complete',reward_xp:distribute(budget.dungeon,i,world.dungeonEntrances.filter(d=>d.region===map).length),reward_gold:30,tags:['地城引路']});cond(task,1,'zone',entry.zone);line(task+':accept',1,npc,'航标旁的路通向地城，备好装备再往深处走。');line(task+':complete',1,npc,'那条路已经走通，缺材料时知道往哪里去。');tasks.steps.push(step(task,1,'interact',key,'查看地城入口',{prop:'ss-prop-sign'}),step(task,2,'clear_dungeon',key,'首次通关地城',{key:entry.dungeon}));
}
if(n===5){const npc='ow-npc-rift-7',target=prefix+'-boss-cleared';npcs.npcs.push({id:npc,campaign:'starsea',name:'难民补给商·阿弦',short:'阿弦',role:'替难民整备远行补给',voice:'经历过封锁，先顾眼前的人。',home_map:map,x:133,y:339,initial:false,idle:prefix+'-merchant-idle',service_label:'补给整备',service_feature:'forge',service_panel:'character'});npcs.positions.push({id:prefix+'-merchant-position',npc,map,x:133,y:339,when:target});line(prefix+'-merchant-idle',1,npc,'炮台停下来了，补给终于能送进营地。要继续远行，先把装备整备好。');}
cond(prefix+'-boss-cleared',1,'boss','ss-map-boss-'+n);cond(prefix+'-gate-opened',1,'gate','gate-'+island);cond(prefix+'-war-over',1,'boss','all-6');
if(n===6){tasks.conditions=tasks.conditions.filter(c=>c.target!=='ow-global-war-over');cond('ow-global-war-over',1,'boss','all-6');}
const joins=n===2?[['ss-npc-qingmang','n02',17],['ss-npc-mijia','t06',17]]:n===4?[['ss-npc-xuemi','n01',29],['ss-npc-jinyu','n02',30]]:[];
for(const [npc,suffix,fallbackLevel]of joins){const target='npc:'+npc;tasks.conditions=tasks.conditions.filter(c=>c.target!==target);cond(target,1,'task',id(suffix),'guide');cond(target,2,'level',fallbackLevel);const entry=npcs.npcs.find(r=>r.id===npc);entry.dialog_join_fallback=prefix+'-join-fallback-'+npc;entry.join_guide_condition=prefix+'-join-guided-'+npc;cond(entry.join_guide_condition,1,'task',id(suffix),'guide');line(entry.dialog_join_fallback,1,npc,'你已经独自走过不少地方。港口给远行的人留着位置，先看看我能帮什么忙。');}
const arrival=id(plan.newTasks.find(t=>t.thread==='arrive').suffix);
for(const [i,branch]of plan.threads.entries()){const t=row(branch[0]),key=t.discover_landmark??t.accept_landmark;tasks.rumors.push({id:prefix+'-rumor'+(i+1),island:map,zone:t.zone,landmark:key,text:plan.themes[Math.min(i+1,plan.themes.length-1)]+'附近传来一条新消息。',source:'task',source_id:arrival});}
// Each speaker gets one priority chain across all authored islands. The until
// condition is the disjunction of every later active appearance for that NPC.
for(const t of tasks.tasks.filter(t=>t.chapter===chapter&&(t.series==='isle-'+n)&&t.giver&&t.thread!=='return')){
 const key=t.accept_landmark??t.discover_landmark??(t.thread==='converge'?'gate':undefined),at=key&&site(key);if(!at)continue;const target=prefix+'-npc-active-'+t.id;cond(target,1,'task_active',t.id);npcs.positions.push({id:prefix+'-npc-position-'+t.id,npc:t.giver,map,landmark:key,x:at.x+1,y:at.y,when:target});
 if(t.accept_mode==='talk'&&!t.pre){const ready=prefix+'-npc-ready-'+t.id;cond(ready,1,'island',map);cond(ready,1,'zone',at.zone);cond(ready,1,'task_ready',t.id);npcs.positions.push({id:prefix+'-npc-discovery-'+t.id,npc:t.giver,map,landmark:key,x:at.x+1,y:at.y,when:ready});}
}
const fieldPosition=p=>p.id.startsWith('ow-')&&p.map!=='ss-map-port'&&tasks.conditions.some(c=>c.target===p.when&&['task_active','task_ready'].includes(c.kind));
function unionPositionConditions(target,positions){tasks.conditions=tasks.conditions.filter(c=>c.target!==target);let group=0;for(const p of positions){const clauses=tasks.conditions.filter(c=>c.target===p.when);for(const id of new Set(clauses.map(c=>c.group))){group++;for(const c of clauses.filter(c=>c.group===id))cond(target,group,c.kind,c.value,c.path);}}}
for(const npc of new Set(npcs.positions.filter(fieldPosition).map(p=>p.npc))){
 const positions=npcs.positions.filter(p=>p.npc===npc&&fieldPosition(p)).sort((a,b)=>Number(!a.id.includes('-npc-discovery-'))-Number(!b.id.includes('-npc-discovery-')));
 for(const [i,p]of positions.entries()){const until=p.id+'-later';unionPositionConditions(until,positions.slice(i+1));if(i<positions.length-1)p.until=until;else delete p.until;}
 const active='ow-global-field-'+npc;unionPositionConditions(active,positions);
 if(!npcs.positions.some(p=>p.npc===npc&&p.map==='ss-map-port')){const source=npcs.npcs.find(p=>p.id===npc);npcs.positions.push({id:'ow-global-port-position-'+npc,npc,map:'ss-map-port',x:source.x,y:source.y,when:'npc:'+npc,until:active});}
 for(const p of npcs.positions.filter(p=>p.npc===npc&&p.map==='ss-map-port'))p.until=active;
}
const introductions={'ss-npc-tongling':1,'ss-npc-qingmang':2,'ss-npc-xuemi':4,'ss-npc-jinyu':4,'ss-npc-mijia':2};
for(const t of tasks.tasks.filter(t=>t.chapter===chapter&&introductions[t.giver]<n)){
 const fallback=tasks.conditions.find(c=>c.target==='npc:'+t.giver&&c.kind==='level'),opening=[1,6,13,19,25,30][n-1];if(fallback)fallback.value=String(Math.min(Number(fallback.value),opening));for(const group of new Set(tasks.conditions.filter(c=>c.target===t.id).map(c=>c.group)))cond(t.id,group,'npc_met',t.giver);
}
const speaker=npcs.npcs.find(p=>p.id===plan.npc);if(speaker&&plan.npc!=='ss-npc-milo'&&!speaker.dialog_join_fallback){speaker.dialog_join_fallback=prefix+'-join-fallback';speaker.join_guide_condition=prefix+'-join-guided';cond(speaker.join_guide_condition,1,'task',arrival,'guide');line(speaker.dialog_join_fallback,1,plan.npc,'你已经独自走过不少地方。港口给远行的人留着位置，先看看我能帮什么忙。');}
for(const [i,branch]of plan.threads.entries()){const last=id(branch.at(-1)),target=prefix+'-knows-'+['A','B','C'][i];cond(target,1,'task',last);const own=row(branch[0]);own.dialog_progress=prefix+'-clue-progress-'+['A','B','C'][i];line(own.dialog_progress,1,own.giver,'这条线索还有消息没有取齐。航图上的问号会指向具体地点，顺序由你决定。');line(own.dialog_accept,89,'player','航图上的问号就在这里，先查看留下的线索。');for(const other of plan.threads.filter(b=>b!==branch)){const first=row(other[0]);line(first.dialog_accept,90+i,first.giver,'你已带回另一条线索，这里的消息能与它对照。',target);}}
const converge=row(plan.convergence);converge.dialog_progress=prefix+'-missing-clue';line(converge.dialog_progress,1,plan.npc,'关键消息已经汇齐。其余问号还可以回头调查，首领也可以先挑战。');
line(converge.dialog_accept,95,plan.npc,'这是世界机关。调查并击退守门敌人，就能永久打开，开过的门不用重来。');
line(row('t06').dialog_accept,95,plan.npc,'从前一座岛带来的见闻，可以与这里的消息一起听；没听过也不会挡住这条路。');
for(const parameter of tasks.parameters)if(parameter.id==='legacy_layout')parameter.value=parameter.value.filter(v=>v!=='isle-'+n);
const encode=(v,t)=>v==null?null:t==='json'?JSON.stringify(v):t==='list'?v.join('|'):v;
async function save(name,data,mapping){const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/'+name+'.xlsx'));for(const [sheet,key]of Object.entries(mapping)){const sh=wb.worksheets.getItem(sheet),used=sh.getUsedRange().values,fields=used[1].filter(Boolean),types=used[2],rows=data[key].map(r=>fields.map((f,i)=>encode(r[f],types[i]))),height=Math.max(used.length-3,rows.length);sh.getRangeByIndexes(3,0,height,fields.length).values=Array.from({length:height},(_,i)=>rows[i]??fields.map(()=>null));}if(name==='任务'){const sh=wb.worksheets.getItem('说明'),used=sh.getUsedRange().values,index=used.findIndex(r=>r[0]==='#quest-parameters');sh.getRangeByIndexes(index+4,0,tasks.parameters.length,2).values=tasks.parameters.map(p=>[p.id,JSON.stringify(p.value)]);}await(await SpreadsheetFile.exportXlsx(wb)).save(root+'/config/excel/'+name+'.xlsx');}
await save('任务',tasks,{'任务':'tasks','步骤':'steps','条件':'conditions','传闻':'rumors'});await save('NPC',npcs,{'NPC':'npcs','站位':'positions'});await save('对话',dialogue,{'对话':'lines','触发':'triggers'});
await fs.writeFile(out+'/quest-authoring.json',JSON.stringify({chapter,island,storyXpBefore:total,storyXpAfter:tasks.tasks.filter(t=>t.chapter===chapter&&t.series==='isle-'+n).reduce((v,t)=>v+(t.reward_xp??0),0),battleToClearCamp:retargeted,dialogueStatus:'草稿，最终体验由用户试玩'},null,2));console.log(JSON.stringify({chapter,books:3,storyXp:total}));
