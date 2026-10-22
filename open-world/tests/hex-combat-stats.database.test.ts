import {beforeAll,afterAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {fieldActivityViewSchema} from '../packages/contracts/field-activities.ts';
import {dungeonViewSchema} from '../packages/contracts/dungeons.ts';
import {hexCombatStatsSchema} from '../packages/contracts/hex-combat-stats.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Requires isolated PostgreSQL');
const schema='qa_hex_stats_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let app=createApp(pool,{campaign:'legacy',testLogin:true}),origin='';
let legacy=false;
async function launch(){app=createApp(pool,{...(legacy?{campaign:'legacy' as const}:{}),testLogin:true});await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+(app.server.address() as any).port;}
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await launch();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function actor(){
 const login=await fetch(origin+'/api/session/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'hexstats_'+randomUUID().slice(0,8)})}),cookie=login.headers.get('set-cookie')!.split(';')[0];
 const req=async(path:string,body?:unknown)=>{const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};};
 const s=(await req('character',{name:'统计隔离验收'})).body;s.level=30;s.gold=1000;s.material=100;s.story={version:1,legacyAccess:true,events:{},choices:{}};s.progress.regions=['town','meadow'];if(s.starsea){s.starsea.features.push('events');s.starsea.islands=[...new Set([...s.starsea.islands,'ss-map-wind','wind'])];}await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await req('control',{client_id:randomUUID()})).body.lease_id;return {req,cookie,lease,id:s.id};
}
// Only the isolated server checkpoint receives this deterministic attribution fixture.
// Actual executor damage is saved, never client-submitted counters or rewards.
function measure(w:World,character?:string){const run=()=>{w.stats.rules=[effectRuleSchema.parse({id:'qa-hex-stats',hexMechanism:'hex-aftershock',source:'qa-gear',name:'QA',description:'attribution fixture',trigger:'hit',chance:1,icd:30,action:{type:'nova',ratio:.5,radius:3,ref:'hit',damageType:'pure'},vfxKey:'hex/qa'})];w.mode='manual';const target=w.enemies.find(e=>e.alive)!;(w as any).damage(target,1,false,'basic',{category:'direct',damageType:'pure',scaled:true});};if(character)w.forPlayer(character,run);else run();}
it('real activity HTTP exposes persisted executor counters after restart, including when battle payload is hidden; rejects client counters',async()=>{
 const p=await actor(),event=worldTables.events.find(e=>e.region==='ss-map-wind')!,s=(await p.req('character')).body;
 const start=await p.req('field/activity/start',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,kind:'event',region:event.region,target:event.id,position:{x:event.x,y:event.y}});expect(start.status,JSON.stringify(start.body)).toBe(200);
 await app.close();const data=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[p.id,event.id])).rows[0].data,w=World.restore(data.battle);measure(w);data.battle=w.exportCheckpoint();data.status='failed'; // terminal fixture: no extra live ticks or reward grants
 await pool.query('UPDATE ow_field_activities SET status=$1,data=$2 WHERE character=$3 AND target=$4',[data.status,data,p.id,event.id]);await launch();
 const response=await p.req('field/activity'),v=fieldActivityViewSchema.parse(response.body.activities.find((a:any)=>a.instance===data.instance));expect(v.battle).toBeUndefined();expect(v.hexCombatStats).toMatchObject({coverage:'complete',rules:[{rune:'hex-aftershock',triggers:1}]});expect(v.hexCombatStats!.totalDamage).toBe(w.hexStatistics!.totalDamage);
 expect((await p.req('field/activity/input',{lease_id:p.lease,instance:data.instance,hexCombatStats:{totalDamage:999999}})).status).toBe(400);
 const again=(await p.req('field/activity')).body.activities.find((a:any)=>a.instance===data.instance);expect(again.hexCombatStats).toEqual(v.hexCombatStats);
 const other=await actor();expect((await other.req('field/activity')).body.activities).toEqual([]);
});
it('authenticated dungeon HTTP and WebSocket project self counters from persisted party actor, not focused/base actor',async()=>{
 await app.close();legacy=true;await launch();
 const p=await actor(),command=(op:string,extra:object={})=>p.req('dungeons/command',{command_id:randomUUID(),lease_id:p.lease,op,...extra});
 const made=await command('create',{dungeon_id:'normal-meadow'});expect(made.status,JSON.stringify(made.body)).toBe(200);const id=made.body.instance.id;
 async function connect(){const socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});let ready:(v:any)=>void;const state=new Promise<any>(resolve=>{ready=resolve;});socket.on('message',raw=>{const value=JSON.parse(String(raw));if(value.type==='state')ready(value.instance);});await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));return {socket,state};}
 const first=await connect();await first.state;expect((await command('ready',{instance_id:id})).status).toBe(200);expect((await command('start',{instance_id:id})).status).toBe(200);first.socket.close();await app.close();
 const saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,w=World.restore(saved.battle);measure(w,p.id);saved.battle=w.exportCheckpoint();await pool.query('UPDATE ow_dungeons SET data=$1 WHERE id=$2',[saved,id]);await launch();
 const http=await p.req('dungeons/'+id+'/result');expect(http.status).toBe(200);const view=dungeonViewSchema.parse(http.body.instance);expect(view.hexCombatStats).toMatchObject({coverage:'complete',rules:[{rule:'qa-hex-stats',triggers:1}]});
 const second=await connect();try{const frame=dungeonViewSchema.parse(await second.state);expect(frame.hexCombatStats!.rules).toEqual(view.hexCombatStats!.rules);hexCombatStatsSchema.parse(frame.hexCombatStats);}finally{second.socket.close();await command('leave',{instance_id:id});}
},20000);
it('ordinary permit results explicitly report unavailable, never a fabricated zero contribution',async()=>{
 const p=await actor(),permit=await p.req('permit',{lease_id:p.lease,region:'meadow',attempt_id:randomUUID()});expect(permit.status,JSON.stringify(permit.body)).toBe(200);
 const result=await p.req('combat/results/'+permit.body.id);expect(result.status).toBe(200);
 expect(hexCombatStatsSchema.parse(result.body.hexCombatStats)).toMatchObject({coverage:'unavailable',totalDamage:null,directDamage:null,share:null,rules:[]});
});
