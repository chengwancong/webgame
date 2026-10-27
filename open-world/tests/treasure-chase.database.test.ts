import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {migrateHub,saveHubState} from '../apps/api/src/hub-state.ts';
import {migrateHubChart} from '../apps/api/src/hub-chart-service.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {hubDungeonViewSchema,type HubDungeonView} from '../packages/contracts/dungeons.ts';
import {hubMimicChest} from '../apps/api/src/hub-dungeon-runtime.ts';
import {World,type Entity,type WorldCheckpoint} from '../packages/simulation/index.ts';

// The parent runner owns a new temporary database. This suite only uses its own
// schema and temporary characters, with real HTTP/WS and server combat/rewards.
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Isolated PostgreSQL required');
const schema='qa_treasure_chase_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let seed=1;while(hubMimicChest('unused',seed)!==null)seed++;
const content=structuredClone(dungeonContent),definition=content.definitions.find(d=>d.hub?.node==='wind-treasure')!;
definition.policy.timeLimitSeconds=90;definition.policy.enemyScale={hp:.001,attack:.001,hpPerStage:0,attackPerStage:0};
const sockets:WebSocket[]=[];let app:ReturnType<typeof createApp>|undefined,origin='',created=false;
async function launch(){app=createApp(pool,{testLogin:true,testDungeonSeed:seed,dungeons:content,fieldFreeze:{fieldEntry:true,fieldGather:true,fieldSprint:true}});await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+((app.server.address() as {port:number}).port);}
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);created=true;await migrate(pool);const c=await pool.connect();try{await migrateHub(c);await migrateHubChart(c);}finally{c.release();}await launch();});
afterAll(async()=>{for(const socket of sockets)socket.terminate();await app?.close();await pool.end();if(created)await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean|Promise<boolean>,message:string,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(30);}throw Error(message);}
async function http(path:string,body?:unknown,cookie?:string){const response=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});return{status:response.status,body:await response.json() as any,cookie:String(response.headers.get('set-cookie')??'').split(';')[0]};}
async function player(){
 const login=await http('session/login',{username:'treasurechase_'+randomUUID().replaceAll('-','').slice(0,16)});expect(login.status).toBe(200);
 const cookie=login.cookie,request=(path:string,body?:unknown)=>http(path,body,cookie),state=(await request('character',{name:'追逐寻宝验收'})).body;
 state.starsea.prologue.done=true;state.level=30;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);
 const hub=newHubState();hub.mode='manual';for(const node of ['wind-story-1','wind-story-2','wind-nest-3','wind-gate','mist-gate'])hub.chart.cleared[node]={firstAt:new Date().toISOString(),bestSeconds:90};
 const c=await pool.connect();try{await saveHubState(c,state.id,hub);}finally{c.release();}
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 return{id:state.id,cookie,lease,request,command:(op:string,extra:object={})=>request('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra})};
}
type Player=Awaited<ReturnType<typeof player>>;
async function connect(p:Player,id:string){
 let current:HubDungeonView|undefined,seq=0;const errors:string[]=[],socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});sockets.push(socket);
 socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='state'){try{current=hubDungeonViewSchema.parse(message.instance);}catch(error){errors.push(String(error));}}else if(message.type==='error')errors.push(message.message);});
 await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('error',()=>{});socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));await until(()=>Boolean(current),'No treasure WS state');
 return{socket,errors,get frame(){return current!;},input(body:object){seq=Math.max(seq,current?.self?.lastInputSeq??0)+1;socket.send(JSON.stringify({type:'input',input:{seq,...body}}));return seq;}};
}
async function savedRun(id:string){return (await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;}
const enemy=(frame:HubDungeonView,id:string)=>(frame.battle as WorldCheckpoint).data.enemies.find((e:Entity)=>e.id===id) as Entity|undefined;
async function chestAwards(instance:string,character:string,chest:string){return (await pool.query('SELECT source,receipt FROM ow_dungeon_awards WHERE instance=$1 AND character=$2 AND source=$3',[instance,character,'hub-chest:'+chest])).rows;}

it('plays the real introductory chase, restores its frozen route, and pays the carried chest exactly once',async()=>{
 expect(hubMimicChest('unused',seed)).toBeNull();
 const p=await player(),created=await p.command('create',{node_id:'wind-treasure'});expect(created.status,JSON.stringify(created.body)).toBe(200);
 const id=created.body.instance.id;let live=await connect(p,id);
 expect((await p.command('ready',{instance_id:id})).status).toBe(200);expect((await p.command('start',{instance_id:id})).status).toBe(200);
 await until(()=>live.frame.status==='running','Treasure did not start');
 await app!.close();
 const initial=await savedRun(id),world=World.restore(initial.battle);
 expect(initial.hub.mimicIntro).toBe(true);expect(initial.hub.mimic).toBeTruthy();expect(initial.hub.mimicRules).toBeDefined();
 const chest=world.region.keyChests!.find(c=>c.id===initial.hub.mimic.chest)!;expect(chest).toBeDefined();
 // Only setup is altered: ingress is next to the chest and unrelated ambient
 // enemies are phased out, not marked dead. The channel, mimic, chase, kill and
 // all reward writes below are produced by the actual service and World.
 world.phaseOut({x:world.region.width/2,y:world.region.height/2},Math.hypot(world.region.width,world.region.height),()=>false);
 world.region={...world.region,safe:{x:chest.x,y:chest.y}};
 world.forPlayer(p.id,()=>{world.hero.position={x:chest.x,y:chest.y};world.control(0,0);world.cancelWalk();world.setMode('manual');world.autoSkills=true;});
 initial.battle=world.exportCheckpoint();initial.tick=world.tick;initial.startedAt=new Date(Date.now()-world.tick/initial.tickRate*1000).toISOString();
 await pool.query('UPDATE ow_dungeons SET data=$2 WHERE id=$1',[id,initial]);await launch();live=await connect(p,id);
 expect(live.frame.keyChests.find(c=>c.id===chest.id)?.claimed).toBe(false);expect(await chestAwards(id,p.id,chest.id)).toEqual([]);
 live.input({kind:'interact',target:chest.id});
 await until(()=>Boolean(live.frame.chase),'Opening did not create a public chase');
 const chase=structuredClone(live.frame.chase!);expect(chase.chestId).toBe(chest.id);expect(chase.phase).toBe('waking');
 expect(enemy(live.frame,chase.enemyId)).toMatchObject({name:'宝箱怪',alive:true,elite:true});
 expect(live.frame.keyChests.find(c=>c.id===chest.id)?.claimed).toBe(false);
 const errorStart=live.errors.length,blocked=live.input({kind:'interact',target:chest.id});
 await until(()=>live.frame.self!.lastInputSeq>=blocked&&live.errors.length>errorStart,'Awake mimic did not block the original chest');
 expect(live.errors.splice(errorStart)).toEqual([expect.stringContaining('宝箱怪')]);expect(await chestAwards(id,p.id,chest.id)).toEqual([]);
 await until(()=>live.frame.chase?.phase==='running'&&Math.hypot(enemy(live.frame,chase.enemyId)!.position.x-chest.x,enemy(live.frame,chase.enemyId)!.position.y-chest.y)>.3,'Mimic never moved along its chase route');
 await app!.close();
 const checkpoint=await savedRun(id),before=World.restore(checkpoint.battle).enemies.find(e=>e.id===chase.enemyId)!;
 expect(before.chase).toBeDefined();const frozen=structuredClone(before.chase!);expect(frozen.destinations.length).toBeGreaterThan(0);expect(checkpoint.hub.mimic.chase).toBe(true);
 await launch();live=await connect(p,id);const restored=enemy(live.frame,chase.enemyId)!;
 expect(restored.alive).toBe(true);expect(restored.hp).toBe(before.hp);expect(restored.chase).toMatchObject({started:frozen.started,until:frozen.until,destinations:frozen.destinations});
 expect(restored.chase!.leg).toBeGreaterThanOrEqual(frozen.leg);expect(live.frame.chase?.enemyId).toBe(chase.enemyId);
 expect(await chestAwards(id,p.id,chest.id)).toEqual([]);
 live.input({kind:'mode',mode:'auto'});
 await until(()=>live.frame.keyChests.find(c=>c.id===chest.id)?.claimed===true,'Server combat did not defeat the mimic and award its chest',30000);
 expect(enemy(live.frame,chase.enemyId)?.alive).toBe(false);expect(live.frame.chase).toBeUndefined();
 const stopped=live.input({kind:'mode',mode:'manual'});await until(()=>live.frame.self!.lastInputSeq>=stopped,'Manual stop was not applied');
 const paid=await chestAwards(id,p.id,chest.id);expect(paid).toHaveLength(1);
 live.input({kind:'go',x:chest.x,y:chest.y});await until(()=>{const actor=live.frame.actors.find(a=>a.id===p.id)!;return Math.hypot(actor.position.x-chest.x,actor.position.y-chest.y)<=1.8;},'Could not revisit the already-paid chest');
 live.input({kind:'interact',target:chest.id});const again=live.input({kind:'interact',target:chest.id});await until(()=>live.frame.self!.lastInputSeq>=again,'Repeated chest input was not consumed');await delay(150);
 expect(await chestAwards(id,p.id,chest.id)).toEqual(paid);expect(live.errors).toEqual([]);
 expect((await p.command('leave',{instance_id:id})).status).toBe(200);expect((await p.command('return',{instance_id:id})).status).toBe(200);
 const replay=await p.command('create',{node_id:'wind-treasure'});expect(replay.status,JSON.stringify(replay.body)).toBe(200);
 const next=await savedRun(replay.body.instance.id);expect(next.hub.mimicIntro).toBe(false);
 expect((await p.command('leave',{instance_id:replay.body.instance.id})).status).toBe(200);
},90000);
