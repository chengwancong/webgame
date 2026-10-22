import {beforeAll,afterAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {stampHexCooldownView,importSnapshotHexCooldowns} from '../apps/web/src/hex-cooldown-import.ts';
import {migrate,transaction} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {enterHexCombat,persistHexCombat,readHexCooldowns} from '../apps/api/src/hex-cooldown-ledger.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {snapshotSchema,skillSchema} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Requires isolated PostgreSQL');
const schema='qa_hex_ledger_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'ledger_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,payload?:unknown)=>app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});
 const initial=(await req('character',{name:'冷却账本验收'})).json(),lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 return {id:initial.id,req,lease,cookie};
}
function world(){
 const rule=effectRuleSchema.parse({id:'hex-ledger-test',hexMechanism:'hex-aftershock',source:'controlled-gear',name:'ledger test',description:'controlled long ICD, not content tuning',trigger:'hit',chance:1,icd:300,vfxKey:'hex/ledger',action:{type:'heal',ref:'maxHp',ratio:.01}});
 const skill=skillSchema.parse({id:'basic',name:'basic',description:'controlled',kind:'single',damage:10,range:4,radius:0,cooldown:30,cost:0,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}});
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:1000,attack:10,armor:0,speed:1,mana:100,regen:0,effects:[],rules:[rule]},[skill],[{id:'target',name:'target',kind:'melee',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}],[],41);
 w.mode='manual';w.hero.hp=100;w.enemies[0].cooldown=999999;return w;
}
function hit(w:World){(w as any).damage(w.enemies[0],10,false,'basic',{category:'direct',damageType:'physical',skill:w.skills[0],scaled:true});}
const key='hex:hex-aftershock';
it('persists a real trigger across new worlds and restart; repeated checkpoint writes do not extend expiry',async()=>{
 const p=await actor(),a=world(),now=Date.now();
 await transaction(pool,c=>enterHexCombat(c,p.id,'activity:a',a,undefined,now));hit(a);
 await transaction(pool,c=>persistHexCombat(c,p.id,'activity:a',a,undefined,now));
 expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+10000);
 const restored=World.restore(JSON.parse(JSON.stringify(a.exportCheckpoint())));
 await transaction(pool,c=>persistHexCombat(c,p.id,'activity:a',restored,undefined,now+2000));
 expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+10000);
 await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();
 const snap=(await p.req('character')).json();snapshotSchema.parse(snap);expect(snap.hexCooldowns.readyAt[key]).toBe(now+10000);
 const b=world();await transaction(pool,c=>enterHexCombat(c,p.id,'dungeon:b',b,undefined,now+2000));expect(b.comboReady[key]).toBe(240);hit(b);expect(b.hero.hp).toBe(100);
 b.tick=240;hit(b);expect(b.hero.hp).toBe(110);
 await transaction(pool,c=>persistHexCombat(c,p.id,'dungeon:b',b,undefined,now+10000));
 expect((await readHexCooldowns(pool,p.id,now+10000)).readyAt[key]).toBe(now+20000);
});
it('ignores stale former instances, clears the active ledger on actual death, and survives transaction rollback',async()=>{
 const p=await actor(),a=world(),b=world(),now=Date.now();
 await transaction(pool,async c=>{await enterHexCombat(c,p.id,'a',a,undefined,now);hit(a);await persistHexCombat(c,p.id,'a',a,undefined,now);await enterHexCombat(c,p.id,'b',b,undefined,now);});
 (a as any).hurt(10000,'fatal',{category:'direct',damageType:'pure',scaled:true});
 await transaction(pool,c=>persistHexCombat(c,p.id,'a',a,undefined,now));expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+10000);
 (b as any).hurt(10000,'fatal',{category:'direct',damageType:'pure',scaled:true});expect(b.hero.hp).toBe(0);expect(b.comboReady[key]).toBeUndefined();
 await expect(transaction(pool,async c=>{await persistHexCombat(c,p.id,'b',b,undefined,now);throw Error('controlled rollback');})).rejects.toThrow('controlled rollback');
 expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+10000);
 await transaction(pool,c=>persistHexCombat(c,p.id,'b',b,undefined,now));expect((await readHexCooldowns(pool,p.id,now)).readyAt).toEqual({});
 const revived=world();await transaction(pool,c=>enterHexCombat(c,p.id,'c',revived,undefined,now));hit(revived);expect(revived.hero.hp).toBe(110);
});
it('real HTTP activity creation imports prior-instance cooldowns; clients cannot supply a forged ledger',async()=>{
 const p=await actor(),prior=world(),now=Date.now(),event=worldTables.events.find(e=>e.region==='ss-map-wind')!;
 expect(event).toBeTruthy();await transaction(pool,async c=>{await enterHexCombat(c,p.id,'prior-server-world',prior,undefined,now);hit(prior);await persistHexCombat(c,p.id,'prior-server-world',prior,undefined,now);});
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 s.level=30;s.starsea.features.push('events');s.starsea.islands=[...new Set([...s.starsea.islands,'ss-map-wind','wind'])];
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const input={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,kind:'event',region:event.region,target:event.id,position:{x:event.x,y:event.y}};
 const forged=await p.req('field/activity/start',{...input,hexCooldowns:{readyAt:{},observedAt:0}});expect(forged.statusCode).toBe(400);
 const started=await p.req('field/activity/start',input);expect(started.statusCode,started.body).toBe(200);
 const saved=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[p.id,event.id])).rows[0].data,w=World.restore(saved.battle);
 expect(w.comboReady[key]).toBeGreaterThan(0);expect(w.comboReady[key]).toBeLessThanOrEqual(300);
 expect((await pool.query('SELECT scope FROM ow_hex_cooldowns WHERE character=$1',[p.id])).rows[0].scope).toBe('activity:'+saved.instance);
 expect((await p.req('field/activity/start',input)).json()).toEqual(started.json());
});
it('additive migration is idempotent and leaves original character, receipts and rewards untouched',async()=>{
 const p=await actor(),before=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 await migrate(pool);await migrate(pool);
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(before);
 expect((await pool.query('SELECT 1 FROM ow_schema WHERE version=18')).rowCount).toBe(1);
});
it('bootstraps an old trusted checkpoint once without refreshing its remaining cooldown on every save',async()=>{
 const p=await actor(),w=world(),now=Date.now();w.tick=90;w.comboReady[key]=150;
 await transaction(pool,c=>persistHexCombat(c,p.id,'old-run',w,undefined,now));expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+2000);
 await transaction(pool,c=>persistHexCombat(c,p.id,'old-run',World.restore(w.exportCheckpoint()),undefined,now+1000));expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+2000);
});
it('late-joining actors do not spend imported cooldown while the older instance catches up before their activation tick',async()=>{
 const p=await actor(),prior=world(),party=world(),now=Date.now();
 await transaction(pool,async c=>{await enterHexCombat(c,p.id,'old',prior,undefined,now);hit(prior);await persistHexCombat(c,p.id,'old',prior,undefined,now);});
 party.addPlayer(p.id,structuredClone(party.stats),structuredClone(party.skills));party.players.get(p.id)!.activeFrom=900;
 await transaction(pool,c=>enterHexCombat(c,p.id,'late-party',party,p.id,now));expect(party.players.get(p.id)!.comboReady[key]).toBe(1200);
});
it('replayed receipts keep identical JSON data but carry fresh server time after the recorded cooldown expired',async()=>{
 const p=await actor(),w=world(),now=Date.now();w.stats.rules![0].icd=90;
 await transaction(pool,async c=>{await enterHexCombat(c,p.id,'header-clock',w,undefined,now);hit(w);await persistHexCombat(c,p.id,'header-clock',w,undefined,now);});
 const s=(await p.req('character')).json(),body={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:s.gear[0].id};
 const first=await p.req('gear/lock',body);expect(first.statusCode,first.body).toBe(200);
 const firstBody=first.json(),view=firstBody.snapshot.hexCooldowns;expect(view.readyAt[key]).toBeGreaterThan(view.observedAt);
 stampHexCooldownView(firstBody,()=>1000,Number(first.headers['x-aw-server-now']));
 const currentClient=world();importSnapshotHexCooldowns(currentClient,firstBody.snapshot,()=>1000);hit(currentClient);expect(currentClient.hero.hp).toBe(100);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,view.readyAt[key]-Date.now())+30));
 const again=await p.req('gear/lock',body);expect(again.json()).toEqual(first.json()); // JSONB may reorder object keys
 expect(Number(again.headers['x-aw-server-now'])).toBeGreaterThanOrEqual(view.readyAt[key]);
 expect(Number(again.headers['x-aw-server-now'])).toBeGreaterThan(Number(first.headers['x-aw-server-now']));
 const replayBody=again.json();stampHexCooldownView(replayBody,()=>4000,Number(again.headers['x-aw-server-now']));
 const reconnectedClient=world();importSnapshotHexCooldowns(reconnectedClient,replayBody.snapshot,()=>4000);expect(reconnectedClient.comboReady[key]).toBeUndefined();hit(reconnectedClient);expect(reconnectedClient.hero.hp).toBe(110);
});
it('real authenticated dungeon start imports the ledger into its party actor and departure cannot clear it',async()=>{
 await app.close();app=createApp(pool,{campaign:'legacy',testLogin:true});await app.listen({host:'127.0.0.1',port:0});
 const p=await actor(),prior=world(),now=Date.now(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 s.level=30;s.gold=1000;s.material=100;s.story={version:1,legacyAccess:true,events:{},choices:{}};s.progress.regions=['town','meadow'];await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 await transaction(pool,async c=>{await enterHexCombat(c,p.id,'previous-activity',prior,undefined,now);hit(prior);await persistHexCombat(c,p.id,'previous-activity',prior,undefined,now);});
 const command=(op:string,extra:object={})=>p.req('dungeons/command',{command_id:randomUUID(),lease_id:p.lease,op,...extra});
 const made=await command('create',{dungeon_id:'normal-meadow'});expect(made.statusCode,made.body).toBe(200);
 const id=made.json().instance.id,socket=new WebSocket('ws://127.0.0.1:'+(app.server.address() as any).port+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});
 try{
  const state=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No authenticated state')),5000);socket.on('message',raw=>{if(JSON.parse(String(raw)).type==='state'){clearTimeout(timer);resolve();}});socket.once('error',reject);});
  await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));await state;
  const ready=await command('ready',{instance_id:id});expect(ready.statusCode,ready.body).toBe(200);
  const started=await command('start',{instance_id:id});expect(started.statusCode,started.body).toBe(200);
  const saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,w=World.restore(saved.battle);
  expect(w.players.get(p.id)!.comboReady[key]).toBeGreaterThan(w.tick);
  expect((await pool.query('SELECT scope FROM ow_hex_cooldowns WHERE character=$1',[p.id])).rows[0].scope).toBe('dungeon:'+id);
  expect((await command('leave',{instance_id:id})).statusCode).toBe(200);
  expect((await readHexCooldowns(pool,p.id,now)).readyAt[key]).toBe(now+10000);
 }finally{socket.close();await command('leave',{instance_id:id});}
},15000);
