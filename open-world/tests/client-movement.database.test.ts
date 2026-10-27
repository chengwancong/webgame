import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import dungeonSource from '../packages/content/dungeons.json';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import type {DungeonView} from '../packages/contracts/dungeons.ts';
import type {ClientMovementReport,ClientMovementView} from '../packages/contracts/client-movement.ts';
import {World} from '../packages/simulation/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';

// Real PostgreSQL + localhost HTTP/WebSocket, entirely within a unique schema.
// The parent runner supplies a temporary database; this suite never starts one.
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Isolated PostgreSQL required');
const schema='qa_client_move_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema});
const config=structuredClone(dungeonSource) as any;
config.defaults.loadingSeconds=15;config.runtime.pumpMs=30;config.runtime.stateEveryMs=60;
config.definitions.push({id:'qa-client-movement',kind:'trial',profiles:['realtime'],area:'meadow',stages:['meadow-boss'],worldDrops:false,policy:{timeLimitSeconds:120,retention:{seconds:60},enemyScale:{hp:100000,attack:.001},entryCost:{gold:0,material:0}},reward:{gold:0,xp:0,material:0}});
const content=resolveDungeonContent(config);let app:ReturnType<typeof createApp>,origin='',created=false;const sockets:WebSocket[]=[];
async function launch(campaign:'legacy'|'starsea'='legacy'){app=createApp(pool,{campaign,testLogin:true,dungeons:content});await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+((app.server.address() as {port:number}).port);}
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);created=true;await migrate(pool);await launch();});
afterAll(async()=>{for(const socket of sockets)socket.terminate();await app?.close();await pool.end();if(created)await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean|Promise<boolean>,message:string,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(25);}throw Error(message);}
async function http(path:string,body?:unknown,cookie?:string){
 const response=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 return{status:response.status,body:await response.json() as any,cookie:String(response.headers.get('set-cookie')??'').split(';')[0]};
}
async function player(){
 const login=await http('session/login',{username:'clientmove_'+randomUUID().replaceAll('-','').slice(0,20)});expect(login.status).toBe(200);
 const cookie=login.cookie,request=(path:string,body?:unknown)=>http(path,body,cookie),state=(await request('character',{name:'移动协议验收'})).body;
 state.story={version:1,legacyAccess:true,events:{},choices:{}};state.level=60;state.gold=10000;state.material=1000;
 state.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];state.progress.regionKills={meadow:6};state.progress.regionElites={meadow:1};
 if(state.starsea&&!state.starsea.features.includes('events'))state.starsea.features.push('events');
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 return{id:state.id,cookie,lease,request,command:(op:string,extra:object={})=>request('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra})};
}
type Player=Awaited<ReturnType<typeof player>>;
async function connect(p:Player,id:string){
 const socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});sockets.push(socket);
 let current:DungeonView|undefined,outerSeq=0;const errors:string[]=[];
 socket.on('message',raw=>{const data=JSON.parse(String(raw));if(data.type==='state')current=data.instance;else if(data.type==='error')errors.push(data.message);});
 await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('error',()=>{});
 socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));await until(()=>Boolean(current),'No initial WebSocket state');
 return{socket,errors,get frame(){return current!;},send(movement:ClientMovementReport){outerSeq=Math.max(outerSeq,current?.self?.lastInputSeq??0)+1;socket.send(JSON.stringify({type:'input',input:{kind:'client_move',seq:outerSeq,movement}}));return outerSeq;}};
}
function quiet(world:World,playerId?:string,position={x:10,y:10}){
 world.region={...world.region,obstacles:[],dynamicObstacles:undefined};world.projectiles=[];world.zones=[];world.statuses=[];
 const own=()=>{world.hero.position={...position};world.hero.hp=world.stats.hp;world.setMode('auto');world.autoSkills=false;world.autoBounds={center:{...position},radius:1};};
 if(playerId)world.forPlayer(playerId,own);else own();
 for(const enemy of world.enemies){enemy.position={x:Math.max(2,world.region.width-4),y:Math.max(2,world.region.height-4)};enemy.cooldown=world.tick+100000;enemy.attack=0;enemy.engaged=false;}
}
async function begin(){
 const p=await player(),created=await p.command('create',{dungeon_id:'qa-client-movement'});expect(created.status,JSON.stringify(created.body)).toBe(200);
 const id=created.body.instance.id,initial=await connect(p,id);expect((await p.command('ready',{instance_id:id})).status).toBe(200);expect((await p.command('start',{instance_id:id})).status).toBe(200);
 await until(()=>initial.frame.status==='running','Dungeon did not start');await app.close();
 const saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,world=World.restore(saved.battle);
 quiet(world,p.id);saved.battle=world.exportCheckpoint();saved.tick=world.tick;saved.startedAt=new Date(Date.now()-world.tick/saved.tickRate*1000).toISOString();
 await pool.query('UPDATE ow_dungeons SET data=$2 WHERE id=$1',[id,saved]);await launch();
 const live=await connect(p,id);await until(()=>Boolean(live.frame.movement),'No client movement handshake');return{p,id,live};
}
function report(view:ClientMovementView,seq:number,patch:Partial<ClientMovementReport>={}):ClientMovementReport{return{epoch:view.epoch,revision:view.revision,seq,position:{...view.position},direction:{x:0,y:0},active:true,...patch};}
const actor=(frame:DungeonView,id:string)=>frame.actors.find(a=>a.id===id)!;

it('real WebSocket adopts legal client positions without periodic revision corrections and rejects stale/invalid reports without rewards',async()=>{
 const {p,id,live}=await begin(),baseline=live.frame.movement!,wallet=(await p.request('character')).body,position={x:baseline.position.x+.2,y:baseline.position.y};
 live.send(report(baseline,1,{position}));await until(()=>live.frame.movement?.ack===1,'Legal movement was not acknowledged');
 expect(live.frame.movement).toMatchObject({owner:'client',revision:baseline.revision,position});expect(actor(live.frame,p.id).position).toEqual(position);
 live.send(report(live.frame.movement!,2,{position:{x:position.x+.1,y:position.y}}));await until(()=>live.frame.movement?.ack===2,'Second movement was not acknowledged');
 expect(live.frame.movement!.revision).toBe(baseline.revision);
 const current=structuredClone(live.frame.movement!),old=live.send(report(current,99,{epoch:'stale:'+current.epoch,position:{x:30,y:30}}));
 await until(()=>live.frame.self!.lastInputSeq>=old,'Stale report was not processed');expect(live.frame.movement).toMatchObject({epoch:current.epoch,ack:2,revision:current.revision,position:current.position});
 live.send(report(current,3,{position:{x:-1000,y:-1000}}));await until(()=>live.frame.movement!.revision>current.revision,'Invalid position did not issue a correction');
 expect(live.frame.movement).toMatchObject({owner:'server',ack:3,reason:'invalid-position'});expect(live.frame.movement!.position.x).toBeGreaterThanOrEqual(1);
 expect((await pool.query("SELECT 1 FROM ow_dungeon_awards WHERE instance=$1 AND source LIKE 'kill:%'",[id])).rowCount).toBe(0);
 const after=(await p.request('character')).body;expect({gold:after.gold,material:after.material,gear:after.gear}).toEqual({gold:wallet.gold,material:wallet.material,gear:wallet.gear});
 expect(live.errors).toEqual([]);await p.command('leave',{instance_id:id});await p.command('return',{instance_id:id});
},30000);

it('movement ownership survives checkpoint encoding, explicit release returns to server, and reconnect invalidates old epochs',async()=>{
 const {p,id,live}=await begin(),baseline=live.frame.movement!;
 live.send(report(baseline,1));await until(()=>live.frame.movement?.ack===1,'Client claim was not acknowledged');
 let saved:any;await until(async()=>{saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;return World.restore(saved.battle).clientMovementView(p.id)?.ack===1;},'Movement ownership was not persisted');
 expect(World.restore(saved.battle).clientMovementView(p.id)).toMatchObject({epoch:baseline.epoch,ack:1,revision:baseline.revision,owner:'client'});
 const tick=live.frame.tick;live.send(report(live.frame.movement!,2,{active:false}));await until(()=>live.frame.movement?.ack===2,'Stop was not acknowledged');
 const stopped=structuredClone(live.frame.movement!);expect(stopped.owner).toBe('client');expect(stopped.revision).toBe(baseline.revision);
 live.send(report(stopped,3,{active:false,release:true}));await until(()=>live.frame.movement?.ack===3&&live.frame.movement.owner==='server','Release did not restore server ownership');
 expect(live.frame.movement!.revision).toBe(stopped.revision);expect(live.frame.tick).toBeGreaterThanOrEqual(tick);
 const oldEpoch=live.frame.movement!.epoch;live.socket.close();const fresh=await connect(p,id);expect(fresh.frame.movement!.epoch).not.toBe(oldEpoch);expect(fresh.frame.movement).toMatchObject({owner:'server',ack:0});
 const outer=fresh.send(report(fresh.frame.movement!,4,{epoch:oldEpoch}));await until(()=>fresh.frame.self!.lastInputSeq>=outer,'Old connection report was not consumed');expect(fresh.frame.movement!.ack).toBe(0);
 await p.command('leave',{instance_id:id});await p.command('return',{instance_id:id});
},30000);

it('real field HTTP movement persists the same contract and explicit reset invalidates the prior stream',async()=>{
 await app.close();await launch('starsea');const p=await player(),state=(await p.request('character')).body,event=worldTables.events.find(e=>e.region==='ss-map-wind')!;
 const started=await p.request('field/activity/start',{command_id:randomUUID(),revision:state.revision,lease_id:p.lease,kind:'event',region:event.region,target:event.id,position:{x:event.x,y:event.y}});expect(started.status,JSON.stringify(started.body)).toBe(200);
 await app.close();const data=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[p.id,event.id])).rows[0].data,world=World.restore(data.battle);
 quiet(world,undefined,data.position);data.battle=world.exportCheckpoint();data.tick=world.tick;data.startedAt=Date.now()-world.tick/30*1000;
 await pool.query('UPDATE ow_field_activities SET data=$1 WHERE character=$2 AND target=$3',[data,p.id,event.id]);await launch('starsea');
 const request=(extra:object)=>p.request('field/activity/input',{lease_id:p.lease,instance:data.instance,...extra});
 const reset=await request({clientMovementReset:true});expect(reset.status,JSON.stringify(reset.body)).toBe(200);const initial=reset.body.activity.movement as ClientMovementView;expect(initial).toMatchObject({owner:'server',revision:0,ack:0});
 const position={x:initial.position.x+.1,y:initial.position.y},accepted=await request({clientMovement:report(initial,1,{position})});expect(accepted.status).toBe(200);
 expect(accepted.body.activity.movement).toMatchObject({owner:'client',ack:1,revision:0,position});
 const persisted=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[p.id,event.id])).rows[0].data;
 expect(World.restore(persisted.battle).clientMovementView()).toMatchObject({epoch:initial.epoch,owner:'client',ack:1,position});
 const refreshed=await request({clientMovementReset:true});expect(refreshed.status).toBe(200);const next=refreshed.body.activity.movement as ClientMovementView;expect(next.epoch).not.toBe(initial.epoch);expect(next).toMatchObject({owner:'server',revision:0,ack:0});
 const stale=await request({clientMovement:report(initial,2,{position:{x:initial.position.x+5,y:initial.position.y}})});expect(stale.status).toBe(200);expect(stale.body.activity.movement).toMatchObject({epoch:next.epoch,ack:0,revision:0});
 const invalid=await request({clientMovement:report(next,1,{position:{x:-1000,y:-1000}})});expect(invalid.status).toBe(200);expect(invalid.body.activity.movement).toMatchObject({owner:'server',revision:1,ack:1,reason:'invalid-position'});
 expect((await p.request('field/activity/claim',{command_id:randomUUID(),revision:(await p.request('character')).body.revision,lease_id:p.lease,instance:data.instance})).status).not.toBe(200);
},30000);
