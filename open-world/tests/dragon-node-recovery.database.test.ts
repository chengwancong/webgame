import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {starseaMap} from '../packages/content/starsea/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {evaluateUnlocks} from '../packages/rules/starsea.ts';
import {validateResponse,type CharacterState,type Snapshot,type Permit} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Isolated real PostgreSQL required');
const pool=poolFor(dsn);let app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();});

it('persists three distinct dragon defense nodes across fresh API logins and never replays a completed reward',async()=>{
 const region='ss-map-dragon',task='ss-c06-t04',username='qa_dragon_'+randomUUID().replaceAll('-','').slice(0,16);let cookie='';
 async function login(){const r=await app.inject({method:'POST',url:'/api/session/login',payload:{username}});expect(r.statusCode).toBe(200);cookie=String(r.headers['set-cookie']).split(';')[0];}
 await login();
 async function request(path:string,payload?:object){const r=await app.inject({method:payload?'POST':'GET',url:'/api/'+path,headers:{cookie},payload});return {status:r.statusCode,body:r.json()};}
 let s=(await request('character',{name:'三节点恢复夹具'})).body as Snapshot;const id=s.id;
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState;
 // Controlled setup only: this is not evidence of naturally reaching chapter six.
 state.level=40;state.gear.find(g=>g.id===state.equipment.weapon)!.attack=10000;state.gear.find(g=>g.id===state.equipment.armor)!.armor=10000;
 state.starsea!.quests={[task]:{step:0,attempt:0,acceptedAt:Date.now()}};state.starsea!.tracked=task;state.starsea!.wave=null;evaluateUnlocks(state);
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
 s=(await request('character')).body;let lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 async function command(path:string,body:object){const payload={command_id:randomUUID(),revision:s.revision,lease_id:lease,...body},r=await request(path,payload);if(r.status===200){validateResponse(path,r.body);s=r.body.snapshot;}return {...r,payload};}
 const nodes=[1,2,3].map(n=>starseaMap(region).landmarks.find(l=>l.id==='device-'+n)!);
 const waveIds=new Set<string>();let finalPayload:object|undefined,finalBody:any;
 for(const [step,node] of nodes.entries()){
  const point={x:node.x,y:node.y};expect(s.starsea!.quests[task].step).toBe(step);
  expect(s.starseaView!.quests.find(q=>q.id===task)!.step.points[0]).toMatchObject(point);
  const permitted=await request('permit',{lease_id:lease,region,position:point});expect(permitted.status,JSON.stringify(permitted.body)).toBe(200);const permit=permitted.body as Permit;
  if(step>0){const wrong=await command('quest',{op:'start',task,region,position:{x:nodes[0].x,y:nodes[0].y}});expect(wrong.body.code).toBe('QUEST_DISTANCE');}
  const started=await command('quest',{op:'start',task,region,position:point});expect(started.status,JSON.stringify(started.body)).toBe(200);
  const wave=s.starsea!.wave!;expect(wave.step).toBe(step);expect(wave.spawns).toHaveLength(3);
  for(const spawn of wave.spawns){expect(waveIds.has(spawn.id)).toBe(false);waveIds.add(spawn.id);}
  const current=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState,build=resolveBuild(current);
  expect(build.resolvedSkills.length).toBeGreaterThan(0);
  const world=new World(regionById(region),build.stats,build.resolvedSkills,wave.spawns,[],41);
  world.hero.position={...point};world.setMode('auto');world.radius=40;
  world.defense={position:{...point},hp:wave.defense!.hp,maxHp:wave.defense!.hp,radius:wave.defense!.radius,requiredTicks:wave.defense!.holdTicks,heldTicks:0,enemyIds:wave.spawns.map(m=>m.id),complete:false,failed:false};
  for(let t=0;t<3600&&world.hero.hp>0&&(!world.defense.complete||world.enemies.some(e=>e.alive));t++)world.step();
  expect(world.hero.hp).toBeGreaterThan(0);expect(world.defense.failed).toBe(false);expect(world.defense.complete).toBe(true);expect(world.kills).toHaveLength(3);
  const elapsed=Math.max(world.tick/30*1000,wave.minClearMs??0),remaining=Math.max(0,(wave.startedAt??Date.now())+elapsed-Date.now());
  if(remaining>0)await new Promise(r=>setTimeout(r,remaining+50));
  const report=await command('combat/report',{permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+world.tick,kills:world.kills.map(k=>({...k,tick:k.tick+permit.from_tick})),position:world.hero.position});
  expect(report.status,JSON.stringify(report.body)).toBe(200);expect(s.starsea!.wave!.killed).toHaveLength(3);
  const persisted=structuredClone(s.starsea!.wave),revision=s.revision;
  await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();await login();
  s=(await request('character')).body;expect(s.revision).toBe(revision);expect(s.starsea!.wave).toEqual(persisted);expect(s.starsea!.quests[task].step).toBe(step);
  expect((await request('combat/report',report.payload)).body).toEqual(report.body);
  const stale=await command('quest',{op:'defense-finish',task,region});expect(stale.body.code).toBe('CONTROL');
  expect((await request('character')).body.revision).toBe(revision);
  expect((await request('control',{client_id:randomUUID()})).body.code).toBe('BUSY');
  const control=await request('control',{client_id:randomUUID(),takeover:true});expect(control.status,JSON.stringify(control.body)).toBe(200);lease=control.body.lease_id;
  const done=await command('quest',{op:'defense-finish',task,region});expect(done.status,JSON.stringify(done.body)).toBe(200);
  expect((await request('quest',done.payload)).body).toEqual(done.body);finalPayload=done.payload;finalBody=done.body;
 }
 expect(s.starsea!.done.filter(q=>q===task)).toHaveLength(1);expect(s.starsea!.quests[task]).toBeUndefined();
 const after=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 expect((await request('quest',finalPayload)).body).toEqual(finalBody);
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state).toEqual(after);
 expect((await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1 AND command=$2',[id,(finalPayload as any).command_id])).rows[0].n).toBe(1);
},120000);
