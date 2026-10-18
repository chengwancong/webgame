import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {tasks,steps,conditions} from '../packages/content/task-tables.ts';
import {starseaMap} from '../packages/content/starsea/index.ts';
import {engineDefense} from '../packages/content/starsea/defense.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState,Snapshot,Spawn,Permit,Vec} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL is required');
const owner=new Pool({connectionString:dsn}),schema='qa_island_story_'+randomUUID().replaceAll('-',''),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});let app=createApp(pool,{testLogin:true,dungeons:false});
const requestedChapter=Number(process.env.AW_ISLAND_CHAPTER)||undefined,islands=worldTables.islands.filter(i=>i.chapter>1&&(!requestedChapter||i.chapter===requestedChapter)),evidence:Record<string,unknown[]>={};
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();for(const island of islands){const out='docs/reviews/open-world-m2-m4/W'+(island.chapter+3);await mkdir(out,{recursive:true});await writeFile(out+'/story-driver.json',JSON.stringify({realWorld:true,realPostgres:true,scope:'Controlled initial level50 and equipped attack/armour10000 for flow and source/reward protection; authored maps, enemies, skills and steps are retained. This is not natural pacing.',evidence:evidence[island.region]??[]},null,2));}});
async function player(region:string){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'storydriver_'+randomUUID().replaceAll('-','').slice(0,16)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 let lease='',renewed=0;const clientId=randomUUID();
 const request=async(path:string,body?:unknown)=>{if(lease&&Date.now()-renewed>15000){const control=await app.inject({method:'POST',url:'/api/control',headers:{cookie},payload:{client_id:clientId}});expect(control.statusCode,control.body).toBe(200);lease=control.json().lease_id;renewed=Date.now();if(body&&typeof body==='object'&&'lease_id' in body)body={...body,lease_id:lease};}const response=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});expect(response.statusCode,response.body).toBe(200);return response.json();};
 let snapshot=await request('character',{name:'岛屿乱序驾驶器'}) as Snapshot;lease=(await request('control',{client_id:clientId})).lease_id;renewed=Date.now();
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[snapshot.id])).rows[0].state as CharacterState;state.level=50;state.gear.find(g=>g.id===state.equipment.weapon)!.attack=10000;state.gear.find(g=>g.id===state.equipment.armor)!.armor=10000;state.skills=['cut','whirl','ward'];state.skillRanks={cut:5,whirl:5,ward:5};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,snapshot.id]);
 const reload=async()=>snapshot=await request('character') as Snapshot;await reload();
 const command=async(op:string,body:object={})=>{const payload={command_id:randomUUID(),revision:snapshot.revision,lease_id:lease,op,region,...body},receipt=await request('quest',payload);snapshot=receipt.snapshot;return {receipt,payload};};
 const at=(key:string)=>{const found=starseaMap(region).landmarks.find(p=>p.id===key);if(!found)throw Error('Missing declared landmark '+region+'/'+key);return found;};
 let permit:Permit|undefined=await request('permit',{lease_id:lease,region}) as Permit;
 async function combat(spawns:Spawn[],position:Vec,map=region,defend=false,issued?:Permit){
  if(issued)permit=issued;
  if(!permit||permit.region!==map)permit=await request('permit',{lease_id:lease,region:map,attempt_id:randomUUID()}) as Permit;
  if(permit.build!==snapshot.build)permit=await request('permit',{lease_id:lease,region:map,position}) as Permit;
  const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[snapshot.id])).rows[0].state as CharacterState,build=resolveBuild(state),world=new World(regionById(map),build.stats,build.resolvedSkills,spawns,[],41);world.hero.position={...position};world.setMode('auto');world.radius=40;
  if(defend)world.defense={position:{...position},hp:engineDefense.hp,maxHp:engineDefense.hp,radius:engineDefense.radius,requiredTicks:engineDefense.holdTicks,heldTicks:0,enemyIds:spawns.map(s=>s.id),complete:false,failed:false};
  const start=Date.now();for(let tick=0;tick<7200&&world.hero.hp>0&&(world.enemies.some(e=>e.alive)||defend&&!world.defense!.complete);tick++)world.step();expect(world.hero.hp).toBeGreaterThan(0);expect(new Set(world.kills.map(k=>k.source_id))).toEqual(new Set(spawns.map(s=>s.id)));if(defend)expect(world.defense!.complete).toBe(true);
  // 驾驶器按真实客户端心跳续租，长战斗不因45秒租约过期误报。
  while(Date.now()-start<world.tick/30*1000){await new Promise(r=>setTimeout(r,Math.min(10000,world.tick/30*1000-(Date.now()-start))));await request('control/renew',{lease_id:lease});}
  const payload={command_id:randomUUID(),revision:snapshot.revision,lease_id:lease,permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+world.tick,kills:world.kills.map(k=>({...k,tick:permit!.from_tick+k.tick})),position:world.hero.position},receipt=await request('combat/report',payload);snapshot=receipt.snapshot;permit.sequence++;permit.from_tick=payload.to_tick;
  expect(await request('combat/report',payload)).toEqual(receipt);return {ticks:world.tick,kills:world.kills.length,receipt:receipt.command_id};
 }
 async function gate(){const row=worldTables.gates.find(g=>g.map===region)!;if(snapshot.starsea!.gates.includes(row.id))return;const p=at(row.landmark);const started=await command('gate',{gate:row.id,position:p}),spawns=started.receipt.snapshot.starsea.wave.spawns;await combat(spawns,p);expect(snapshot.starsea!.gates).toContain(row.id);}
 async function camp(id:string){const row=worldTables.camps.find(c=>c.id===id)!;if(!permit||permit.region!==region)permit=await request('permit',{lease_id:lease,region}) as Permit;const view=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:{x:row.x,y:row.y}}),cycle=view.camps.find((c:any)=>c.id===id);expect(cycle).toBeTruthy();await combat(cycle.spawns,{x:row.x-5,y:row.y});expect(snapshot.starsea!.clearedCamps).toContain(id);}
 async function task(id:string){
  const row=tasks.find(t=>t.id===id)!;if(snapshot.starsea!.done.includes(id))return;
  if(!snapshot.starsea!.quests[id]){const first=steps.filter(s=>s.task===id).sort((a,b)=>a.seq-b.seq)[0],key=row.discover_landmark??row.accept_landmark??first.landmark!;
   if(row.accept_mode==='discover'||row.accept_mode==='arrive')await command(row.accept_mode,{target:key,position:at(key)});else if(row.accept_mode==='talk'){
    const map=row.accept_map??first.map,position=map==='ss-map-port'?{x:23,y:12}:at(key);if(map===region){await command('arrive',{target:key,position});const npc=snapshot.starseaView!.npcPositions.find(n=>n.npc===(row.accept_npc??row.giver));expect(npc,'Talk giver must be visible before acceptance '+id).toBeTruthy();expect(npc!.map).toBe(map);expect(Math.hypot(npc!.x-position.x,npc!.y-position.y)).toBeLessThanOrEqual(2);}
    await command('accept',{task:id,region:map,position});
   }else await reload();
  }
  for(let guard=0;guard<24&&!snapshot.starsea!.done.includes(id);guard++){
   const current=snapshot.starseaView!.quests.find(q=>q.id===id);expect(current,'Task unavailable '+id).toBeTruthy();const step=current!.step,rowStep=steps.find(s=>s.task===id&&s.seq===step.seq)!,p=step.points[0];
   if(rowStep.op==='clear_camp')await camp(rowStep.camp!);
   else if(rowStep.op==='gate')await gate();
   else if(rowStep.op==='reach_waypoint')await command('waypoint',{target:rowStep.key,position:p});
   else if(step.op==='talk')await command('talk',{task:id,region:step.map,position:p});
   else if(step.op==='boss'){const issued=await request('permit',{lease_id:lease,region:step.map,attempt_id:randomUUID()}) as Permit;await combat(issued.spawns,regionById(step.map).safe,step.map,false,issued);}
   else if(step.op==='interact')await command('interact',{task:id,target:p.id,region:step.map,position:p});
   else if(step.op==='choose'||step.op==='wave'){
    const choice=step.op==='choose'?'a':undefined,start=step.op==='choose'?step.points[0]:p,started=await command('start',{task:id,region:step.map,position:start,...choice?{choice}:{}}),wave=started.receipt.snapshot.starsea.wave;await combat(wave.spawns,start,step.map,rowStep.op==='defend');if(rowStep.op==='defend')await command('defense-finish',{task:id});
   }else throw Error('Unhandled real step '+rowStep.op);
  }
  expect(snapshot.starsea!.done).toContain(id);const done=structuredClone(snapshot.starsea!.done);await reload();expect(snapshot.starsea!.done).toEqual(done);
 }
 return {request,reload,command,at,combat,gate,camp,task,lease,get snapshot(){return snapshot;}};
}
const permutations=<T>(values:T[]):T[][]=>values.length?values.flatMap((value,i)=>permutations(values.filter((_,j)=>j!==i)).map(rest=>[value,...rest])):[[]];
for(const island of islands){const chapter='ss-c0'+island.chapter,story=tasks.filter(t=>t.chapter===chapter&&t.series==='isle-'+island.chapter),branches=['A','B','C'].filter(thread=>story.some(t=>t.thread===thread));evidence[island.region]=[];
 if(island.chapter===6)it('real victories across the six islands unlock every configured final-phase waypoint, retire only authored invasion camps and allow later camp-fact quests without invented kills',async()=>{
  const p=await player(island.region),other=await player(island.region);for(const row of worldTables.islands.sort((a,b)=>a.chapter-b.chapter)){const map='ss-map-boss-'+row.chapter,issued=await p.request('permit',{lease_id:p.lease,region:map,attempt_id:randomUUID()}) as Permit;await p.combat(issued.spawns,regionById(map).safe,map,false,issued);}
  await p.reload();await other.reload();const retired=worldTables.camps.filter(c=>c.until==='ow-global-war-over'),waypoints=worldTables.waypoints.filter(w=>w.unlockWhen==='ow-global-war-over');expect(retired.some(c=>p.snapshot.worldView!.camps.includes(c.id))).toBe(false);expect(retired.every(c=>other.snapshot.worldView!.camps.includes(c.id))).toBe(true);for(const waypoint of waypoints){expect(p.snapshot.starsea!.waypoints).toContain(waypoint.id);expect(p.snapshot.world!.waypoints).toContain(waypoint.id);}
  const task=tasks.find(t=>t.series==='ow-dragon-regional'&&steps.some(s=>s.task===t.id&&s.op==='clear_camp'&&retired.some(c=>c.id===s.camp)))!,sourcesBefore=(await pool.query('SELECT source FROM ow_kills WHERE character=$1 ORDER BY source',[p.snapshot.id])).rows.map(r=>r.source);expect(task).toBeTruthy();await p.command('arrive',{target:task.accept_landmark,position:p.at(task.accept_landmark!)});await p.command('accept',{task:task.id,position:p.at(task.accept_landmark!)});const current=p.snapshot.starseaView!.quests.find(q=>q.id===task.id)!;expect(steps.find(s=>s.task===task.id&&s.seq===current.step.seq)!.op).not.toBe('clear_camp');expect((await pool.query('SELECT source FROM ow_kills WHERE character=$1 ORDER BY source',[p.snapshot.id])).rows.map(r=>r.source)).toEqual(sourcesBefore);
  const before=structuredClone(p.snapshot.worldView);await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();await p.reload();expect(p.snapshot.worldView).toEqual(before);evidence[island.region].push({case:'global finale phase',actualBosses:p.snapshot.starsea!.bosses,retiredCamps:retired.map(c=>c.id),unlockedWaypoints:waypoints.map(w=>w.id),lateCampFactTask:task.id,noInventedKills:true,reconnectSame:true});
 },180000);
 it(island.name+' follows all real clue orders and confirms convergence and rewards without duplicate history',async()=>{
  for(const order of permutations(branches)){const p=await player(island.region),completed:string[]=[];for(const thread of order){for(const row of story.filter(t=>t.thread===thread).sort((a,b)=>a.order-b.order))await p.task(row.id);completed.push(thread);const converge=story.filter(t=>t.thread==='converge').sort((a,b)=>a.order-b.order)[0];const required=(await import('../packages/content/task-tables.ts')).conditions.filter(c=>c.target===converge.id&&c.kind==='task'),eligible=[...new Set(required.map(c=>c.group))].some(group=>required.filter(c=>c.group===group).every(c=>p.snapshot.starsea!.done.includes(c.value)));expect(Boolean(p.snapshot.starsea!.quests[converge.id]||p.snapshot.starsea!.done.includes(converge.id))).toBe(eligible);}
   for(const row of story.filter(t=>t.thread==='converge').sort((a,b)=>a.order-b.order))await p.task(row.id);const positions=p.snapshot.starseaView!.npcPositions;expect(new Set(positions.map(p=>p.npc)).size).toBe(positions.length);const archive=(await pool.query("SELECT state->'taskJournal'->'archive' archive FROM ow_characters WHERE id=$1",[p.snapshot.id])).rows[0].archive;expect(new Set(archive.map((entry:any)=>entry.taskId)).size).toBe(archive.length);evidence[island.region].push({case:'all clue orders',order,done:p.snapshot.starsea!.done,npcUnique:true,archivesUnique:true});
  }
 },900000);
 it(island.name+' opens its gate and boss without optional quests, preserves individual phase and reconnect, and takes regional quests in parallel',async()=>{
  const one=await player(island.region),two=await player(island.region);expect(one.snapshot.starsea!.done).toEqual([]);await one.gate();expect(one.snapshot.starsea!.done).toEqual([]);const map='ss-map-boss-'+island.chapter,permit=await one.request('permit',{lease_id:one.lease,region:map,attempt_id:randomUUID()}) as Permit;await one.combat(permit.spawns,regionById(map).safe,map,false,permit);await one.reload();await two.reload();expect(one.snapshot.starsea!.bosses).toContain(map);expect(two.snapshot.starsea!.bosses).not.toContain(map);expect(one.snapshot.worldView).not.toEqual(two.snapshot.worldView);
  const phase=conditions.find(c=>c.target==='ow-'+island.artIsland+'-boss-cleared')!,old={kind:phase.kind,value:phase.value},originalView=structuredClone(one.snapshot.worldView);if(worldTables.camps.some(c=>c.region===island.region&&c.until===phase.target))try{phase.kind='level';phase.value=String(Math.max(one.snapshot.level,two.snapshot.level)+1);await one.reload();expect(one.snapshot.worldView).not.toEqual(originalView);}finally{phase.kind=old.kind;phase.value=old.value;}
  await one.reload();const hidden=worldTables.camps.filter(c=>c.region===island.region&&c.until===phase.target).map(c=>c.id);expect(hidden.some(id=>one.snapshot.worldView!.camps.includes(id))).toBe(false);expect(hidden.every(id=>two.snapshot.worldView!.camps.includes(id))).toBe(true);
  for(const merchant of worldTables.merchants.filter(m=>m.region===island.region&&m.when===phase.target)){expect(one.snapshot.worldView!.merchants.map(m=>m.id)).toContain(merchant.id);expect(two.snapshot.worldView!.merchants.map(m=>m.id)).not.toContain(merchant.id);expect(one.snapshot.starseaView!.npcPositions.some(p=>p.npc===merchant.npc&&p.map===island.region)).toBe(true);}
  await one.reload();const before=structuredClone(one.snapshot.worldView);await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();await one.reload();expect(one.snapshot.worldView).toEqual(before);
  const regional=tasks.filter(t=>t.series==='ow-'+island.artIsland+'-regional').slice(0,5);for(const row of regional){await two.command('arrive',{target:row.accept_landmark,position:two.at(row.accept_landmark!)});await two.command('accept',{task:row.id,position:two.at(row.accept_landmark!)});}for(const row of regional)expect(two.snapshot.starsea!.quests).toHaveProperty(row.id);await two.command('track',{task:regional.at(-1)!.id});expect(two.snapshot.starsea!.tracked).toBe(regional.at(-1)!.id);await two.command('track',{task:null});expect(two.snapshot.starseaView!.recommend).toBeTruthy();evidence[island.region].push({case:'no quest gate/boss fallback and parallel quests',phaseReconnect:true,regionalTasks:regional.map(t=>t.id),firstBoss:true});
 },180000);
}
