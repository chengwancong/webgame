import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {battleProgressResponseSchema,type Snapshot,type Permit} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real isolated PostgreSQL required');
const schema='qa_playability_phase_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(){const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'phase_'+randomUUID().replaceAll('-','').slice(0,20)}}),cookie=String(login.headers['set-cookie']).split(';')[0];const request=async(path:string,body?:object)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body});const created=await request('character',{name:'相位兼容'});expect(created.statusCode,created.body).toBe(200);const s=created.json() as Snapshot,control=await request('control',{client_id:randomUUID()});return {request,s,lease:control.json().lease_id};}
it('manual tracking stays durable on the server and does not enter the old strict public state',async()=>{
 const p=await player(),result=await p.request('quest',{command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,op:'track',task:'ss-c01-t01',region:'ss-map-wind'});expect(result.statusCode,result.body).toBe(200);
 const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 expect(stored.starsea.trackedManually).toBe(true);expect(result.json().snapshot.starsea).not.toHaveProperty('trackedManually');expect((await p.request('character')).json().starsea).not.toHaveProperty('trackedManually');
},30000);
it('phase progress reads the owned frozen permit, writes no rewards and keeps the original result shape',async()=>{
 const p=await player(),issued=await p.request('permit',{lease_id:p.lease,region:'ss-map-boss-1'});expect(issued.statusCode,issued.body).toBe(200);const permit=issued.json() as Permit;
 const state=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 const receipts=async()=>(await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1',[p.s.id])).rows[0].n;
 const before=await state(),count=await receipts();const original=await p.request('combat/results/'+permit.id);expect(original.statusCode,original.body).toBe(200);expect(original.json()).not.toHaveProperty('phase_progress');
 const progress=await p.request('combat/results/'+permit.id+'/progress');expect(progress.statusCode,progress.body).toBe(200);expect(battleProgressResponseSchema.parse(progress.json()).phase_progress).toMatchObject({phase:'normal',completed:0,total:6});
 expect(await state()).toEqual(before);expect(await receipts()).toBe(count);
 const other=await player();expect((await other.request('combat/results/'+permit.id+'/progress')).statusCode).toBe(404);
},30000);
