import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'ws_'+randomUUID().replaceAll('-','').slice(0,22)}}),cookie=String(login.headers['set-cookie']).split(';')[0];const request=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};let s=(await request('character',{name:'绑定与主线'})).body as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;const write=async(path:string,body:object)=>{const result=await request(path,{command_id:randomUUID(),revision:s.revision,lease_id:lease,...body});if(result.status===200)s=result.body.snapshot;return result;};return {request,write,lease,get s(){return s;},reload:async()=>{s=(await request('character')).body;return s;}};}

it('db15 preserves every non-quest field and every historical row; migration is idempotent',async()=>{
 const p=await player(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 s.starsea={version:1,chapter:1,task:2,step:1,attempt:3,wave:{task:'ss-c01-t03',step:1,region:'ss-map-wind',spawns:[],killed:[],startedAt:123,minClearMs:456},openingComplete:true,choices:{},done:['ss-c01-t01','ss-c01-t02'],npcs:['ss-npc-milo'],features:['forge'],islands:['ss-map-wind'],bosses:[],hardmode:false,crystals:[]};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.s.id]);
 const rows=async(table:string)=>(await pool.query(`SELECT row_to_json(t) data FROM ${table} t`)).rows.map(r=>JSON.stringify(r.data)).sort();
 const before=Object.fromEntries(await Promise.all(['ow_accounts','ow_receipts','ow_ledger'].map(async t=>[t,await rows(t)])));
 await pool.query('DELETE FROM ow_schema WHERE version=15');await migrate(pool);
 const current=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 const {starsea:oldQuest,...oldRest}=s,{starsea:quest,...newRest}=current;expect(newRest).toEqual(oldRest);expect(quest.wave).toEqual(oldQuest.wave);expect(quest.quests['ss-c01-t03']).toMatchObject({step:1,attempt:3});expect(quest.attempts['ss-c01-t03']).toBe(3);
 expect((await pool.query('SELECT before_state,after_state FROM ow_quest_migrations WHERE character=$1',[p.s.id])).rows[0]).toEqual({before_state:oldQuest,after_state:quest});
 await migrate(pool);expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state).toEqual(current);
 for(const [table,value] of Object.entries(before))expect(await rows(table)).toEqual(value);
 expect((await p.reload()).starsea?.version).toBe(2);
});
it('gate command replay and independent tracking survive reload without duplicate receipts or rewards',async()=>{
 const p=await player();await p.request('permit',{lease_id:p.lease,region:'ss-map-wind'});
 const payload={op:'gate',gate:'gate-wind',region:'ss-map-wind',command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease};
 const first=await p.request('quest',payload);expect(first.status,JSON.stringify(first.body)).toBe(200);const replay=await p.request('quest',payload);expect(replay).toEqual(first);
 expect((await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,payload.command_id])).rows[0].n).toBe(1);
 await p.reload();expect(p.s.starsea!.wave!.task).toBe('gate:gate-wind');expect(p.s.gold).toBe(first.body.snapshot.gold);
 expect((await p.write('quest',{op:'track',task:null,region:'ss-map-wind'})).status).toBe(200);await p.reload();expect(p.s.starsea!.tracked).toBeNull();expect(p.s.starseaView!.recommend).toBeTruthy();expect(p.s.starsea!.wave!.task).toBe('gate:gate-wind');
});
