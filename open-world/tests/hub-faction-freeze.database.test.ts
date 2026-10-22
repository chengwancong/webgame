import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import source from '../packages/content/dungeons.json';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import type {CharacterState,Receipt} from '../packages/contracts/index.ts';
import type {DungeonView} from '../packages/contracts/dungeons.ts';

// Same real API/WS executor as dungeon-instance.database.test.ts, in a private
// schema. The two raid fixtures isolate awardKill(worldDrops) and finish(!worldDrops).
// Only fixture damage/HP and preparation differ; no client kill or success is injected.
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real isolated PostgreSQL required');
const schema='qa_hub_faction_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const config=structuredClone(source) as any;
for(const worldDrops of [true,false])config.definitions.push({id:'qa-faction-'+(worldDrops?'kill':'completion'),kind:'raid',profiles:['simulation'],area:'meadow',stages:['meadow-boss'],worldDrops,policy:{party:{min:1,max:1,roles:{},defaultRole:'damage'},augments:{enabled:false},enemyScale:{hp:.001,attack:.001},timeLimitSeconds:30},reward:worldDrops?{gold:0,xp:0,material:0}:{gold:19,xp:23,material:3}});
const content=resolveDungeonContent(config);
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);});
afterAll(async()=>{await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function until(check:()=>boolean){const deadline=Date.now()+15000;while(!check()){if(Date.now()>deadline)throw Error('Real faction-freeze executor timed out');await new Promise(r=>setTimeout(r,30));}}
const sum=(values:Record<string,number>|undefined)=>Object.values(values??{}).reduce((n,v)=>n+v,0);
async function run(worldDrops:boolean,fieldEntry:boolean|undefined){
 let app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:content,...(fieldEntry===undefined?{}:{fieldFreeze:{fieldEntry}})});let socket:WebSocket|undefined;
 try{
  await app.listen({host:'127.0.0.1',port:0});const origin='http://127.0.0.1:'+((app.server.address() as {port:number}).port);
  const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'faction_'+randomUUID().replaceAll('-','').slice(0,12)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
  const request=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as never});
  expect(login.statusCode,login.body).toBe(200);
  const createdCharacter=await request('character',{name:'旧团本冻结验收'});expect(createdCharacter.statusCode,createdCharacter.body).toBe(200);
  const made=createdCharacter.json(),id=made.id;
  const s:CharacterState=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
  s.story={version:1,legacyAccess:true,events:{},choices:{}};s.level=60;s.gold=1000;s.material=100;s.progress.regions=['town','meadow'];
  s.gear.find(g=>g.id===s.equipment.weapon)!.attack=10000;s.gear.find(g=>g.id===s.equipment.armor)!.armor=10000;
  ensureProgression(s).reputation.meadow=17;const priorReputation=structuredClone(s.progression!.reputation);
  await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);
  const lease=(await request('control',{client_id:randomUUID()})).json().lease_id;
  const command=(op:string,extra:object={})=>({command_id:randomUUID(),lease_id:lease,op,...extra});
  const createInput=command('create',{dungeon_id:'qa-faction-'+(worldDrops?'kill':'completion')}),created=await request('dungeons/command',createInput);expect(created.statusCode,created.body).toBe(200);const instance=created.json().instance.id;
  let frame:DungeonView|undefined;const errors:string[]=[];socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+instance+'/live',{headers:{cookie}});
  socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='state')frame=message.instance;else if(message.type==='error')errors.push(message.message);});
  await new Promise<void>((resolve,reject)=>{socket!.once('open',resolve);socket!.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:lease}));await until(()=>Boolean(frame));
  expect((await request('dungeons/command',command('ready',{instance_id:instance}))).statusCode).toBe(200);
  const startInput=command('start',{instance_id:instance}),started=await request('dungeons/command',startInput);expect(started.statusCode,started.body).toBe(200);
  await until(()=>frame?.status==='success');expect(errors).toEqual([]);
  const awards=(await pool.query('SELECT source,receipt FROM ow_dungeon_awards WHERE instance=$1 AND character=$2 ORDER BY source',[instance,id])).rows as {source:string;receipt:Receipt}[];
  expect(awards.filter(a=>a.source.startsWith('kill:'))).toHaveLength(1);expect(awards.filter(a=>a.source==='result')).toHaveLength(1);
  const target=awards.find(a=>worldDrops?a.source.startsWith('kill:'):a.source==='result')!.receipt.delta;
  expect(target.gold).toBeGreaterThan(0);expect(target.material).toBeGreaterThan(0);expect(sum(target.progression?.materials)).toBeGreaterThan(0);
  const after:CharacterState=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
  if(fieldEntry){expect(after.progression!.reputation).toEqual(priorReputation);expect(sum(target.progression?.reputation)).toBe(0);}
  else{expect(after.progression!.reputation.meadow).toBe(priorReputation.meadow+30);expect(target.progression?.reputation).toEqual({meadow:30});}
  expect(after.gold).toBeGreaterThan(s.gold);expect(after.material).toBeGreaterThan(s.material);
  // A fully submitted start/create receipt must survive completion and return.
  const returnInput=command('return',{instance_id:instance}),returned=await request('dungeons/command',returnInput);expect(returned.statusCode,returned.body).toBe(200);
  // Receipts issued before the switch must still replay after a real service
  // restart with freezing enabled; previously committed reputation is not clawed back.
  if(fieldEntry===false){socket.close();await app.close();app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:content,fieldFreeze:{fieldEntry:true}});await app.listen({host:'127.0.0.1',port:0});}
  const beforeReplay=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state,awardsBeforeReplay=(await pool.query('SELECT source,receipt FROM ow_dungeon_awards WHERE instance=$1 AND character=$2 ORDER BY source',[instance,id])).rows;
  for(const [input,response] of [[createInput,created],[startInput,started],[returnInput,returned]] as const){const replay=await request('dungeons/command',input);expect(replay.statusCode,replay.body).toBe(200);expect(replay.json()).toEqual(response.json());}
  expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state).toEqual(beforeReplay);
  expect((await pool.query('SELECT source,receipt FROM ow_dungeon_awards WHERE instance=$1 AND character=$2 ORDER BY source',[instance,id])).rows).toEqual(awardsBeforeReplay);
  return {gold:target.gold,material:target.material,progressionMaterials:target.progression!.materials};
 }finally{socket?.close();await app.close();}
}
for(const worldDrops of [true,false])it(`keeps non-HUB ${worldDrops?'kill':'completion'} currencies and receipts while fieldEntry freezes only legacy faction reputation`,async()=>{
 const unfrozen=await run(worldDrops,false),frozen=await run(worldDrops,true),defaultContext=await run(worldDrops,undefined);
 expect(frozen).toEqual(unfrozen);expect(defaultContext).toEqual(unfrozen);
},60000);
