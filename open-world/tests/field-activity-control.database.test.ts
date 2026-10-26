import {beforeAll,afterAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {skillSchema} from '../packages/contracts/index.ts';
import {advanceFieldActivity} from '../apps/api/src/field-activities.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Isolated PostgreSQL required');
const schema='qa_field_control_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema});let app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function start(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'fieldcontrol_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0],req=(path:string,payload?:any)=>app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload});
 const s=(await req('character',{name:'活动移动验收'})).json(),lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 s.level=30;s.starsea.features.push('events');await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const event=worldTables.events.find(e=>e.region==='ss-map-wind')!;const response=await req('field/activity/start',{command_id:randomUUID(),revision:s.revision,lease_id:lease,kind:'event',region:event.region,target:event.id,position:{x:event.x,y:event.y}});expect(response.statusCode,response.body).toBe(200);
 const data=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[s.id,event.id])).rows[0].data;return {id:s.id,req,lease,data};
}
it('normal activity start is full auto (doc 27 R1)',async()=>{const p=await start();expect(World.restore(p.data.battle).mode).toBe('auto');});
it('HTTP rejects manual mode while accepting auto, semi and actual movement input',async()=>{
 const p=await start(),body={lease_id:p.lease,instance:p.data.instance};
 expect((await p.req('field/activity/input',{...body,mode:'auto'})).statusCode).toBe(200);
 expect((await p.req('field/activity/input',{...body,mode:'manual'})).statusCode).toBe(400);
 expect((await p.req('field/activity/input',{...body,mode:'semi',movement:{x:1,y:0}})).statusCode).toBe(200);
 const saved=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2',[p.id,p.data.target])).rows[0].data,w=World.restore(saved.battle);expect(w.mode).toBe('semi');expect(w.exportCheckpoint().data.input).toEqual({x:1,y:0});
});
it('keeps the checkpoint mode without refilling HP or resetting enemies, RNG, cooldowns or counters',async()=>{
 const p=await start();await app.close();const w=World.restore(p.data.battle);w.mode='auto';w.hero.hp=100;w.cooldowns.saved=300;w.comboReady['hex:hex-aftershock']=600;w.hexLedger={deaths:0,triggers:{'hex:hex-aftershock':{tick:w.tick,ready:600}}};
 p.data.battle=w.exportCheckpoint();const before=structuredClone(p.data.battle.data);advanceFieldActivity(p.data,p.data.startedAt+p.data.tick*1000/30,0);const restored=World.restore(p.data.battle);
 expect(restored.mode).toBe('auto');expect(restored.hero.hp).toBe(100);for(const key of ['enemies','randomState','cooldowns','comboReady','hexLedger','effectStats'])expect(p.data.battle.data[key]).toEqual(before[key]);
 await pool.query('UPDATE ow_field_activities SET data=$1 WHERE character=$2 AND target=$3',[p.data,p.id,p.data.target]);app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();
 const response=(await p.req('field/activity')).json().activities.find((a:any)=>a.instance===p.data.instance);expect(World.restore(response.battle).mode).toBe('auto');
});
it('semi mode still executes automatic skills and honors explicit movement without walking to attack targets',()=>{
 const skill=skillSchema.parse({id:'control-test',name:'QA',description:'movement ownership',kind:'single',damage:10,range:3,radius:0,cooldown:30,cost:0,windup:0,duration:1});
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:1000,attack:10,armor:0,speed:2,mana:100,regen:0,effects:[]},[skill],[{id:'target',name:'target',kind:'melee',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('semi');w.enemies[0].cooldown=99999;const position={...w.hero.position};let casts=0;
 for(let i=0;i<90;i++){w.step();casts+=w.events.filter(e=>e.type==='cast_started').length;}expect(casts).toBeGreaterThan(0);expect(w.enemies[0].hp).toBeLessThan(10000);expect(w.hero.position).toEqual(position);
 w.control(-1,0);for(let i=0;i<10;i++)w.step();expect(w.hero.position.x).toBeLessThan(position.x);
});
