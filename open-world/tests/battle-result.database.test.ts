import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {battleResultSchema,type Snapshot,type Permit} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'br_'+randomUUID().replaceAll('-','').slice(0,24)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 let s=(await request('character',{name:'战斗记录验证'})).body as Snapshot;s.progress.regionKills={meadow:6};s.progress.regionElites={meadow:1};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const permit=async(attempt_id=randomUUID(),region='meadow-boss')=>{const r=await request('permit',{lease_id:lease,region,attempt_id});expect(r.status).toBe(200);const p=r.body as Permit;await pool.query("UPDATE ow_permits SET created=now()-interval '60 seconds' WHERE id=$1",[p.id]);return p;};
 const report=async(p:Permit)=>{s=(await request('character')).body;const body={command_id:randomUUID(),revision:s.revision,lease_id:lease,permit_id:p.id,build:p.build,sequence:1,from_tick:0,to_tick:60,kills:p.spawns.map(m=>({source_id:m.id,tick:30}))};const done=await request('combat/report',body);expect(done.status).toBe(200);return {body,done};};
 return {request,permit,report,lease,s};
}
it('island failure advice is selected by the server and never writes rewards or progress',async()=>{
 const p=await player(),run=await p.permit(),before=(await p.request('character')).body;
 const fatal={enemy:'督猎者',skill:'背刺',damage:120,damageType:'物理',statuses:['减速'],hint:'它会绕到你身后出手',kind:'melee'};
 const review=await p.request('combat/review',{permit:run.id,fatal,recent:[]});
 expect(review.status).toBe(200);expect(review.body.advice.map((a:any)=>a.label)).toEqual(['控场技能','加生存天赋','强化护甲']);
 expect((await p.request('character')).body).toEqual(before);
 const other=await player();expect((await other.request('combat/review',{permit:run.id,fatal,recent:[]})).status).toBe(404);
 expect((await p.request('combat/review',{permit:run.id,fatal,recent:[],advice:[{label:'自选',target:'bag'}]})).status).toBe(400);
});
it('dungeon loot goes directly into a full inventory, one reward grant across retries; exact per-run totals',async()=>{
 const p=await player();while(p.s.gear.length<24)p.s.gear.push({...p.s.gear[0],id:randomUUID()});p.s.gold=12345;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[p.s,p.s.id]);
 const run=await p.permit(),before=await p.request('combat/results/'+run.id);expect(before.body.totals).toEqual({gold:0,xp:0,material:0});
 const {body,done}=await p.report(run);expect((await p.request('combat/report',body)).body).toEqual(done.body);
 const result=battleResultSchema.parse((await p.request('combat/results/'+run.id)).body);expect(result).toMatchObject({success:true,first_clear:true,pending_gear:0,delivery:'inventory',history_complete:true,unlocked_regions:['forest']});
 expect(result.totals).toEqual({gold:done.body.delta.gold,xp:done.body.delta.xp,material:done.body.delta.material});expect(result.totals.gold).not.toBe(done.body.snapshot.gold);
 expect(result.books).toEqual({ember:1});expect(result.gear.length).toBeGreaterThan(0);expect(done.body.snapshot.gear.length).toBe(24+result.gear.length);expect(done.body.snapshot.rewards).toEqual([]);
 expect(result.materials).toEqual(done.body.delta.progression.materials);for(const g of result.gear)expect(done.body.snapshot.gear.filter((x:any)=>x.id===g.id)).toHaveLength(1);
 expect((await p.request('receipt/'+body.command_id)).body).toEqual(done.body);expect((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,body.command_id])).rows[0].n).toBe(1);
 const again=await p.permit();expect(again.id).not.toBe(run.id);const repeated=await p.report(again),second=(await p.request('combat/results/'+again.id)).body;expect(second.first_clear).toBe(false);expect(second.unlocked_regions).toEqual([]);expect(second.books).toEqual({});expect(repeated.done.body.snapshot.skillBooks.ember).toBe(1);
 expect(battleResultSchema.parse((await p.request('combat/results/'+run.id)).body)).toEqual(result);
});
it('attempt retry reuses the permit, outdoor drops stay on the ground, records are owner-only',async()=>{
 const p=await player(),id=randomUUID(),first=await p.permit(id),retry=await p.permit(id);expect(retry.id).toBe(first.id);
 const outdoor=await p.permit(randomUUID(),'meadow'),{done}=await p.report(outdoor);expect(done.body.snapshot.gear.length).toBe(p.s.gear.length);expect(done.body.snapshot.rewards.length).toBeGreaterThan(0);expect((await p.request('combat/results/'+outdoor.id)).body.delivery).toBe('ground');
 const other=await player();expect((await other.request('combat/results/'+first.id)).status).toBe(404);expect((await app.inject({url:'/api/combat/results/'+first.id})).statusCode).toBe(401);
});
it('legacy records never invent totals or first-clear history',async()=>{
 const p=await player(),run=await p.permit();await p.report(run);const row=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[run.id])).rows[0].private_data;delete row.battleResult;await pool.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[row,run.id]);const result=(await p.request('combat/results/'+run.id)).body;expect(result.success).toBe(true);expect(result.history_complete).toBe(false);expect(result.first_clear).toBeNull();expect(result.totals).toEqual({gold:null,xp:null,material:null});
});
