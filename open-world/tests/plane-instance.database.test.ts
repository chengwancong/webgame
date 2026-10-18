import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import source from '../packages/content/dungeons.json';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import '../packages/content/open-world/index.ts';
import type {DungeonView} from '../packages/contracts/index.ts';

/** L2 (plane-world-design F2): gate entry → walk-in passage → boss → plane_exit_open →
 * walk into the exit → result back by the gate, with service restarts at the cleared
 * checkpoint and with the exit open. Real PostgreSQL, real dungeon runtime and socket. */
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Plane instances require real isolated PostgreSQL');
const schema='qa_plane_run_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const gate=worldTables.planeGates.find(g=>g.id==='ow-wind-plane-nest-crypt')!,other=worldTables.planeGates.find(g=>g.id==='ow-wind-plane-nest-maze')!;
// Same plane definition, but enemies are paper-thin and one kill clears a hall: the test is about flow, not balance.
const config=structuredClone(source) as any,fixture=config.definitions.find((d:any)=>d.id===gate.plane);fixture.policy={...fixture.policy,enemyScale:{hp:.001,attack:.001,hpPerStage:0,attackPerStage:0},normalGoals:{killCount:1,eliteCount:0}};
const content=resolveDungeonContent(config);
let app=createApp(pool,{testLogin:true,dungeons:content}),origin='',socket:WebSocket|undefined;
const listen=async()=>{await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+((app.server.address() as any).port);};
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await listen();});
afterAll(async()=>{socket?.close();await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
const wait=async(fn:()=>boolean,what:string,ms=90000)=>{const until=Date.now()+ms;while(!fn()){if(Date.now()>until)throw Error('Timed out waiting for '+what);await new Promise(r=>setTimeout(r,40));}};
const saved=async(id:string)=>(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;
const enemies=(data:any)=>(data.battle.data.enemies as {id:string;alive:boolean;hp:number}[]).map(e=>({id:e.id,alive:e.alive,hp:e.hp}));

it('enters only from the gate, walks through the passage, opens the exit after the boss and settles back by the gate, across restarts without respawns',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'planerun_'+randomUUID().replaceAll('-','').slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=(await request('character',{name:'位面实例验收'})).json(),lease=(await request('control',{client_id:randomUUID()})).json().lease_id;
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state;state.level=50;state.gear.find((g:any)=>g.id===state.equipment.weapon).attack=10000;
 state.world={...(state.world??{}),planes:{[gate.id]:{found:true,clears:0,secrets:[]},[other.id]:{found:true,clears:0,secrets:[]}}};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,created.id]);
 const permitResponse=await request('permit',{lease_id:lease,region:gate.region});expect(permitResponse.statusCode,permitResponse.body).toBe(200);const permit=permitResponse.json().id as string;
 const observer=(p:{x:number;y:number},ago=0)=>pool.query("UPDATE ow_permits SET private_data=jsonb_set(private_data,'{fieldObserver}',$1::jsonb) WHERE id=$2",[JSON.stringify({...p,at:Date.now()-ago}),permit]);
 const command=(op:string,extra:object={})=>request('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra});

 // Entry: catalogue-only, stale or far observers, and a gate that leads elsewhere are refused without charging anything.
 await observer({x:gate.x,y:gate.y});
 expect((await command('create',{dungeon_id:gate.plane})).json().code).toBe('PLANE_GATE');
 expect((await command('create',{dungeon_id:other.plane,gate:gate.id,permit_id:permit})).json().code).toBe('PLANE_GATE');
 await observer({x:gate.x,y:gate.y},10000);expect((await command('create',{dungeon_id:gate.plane,gate:gate.id,permit_id:permit})).json().code).toBe('PLANE_GATE_FAR');
 await observer({x:gate.x+gate.interactRadius+2,y:gate.y});expect((await command('create',{dungeon_id:gate.plane,gate:gate.id,permit_id:permit})).json().code).toBe('PLANE_GATE_FAR');
 expect((await pool.query('SELECT count(*)::int n FROM ow_dungeons')).rows[0].n).toBe(0);
 await observer({x:gate.x,y:gate.y});const started=await command('create',{dungeon_id:gate.plane,gate:gate.id,permit_id:permit});expect(started.statusCode,started.body).toBe(200);
 const id=started.json().instance.id as string;expect((await saved(id)).plane).toEqual({gate:gate.id,returnTo:{region:gate.region,x:gate.returnX,y:gate.returnY},exitOpen:false});

 let frame:DungeonView|undefined;
 const connect=async()=>{frame=undefined;socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie}});const own=socket;own.on('message',raw=>{const data=JSON.parse(String(raw));if(data.type==='state'&&own===socket)frame=data.instance;});await new Promise<void>((resolve,reject)=>{own.once('open',resolve);own.once('error',reject);});own.send(JSON.stringify({type:'hello',lease_id:lease}));await wait(()=>Boolean(frame),'first state');};
 let seq=0;const input=(i:object)=>socket!.send(JSON.stringify({type:'input',input:{seq:++seq,...i}}));
 const hero=()=>frame!.actors[0].position,portal=()=>frame!.plane!.portal,away=()=>Math.hypot(hero().x-portal().x,hero().y-portal().y);
 const clearAll=async()=>{input({kind:'mode',mode:'auto'});const until=Date.now()+90000;while(enemies(await saved(id)).some(e=>e.alive)){if(Date.now()>until)throw Error('Timed out clearing the stage');await new Promise(r=>setTimeout(r,200));}input({kind:'mode',mode:'semi'});};
 /** Step off the portal (it arms once the hero has been outside), then walk into it. The fixture clears a hall with one kill, so the rest are swept first: they would only body-block the walk. */
 const walkIn=async()=>{await clearAll();const safe=(frame!.battle as any).region.safe;input({kind:'go',x:safe.x,y:safe.y});await wait(()=>away()>3,'stepping off the portal');input({kind:'go',x:portal().x,y:portal().y});};
 const restart=async()=>{socket?.close();socket=undefined;await app.close();app=createApp(pool,{testLogin:true,dungeons:content});await listen();seq=(await saved(id)).members[0].lastInputSeq;await connect();};
 await connect();expect((await command('ready',{instance_id:id})).statusCode).toBe(200);expect((await command('start',{instance_id:id})).statusCode).toBe(200);input({kind:'mode',mode:'auto'});

 // Stage 1 cleared: the passage opens, but nothing moves on until the hero walks in; "next" is not a plane command.
 await wait(()=>!!frame?.plane?.passageOpen,'stage 1 cleared');expect(frame!.stage).toBe(0);expect(frame!.checkpoint).toBe(true);
 expect((await command('next',{instance_id:id})).json().code).toBe('PLANE_PASSAGE');
 input({kind:'mode',mode:'semi'});await new Promise(r=>setTimeout(r,300));
 const beforeRestart=enemies(await saved(id));expect(beforeRestart.some(e=>!e.alive)).toBe(true);
 await restart();
 // Restored from the checkpoint: the same enemy instances, the dead stay dead and nobody is topped up.
 const afterRestart=enemies(await saved(id));expect(afterRestart.map(e=>e.id)).toEqual(beforeRestart.map(e=>e.id));
 for(const e of beforeRestart.filter(e=>!e.alive))expect(afterRestart.find(x=>x.id===e.id)!.alive,e.id).toBe(false);
 for(const e of afterRestart.filter(e=>e.alive))expect(e.hp).toBeLessThanOrEqual(beforeRestart.find(x=>x.id===e.id)!.hp);
 expect(frame!.stage).toBe(0);expect(frame!.plane!.passageOpen).toBe(true);
 await walkIn();
 await wait(()=>frame?.stage===1,'walk-in passage');expect(frame!.plane!.passageOpen).toBe(false);expect(frame!.plane!.exitOpen).toBe(false);expect((await saved(id)).stageBattles).toHaveLength(1);

 // Boss floor: killing the boss opens the exit, it does not settle the run.
 input({kind:'mode',mode:'auto'});await wait(()=>!!frame?.plane?.exitOpen,'boss down, exit open');expect(frame!.status).toBe('running');
 const events=(await pool.query("SELECT events FROM ow_dungeon_ticks WHERE instance=$1",[id])).rows.flatMap(r=>r.events as {type:string}[]).map(e=>e.type);expect(events).toContain('plane_passage_open');expect(events).toContain('plane_exit_open');
 input({kind:'mode',mode:'semi'});await new Promise(r=>setTimeout(r,300));const bossBefore=enemies(await saved(id)).filter(e=>!e.alive).map(e=>e.id);
 await restart();
 expect(frame!.status).toBe('running');expect(frame!.plane!.exitOpen).toBe(true);expect(enemies(await saved(id)).filter(e=>!e.alive).map(e=>e.id)).toEqual(expect.arrayContaining(bossBefore));
 expect((await saved(id)).stageBattles).toHaveLength(1);expect((await pool.query("SELECT count(*)::int n FROM ow_dungeon_awards WHERE instance=$1 AND source='result'",[id])).rows[0].n).toBe(0);

 // Walking into the exit settles once, back by the gate.
 await walkIn();await wait(()=>frame?.status==='success','walk into the exit');
 const character=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state;
 expect(character.world.planes[gate.id]).toMatchObject({found:true,clears:1});expect(character.world.planes[gate.id].firstClearAt).toBeGreaterThan(0);
 expect(character.dungeon).toEqual({instance:null,pendingResult:id,returnRegion:gate.region,returnTo:{x:gate.returnX,y:gate.returnY}});
 expect(character.starsea.location).toEqual({map:gate.region,x:gate.returnX,y:gate.returnY});expect(character.lastRegion).toBe(gate.region);
 expect((await pool.query("SELECT count(*)::int n FROM ow_dungeon_awards WHERE instance=$1 AND source='result'",[id])).rows[0].n).toBe(1);
 expect((await pool.query('SELECT dungeon FROM ow_dungeon_completions WHERE character=$1',[created.id])).rows.map(r=>r.dungeon)).toEqual([gate.plane]);
 const snapshot=(await request('character')).json();expect(snapshot.worldView.planeGates.find((g:any)=>g.id===gate.id)).toEqual({id:gate.id,state:'open',clears:1});
 expect((await command('return',{instance_id:id})).statusCode).toBe(200);
 const after=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state;expect(after.dungeon).toEqual({instance:null,pendingResult:null,returnRegion:gate.region});expect(after.world.planes[gate.id].clears).toBe(1);
},240000);
