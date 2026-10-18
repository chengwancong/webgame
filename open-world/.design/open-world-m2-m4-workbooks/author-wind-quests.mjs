import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const root='G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world',out=root+'/docs/reviews/open-world-m2-m4/W4',chapter='ss-c01',map='ss-map-wind',prefix='ow-wind';
await fs.mkdir(out+'/source-before',{recursive:true});
for(const file of ['tasks','npcs','dialogue','world']){const data=await fs.readFile(root+'/config/json/'+file+'.json');try{await fs.writeFile(out+'/source-before/'+file+'.json',data,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}
const read=async file=>JSON.parse(await fs.readFile(root+'/config/json/'+file+'.json','utf8')),tasks=await read('tasks'),npcs=await read('npcs'),dialogue=await read('dialogue'),world=JSON.parse(await fs.readFile(root+'/.runtime/world-w4-world-draft.json','utf8'));
const original=JSON.parse(await fs.readFile(out+'/source-before/tasks.json','utf8')),old=original.tasks.filter(t=>t.chapter===chapter&&t.id.startsWith(chapter+'-t')),total=old.reduce((n,t)=>n+t.reward_xp,0);
const isNew=id=>id?.startsWith(prefix+'-')||id===chapter+'-n01'||id===chapter+'-n02';
tasks.tasks=tasks.tasks.filter(t=>!isNew(t.id));tasks.steps=tasks.steps.filter(s=>!isNew(s.task));tasks.conditions=tasks.conditions.filter(c=>!isNew(c.target)&&!old.some(t=>t.id===c.target));tasks.rumors=tasks.rumors.filter(r=>!r.id.startsWith(prefix+'-'));
dialogue.lines=dialogue.lines.filter(l=>!l.group.startsWith(prefix+'-')&&!l.group.startsWith(chapter+'-n')&&!l.when?.startsWith(prefix+'-'));dialogue.triggers=dialogue.triggers.filter(t=>!t.id.startsWith(prefix+'-'));
npcs.npcs=npcs.npcs.filter(n=>!n.id.startsWith('ow-npc-wind-'));npcs.positions=npcs.positions.filter(n=>!n.id.startsWith(prefix+'-'));
const condition=(target,group,kind,value,path='fallback')=>tasks.conditions.push({target,group,kind,value:String(value),path});
const line=(group,seq,speaker,text,when)=>dialogue.lines.push({group,seq,speaker,text,...(when?{when}:{})});
const step=(task,seq,op,landmark,zone,key,label,extra={})=>({task,seq,op,map,landmark,zone:prefix+'-z'+zone,key,label,world_fact:['interact','clear_camp','reach_waypoint','open_chest','complete_event','clear_dungeon'].includes(op),...extra});
const oldTask=id=>tasks.tasks.find(t=>t.id===id),oldId=n=>chapter+'-t0'+n;
let remaining=total;for(const row of old){const task=oldTask(row.id);task.reward_xp=Math.round(row.reward_xp*.85);remaining-=task.reward_xp;task.zone=prefix+'-z'+({1:1,2:2,3:2,4:5,5:6,6:6})[Number(row.id.slice(-2))];task.order=({1:1,2:3,3:4,4:6,5:7,6:8})[Number(row.id.slice(-2))];condition(task.id,1,'island',map);}
oldTask(oldId(2)).pre=chapter+'-n01';oldTask(oldId(4)).discover_landmark='route-fork';oldTask(oldId(5)).accept_mode='none';oldTask(oldId(5)).discover_landmark='boss-entry';
for(const row of tasks.steps.filter(s=>old.some(t=>t.id===s.task))){if(row.map===map)row.zone=oldTask(row.task).zone;else if(row.map==='ss-map-port')row.zone=oldTask(row.task).zone;}
for(const r of tasks.steps.filter(s=>s.task===oldId(4)))r.landmark=r.op==='choose'?'route-fork':'route-a';
// Convergence is A AND B. The gate is a separate world fact, never a quest lock.
tasks.conditions=tasks.conditions.filter(c=>c.target!==oldId(5));condition(oldId(5),1,'task',chapter+'-n02','guide');condition(oldId(5),1,'task',oldId(4),'guide');
condition(oldId(4),1,'zone',prefix+'-z5');condition(oldId(6),1,'task',oldId(5),'guide');
const newTasks=[
 {id:chapter+'-n01',order:2,type:'guide',title:'跟上米洛',goal:'跟着米洛到船台湾，触碰航标并听他介绍前哨。',series:'onboarding',pre:oldId(1),accept_mode:'none',auto_track:true,abandonable:false,zone:prefix+'-z2',giver:'ss-npc-milo',reward_xp:Math.ceil(remaining/2),reward_gold:20,discover_landmark:'outpost'},
 {id:chapter+'-n02',order:5,type:'side',title:'码头的求救信号',goal:'调查旧码头的信号浮标，清空附近拾荒者营地。',series:'isle-1',thread:'A',accept_mode:'discover',auto_track:false,abandonable:true,zone:prefix+'-z4',giver:'ss-npc-milo',reward_xp:Math.floor(remaining/2),reward_gold:35,discover_landmark:'clue'},
];
for(const t of newTasks){t.campaign='starsea';t.chapter=chapter;t.dialog_accept=t.id+':accept';t.dialog_complete=t.id+':complete';t.journal=true;t.tags=['岛屿故事'];tasks.tasks.push(t);condition(t.id,1,'island',map);}
condition(newTasks[1].id,1,'zone',prefix+'-z4');
tasks.steps.push(step(newTasks[0].id,1,'reach_waypoint','outpost',2,prefix+'-wp2','触碰船台湾航标'),step(newTasks[0].id,2,'talk','outpost',2,'npc:ss-npc-milo','听米洛介绍前哨',{npc:'ss-npc-milo'}),step(newTasks[1].id,1,'interact','clue',4,'object:signal','检查求救信号浮标',{prop:'ss-prop-sign'}));
// Select the authored camp closest to the signal. World authoring places one
// thematic camp within twelve cells; this binds to its durable clear fact.
const draftWorld=world,signal={x:365,y:338};
const camp=draftWorld.camps.filter(c=>c.region==='ss-field-wind'||c.region===map).filter(c=>c.zone===prefix+'-z4').sort((a,b)=>Math.hypot(a.x-signal.x,a.y-signal.y)-Math.hypot(b.x-signal.x,b.y-signal.y))[0];
if(!camp||Math.hypot(camp.x-signal.x,camp.y-signal.y)>12)throw Error('Signal must bind to an authored nearby camp, without a replacement wave');
tasks.steps.push(step(newTasks[1].id,2,'clear_camp','clue',4,camp.id,'清空信号旁的拾荒者营地',{camp:camp.id}));
line(newTasks[0].dialog_accept,1,'ss-npc-milo','船台湾就在坡下。跟我走，先认清航标；以后远行，才知道从哪里回来。');line(newTasks[0].dialog_complete,1,'ss-npc-milo','航标记住你了。前哨能补给，也能送你回拾星港。岛上还有三件值得留意的事：旧船台、旧码头的求救信号、岸线崖的进港路。');
line(newTasks[1].dialog_accept,1,'ss-npc-milo','这是旧码头的求救频率。浮标还在响，附近的拾荒者却不让人靠近。');line(newTasks[1].dialog_complete,1,'ss-npc-milo','信号不是侵军发的。有人在船坞里求救，航钥也认出了这条频率。');
condition(prefix+'-knows-route',1,'task',oldId(4));condition(prefix+'-knows-signal',1,'task',newTasks[1].id);
line(newTasks[1].dialog_accept,2,'ss-npc-milo','你已找到进港路线。这条信号会告诉我们，为什么还要进去。',prefix+'-knows-route');line(oldTask(oldId(4)).dialog_accept,90,'ss-npc-milo','码头的求救频率来自船坞。选好一条路，我们去看看里面的人。',prefix+'-knows-signal');
newTasks[1].dialog_progress=prefix+'-missing-signal';oldTask(oldId(4)).dialog_progress=prefix+'-missing-route';
line(newTasks[1].dialog_progress,1,'ss-npc-milo','进港路线已经认清，还差码头的求救信号。查看浮标，再清空附近营地。',prefix+'-knows-route');
line(oldTask(oldId(4)).dialog_progress,1,'ss-npc-milo','求救频率已经找到了，还差一条进港路。两条路线任选一条，顺序由你决定。',prefix+'-knows-signal');
line(newTasks[1].dialog_accept,3,'player','浮标一直留在这里。先调查问号，再看附近的营地。');
line(oldTask(oldId(5)).dialog_accept,91,'ss-npc-milo','船坞闸门是世界机关。调查闸门并击退守门敌人，就会永久打开。已经开过的门不用重来。');
for(const [i,z,key,text]of [[1,2,'objective','船台湾的旧引擎有人正在抢修。'],[2,4,'clue','旧码头还在重复一条求救频率。'],[3,5,'route-fork','岸线崖与仓库都通向船坞要塞。']])tasks.rumors.push({id:prefix+'-rumor'+i,island:map,zone:prefix+'-z'+z,landmark:key,text,source:'task',source_id:newTasks[0].id});
condition(prefix+'-boss-cleared',1,'boss','ss-map-boss-1');condition(prefix+'-gate-opened',1,'gate','gate-wind');condition(prefix+'-war-over',1,'boss','all-6');
condition(prefix+'-ship-active',1,'task',oldId(2));condition(prefix+'-ship-finished',1,'task',oldId(3));
// Local residents publish twelve regional stories independent of island story.
const locals=['牧羊少年·小穗','船匠·老戈','磨坊主·芦婶','拾荒者·阿灰','灯塔看守·衡','暮界逃兵·莱恩'],titles=['找回羊群的铃铛','抢修小艇','被偷走的风向布','被逼入伙的拾荒者','重新点亮岸线灯塔','没有寄出的家书'],shorts=['小穗','老戈','芦婶','阿灰','衡','莱恩'];
const lower=[1,2,3,4,5,7],centres=[{x:125,y:185},{x:125,y:335},{x:256,y:350},{x:385,y:325},{x:385,y:185},{x:256,y:155}];
const taskBudget=Math.round(total*5/22),exploreBudget=Math.round(total/22),leadBudget=Math.round(total/22),regional=[];
for(let z=1;z<=6;z++){
 const npc='ow-npc-wind-'+z,c=centres[z-1],loc=prefix+'-resident'+z,target=prefix+'-zone'+z+'-discovered';condition(target,1,'zone',prefix+'-z'+z);condition(target,1,'level',Math.max(1,lower[z-1]-2));
 npcs.npcs.push({id:npc,campaign:'starsea',name:locals[z-1],short:shorts[z-1],role:titles[z-1]+'的区域人物',voice:'生活在本分区，讲眼前的事。',home_map:map,x:c.x+4,y:c.y+4,initial:false,idle:prefix+'-idle'+z});
 npcs.positions.push({id:prefix+'-resident-position'+z,npc,map,landmark:loc,x:c.x+4,y:c.y+4,when:target});
 line(prefix+'-idle'+z,1,npc,['我的羊听见铃声才肯回坡上。','船还没修好，人得先撑住。','风向布不见了，磨坊也停了。','那些人不全是自愿跟着星钩头目的。','灯塔亮着，海上的人才知道岸在哪里。','这封家书，比我的武器还沉。'][z-1]);
 for(let variant=1;variant<=2;variant++){
  const id=prefix+'-side-z'+z+'-'+variant,title=variant===1?titles[z-1]:['查清草坡足迹','找回修船工具','收集风车记录','清理码头货堆','核对岸线标记','送达逃兵口信'][z-1],reward=Math.floor(taskBudget/12)+(z===6&&variant===2?taskBudget%12:0),task={id,campaign:'starsea',chapter,order:100+z*2+variant,type:'side',title,goal:title+'，回来告诉'+shorts[z-1]+'。',giver:npc,accept_mode:'talk',accept_npc:npc,accept_map:map,accept_landmark:loc,series:prefix+'-regional',zone:prefix+'-z'+z,abandonable:true,journal:true,dialog_accept:id+':accept',dialog_complete:id+':complete',reward_xp:reward,reward_gold:20+z*5,tags:['区域支线'],region:map,area:['落风坡','船台湾','风车高地','旧码头','岸线崖','船坞要塞'][z-1],place:locals[z-1]};
  tasks.tasks.push(task);condition(id,1,'zone',task.zone);condition(id,1,'level',Math.max(1,lower[z-1]-2));
  line(task.dialog_accept,1,npc,variant===1?['巡猎兽叼走了羊铃。替我去草坡看一看，别让羊再往侵军那边跑。','侵军把小艇打坏了。帮我稳住引擎，我得把还在码头的人接出来。','风车的风向布被偷走了。看看架台留下的痕迹，再把记录带回来。','清理那堆货物时留心一下。有些拾荒者只是想带家人离开。','岸线有三处灯塔记录。把它们核对好，灯火才不会指错方向。','如果你要回港，替我检查一下这封信。告诉收信人，我还活着。'][z-1]:'顺路帮我'+title+'。这是这里的事，不用等船坞的故事结束。');line(task.dialog_complete,1,npc,shorts[z-1]+'收好了你带回的消息。'+(variant===1?'这片地方又能继续过日子了。':'下次经过，记得来打个招呼。'));
  if(variant===2)tasks.steps.push(step(id,1,'interact',prefix+'-side-clue'+z,z,'object:'+id,title,{prop:'ss-prop-sign'}));
  else if(z===2){tasks.steps.push(step(id,1,'interact',prefix+'-side-clue'+z,z,'object:'+id,'检查小艇引擎',{prop:'ss-prop-engine',then_battle:true}),step(id,2,'defend',prefix+'-side-clue'+z,z,'wave','守住修船现场',{prop:'ss-prop-engine',count:3,enemies:['ss-mon-dusk-blade','ss-mon-dusk-gunner'],defense:'engine'}));}
  else{const closest=world.camps.filter(c=>c.zone===task.zone).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];tasks.steps.push(step(id,1,'clear_camp',prefix+'-camp-clue'+z,z,closest.id,'清空附近营地',{camp:closest.id}),step(id,2,'interact',prefix+'-side-clue'+z,z,'object:'+id,title,{prop:'ss-prop-cargo'}));}
  regional.push(id);
 }
 const exploreId=prefix+'-explore-z'+z,explore={id:exploreId,campaign:'starsea',chapter,order:200+z,type:'side',title:'探索'+['落风坡','船台湾','风车高地','旧码头','岸线崖','船坞要塞'][z-1],goal:'认清航标，找到一只宝箱，完成一次本地事件。',accept_mode:'arrive',discover_landmark:prefix+'-resident'+z,zone:prefix+'-z'+z,series:prefix+'-exploration',dialog_accept:exploreId+':accept',dialog_complete:exploreId+':complete',reward_xp:Math.floor(exploreBudget/6)+(z===6?exploreBudget%6:0),reward_gold:15,journal:true,abandonable:true,tags:['探索']};
 tasks.tasks.push(explore);condition(exploreId,1,'zone',explore.zone);line(explore.dialog_accept,1,'player','先认清这里的航标、补给与事件，远行才有把握。');line(explore.dialog_complete,1,'player','这一片已经记在航图上了。');
 tasks.steps.push(step(exploreId,1,'reach_waypoint',prefix+'-resident'+z,z,prefix+'-wp'+z,'激活本区航标'),step(exploreId,2,'open_chest',prefix+'-chest-landmark'+z,z,prefix+'-chest'+z,'找到本区宝箱'),step(exploreId,3,'complete_event',prefix+'-event-landmark'+z,z,prefix+'-event'+z,'完成本区事件'));
 for(let b=1;b<=3;b++){const id=prefix+'-bounty-z'+z+'-'+b,entry={id,campaign:'starsea',order:b,type:'bounty',title:['清理侵扰','剿除精英','守住道路'][b-1],goal:['击退8只本区怪物','击退1只本区精英','击退15只本区怪物'][b-1],accept_mode:'board',zone:prefix+'-z'+z,series:prefix+'-bounty',pool:prefix+'-pool-z'+z,repeat_cooldown_seconds:600,cond_kind:'kills',cond_count:[8,1,15][b-1],elite:b===2,reward_gold:20*b};tasks.tasks.push(entry);}
}
for(let d=1;d<=3;d++){const z=1+(d-1)*2,id=prefix+'-dungeon-guide'+d,npc='ow-npc-wind-'+z,entry=prefix+'-entry-landmark'+d;tasks.tasks.push({id,campaign:'starsea',chapter,order:300+d,type:'side',title:['风车地窖的旧箱','沉船货舱的回声','船坞遗址的航图'][d-1],goal:'找到地城入口，完成一次通关。',giver:npc,accept_mode:'talk',accept_npc:npc,accept_map:map,accept_landmark:prefix+'-resident'+z,series:prefix+'-dungeon',zone:prefix+'-z'+z,journal:true,abandonable:true,dialog_accept:id+':accept',dialog_complete:id+':complete',reward_xp:Math.floor(leadBudget/3)+(d===3?leadBudget%3:0),reward_gold:30,tags:['地城引路']});condition(id,1,'zone',prefix+'-z'+z);line(id+':accept',1,npc,'沿着航标旁的路就能找到入口。里面有落下的装备，也有强敌；准备好再往深处走。');line(id+':complete',1,npc,'你把那条路走通了。以后再缺材料，知道到哪里去找。');tasks.steps.push(step(id,1,'interact',entry,z,'object:'+id,'查看地城入口',{prop:'ss-prop-sign'}),step(id,2,'clear_dungeon',entry,z,'field-wind-'+d,'通关地城'));}
// Story people: one symbolic priority chain. Accept-stay and active talk
// positions remain owned by the existing server resolver, including onboarding.
tasks.conditions=tasks.conditions.filter(c=>![prefix+'-ship-active',prefix+'-ship-finished'].includes(c.target));
const miloTasks=[newTasks[0].id,newTasks[1].id,oldId(4),oldId(5)],miloSites=[['outpost',126,335],['clue',366,338],['route-fork',358,213],['gate',261,132]],positions=[];
for(let i=0;i<miloTasks.length;i++){
 const when=prefix+'-milo-active'+i,until=prefix+'-milo-after'+i;condition(when,1,'task_active',miloTasks[i]);
 for(let j=i+1;j<miloTasks.length;j++)condition(until,j-i,'task_active',miloTasks[j]);
 const [landmark,x,y]=miloSites[i];positions.push({npc:'ss-npc-milo',landmark,x,y,when,...(i<miloTasks.length-1?{until}:{})});
}
condition(prefix+'-milo-port',1,'level',1);miloTasks.forEach((task,i)=>condition(prefix+'-milo-field',i+1,'task_active',task));
positions.push({npc:'ss-npc-milo',map:'ss-map-port',x:23,y:12,when:prefix+'-milo-port',until:prefix+'-milo-field'});
condition(prefix+'-ship-active',1,'task_active',oldId(3));positions.push({npc:'ss-npc-tongling',landmark:'objective',x:143,y:318,when:prefix+'-ship-active'},{npc:'ss-npc-tongling',map:'ss-map-port',x:19,y:20,when:'npc:ss-npc-tongling',until:prefix+'-ship-active'});
tasks.conditions=tasks.conditions.filter(c=>c.target!=='npc:ss-npc-tongling');condition('npc:ss-npc-tongling',1,'task',oldId(1),'guide');condition('npc:ss-npc-tongling',2,'level',3);
for(const [i,p]of positions.entries())npcs.positions.push({id:prefix+'-story-position'+(i+1),map:p.map??map,...p});
line(prefix+'-join-fallback-tongling',1,'ss-npc-tongling','你已经走了不少地方。工坊给远行的人留着门，先看看装备哪里需要修。');
const tongling=npcs.npcs.find(n=>n.id==='ss-npc-tongling');tongling.dialog_join_fallback=prefix+'-join-fallback-tongling';tongling.join_guide_condition=prefix+'-tongling-guided';condition(tongling.join_guide_condition,1,'task',oldId(1),'guide');
for(const p of tasks.parameters)if(p.id==='legacy_layout')p.value=p.value.filter(x=>x!=='isle-1');
function encode(value,type){return value===undefined||value===null?null:type==='json'?JSON.stringify(value):type==='list'?value.join('|'):value;}
async function save(name,data,mapping){const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/'+name+'.xlsx'));for(const [sheet,key]of Object.entries(mapping)){const sh=wb.worksheets.getItem(sheet),used=sh.getUsedRange().values,fields=used[1].filter(Boolean),types=used[2],rows=data[key].map(r=>fields.map((f,i)=>encode(r[f],types[i]))),height=Math.max(used.length-3,rows.length);sh.getRangeByIndexes(3,0,height,fields.length).values=Array.from({length:height},(_,i)=>rows[i]??fields.map(()=>null));}if(name==='任务'){const sh=wb.worksheets.getItem('说明'),used=sh.getUsedRange().values,index=used.findIndex(r=>r[0]==='#quest-parameters');if(index<0)throw Error('Missing parameter owner');sh.getRangeByIndexes(index+4,0,tasks.parameters.length,2).values=tasks.parameters.map(p=>[p.id,JSON.stringify(p.value)]);}await(await SpreadsheetFile.exportXlsx(wb)).save(root+'/config/excel/'+name+'.xlsx');}
const npcBook=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/NPC.xlsx')),npcSheet=npcBook.worksheets.getItem('NPC'),columns=npcSheet.getUsedRange().values[1].filter(Boolean);for(const [key,label]of [['dialog_join_fallback','兜底入驻对白'],['join_guide_condition','引导入驻条件']])if(!columns.includes(key)){npcSheet.getRangeByIndexes(0,columns.length,3,1).values=[[label],[key],['string']];columns.push(key);}await(await SpreadsheetFile.exportXlsx(npcBook)).save(root+'/config/excel/NPC.xlsx');
await save('任务',tasks,{'任务':'tasks','步骤':'steps','条件':'conditions','传闻':'rumors'});await save('NPC',npcs,{'NPC':'npcs','站位':'positions'});await save('对话',dialogue,{'对话':'lines','触发':'triggers'});
await fs.writeFile(out+'/quest-authoring.json',JSON.stringify({storyOld:6,storyNew:2,regional:12,exploration:6,dungeonGuide:3,bounties:18,rumors:3,residents:6,storyXpBefore:total,storyXpAfter:old.reduce((n,r)=>n+oldTask(r.id).reward_xp,0)+remaining,battleToClearCamp:[{task:newTasks[1].id,step:2,camp:camp.id,status:'待用户试玩确认'}],dialogueStatus:'全部新对白为草稿，待用户试玩确认',phasePositionsRequireCheck:true},null,2));console.log(JSON.stringify({storyXp:total,regional:regional.length,authoredBooks:3}));
