import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {taskViewSchema,type TaskView,type Snapshot,type Permit} from '../packages/contracts/index.ts';
import {taskDefinitions,taskTypes} from '../packages/content/tasks.ts';
import {rewards} from '../apps/api/src/economy.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Task persistence tests require a real isolated PostgreSQL database.');
const pool=poolFor(dsn),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'task_'+randomUUID().replaceAll('-','').slice(0,22)}});expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const snapshot=(await request('character',{name:'任务持久化验收'})).body as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 return {request,snapshot,lease,cookie};
}
async function completeSix(p:Awaited<ReturnType<typeof player>>){
 const permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 await pool.query("UPDATE ow_permits SET created=now()-interval '30 seconds' WHERE id=$1",[permit.id]);
 const s=(await p.request('character')).body as Snapshot;
 const report=await p.request('combat/report',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:60,kills:permit.spawns.slice(0,6).map(m=>({source_id:m.id,tick:30}))});expect(report.status).toBe(200);return report.body.snapshot as Snapshot;
}
const view=async(p:Awaited<ReturnType<typeof player>>)=>taskViewSchema.parse((await p.request('tasks')).body);
it('publishes only official objectives, flat categories and one primary type per task',async()=>{
 expect((await app.inject({url:'/api/tasks'})).statusCode).toBe(401);const p=await player(),v=await view(p);
 expect(v.current.map(t=>t.taskId)).toEqual(['first-six','first-boss']);expect(v.archive).toEqual([]);expect(v.types.map(t=>t.id)).toEqual(['main','dungeon','side']);
 expect(v.current.find(t=>t.taskId==='first-boss')).toMatchObject({typeId:'main',regionId:'meadow-boss',state:'active',reward:{gold:50,material:5,xp:0},chain:[]});
 expect((await p.request('task/claim',{command_id:randomUUID(),revision:p.snapshot.revision,lease_id:p.lease,task:'first-six'})).status).toBe(409);expect((await view(p)).archive).toHaveLength(0);
});
it('records real completion separately, archives atomically with payment and replays a lost response once',async()=>{
 const p=await player(),s=await completeSix(p),before=await view(p),task=before.current.find(t=>t.taskId==='first-six')!;
 expect(task.state).toBe('ready');expect(task.goalAt).not.toBeNull();expect(before.archive).toHaveLength(0);
 const command={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,task:'first-six'};
 const first=await p.request('task/claim',command),again=await p.request('task/claim',command),recovered=await p.request('receipt/'+command.command_id);
 expect(first.status).toBe(200);expect(again.body).toEqual(first.body);expect(recovered.body).toEqual(first.body);expect(first.body.delta).toEqual({gold:50,material:5,xp:0});
 const after=await view(p);expect(after.current.some(t=>t.taskId==='first-six')).toBe(false);expect(after.archive).toHaveLength(1);
 const record=after.archive[0];expect(record).toMatchObject({taskId:'first-six',state:'archived',current:6,total:6,goalAt:task.goalAt,reward:{gold:50,material:5,xp:0},source:'confirmed'});expect(record.story).toBeTruthy();expect(Date.parse(record.claimedAt!)).toBeGreaterThanOrEqual(Date.parse(record.goalAt!));
 expect((await p.request('character')).body.gold).toBe(s.gold+50);expect((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 AND command=$2',[s.id,command.command_id])).rowCount).toBe(1);
 const restarted=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});await restarted.ready();try{const response=await restarted.inject({url:'/api/tasks',headers:{cookie:p.cookie}});expect(taskViewSchema.parse(response.json()).archive).toEqual(after.archive);}finally{await restarted.close();}
 expect((await p.request('task/claim',{...command,command_id:randomUUID(),revision:first.body.revision})).body.code).toBe('CLAIMED');
});
it('concurrent distinct claims cannot duplicate the reward or archive',async()=>{
 const p=await player(),s=await completeSix(p),base={revision:s.revision,lease_id:p.lease,task:'first-six'};
 const responses=await Promise.all([p.request('task/claim',{...base,command_id:randomUUID()}),p.request('task/claim',{...base,command_id:randomUUID()})]);
 expect(responses.filter(r=>r.status===200)).toHaveLength(1);expect((await view(p)).archive).toHaveLength(1);expect((await p.request('character')).body.gold).toBe(s.gold+50);
});
it('a database failure rolls back payment, archive, receipt and claimed flag together',async()=>{
 const p=await player(),s=await completeSix(p),command={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,task:'first-six'};
 await pool.query(`CREATE OR REPLACE FUNCTION task_qa_fail_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.character='${s.id}'::uuid THEN RAISE EXCEPTION 'task QA rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER task_qa_rollback BEFORE INSERT ON ow_ledger FOR EACH ROW EXECUTE FUNCTION task_qa_fail_ledger()`);
 try{expect((await p.request('task/claim',command)).status).toBe(500);expect((await view(p)).archive).toHaveLength(0);expect((await p.request('character')).body.gold).toBe(s.gold);expect((await p.request('character')).body.progress.tasks).not.toContain('first-six');expect((await p.request('receipt/'+command.command_id)).status).toBe(404);}
 finally{await pool.query('DROP TRIGGER task_qa_rollback ON ow_ledger; DROP FUNCTION task_qa_fail_ledger()');}
 expect((await p.request('task/claim',command)).status).toBe(200);expect((await view(p)).archive).toHaveLength(1);
});
it('historical snapshots survive definition, reward and type edits',async()=>{
 const p=await player(),s=await completeSix(p);await p.request('task/claim',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,task:'first-six'});const archive=(await view(p)).archive;
 const definition=structuredClone(taskDefinitions[0]),type=structuredClone(taskTypes[0]),gold=rewards.taskGold;
 try{taskDefinitions[0].title='后来改名';taskDefinitions[0].goal='后来改目标';taskDefinitions[0].story='后来改剧情';taskTypes[0].name='后来改类型';taskTypes[0].enabled=false;rewards.taskGold=999;
  expect((await view(p)).archive).toEqual(archive);expect((await view(p)).types[0]).toMatchObject({enabled:false,name:'后来改类型'});
 }finally{Object.assign(taskDefinitions[0],definition);Object.assign(taskTypes[0],type);rewards.taskGold=gold;}
});
it('migrates proven legacy payments, leaves unknown history empty and preserves wallets on repeated startup',async()=>{
 const p=await player(),s=await completeSix(p),command={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,task:'first-six'};await p.request('task/claim',command);
 await pool.query("UPDATE ow_characters SET state=state-'taskJournal' WHERE id=$1",[s.id]);
 const unknown=await player();await pool.query("UPDATE ow_characters SET state=(state-'taskJournal')||jsonb_build_object('progress',(state->'progress')||'{\"tasks\":[\"first-six\"]}'::jsonb) WHERE id=$1",[unknown.snapshot.id]);
 const before=(await p.request('character')).body;
 await pool.query('DELETE FROM ow_schema WHERE version=10');await migrate(pool);
 const legacy=(await view(p)).archive[0],missing=(await view(unknown)).archive[0];
 expect(legacy).toMatchObject({source:'legacy-receipt',reward:{gold:50,material:5,xp:0},goal:null,story:null,chain:null,goalAt:null});expect(legacy.claimedAt).toBeTruthy();
 expect(missing).toMatchObject({source:'legacy-unrecorded',reward:null,claimedAt:null,goalAt:null,goal:null,story:null,chain:null});
 const once=await view(p);await migrate(pool);expect(await view(p)).toEqual(once);expect((await p.request('character')).body).toEqual(before);
});
