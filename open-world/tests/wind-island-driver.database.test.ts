import {reviewPath} from './review-path.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {tasks,steps} from '../packages/content/task-tables.ts';
import {conditions} from '../packages/content/task-tables.ts';
import {starseaMap} from '../packages/content/starsea/index.ts';
import type {CharacterState,Snapshot,Spawn,Permit,Vec} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Wind driver requires real temporary PostgreSQL');
const schema='qa_wind_driver_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});let app=createApp(pool,{testLogin:true,dungeons:false});
const evidence:unknown[]=[];
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();await mkdir(reviewPath('docs/reviews/open-world-m2-m4/W4'),{recursive:true});await writeFile(reviewPath('docs/reviews/open-world-m2-m4/W4/wind-driver.json'),JSON.stringify({realPostgres:true,realWorld:true,scope:'Controlled level50 / attack10000 initial build for quest-flow and settlement. Actual authored map, enemy levels, skills and rules are retained. This is not the natural story-level or pacing proof.',evidence},null,2));});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'wind_'+randomUUID().replaceAll('-','').slice(0,18)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const response=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});expect(response.statusCode,response.body).toBe(200);return response.json();};
 let s=await request('character',{name:'风栖流程驾驶器'}) as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).lease_id;
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state as CharacterState;state.level=50;state.gear.find(g=>g.id===state.equipment.weapon)!.attack=10000;state.skills=['cut','whirl','ward'];state.skillRanks={cut:5,whirl:5,ward:5};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,s.id]);s=await request('character');
 const reload=async()=>s=await request('character') as Snapshot;
 const write=async(path:string,body:object)=>{const command={command_id:randomUUID(),revision:s.revision,lease_id:lease,...body},receipt=await request(path,command);s=receipt.snapshot;return {command,receipt};};
 const quest=async(op:string,body:object={})=>write('quest',{op,region:'ss-map-wind',...body});
 return {request,reload,write,quest,lease,get s(){return s;}};
}
type Driver=Awaited<ReturnType<typeof player>>;
async function combat(p:Driver,permit:Permit,spawns:Spawn[],start:Vec){
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state as CharacterState,build=resolveBuild(state),region=regionById(permit.region),w=new World(region,build.stats,build.resolvedSkills,spawns,[],41);w.hero.position={...start};w.setMode('auto');w.radius=40;
 const began=Date.now();for(let i=0;i<1800&&w.enemies.some(e=>e.alive)&&w.hero.hp>0;i++)w.step();expect(w.hero.hp).toBeGreaterThan(0);expect(w.enemies.every(e=>!e.alive)).toBe(true);expect(w.kills).toHaveLength(spawns.length);
 const wait=Math.max(0,w.tick/30*1000-(Date.now()-began));if(wait)await new Promise(r=>setTimeout(r,wait));
 const result=await p.write('combat/report',{permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+w.tick,kills:w.kills.map(k=>({...k,tick:permit.from_tick+k.tick})),position:w.hero.position});permit.sequence++;permit.from_tick+=w.tick;
 evidence.push({region:permit.region,requestedSkills:state.skills,executedSkills:w.skills.map(sk=>sk.id),seed:41,ticks:w.tick,actualKills:w.kills.length,enemyLevels:spawns.map(m=>m.monster!.level),receipt:result.receipt.command_id});return result;
}
const mark=(id:string)=>starseaMap('ss-map-wind').landmarks.find(p=>p.id===id)!;
async function permit(p:Driver,region='ss-map-wind'){return await p.request('permit',{lease_id:p.lease,region,attempt_id:randomUUID()}) as Permit;}
async function signal(p:Driver){const at=mark('clue');await p.quest('discover',{target:'clue',position:at});const id=steps.find(s=>s.task==='ss-c01-n02'&&s.op==='clear_camp')!.camp!,camp=worldTables.camps.find(c=>c.id===id)!;
 const authorization=await permit(p),cycles=await p.request('field/camps',{lease_id:p.lease,permit_id:authorization.id,position:{x:camp.x,y:camp.y}}),cycle=cycles.camps.find((c:any)=>c.id===id);expect(cycle).toBeTruthy();await combat(p,authorization,cycle.spawns,{x:camp.x-5,y:camp.y});expect(p.s.starsea!.done).toContain('ss-c01-n02');}
async function route(p:Driver){await p.quest('arrive',{target:'route-fork',position:mark('route-fork')});await permit(p);const started=await p.quest('start',{task:'ss-c01-t04',choice:'a',position:mark('route-a')}),authorization=await permit(p);/* 选路即开第 4 技能位，构筑变了；客户端同样在构筑变化后重新取授权（main.ts） */const spawns=started.receipt.snapshot.starsea.wave.spawns;await combat(p,authorization,spawns,mark('route-a'));expect(p.s.starsea!.done).toContain('ss-c01-t04');}
it('runs both real parallel clue orders, exposes convergence only after A+B, and keeps task records unique on retry',async()=>{
 for(const order of [['signal','route'],['route','signal']]){const p=await player();const first=order[0]==='signal'?signal:route,second=order[1]==='signal'?signal:route;await first(p);expect(p.s.starsea!.quests).not.toHaveProperty('ss-c01-t05');await second(p);await p.reload();expect(p.s.starsea!.quests).toHaveProperty('ss-c01-t05');const before=p.s.starsea!.done.slice(),s=await p.reload();expect(s.starsea!.done).toEqual(before);const archive=(await pool.query("SELECT state->'taskJournal'->'archive' archive FROM ow_characters WHERE id=$1",[s.id])).rows[0].archive;for(const id of ['ss-c01-n02','ss-c01-t04'])expect(archive.filter((a:any)=>a.taskId===id)).toHaveLength(1);evidence.push({case:'parallel clue order',order,done:s.starsea!.done,uniqueDone:new Set(s.starsea!.done).size===s.starsea!.done.length,confirmedArchiveCount:archive.length});}
},60000);
it('takes five independent local quests in parallel, changes tracking, and keeps NPCs in one server-resolved position',async()=>{
 const p=await player();for(let z=1;z<=3;z++)await p.quest('arrive',{target:'ow-wind-resident'+z,position:mark('ow-wind-resident'+z)});
 for(const row of tasks.filter(t=>t.series==='ow-wind-regional').slice(0,5))await p.quest('accept',{task:row.id,position:mark(row.accept_landmark!)});
 const ids=Object.keys(p.s.starsea!.quests);expect(ids.length).toBeGreaterThanOrEqual(5);const tracked=ids.find(id=>id.startsWith('ow-wind-side-'))!;await p.quest('track',{task:tracked});expect(p.s.starsea!.tracked).toBe(tracked);await p.quest('track',{task:null});expect(p.s.starseaView!.recommend).toBeTruthy();const positions=p.s.starseaView!.npcPositions;expect(new Set(positions.map(n=>n.npc)).size).toBe(positions.length);evidence.push({case:'parallel5 and tracking',active:ids.length,npcPositions:positions,recommend:p.s.starseaView!.recommend});
});
it('settles actual camp and clue facts before accepting a regional task, then confirms one reward and archive',async()=>{
 const p=await player(),row=tasks.find(t=>t.id==='ow-wind-side-z1-1')!,npc=mark(row.accept_landmark!),camp=worldTables.camps.filter(c=>c.zone==='ow-wind-z1').sort((a,b)=>Math.hypot(a.x-125,a.y-185)-Math.hypot(b.x-125,b.y-185))[0];
 const authorization=await permit(p),cycles=await p.request('field/camps',{lease_id:p.lease,permit_id:authorization.id,position:{x:camp.x,y:camp.y}}),cycle=cycles.camps.find((c:any)=>c.id===camp.id);await combat(p,authorization,cycle.spawns,{x:camp.x-5,y:camp.y});
 await p.quest('discover',{target:'ow-wind-side-clue1',position:mark('ow-wind-side-clue1')});expect(p.s.starsea!.quests).not.toHaveProperty(row.id);expect(p.s.starsea!.clearedCamps).toContain(camp.id);
 const accepted=await p.quest('accept',{task:row.id,position:npc});expect(p.s.starsea!.done).toContain(row.id);expect(accepted.receipt.delta.xp).toBe(row.reward_xp);const replay=await p.request('quest',accepted.command);expect(replay).toEqual(accepted.receipt);
 const archive=(await pool.query("SELECT state->'taskJournal'->'archive' archive FROM ow_characters WHERE id=$1",[p.s.id])).rows[0].archive;expect(archive.filter((entry:any)=>entry.taskId===row.id)).toHaveLength(1);evidence.push({case:'camp and clue before talk acceptance',camp:camp.id,task:row.id,receiptReplayed:true,archiveUnique:true});
},30000);
it('uses a real boss victory for the no-quest phase, isolates two characters, applies condition edits and preserves reconnect',async()=>{
 const one=await player(),two=await player(),authorization=await permit(one,'ss-map-boss-1');expect(authorization.spawns.some(m=>m.boss)).toBe(true);await combat(one,authorization,authorization.spawns,regionById('ss-map-boss-1').safe);await one.reload();await two.reload();
 expect(one.s.starsea!.bosses).toContain('ss-map-boss-1');expect(one.s.starsea!.done).not.toContain('ss-c01-t05');const fort=new Set(worldTables.camps.filter(c=>c.zone==='ow-wind-z6').map(c=>c.id)),count=(s:Snapshot)=>s.worldView!.camps.filter(id=>fort.has(id)).length;
 expect(count(one.s)).toBe(0);expect(count(two.s)).toBe(fort.size);expect(one.s.worldView!.waypoints).toContain('ow-wind-wp9');expect(two.s.worldView!.waypoints).not.toContain('ow-wind-wp9');
 const condition=conditions.find(c=>c.target==='ow-wind-boss-cleared')!,previous={kind:condition.kind,value:condition.value};try{condition.kind='level';condition.value='51';await one.reload();expect(count(one.s)).toBe(fort.size);}finally{condition.kind=previous.kind;condition.value=previous.value;}
 await one.reload();const before=structuredClone(one.s.worldView);await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();await one.reload();expect(one.s.worldView).toEqual(before);expect(one.s.starsea!.gates).toContain('gate-wind');evidence.push({case:'boss-before-story and phase/reconnect',firstBoss:true,storyCompleted:false,charactersHaveDifferentPhases:true,conditionEditChangesWorld:true,reconnectSamePhase:true});
},45000);
it('opens the world gate from real guard kills without story completion and keeps one durable reward per guard',async()=>{
 const p=await player(),authorization=await permit(p),gate=worldTables.gates.find(g=>g.id==='gate-wind')!,started=await p.quest('gate',{gate:gate.id,position:mark('gate')}),spawns=started.receipt.snapshot.starsea.wave.spawns;expect(spawns.length).toBeGreaterThan(0);await combat(p,authorization,spawns,mark('gate'));expect(p.s.starsea!.gates).toContain(gate.id);expect(p.s.starsea!.done).not.toContain('ss-c01-t05');const count=(await pool.query('SELECT count(*)::int n FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[p.s.id,spawns.map((s:Spawn)=>s.id)])).rows[0].n;expect(count).toBe(new Set(spawns.map((s:Spawn)=>s.id)).size);await p.quest('gate',{gate:gate.id,position:mark('gate')});expect((await pool.query('SELECT count(*)::int n FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[p.s.id,spawns.map((s:Spawn)=>s.id)])).rows[0].n).toBe(count);evidence.push({case:'gate-before-quests',actualGuards:spawns.length,durableKills:count,gatePermanent:true});
},30000);
it('reaches all level fallback services and islands without completing or accepting an optional quest',async()=>{
 const p=await player();expect(p.s.starsea!.done).toEqual([]);for(const region of worldTables.islands)expect(p.s.starsea!.islands).toContain(region.region);for(const feature of ['forge','professions','grid','summons','aspects','nightmare','trial','high','raid'])expect(p.s.starsea!.features).toContain(feature);const side=Object.keys(p.s.starsea!.quests).filter(id=>tasks.find(t=>t.id===id)?.type==='side');expect(side).toEqual([]);evidence.push({case:'level fallback without optional quests',level:p.s.level,done:[],autoOnboarding:Object.keys(p.s.starsea!.quests),islands:p.s.starsea!.islands,features:p.s.starsea!.features});
});
it('discards the old unfinished wave when starting combat in another zone and never resurrects its killed source',async()=>{
 const p=await player(),authorization=await permit(p),started=await p.quest('start',{task:'ss-c01-t01',position:mark('landing')}),old=started.receipt.snapshot.starsea.wave.spawns as Spawn[],state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state as CharacterState,build=resolveBuild(state),world=new World(regionById('ss-map-wind'),build.stats,build.resolvedSkills,old,[],41);
 world.hero.position={x:old[0].x-2,y:old[0].y};world.setMode('manual');expect(world.cast('cut',world.enemies[0])).toBe(true);const began=Date.now();for(let i=0;i<90&&!world.kills.length;i++)world.step();expect(world.kills.length).toBeGreaterThan(0);expect(world.enemies.some(e=>e.alive)).toBe(true);expect(world.enemies.filter(e=>e.alive).length+world.kills.length).toBe(old.length);const wait=Math.max(0,world.tick/30*1000-(Date.now()-began));if(wait)await new Promise(r=>setTimeout(r,wait));
 await p.write('combat/report',{permit_id:authorization.id,build:authorization.build,sequence:1,from_tick:0,to_tick:world.tick,kills:world.kills,position:world.hero.position});const killed=world.kills[0].source_id;expect(p.s.starsea!.wave!.killed).toContain(killed);
 await p.quest('arrive',{target:'route-fork',position:mark('route-fork')});const next=await p.quest('start',{task:'ss-c01-t04',choice:'b',position:mark('route-b')});expect(next.receipt.snapshot.starsea.wave.task).toBe('ss-c01-t04');expect(next.receipt.snapshot.starsea.wave.spawns.some((m:Spawn)=>old.some(o=>o.id===m.id))).toBe(false);expect((await pool.query('SELECT count(*)::int n FROM ow_kills WHERE character=$1 AND source=$2',[p.s.id,killed])).rows[0].n).toBe(1);
 const band=worldTables.zones.find(z=>z.id==='ow-wind-z4')!.levelBand;for(const enemy of next.receipt.snapshot.starsea.wave.spawns as Spawn[])expect(enemy.monster!.level).toBeGreaterThanOrEqual(band[0]);expect(next.receipt.snapshot.starsea.wave.spawns.every((m:Spawn)=>m.monster!.level<=band[1]+1)).toBe(true);evidence.push({case:'different-zone wave replacement',oldKilled:killed,oldTaskStillAtStep:p.s.starsea!.quests['ss-c01-t01'].step,newSourcesDistinct:true,routeBZone:'ow-wind-z4'});
},30000);
