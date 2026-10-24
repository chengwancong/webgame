/** Real isolated API/WS acceptance; no synthetic kills, completions, rewards or checkpoints.
 * AW_DATABASE_URL=... pnpm exec tsx tools/hub-autopilot.ts [sword|staff|hidden|all]
 * Each route owns a new disposable PostgreSQL schema. Only the trusted server's
 * existing simulation clock is accelerated; stats, builds, mobs, budgets and rules
 * are production content. Run this heavy job alone. Raw evidence stays .runtime/.
 */
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,appendFileSync,readFileSync} from 'node:fs';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {loadHubOutsideNumbers} from '../apps/api/src/hub-numbers.ts';
import {migrate} from '../apps/api/src/database.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {talentDefinitions} from '../packages/content/deep-progression.ts';
import {World,distance,type WorldCheckpoint} from '../packages/simulation/index.ts';
import {gearWeaponType} from '../packages/rules/weapon-skills.ts';
import {versions,type Snapshot,type GrowthPreview} from '../packages/contracts/index.ts';
import {hubDungeonViewSchema,type HubDungeonView} from '../packages/contracts/dungeons.ts';
import hubRuntime from '../packages/content/hub-runtime.json';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';
import {hubRewardSourceHashes,hubRuntimeNumbersHash} from './spine/hub-rewards.ts';
import {hubRewardEvidenceSchema,type HubRewardEvidence} from './spine/hub-reward-schema.ts';
import {skillSlotCount} from '../packages/rules/skill-slots.ts';
import {phaseAcquisitionAt,minutesAtLevel} from './world-stage-schedule.ts';
import keyPools from '../apps/api/src/stage-key-pools.json';
import type {StageKeyProgress,StageKeyPreview} from '../packages/contracts/stage-keys.ts';
import type {ChartView,TodayView} from '../packages/contracts/hub.ts';

const dsn=process.env.AW_DATABASE_URL;if(dsn&&process.env.AW_B4_CLOUD==='1'&&new URL(dsn).hostname!=='b4-pg')throw Error('B4 cloud autopilot requires isolated b4-pg');if(!dsn)throw Error('AW_DATABASE_URL is required; no resident schema is selected automatically.');
const planHash=process.argv.find(x=>x.startsWith('--plan-hash='))?.slice(12);if(planHash&&!/^[a-f0-9]{64}$/.test(planHash))throw Error('Invalid applied plan hash');
const preSwitch=process.argv.includes('--pre-switch'),preflight=process.argv.includes('--preflight'),seed=Number(process.argv.find(x=>x.startsWith('--seed='))?.slice(7)??11);if(!Number.isInteger(seed)||seed<1)throw Error('Seed must be a positive integer');const selected=process.argv.slice(2).find(a=>!a.startsWith('--'))??'all';if(!['all','sword','staff','hidden'].includes(selected))throw Error('Choose sword, staff, hidden or all');
if(!preflight&&!preSwitch&&(Number(versions.db)!==19||Object.values(parseFieldFreeze(hubRuntime.fieldFreeze)).some(v=>!v)))throw Error('Full HUB autopilot requires completed switch S (db 19, nine field freezes enabled).');
const weapons=selected==='all'?['sword','staff','hidden']:[selected],evidence='.runtime/b4/autopilot/'+(preflight?'preflight-':preSwitch?'pre-switch-':'full-')+seed+(planHash?'-'+planHash.slice(0,12):'-baseline')+'-strategy-v3-level-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);mkdirSync(evidence,{recursive:true});
const measurement:HubRewardEvidence={schema:'hub-reward-evidence-v1',command:'node --import tsx tools/hub-autopilot.ts '+process.argv.slice(2).join(' '),versions,sourceHashes:await hubRewardSourceHashes(),runtimeNumbersHash:await hubRuntimeNumbersHash(),...(planHash?{planHash}:{}),runs:[],combat:[],autopilot:[]};
const saveMeasurement=()=>writeFileSync(evidence+'/evidence.json',JSON.stringify(hubRewardEvidenceSchema.parse(measurement),null,2));
const numericDefects=new Map<string,{rank:string;medianTtd:number;targetTtd:number;seeds:number[]}>(),numericEvidencePath=process.argv.find(a=>a.startsWith('--known-n1-defects='))?.slice('--known-n1-defects='.length);
if(numericEvidencePath){
 const probe=hubRewardEvidenceSchema.parse(JSON.parse(readFileSync(numericEvidencePath,'utf8')));
 if(probe.runtimeNumbersHash!==measurement.runtimeNumbersHash||JSON.stringify(probe.versions)!==JSON.stringify(versions))throw Error('Known N1 defects require the same measured runtime numbers and versions.');
 const analysisOnly=['tools/spine/hub-rewards.ts','tools/spine/hub-plan-integrity.ts','tools/hub-reward-apply.mjs','tools/hub-autopilot.ts'];
 for(const [file,hash]of Object.entries(measurement.sourceHashes))if(!analysisOnly.includes(file)&&probe.sourceHashes[file]!==hash)throw Error('N1 defect evidence source drift: '+file);
 for(const nodeId of new Set(probe.combat.map(r=>r.nodeId))){const all=probe.combat.filter(r=>r.nodeId===nodeId),rank=all.some(r=>r.rank==='boss')?'boss':all.some(r=>r.rank==='elite')?'elite':'normal',rows=all.filter(r=>r.rank===rank&&r.ttdSeconds!==null&&JSON.stringify(r.requestedSkills)===JSON.stringify(r.executedSkills)),seeds=[...new Set(rows.map(r=>r.seed))];if(![11,23,47,71,101].every(seed=>seeds.includes(seed)))continue;const times=rows.map(r=>r.ttdSeconds!).sort((a,b)=>a-b),medianTtd=(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2,targetTtd=rank==='boss'?30:rank==='elite'?20:40;if(medianTtd<targetTtd*.8)numericDefects.set(nodeId,{rank,medianTtd,targetTtd,seeds});}
 writeFileSync(evidence+'/known-n1-defects.json',JSON.stringify({source:numericEvidencePath,sourceHashes:probe.sourceHashes,runtimeNumbersHash:probe.runtimeNumbersHash,nodes:Object.fromEntries(numericDefects)},null,2));
}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const assert=(v:unknown,message:string)=>{if(!v)throw Error(message);};
async function runRoute(weapon:string){
 const schema='qa_hub_auto_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
 const content=structuredClone(dungeonContent);for(const d of content.definitions)if(d.hub)d.mode='simulation';
 content.runtime.autoTicksPerSlice=30;content.runtime.pumpMs=50;
 const hubNumbers=loadHubOutsideNumbers();
 const app=createApp(pool,{testLogin:true,testDungeonSeed:seed,dungeons:content,hubNumbers,fieldFreeze:{camps:true,patrols:true,exploration:true,waypoints:true,bounties:true,events:true,fieldEntry:true,fieldGather:true,fieldSprint:true}});
 let cookie='',lease='',snapshot:Snapshot,live:WebSocket|undefined,base='',steps:object[]=[],completed=new Set<string>(),lastNode='prologue',activeInstance:string|undefined,elapsed=0,renewAt=Date.now()+15000;const routeEvidence={family:weapon as 'sword'|'staff'|'hidden',seed,skippedByFreeze:0,events:[] as HubRewardEvidence['autopilot'][number]['events'],withoutDailyWalls:[]};measurement.autopilot.push(routeEvidence);
 const record=(value:object)=>{steps.push(value);appendFileSync(evidence+'/'+weapon+'.jsonl',JSON.stringify(value)+'\n');};
 record({kind:'loaded-runtime-numbers',source:'packages/content/hub-outside-numbers.json; absent means pending only when every node budget is pending',runtimeNumbersHash:measurement.runtimeNumbersHash,hubNumbers});
 async function call(path:string,body?:unknown,allowReject=false):Promise<any>{const result=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const set=result.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const value=await result.json();if(!result.ok&&!allowReject)throw Error(path+': '+result.status+' '+JSON.stringify(value));return {ok:result.ok,value};}
 async function renew(){if(lease&&Date.now()>=renewAt){await call('control/renew',{lease_id:lease});renewAt=Date.now()+15000;}}
 const state=async()=>{await renew();return snapshot=(await call('character')).value;};
 async function write(path:string,body:object,allowReject=false){await state();const r=await call(path,{command_id:randomUUID(),lease_id:lease,revision:snapshot.revision,...body},allowReject);if(r.value.snapshot)snapshot=r.value.snapshot;record({kind:'player-action',atSeconds:elapsed,path,body,ok:r.ok,delta:r.value.delta,error:r.ok?undefined:r.value,revision:snapshot.revision});return r;}
 const command=async(op:string,body:object={})=>(await call('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...body})).value;
 function walkPort(target:{x:number;y:number}){const r=regionById('ss-map-port'),w=new World(r,snapshot.stats,[],[],[],11);w.hero.position={...snapshot.starsea!.location!};w.setMode('manual');w.go(target);for(let n=0;n<900&&distance(w.hero.position,target)>1;n++)w.step();assert(distance(w.hero.position,target)<=4.5,'Port route is obstructed');return {...w.hero.position};}
 async function returnQueue(){const today:TodayView=(await call('hub/today')).value;assert(today.returnQueue.filter(x=>x.kind==='unlock').length<=1,'More than one unlock in a port arrival');for(const item of today.returnQueue)await call('hub/return-ack',{command_id:randomUUID(),kind:item.kind,id:item.kind==='unlock'?item.id:item.kind==='dialogue'?item.dialogueId:'away'});record({kind:'return',unlockCount:today.returnQueue.filter(x=>x.kind==='unlock').length,daily:today.firstClear});}
 function auditBuild(label:string){record({kind:'build',label,atSeconds:elapsed,level:snapshot.level,xp:snapshot.xp,gold:snapshot.gold,material:snapshot.material,stats:snapshot.stats,equipment:snapshot.equipment,gear:snapshot.gear,skills:snapshot.skills,skillRanks:snapshot.skillRanks,skillAccess:snapshot.skillAccess,recovery:snapshot.skillRecovery,stageKeys:snapshot.world?.stageKeys});}
 async function equipBest(){
  for(const slot of ['weapon','armor','helmet','boots','accessory','ring']){
   await state();const candidates=snapshot.gear.filter(g=>g.slot===slot&&g.id!==(snapshot.equipment as Record<string,string>)[slot]&&(g.requiredLevel??1)<=snapshot.level&&(slot!=='weapon'||gearWeaponType(g)===snapshot.stats.weapon));
   const options:{id:string;preview:GrowthPreview}[]=[];
   for(const gear of candidates){const preview:GrowthPreview=(await call('gear/'+gear.id+'/preview')).value;if(!preview.equipBlock&&(['stronger',slot==='weapon'?'output':'sustain'].includes(preview.verdict)))options.push({id:gear.id,preview});}
   options.sort((a,b)=>Number(b.preview.verdict==='stronger')-Number(a.preview.verdict==='stronger')||(slot==='weapon'?b.preview.equipped.stats.attack-a.preview.equipped.stats.attack:b.preview.equipped.stats.hp-a.preview.equipped.stats.hp)||a.id.localeCompare(b.id));
   if(options[0]){record({kind:'gear-comparison',slot,selected:options[0],alternatives:options.map(o=>({id:o.id,verdict:o.preview.verdict}))});await write('gear/equip',{gear_id:options[0].id});}
  }
 }
 async function prepare(){await state();record({kind:'preparation-policy',policy:'existing phase schedule at actual character level; real API costs and unlocks only',level:snapshot.level});auditBuild('prepare-before');
  for(const offer of snapshot.starseaView?.available??[])if(offer.map==='ss-map-port'&&offer.task.startsWith('HEX-Q'))await write('quest',{op:'accept',task:offer.task,region:offer.map,position:walkPort(offer)},true);
  await equipBest();
  // Query only stages the character actually visited. The API owns fragments, cost,
  // deterministic outputs and one-time receipt. No synthetic key or resource grant.
  const visited=[...new Set(Object.values(snapshot.world?.stageKeys??{}).map(k=>k.stage))].sort((a,b)=>a-b);
  for(const stage of visited){await state();const progress:StageKeyProgress|null=(await call('stage-keys?stage='+stage)).value.progress;record({kind:'key-progress',progress});if(!progress||progress.obtained)continue;
   const options:{choice:string;preview:StageKeyPreview}[]=[];
   for(const choice of progress.choices){const preview=await call('stage-keys/preview',{revision:snapshot.revision,stage,key:choice.id},true);record({kind:'key-preview',stage,choice:choice.id,ok:preview.ok,preview:preview.value});if(choice.craftable&&preview.ok)options.push({choice:choice.id,preview:preview.value});}
   // Choose a visible useful preview, with the pool's canonical ID as a stable tie-break.
   options.sort((a,b)=>b.preview.changes.filter(c=>c.tone==='positive').length-a.preview.changes.filter(c=>c.tone==='positive').length||b.preview.growth.length-a.preview.growth.length||a.choice.localeCompare(b.choice));
   if(options[0]){await write('stage-keys/craft',{stage,key:options[0].choice});await equipBest();}
  }
  await state();const expected=phaseAcquisitionAt(minutesAtLevel(snapshot.level)),forge=regionById('ss-map-port').landmarks.find(l=>l.kind==='forge')!;
  for(const slot of ['weapon','armor','helmet','boots','accessory','ring']){await state();const id=(snapshot.equipment as Record<string,string>)[slot];if(!id)continue;const target=Math.max(expected.enhance,slot==='weapon'?1:0);
   for(let n=0;n<target;n++){await state();const gear=snapshot.gear.find(g=>g.id===id)!;if(gear.rank>=target)break;const preview:GrowthPreview=(await call('gear/'+id+'/preview')).value;record({kind:'upgrade-preview',slot,target,preview});if(preview.max||preview.upgradeBlock||snapshot.gold<preview.cost.gold||snapshot.material<preview.cost.material)break;if(!(await write('gear/upgrade',{gear_id:id,region:'ss-map-port',position:walkPort(forge)},true)).ok)break;}
  }
  await state();const loadout=[...snapshot.skills];
  for(const access of snapshot.skillAccess.filter(a=>a.weaponCompatible!==false&&a.eligible&&!a.activated).sort((a,b)=>a.id.localeCompare(b.id))){if(loadout.length>=skillSlotCount(snapshot))break;if((await write('skills/activate',{skill_id:access.id},true)).ok)loadout.push(access.id);}
  for(const access of snapshot.skillAccess.filter(a=>a.weaponCompatible!==false&&a.activated&&!loadout.includes(a.id)).sort((a,b)=>a.id.localeCompare(b.id))){if(loadout.length>=skillSlotCount(snapshot))break;loadout.push(access.id);}
  if(loadout.join('|')!==snapshot.skills.join('|'))await write('skills',{skills:loadout});
  for(const id of [...snapshot.skills])for(let n=0;n<expected.skillRank;n++){await state();const skill=snapshot.skillAccess.find(k=>k.id===id);if(!skill||skill.rank>=expected.skillRank||skill.action!=='upgrade'||!skill.affordable)break;await write('skills/upgrade',{skill_id:id});}
  // Spend actual earned talent points, bounded by the catalog; rejected previews stay in audit.
  for(let n=0;n<talentDefinitions.length;n++){let learned=false;for(const talent of talentDefinitions){const q=(await call('progression/preview',{action:{op:'talent.learn',target:talent.id}},true)).value;if(q.enabled){await write('progression/action',{action:{op:'talent.learn',target:talent.id}});learned=true;break;}}if(!learned)break;}
  const today:TodayView=(await call('hub/today')).value;if(today.dock.open&&!today.dock.fleets.some(f=>f.region))await call('hub/dock',{op:'send',fleet:1,region:'wind',command_id:randomUUID()});
  await state();for(const q of snapshot.starseaView?.quests??[])if(q.id.startsWith('HEX-Q')&&q.step.map==='ss-map-port'&&q.step.op==='talk'&&q.step.points[0])await write('quest',{op:'talk',task:q.id,region:'ss-map-port',target:q.step.points[0].id,position:walkPort(q.step.points[0])},true);
  if(snapshot.gear.length>=snapshot.capacity-12){const preview=(await call('gear/salvage-batch/preview')).value;if(preview.gear.length)await write('gear/salvage-batch',{gear_ids:preview.gear.map((g:any)=>typeof g==='string'?g:g.id)});}
  await state();auditBuild('prepare-after');
 }
 async function dungeon(node:string,maxSeconds=Infinity){lastNode=node;auditBuild('entry:'+node);console.log(JSON.stringify({phase:'enter',weapon,node,level:snapshot.level,seed}));const beforeLevel=snapshot.level,recoveredBefore=snapshot.skillRecovery?.recovered.length??0,beforeShards=Object.values((await pool.query('SELECT state FROM ow_hub_state WHERE character=$1',[snapshot.id])).rows[0]?.state.chart.shards??{}).reduce((sum:number,n)=>sum+Number(n),0);const entry=await command('create',{node_id:node,shards:[]}),id=entry.instance.id;activeInstance=id;let frame:HubDungeonView|undefined,seq=0;const errors:string[]=[];live=new WebSocket(base.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie}});live.on('message',raw=>{const d=JSON.parse(String(raw));if(d.type==='state')frame=hubDungeonViewSchema.parse(d.instance);else if(d.type==='error')errors.push(d.message);});await new Promise<void>((resolve,reject)=>{live!.once('open',resolve);live!.once('error',reject);});live.send(JSON.stringify({type:'hello',lease_id:lease}));while(!frame)await sleep(20);
  await command('ready',{instance_id:id});await command('start',{instance_id:id});if(preflight){await sleep(150);assert(frame!.status==='running','First node did not start');assert(frame!.definition.hub?.node==='wind-story-1','Wrong first node');assert((await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data.hub.seed===seed,'Requested and executed combat seed differ');record({kind:'preflight-entry',node,status:frame!.status,objective:frame!.objective,segment:frame!.segment});await command('leave',{instance_id:id});live.close();live=undefined;await state();assert(!JSON.stringify(snapshot.starsea).includes('skipped-by-freeze'),'skipped-by-freeze during first entry');return;}let lastAction='',lastAt=0,lastProgressAt=Date.now(),limitReached=false;const deadline=Date.now()+180000;
  while(!['success','failed','abandoned','closed'].includes(frame!.status)){
   if(Date.now()>deadline)throw Error('Real executor exceeded wall-clock budget at '+node);await renew();const f=frame!;if(f.tick/30>=maxSeconds){limitReached=true;const left=await command('leave',{instance_id:id});frame=hubDungeonViewSchema.parse(left.instance);
    // leave closes this member's WS. Never wait for an update on that closed stream.
    for(let poll=0;poll<100&&!['success','failed','abandoned','closed'].includes(frame.status);poll++){await sleep(20);frame=hubDungeonViewSchema.parse((await call('dungeons/'+id+'/result')).value.instance);}
    assert(['success','failed','abandoned','closed'].includes(frame.status),'Exit did not reach a terminal state');break;}const hero=f.actors.find(a=>a.id===snapshot.id);if(!hero){await sleep(40);continue;}
   const send=(input:object,key:string)=>{if(key!==lastAction||Date.now()-lastAt>600){live!.send(JSON.stringify({type:'input',input:{seq:++seq,...input}}));lastAction=key;lastAt=Date.now();}};
   if(Date.now()-lastProgressAt>=15000){console.log(JSON.stringify({phase:'running',weapon,node,stage:f.stage+1,tick:f.tick,hp:hero.hp,objective:f.objective.text}));lastProgressAt=Date.now();}const object=f.story?.objects.find(o=>o.enabled&&!(o.kind==='beacon'&&f.story?.defendActive));if(object){if(distance(hero.position,object.position)>2.5)send({kind:'go',x:object.position.x,y:object.position.y},'go:'+f.stage+':'+object.id);else send({kind:'interact',target:object.id},'interact:'+f.stage+':'+f.story?.phase+':'+object.id);}
   else if(f.definition.hub?.kind==='nest'&&f.keyChests.some(c=>!c.claimed)&&!((f.battle as WorldCheckpoint|undefined)?.data.enemies??[]).some((e:{alive:boolean;position:{x:number;y:number}})=>e.alive&&distance(e.position,hero.position)<=12)){
    const chest=f.keyChests.filter(c=>!c.claimed).sort((a,b)=>distance(hero.position,a.position)-distance(hero.position,b.position))[0];
    // Loot only after nearby threats are cleared; never race through a live pack for a box.
    // Semi keeps real combat running while respecting the player's chest destination.
    live!.send(JSON.stringify({type:'input',input:{seq:++seq,kind:'mode',mode:'semi'}}));
    if(distance(hero.position,chest.position)>2.5)send({kind:'go',x:chest.position.x,y:chest.position.y},'chest-go:'+f.stage+':'+chest.id);else send({kind:'interact',target:chest.id},'chest-open:'+f.stage+':'+chest.id);
   }else send({kind:'mode',mode:'auto'},'auto:'+f.stage+':'+f.story?.phase);
   if(errors.length)throw Error(node+' runtime error: '+errors.join(' | '));await sleep(50);
  }
  const f=frame!,saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;writeFileSync(evidence+'/'+weapon+'-'+id+'.json',JSON.stringify({finalView:f,saved},null,2));const telemetry=Object.entries(saved.hub.lootTelemetry??{}) as [string,{gearCount:number;hexCount:number;eligible:number}][];assert(saved.hub.seed===seed,'Requested combat seed differs from executed seed');measurement.runs.push({nodeId:node,seed,family:weapon as 'sword'|'staff'|'hidden',seconds:Math.max(1/30,f.tick/30),won:f.status==='success',...(f.status!=='success'?{failure:f.reason}:{}),rewards:saved.hub.candidateRewards??{gold:0,xp:0,material:0},gathered:saved.hub.gatherAmounts??{},gearCount:telemetry.reduce((n,[,v])=>n+v.gearCount,0),hexCount:telemetry.reduce((n,[,v])=>n+v.hexCount,0),eligibleHex:Object.fromEntries(telemetry.map(([k,v])=>[k,v.eligible])),shardsUsed:saved.hub.shards.length,shardsDropped:Math.max(0,Object.values((await pool.query('SELECT state FROM ow_hub_state WHERE character=$1',[snapshot.id])).rows[0]?.state.chart.shards??{}).reduce((sum:number,n)=>sum+Number(n),0)-beforeShards+saved.hub.shards.length),day:1});saveMeasurement();record({kind:'node',candidateRewards:saved.hub.candidateRewards,paid:saved.hub.alreadyPaid,node,status:f.status,ticks:f.tick,seconds:f.tick/30,levelBefore:snapshot.level,shards:[],diagnostic:f.diagnostic});console.log(JSON.stringify({phase:'node-result',weapon,node,status:f.status,seconds:f.tick/30}));live.close();live=undefined;
  const result=(await pool.query('SELECT response FROM ow_hub_node_settlements WHERE character=$1 AND instance=$2',[snapshot.id,id])).rows[0]?.response;if(f.status==='success'){assert(result?.firstClear===!completed.has(node),'First-clear flag mismatch '+node);completed.add(node);}await command('return',{instance_id:id});activeInstance=undefined;await state();assert(!JSON.stringify(snapshot.starsea).includes('skipped-by-freeze'),'skipped-by-freeze appeared');await returnQueue();elapsed+=f.tick/30;const recovered=snapshot.skillRecovery?.recovered.length??0;if(f.status==='success')routeEvidence.events.push({nodeId:node,atSeconds:elapsed,levelBefore:beforeLevel,levelAfter:snapshot.level,...(recovered>recoveredBefore&&recovered<=4?{recoveryOrder:recovered}:{})});record({kind:'attempt-return',node,status:f.status,limitReached,seconds:f.tick/30,atSeconds:elapsed,levelBefore:beforeLevel,levelAfter:snapshot.level,keyProgress:f.keyProgress});auditBuild('return:'+node);saveMeasurement();return {success:f.status==='success',seconds:f.tick/30,limitReached,bug:false};
 }
 try{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.listen({host:'127.0.0.1',port:0});base='http://127.0.0.1:'+((app.server.address() as {port:number}).port);await call('session/login',{username:'qa_hub_'+weapon+'_'+randomUUID().slice(0,8)});snapshot=(await call('character',{name:'HUB '+weapon})).value;lease=(await call('control',{client_id:randomUUID()})).value.lease_id;
  await write('prologue',{weapon});await write('prologue',{finish:true});await state();assert(snapshot.starsea?.location?.map==='ss-map-port','Prologue did not arrive at port');await returnQueue();
  const skipped=new Set<string>();const earliestGate=new Set<string>();const attempted=new Map<string,number>(),wallSeconds=new Map<string,number>();let blocked:string|undefined;const failedAttempts=new Map<string,number>();
  for(let iteration=0;iteration<160&&completed.size+skipped.size<20;iteration++){
   await prepare();const chart:ChartView=(await call('hub/chart')).value;const nodes=chart.regions.flatMap(r=>r.nodes),fresh=nodes.filter(n=>n.status==='open'&&!completed.has(n.id)&&!skipped.has(n.id)).sort((a,b)=>Number(b.recommended)-Number(a.recommended)||a.id.localeCompare(b.id));
   for(const gate of nodes.filter(n=>n.kind==='gate'&&n.status==='open'&&!earliestGate.has(n.id))){earliestGate.add(gate.id);record({kind:'earliest-gate',node:gate.id,level:snapshot.level,atSeconds:elapsed,nonGateClears:[...completed].filter(id=>id.startsWith(gate.region+'-')&&!id.endsWith('-gate')).length});}
   if(!fresh.length&&!blocked&&skipped.size){record({kind:'no-unmeasured-legal-node',skipped:[...skipped],unmeasured:content.definitions.flatMap(d=>d.hub&&!completed.has(d.hub.node)?[d.hub.node]:[])});break;}
   let next=blocked?nodes.find(n=>n.id===blocked&&n.status==='open'):fresh[0];
   // Three regional clears may open the gate before a difficult nest. Try other
   // legal nodes after two defeats; defer, never mark them cleared or skipped.
   const alternate=blocked&&(failedAttempts.get(blocked)??0)>=2?fresh.find(n=>n.id!==blocked&&(attempted.get(n.id)??0)<(attempted.get(blocked!)??0)):undefined;
   if(alternate){record({kind:'defer-defeated-node',node:blocked,next:alternate.id,reason:'new three-clear gate rule permits another legal node'});blocked=undefined;next=alternate;}
   if(blocked&&(failedAttempts.get(blocked)??0)>=2&&(failedAttempts.get(blocked)??0)%2===0){const farm=nodes.filter(n=>n.status==='cleared'&&n.kind==='nest'&&n.id!==blocked).sort((a,b)=>b.recommendedLevel-a.recommendedLevel||a.id.localeCompare(b.id))[0];if(farm)next=farm;}
   if(!next){const farm=nodes.filter(n=>n.status==='cleared'&&n.kind==='nest').sort((a,b)=>(attempted.get(a.id)??0)-(attempted.get(b.id)??0))[0];if(!farm)throw Error('No legal node; '+nodes.filter(n=>n.status==='locked').map(n=>n.id+':'+n.lockReason).join('|'));next=farm;}
   const wallId=blocked??next.id,wallNode=nodes.find(n=>n.id===wallId)!,definition=content.definitions.find(d=>d.hub?.node===next.id)!,wallDefinition=content.definitions.find(d=>d.hub?.node===wallId)!,pool=keyPools.pools.find(p=>p.stage===wallDefinition.numericStage),budget=(wallId==='wind-gate'?60:wallId==='mist-gate'?200:wallNode.estimatedMinutes[1])*60*4,used=wallSeconds.get(wallId)??0;
   if(used>=budget){skipped.add(wallId);blocked=undefined;record({kind:'unmeasured-node',node:wallId,seed,reason:'Wall time exceeded 4x original target',used,budget});continue;}
   // Functional recovery may continue at its truthful level; milestone deviation is
   // explicitly reported and cannot turn into an N4 numerical pass.
   if(next.id.endsWith('-gate'))record({kind:'milestone-entry',node:next.id,atSeconds:elapsed,level:snapshot.level,targetLevel:next.id==='wind-gate'?7:14,levelError:snapshot.level-(next.id==='wind-gate'?7:14),targetMinutes:next.id==='wind-gate'?60:200,levelPass:snapshot.level===(next.id==='wind-gate'?7:14),timeErrorMinutes:elapsed/60-(next.id==='wind-gate'?60:200),timePass:Math.abs(elapsed/60-(next.id==='wind-gate'?60:200))<=(next.id==='wind-gate'?60:200)*.1,scenario:'normal-key-route-not-without-daily'});
   const regionTargetLevel=next.id.startsWith('wind-')?7:14,routeBudgetSeconds=(next.id.startsWith('wind-')?60:200)*60*4;record({kind:'level-observation',node:next.id,actual:snapshot.level,target:regionTargetLevel,error:snapshot.level-regionTargetLevel,atSeconds:elapsed,numericTargetMet:snapshot.level===regionTargetLevel});assert(elapsed<routeBudgetSeconds,'Route time exceeded 4x region target: '+next.id);
   attempted.set(next.id,(attempted.get(next.id)??0)+1);record({kind:'attempt',node:next.id,wallId,purpose:blocked&&next.id!==blocked?'cleared-node-resources':blocked?'same-stage-key-retry':'first-clear',attempt:attempted.get(next.id),repeat:attempted.get(next.id)!>1,keyStage:definition.numericStage,usedSeconds:used,budgetSeconds:budget,level:snapshot.level});
   let result;try{result=await dungeon(next.id,Math.min(budget-used,routeBudgetSeconds-elapsed));}catch(error){record({kind:'node-error',node:next.id,seed,error:String(error),attempt:attempted.get(next.id)});let seconds=0;if(activeInstance){const current=(await call('dungeons/'+activeInstance+'/result')).value.instance;seconds=(current.tick??0)/30;await command('leave',{instance_id:activeInstance});await command('return',{instance_id:activeInstance});activeInstance=undefined;live?.close();live=undefined;await state();await returnQueue();elapsed+=seconds;}result={success:false,seconds,limitReached:false,bug:true};}if(preflight)return {weapon,status:'preflight',nodes:0,daily:0};
   wallSeconds.set(wallId,used+result!.seconds);if(result!.limitReached){skipped.add(wallId);blocked=undefined;record({kind:'unmeasured-node',node:wallId,seed,reason:'4x wall budget exhausted'});continue;}if(blocked&&next.id!==blocked){failedAttempts.set(blocked,(failedAttempts.get(blocked)??0)+1);}else if(result!.success){blocked=undefined;failedAttempts.delete(next.id);}else{blocked=next.id;failedAttempts.set(next.id,(failedAttempts.get(next.id)??0)+1);if((result!.bug||numericDefects.has(next.id))&&failedAttempts.get(next.id)!>=2){skipped.add(next.id);blocked=undefined;record({kind:'unmeasured-node',node:next.id,seed,reason:result!.bug?'D-B4: two execution errors; no completion fabricated':'D-B4: confirmed N1 survival defect after two real defeats; unmeasured beyond this wall',numericDefect:numericDefects.get(next.id)});}}
  }
  record({kind:'coverage',completed:[...completed],unmeasured:[...skipped]});await state();const counts=(await pool.query('SELECT count(*)::int n FROM ow_hub_node_first_clears WHERE character=$1',[snapshot.id])).rows[0].n;assert(counts===completed.size,'First-clear ledger differs from actual completed nodes');const daily=(await pool.query('SELECT count(*)::int n FROM ow_hub_daily_node_clears WHERE character=$1',[snapshot.id])).rows[0].n;assert(daily===Math.min(10,counts),'Daily first-clear count differs from successful distinct nodes');record({kind:'route-ledger',nodes:counts,daily,skippedByFreeze:0,unmeasured:[...skipped],level:snapshot.level});assert(completed.size===20,'Not all twenty nodes cleared');assert(completed.has('mist-gate'),'Mist gate not cleared');assert(snapshot.starsea?.done.includes('ss-c01-n01'),'Stargate tutorial not completed by real departure');record({kind:'complete',nodes:counts,daily,skippedByFreeze:0,level:snapshot.level});return {weapon,status:'passed',nodes:counts,daily};
 }catch(error){const reason=error instanceof Error?error.message:String(error);record({kind:'failed',node:lastNode,reason});saveMeasurement();return {weapon,status:'failed',node:lastNode,reason};}
 finally{writeFileSync(evidence+'/'+weapon+'.json',JSON.stringify({weapon,versions,clock:'server simulation / real executor',steps},null,2));live?.close();await app.close();await pool.end();await owner.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await owner.end();}
}
const results=[];let runtimeNumbersStable=true;
for(const weapon of weapons){const result=await runRoute(weapon),afterHash=await hubRuntimeNumbersHash();
 if(afterHash!==measurement.runtimeNumbersHash){runtimeNumbersStable=false;const failure={...result,status:'failed',reason:'Runtime numeric configuration changed during acceptance'};results.push(failure);writeFileSync(evidence+'/runtime-numbers-drift.json',JSON.stringify({before:measurement.runtimeNumbersHash,after:afterHash,weapon},null,2));console.log(JSON.stringify(failure));break;}
 results.push(result);console.log(JSON.stringify(result));
}
writeFileSync(evidence+'/summary.json',JSON.stringify({versions,runtimeNumbersStable,results},null,2));if(!runtimeNumbersStable||results.length!==weapons.length||results.some(x=>x.status!=='passed'&&!(preflight&&x.status==='preflight')))process.exitCode=1;
