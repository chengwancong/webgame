import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {tasks,steps} from '../packages/content/task-tables.ts';
import {starseaMap,starseaBossMaps,bossLevels} from '../packages/content/starsea/index.ts';
import {resolveBuild,gearContribution} from '../packages/rules/index.ts';
import {gearWeaponType} from '../packages/rules/weapon-skills.ts';
import {talentDefinitions} from '../packages/content/deep-progression.ts';
import {engineDefense} from '../packages/content/starsea/defense.ts';
import type {Snapshot,CharacterState,Permit,Spawn,Vec} from '../packages/contracts/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {collectionSetIdentity} from '../packages/content/set-effects.ts';
const combatSeed=Number(process.env.AW_CALENDAR_SEED??41);if(!Number.isSafeInteger(combatSeed))throw Error('自然日程种子必须是整数');
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Natural calendar requires real PostgreSQL');

it('runs earned-only farming and task-attempt calendars through World/PG; reconnect and every source remain consistent',async()=>{
 const owner=new Pool({connectionString:dsn}),schema='qa_calendar_'+randomUUID().replaceAll('-',''),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});await owner.query('CREATE SCHEMA '+schema);await migrate(pool);let app=createApp(pool,{testLogin:true});await app.listen({host:'127.0.0.1',port:0});const results:any[]=[];
 const wallNow=Date.now.bind(Date),realStarted=performance.now();let clock=wallNow();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clock);
 try{for(const strategy of ['no-quests','attempt-all-tasks'].filter(s=>!process.env.AW_CALENDAR_STRATEGY||s===process.env.AW_CALENDAR_STRATEGY)){
  clock=wallNow();const observations={earnedGold:0,spentGold:0,earnedMaterial:0,spentMaterial:0,earnedXp:0,issuedGear:0,qualities:{} as Record<string,number>,acquiredSetIds:[] as string[]},seenGear=new Set<string>(),seenReceipts=new Set<string>();const began=clock,events:any[]=[],milestones:any[]=[],encountered=new Map<string,number>(),failures:any[]=[];
  const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'calendar_'+randomUUID().replaceAll('-','').slice(0,16)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
  const request=async(path:string,body?:object)=>{vi.setSystemTime(clock);const r=await app.inject({method:body?'POST':'GET',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
  let s=(await request('character',{name:'自然日程驾驶器'})).body as Snapshot,lease='',lastLevel=s.level,position:Vec=regionById(worldTables.islands[0].region).safe,currentRegion=worldTables.islands[0].region,stalled=0;
  const initial=structuredClone(s);for(const g of initial.gear)seenGear.add(g.id);let consideredGear=new Set<string>(),gearEvaluationLevel=0;
  const refresh=async()=>{const control=(await request('control',{client_id:s.id})).body;lease=control.lease_id;await pool.query('UPDATE ow_controls SET expires=$1 WHERE character=$2 AND lease=$3',[control.expires_at,s.id,lease]);s=(await request('character')).body;};
  const command=async(path:string,body:object)=>{const payload={command_id:randomUUID(),...(path==='dungeons/command'?{}:{revision:s.revision}),lease_id:lease,...body},r=await request(path,payload);if(r.status===200&&r.body.snapshot)s=r.body.snapshot;if(r.status===200&&r.body.delta&&!seenReceipts.has(payload.command_id)){seenReceipts.add(payload.command_id);const d=r.body.delta;observations.earnedGold+=Math.max(0,d.gold??0);observations.spentGold+=Math.max(0,-(d.gold??0));observations.earnedMaterial+=Math.max(0,d.material??0);observations.spentMaterial+=Math.max(0,-(d.material??0));observations.earnedXp+=Math.max(0,d.xp??0);for(const reward of r.body.rewards??[]){const g=reward.gear;if(seenGear.has(g.id))continue;seenGear.add(g.id);observations.issuedGear++;observations.qualities[g.quality]=(observations.qualities[g.quality]??0)+1;if(g.setId){const id=collectionSetIdentity(g.setId);if(!observations.acquiredSetIds.includes(id))observations.acquiredSetIds.push(id);}}}return {...r,payload};};
  const quest=(op:string,body:object={})=>command('quest',{op,region:currentRegion,...body});
  async function activity(kind:'chest'|'event'|'rare',target:string){
   const rows=kind==='chest'?worldTables.chests:kind==='event'?worldTables.events:worldTables.rares,row=rows.find(r=>r.id===target);if(!row)return false;const history=(await request('field/activity')).body.activities.find((a:any)=>a.target===target),spot='spots' in row?row.spots[(history?.attempt??0)%row.spots.length]:row;
   clock+=Math.hypot(position.x-spot.x,position.y-spot.y)/Math.max(1,s.stats.speed)*1000;await refresh();const start=await command('field/activity/start',{kind,region:row.region,target,position:{x:spot.x,y:spot.y}});if(start.status!==200){failures.push({target,code:start.body.code});return false;}
   let active=(await request('field/activity')).body.activities.find((a:any)=>a.target===target);for(let tick=0;tick<100&&active?.status==='running';tick++){clock+=10000;await refresh();const next=await request('field/activity/input',{lease_id:lease,instance:active.instance,mode:'auto'});active=next.body.activity;}
   if(active?.status==='success'||active?.status==='ready'){const paid=await command('field/activity/claim',{instance:active.instance});expect(paid.status,JSON.stringify(paid.body)).toBe(200);events.push({kind,target,receipt:paid.payload.command_id,delta:paid.body.delta,gear:paid.body.rewards?.map((r:any)=>({quality:r.gear.quality,slot:r.gear.slot}))});return true;}failures.push({target,status:active?.status,reason:active?.reason});return false;
  }
  async function dungeon(id:string){
   await refresh();const entered=await command('dungeons/command',{op:'create',dungeon_id:id});if(entered.status!==200){failures.push({dungeon:id,code:entered.body.code});return false;}const instance=entered.body.instance.id;let socket:WebSocket|undefined,frame:any,seq=0;
   try{socket=new WebSocket('ws://127.0.0.1:'+((app.server.address() as any).port)+'/api/dungeons/'+instance+'/live',{headers:{cookie}});socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='state')frame=message.instance;});await new Promise<void>((resolve,reject)=>{socket!.once('open',resolve);socket!.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:lease}));for(let n=0;n<100&&!frame;n++)await new Promise(r=>setTimeout(r,20));await command('dungeons/command',{op:'ready',instance_id:instance});const started=await command('dungeons/command',{op:'start',instance_id:instance});expect(started.status,JSON.stringify(started.body)).toBe(200);const advanced=new Set<number>();
    for(let n=0;n<1800&&!['success','failed'].includes(frame?.status);n++){clock+=1000;await refresh();socket.send(JSON.stringify({type:'input',input:{seq:++seq,kind:'mode',mode:'auto'}}));await new Promise(r=>setTimeout(r,35));if(frame?.checkpoint&&!advanced.has(frame.stage)){const stage=frame.stage;await command('dungeons/command',{op:'ready',instance_id:instance});const next=await command('dungeons/command',{op:'next',instance_id:instance});if(next.status===409&&next.body.code==='DUNGEON_CLOSED'){const terminal=await request('dungeons/'+instance+'/result');expect(terminal.status).toBe(200);expect(['success','failed','abandoned','closed']).toContain(terminal.body.instance?.status);break;}expect(next.status,JSON.stringify(next.body)).toBe(200);advanced.add(stage);}}
    const result=(await request('dungeons/'+instance+'/result')).body;events.push({kind:'dungeon',id,status:result.instance.status,ticks:result.instance.tick,reason:result.instance.reason});await command('dungeons/command',{op:result.instance.status==='running'?'leave':'return',instance_id:instance});return result.instance.status==='success';
   }finally{socket?.close();}
  }
  const grow=async()=>{
   for(const slot of [...new Set(s.gear.map(g=>g.slot))]){const old=s.gear.find(g=>g.id===s.equipment[slot]),family=old&&slot==='weapon'?gearWeaponType(old):null,candidates=s.gear.filter(g=>g.slot===slot&&(g.requiredLevel??1)<=s.level&&(slot!=='weapon'||gearWeaponType(g)===family));
    // Declared simple player policy: prefer higher effective primary stats,
    // retaining the current weapon family. It is not an omniscient BD search.
    const score=(g:typeof s.gear[number])=>{const copy=structuredClone(s);copy.equipment[slot]=g.id;const b=resolveBuild(copy);return b.resolvedSkills.filter(sk=>sk.damage>0).reduce((sum,sk)=>sum+sk.damage/Math.max(1,sk.cooldown),0)*Math.sqrt(b.stats.hp*(1+b.stats.armor));};
    const fresh=candidates.filter(g=>gearEvaluationLevel!==s.level||!consideredGear.has(g.id)||g.id===old?.id);candidates.splice(0,candidates.length,...fresh);
    const best=candidates.sort((a,b)=>score(b)-score(a))[0];if(best&&best.id!==old?.id)await command('gear/equip',{gear_id:best.id});
   }
   consideredGear=new Set(s.gear.map(g=>g.id));gearEvaluationLevel=s.level;
   for(const access of s.skillAccess.filter(a=>s.skills.includes(a.id)))for(let guard=0;guard<6;guard++){const r=await command('skills/upgrade',{skill_id:access.id});if(r.status!==200)break;}
   for(const gear of s.gear.filter(g=>Object.values(s.equipment).includes(g.id)))for(let guard=0;guard<12;guard++){const r=await command('gear/upgrade',{gear_id:gear.id,region:'ss-map-port',position:{x:19,y:20}});if(r.status!==200)break;}
   const progression=(await request('progression')).body,talent=progression.sections.flatMap((section:any)=>section.items.flatMap((item:any)=>item.operations)).find((operation:any)=>operation.enabled&&operation.action.op==='talent.learn');if(talent)await command('progression/action',{action:talent.action});
   if(s.rewards.length){const preview=await request('gear/salvage-batch/preview');if(preview.status===200&&preview.body.gear.length)await command('gear/salvage-batch',{gear_ids:preview.body.gear.map((g:any)=>g.id)});await command('reward/claim-many',{reward_ids:s.rewards.slice(0,20).map(r=>r.id)});}
  };
  async function fight(spawns:Spawn[],permit:Permit,start:Vec,defend=false){
   const before=s,build=resolveBuild(s as CharacterState),w=new World(regionById(permit.region),build.stats,build.resolvedSkills,spawns,[],combatSeed);w.hero.position={...start};w.setMode('auto');w.radius=40;let casts=0;
   expect(permit.build,'permit and executed build revision').toBe(before.build);expect(build.resolvedSkills.map(sk=>sk.id),'requested and executed natural build').toEqual(before.skills);for(const id of before.skills)expect(before.skillRanks[id],'explicit earned rank '+id).toBeGreaterThan(0);
   if(defend)w.defense={position:{...start},hp:s.starsea!.wave?.defense?.hp??engineDefense.hp,maxHp:s.starsea!.wave?.defense?.hp??engineDefense.hp,radius:s.starsea!.wave?.defense?.radius??engineDefense.radius,requiredTicks:s.starsea!.wave?.defense?.holdTicks??engineDefense.holdTicks,heldTicks:0,enemyIds:spawns.map(e=>e.id),complete:false,failed:false};
   for(let tick=0;tick<180*30&&w.hero.hp>0&&w.enemies.some(e=>e.alive);tick++){w.step();casts+=w.events.filter(e=>e.type==='cast_started'&&e.id===w.playerId).length;}
   clock+=w.tick/30*1000;await refresh();const issued=await request('permit',{lease_id:lease,region:permit.region,position:w.hero.position});if(issued.status!==200)throw Error(JSON.stringify(issued));permit=issued.body;
   const r=await command('combat/report',{permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+w.tick,kills:w.kills.map(k=>({...k,tick:k.tick+permit.from_tick})),position:w.hero.position});expect(r.status,JSON.stringify(r.body)).toBe(200);expect((await request('combat/report',r.payload)).body).toEqual(r.body);
   position=w.hero.position;events.push({region:permit.region,levelBefore:before.level,levelAfter:s.level,minutes:(clock-began)/60000,seconds:w.tick/30,kills:w.kills.length,dead:w.hero.hp<=0,casts,receipt:r.payload.command_id,combatSeed,permitSeed:permit.seed,permitRules:permit.rules,runtimeRules:versions.rules,requestedEquipment:Object.values(before.equipment),gearRanks:before.gear.filter(g=>Object.values(before.equipment).includes(g.id)).map(g=>({id:g.id,rank:g.rank,level:g.requiredLevel})),executedStats:{hp:build.stats.hp,attack:build.stats.attack,armor:build.stats.armor,weapon:build.stats.weapon},requestedSkills:before.skills,skillRanks:before.skillRanks,actualSkills:build.resolvedSkills.map(sk=>sk.id)});
   if(starseaBossMaps.includes(permit.region)&&w.enemies.every(e=>!e.alive)&&w.hero.hp>0)milestones.push({boss:permit.region,level:s.level,minutes:(clock-began)/60000});
   // Explicit recovery pause. This is a virtual server-clock calendar, not a
   // wall-clock or unattended sustainable farming claim.
   clock+=35000;return w.enemies.every(e=>!e.alive)&&w.hero.hp>0&&(!defend||w.defense!.complete&&!w.defense!.failed);
  }
  for(let round=0;round<900&&s.level<50&&(clock-began)<40*3600000;round++){
   await refresh();const next=worldTables.islands.filter(i=>s.starsea!.islands.includes(i.region)&&Math.min(...worldTables.zones.filter(z=>z.region===i.region).map(z=>z.levelBand[0]))<=s.level+1).sort((a,b)=>b.chapter-a.chapter)[0];if(currentRegion!==next.region){currentRegion=next.region;position=regionById(currentRegion).safe;milestones.push({region:currentRegion,level:s.level,minutes:(clock-began)/60000});}
   if(s.level!==lastLevel){await grow();lastLevel=s.level;milestones.push({level:s.level,minutes:(clock-began)/60000,features:s.starsea!.features,islands:s.starsea!.islands});}
   if(strategy==='attempt-all-tasks'){
    const offer=s.starseaView!.available.find(q=>q.map===currentRegion);if(offer){clock+=Math.hypot(position.x-offer.x,position.y-offer.y)/Math.max(1,s.stats.speed)*1000;await refresh();const row=tasks.find(t=>t.id===offer.task)!,point={x:offer.x,y:offer.y};if(row.accept_mode==='arrive'||row.accept_mode==='discover')await quest(row.accept_mode,{target:row.discover_landmark??row.accept_landmark,position:point});else await quest('accept',{task:row.id,position:point});}
    const active=s.starseaView!.quests.find(q=>q.step.map===currentRegion),point=active?.step.points[0];if(active&&point){const row=steps.find(st=>st.task===active.id&&st.seq===active.step.seq),spot={x:point.x,y:point.y};if(row?.op==='reach_waypoint')await quest('waypoint',{target:row.key,position:spot});
    else if(row?.op==='clear_camp'){const target=worldTables.camps.find(c=>c.id===row.camp);if(target){position={x:target.x,y:target.y};encountered.set(target.id,-1);}}
    else if(row?.op==='gate'){const gate=worldTables.gates.find(g=>g.id===row.gate)!;await refresh();const permit=(await request('permit',{lease_id:lease,region:currentRegion})).body as Permit,r=await quest('gate',{gate:gate.id,position:spot});if(r.status===200&&s.starsea!.wave)await fight(s.starsea!.wave.spawns.filter(e=>!s.starsea!.wave!.killed.includes(e.id)),permit,spot);}
    else if(row?.op==='clear_dungeon')await dungeon(row.key);
    else if(row?.op==='open_chest'||row?.op==='complete_event'||row?.op==='kill_rare')await activity(row.op==='open_chest'?'chest':row.op==='complete_event'?'event':'rare',row.key);
    else if(row?.op==='discover_zone')await quest('arrive',{target:row.landmark??row.key,position:spot});
    else if(['talk','interact'].includes(active.step.op)){clock+=Math.hypot(position.x-point.x,position.y-point.y)/Math.max(1,s.stats.speed)*1000;await refresh();const r=await quest(active.step.op,{task:active.id,target:point.id,position:spot});if(r.status!==200)failures.push({task:active.id,op:active.step.op,code:r.body.code});}
    else if(['wave','choose'].includes(active.step.op)){
     await refresh();const permit=(await request('permit',{lease_id:lease,region:currentRegion})).body as Permit,r=await quest('start',{task:active.id,position:spot,...active.step.op==='choose'?{choice:'a'}:{}});if(r.status===200){const wave=s.starsea!.wave!,live=wave.spawns.filter(e=>!wave.killed.includes(e.id));if(await fight(live,permit,spot,row?.op==='defend')&&row?.op==='defend')await quest('defense-finish',{task:active.id});}else failures.push({task:active.id,op:'start',code:r.body.code});
    }
   }
   }
   const visible=new Set(s.worldView!.camps),eligible=worldTables.camps.filter(c=>c.region===currentRegion&&visible.has(c.id)&&worldTables.zones.find(z=>z.id===c.zone)!.levelBand[0]<=s.level+1),camp=eligible.sort((a,b)=>(encountered.get(a.id)??0)-(encountered.get(b.id)??0)||Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0];if(!camp){failures.push({reason:'no accessible authored camp',level:s.level});break;}
   const distance=Math.hypot(position.x-camp.x,position.y-camp.y);clock+=distance/Math.max(1,s.stats.speed)*1000;await refresh();
   // Advance only real, already-confirmed cooldown rows in this isolated fixture.
   await pool.query("UPDATE ow_camp_cycles SET cleared_at=now()-interval '91 seconds' WHERE character=$1 AND cleared_at IS NOT NULL",[s.id]);
   const authorization=await request('permit',{lease_id:lease,region:currentRegion,position:{x:camp.x,y:camp.y}});expect(authorization.status,JSON.stringify(authorization.body)).toBe(200);const permit=authorization.body as Permit,near=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:{x:camp.x,y:camp.y}});expect(near.status,JSON.stringify(near.body)).toBe(200);
   const cycle=near.body.camps.find((c:any)=>c.id===camp.id);if(!cycle?.spawns.length){encountered.set(camp.id,(encountered.get(camp.id)??0)+1);continue;}encountered.set(camp.id,(encountered.get(camp.id)??0)+1);
   const oldXp=s.xp,oldLevel=s.level;await fight(cycle.spawns,permit,{x:camp.x-5,y:camp.y});if(s.rewards.length||s.level!==oldLevel)await grow();stalled=s.xp===oldXp&&s.level===oldLevel?stalled+1:0;if(stalled>12){failures.push({reason:'earned-only route stalled',level:s.level});break;}
   if(round%8===0||s.level!==oldLevel)for(const [index,bossMap]of starseaBossMaps.entries())if(s.level>=bossLevels[index]-1&&s.starsea!.islands.includes(worldTables.islands.find(i=>i.chapter===index+1)!.region)&&!s.starsea!.bosses.includes(bossMap)){
    await refresh();const issued=await request('permit',{lease_id:lease,region:bossMap,attempt_id:randomUUID()});if(issued.status===200){await fight(issued.body.spawns,issued.body,regionById(bossMap).safe);currentRegion=next.region;position=regionById(currentRegion).safe;}
   }
   if(round%40===0)console.log(JSON.stringify({strategy,round,level:s.level,minutes:(clock-began)/60000,bosses:s.starsea!.bosses}));
  }
  await refresh();const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state,killSources=(await pool.query('SELECT source FROM ow_kills WHERE character=$1',[s.id])).rows;expect(new Set(killSources.map(k=>k.source)).size).toBe(killSources.length);expect(stored.level).toBe(s.level);expect(stored.gear).toEqual(s.gear);
  if(strategy==='no-quests')expect(events.some(e=>e.receipt)).toBe(true);
  milestones.push({level:s.level,minutes:(clock-began)/60000,worldTier:s.world?.worldTier,unlockedWorldTier:s.world?.unlockedWorldTier});
  const result={strategy,initial:{level:initial.level,gear:initial.gear,skills:initial.skills},finalState:stored,level:s.level,minutes:(clock-began)/60000,hardmode:s.starsea!.hardmode,bosses:s.starsea!.bosses,islands:s.starsea!.islands,done:s.starsea!.done,milestones,events,failures,observations};results.push(result);
  console.log(JSON.stringify({strategy,level:result.level,minutes:result.minutes,bosses:result.bosses,failures}));
 }
 }finally{vi.useRealTimers();await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();const out=process.env.AW_CALENDAR_OUT??'docs/reviews/open-world-m2-m4/W10';await mkdir(out,{recursive:true});await writeFile(out+'/natural-calendar'+(process.env.AW_CALENDAR_STRATEGY?'-'+process.env.AW_CALENDAR_STRATEGY:'')+'.json',JSON.stringify({versions,seed:combatSeed,actualRuntimeSeconds:(performance.now()-realStarted)/1000,realWorld:true,realPostgres:true,results,limits:['No character level, equipment, skill rank, wallet or reward grants. All progression is earned through actual commands and verified World kills.','Virtual server Date plus isolated already-confirmed camp cooldown aging accelerate waiting. Navigation between encounters and recovery are charged estimates, not GUI timing.','战斗种子由AW_CALENDAR_SEED指定；许可种子单列，私有掉落随机未固定。','Individual camp encounters exclude overlapping neighbouring fights. This is an optimistic route bound, not a sustainable unattended farming measurement.','The task calendar attempts reachable offered tasks; unsupported or unfinished steps remain visible. It cannot be called all-tasks completion unless recorded done IDs actually cover the authored calendar.']},null,2));}
},Number(process.env.AW_LONG_TEST_TIMEOUT_MS??600000));
