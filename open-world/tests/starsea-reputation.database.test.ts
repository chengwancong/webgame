import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {CharacterState,Snapshot,Permit} from '../packages/contracts/index.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required, no mock or skip');
const schema='qa_starrep_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
it('persists actual simulated camp kills as reputation exactly once through the battle API',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'rep_'+randomUUID().replaceAll('-','').slice(0,20)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const created=(await request('character',{name:'声望实库验收'})).body as Snapshot;
 const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state as CharacterState;
 // An isolated combat-speed fixture, never a grant to an existing player. The
 // real build resolver, simulation, validation, transaction and receipt execute.
 stored.level=2;for(const gear of stored.gear){if(gear.slot==='weapon')gear.attack=100000;if(gear.slot==='armor')gear.armor=100000;}
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[stored,stored.id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id,snapshot=(await request('character')).body as Snapshot,issued=await request('permit',{lease_id:lease,region:'ss-map-wind'});expect(issued.status).toBe(200);
 const issuedAt=Date.now(),permit=issued.body as Permit,camp=worldTables.camps.find(c=>c.region===permit.region&&c.pack.every(p=>p.rank==='normal'))!,campView=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:{x:camp.x,y:camp.y}});expect(campView.status).toBe(200);const spawns=campView.body.camps.find((c:any)=>c.id===camp.id).spawns as typeof permit.spawns,normalIds=new Set(spawns.filter(e=>!e.elite&&!e.boss).map(e=>e.id)),world=new World(regionById(permit.region),snapshot.stats,snapshot.resolvedSkills,spawns,permit.completed,permit.seed);world.hero.position={x:camp.x-5,y:camp.y};
 world.radius=100;world.avoidElite=true;world.setMode('auto');for(let i=0;i<3000&&world.hero.hp>0&&world.kills.filter(k=>normalIds.has(k.source_id)).length<normalIds.size;i++)world.step();
 const kills=world.kills.filter(k=>normalIds.has(k.source_id));expect(new Set(kills.map(k=>k.source_id))).toEqual(normalIds);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,world.tick*1000/30-(Date.now()-issuedAt)+100)));
 const command={command_id:randomUUID(),revision:snapshot.revision,lease_id:lease,permit_id:permit.id,build:snapshot.build,sequence:1,from_tick:0,to_tick:world.tick,kills},done=await request('combat/report',command);expect(done.status,JSON.stringify(done.body)).toBe(200);
 expect(done.body.snapshot.progression.reputation).toEqual({meadow:kills.length});expect((await request('combat/report',command)).body).toEqual(done.body);
 const persisted=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[stored.id])).rows[0].state;expect(persisted.progression.reputation).toEqual({meadow:kills.length});
 const view=(await request('progression')).body,wind=view.sections.find((s:any)=>s.id==='reputation').items[0];expect(wind).toMatchObject({id:'meadow',name:'风栖岛 · 船台守望者',currentValue:kills.length,state:'available'});
},60000);
