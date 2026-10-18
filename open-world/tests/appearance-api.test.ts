import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {appearanceContent} from '../packages/content/appearance.ts';
import {appearanceSlots,appearanceViewSchema,appearancePreviewSchema} from '../packages/contracts/appearance.ts';
import {receiptSchema,type CharacterState,type Permit} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Appearance API tests require real PostgreSQL. No mock/skip.');
const schema='qa_appearance_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:8}),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
const starters=appearanceContent.bundles.filter(b=>b.unlock.type==='starter').map(b=>b.id);
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_'+randomUUID().replaceAll('-','').slice(0,20)}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'换装测试'});expect(created.status).toBe(200);
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.body.id])).rows[0].state as CharacterState;
 // Established-character fixtures keep previously available services; new-character gates are verified in story.database.test.ts.
 delete s.story;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 const command=(selection:unknown={},revision=s.revision)=>({command_id:randomUUID(),revision,lease_id:lease,selection});
 const stored=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state as CharacterState;
 return {s,lease,request,command,stored};
}
it('authenticates and previews all seven parts without changing persistent state',async()=>{
 expect((await app.inject({url:'/api/appearance'})).statusCode).toBe(401);
 const p=await player(),before=await p.stored(),selection=Object.fromEntries(appearanceSlots.map((slot,i)=>[slot,starters[i%starters.length]]));
 delete selection.weapon; // weapon compatibility follows the actual main hand.
 const view=await p.request('appearance');expect(view.status).toBe(200);expect(()=>appearanceViewSchema.parse(view.body)).not.toThrow();
 const preview=await p.request('appearance/preview',{revision:before.revision,selection});expect(preview.status).toBe(200);expect(()=>appearancePreviewSchema.parse(preview.body)).not.toThrow();
 expect(Object.keys(preview.body.resolvedAppearance.parts)).toEqual([...appearanceSlots]);expect(await p.stored()).toEqual(before);
});
it('applies idempotently with concurrent retries while preserving build, wallet and battle clock',async()=>{
 const p=await player(),permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 const before=(await pool.query('SELECT * FROM ow_permits WHERE id=$1',[permit.id])).rows[0],input=p.command({head:starters[1],body:starters[2],hands:starters[3],legs:starters[1],feet:starters[2],back:starters[3],weapon:'100011'});
 const results=await Promise.all([p.request('appearance/apply',input),p.request('appearance/apply',input)]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[1].body).toEqual(results[0].body);expect(()=>receiptSchema.parse(results[0].body)).not.toThrow();
 const saved=await p.stored();expect(saved.revision).toBe(p.s.revision+1);expect(saved.build).toBe(p.s.build);expect([saved.gold,saved.material,saved.xp]).toEqual([p.s.gold,p.s.material,p.s.xp]);expect(saved.appearance!.selection).toEqual(input.selection);
 expect((await pool.query('SELECT * FROM ow_permits WHERE id=$1',[permit.id])).rows[0]).toEqual(before);
 expect((await pool.query('SELECT * FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(1);expect((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(1);
 expect((await p.request('appearance/apply',{...input,selection:{head:starters[0]}})).body.code).toBe('COMMAND_CONFLICT');
 const report=await p.request('combat/report',{command_id:randomUUID(),revision:saved.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:0,kills:[]});expect(report.status).toBe(200);
});
it('serializes competing saves, rejects stale revision and requires the owning lease',async()=>{
 const p=await player(),results=await Promise.all([p.request('appearance/apply',p.command({head:starters[1]})),p.request('appearance/apply',p.command({head:starters[2]}))]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(results.find(r=>r.status===409)!.body.code).toBe('REVISION');
 const saved=await p.stored();expect((await p.request('appearance/apply',{...p.command({},saved.revision),lease_id:randomUUID()})).body.code).toBe('CONTROL');expect((await p.request('appearance/preview',{revision:p.s.revision,selection:{}})).body.code).toBe('REVISION');
});
it('rejects locked, unknown, path-injected and invalid slot choices without receipts or mutations',async()=>{
 const p=await player(),view=(await p.request('appearance')).body,locked=view.catalog.find((b:any)=>!b.owned);expect(locked).toBeDefined();const before=await p.stored();
 for(const selection of [{head:locked.id},{head:'not-a-set'},{head:'../../private'},{boots:starters[0]}]){const input=p.command(selection),r=await p.request('appearance/apply',input);expect([400,409]).toContain(r.status);expect(await p.stored()).toEqual(before);expect((await pool.query('SELECT 1 FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(0);}
});
it('auto follows main-hand equip and unequip, while subweapons never change visible weapon',async()=>{
 const p=await player(),bow=p.s.gear.find(g=>g.base==='bow')!;
 const assigned=await p.request('progression/action',{...p.command(),selection:undefined,action:{op:'grid.assign',target:bow.id,slot:1}});expect(assigned.status).toBe(200);expect(assigned.body.snapshot.resolvedAppearance.family).toBe('sword');
 const equipped=await p.request('gear/equip',{command_id:randomUUID(),revision:assigned.body.revision,lease_id:p.lease,gear_id:bow.id});expect(equipped.status).toBe(200);expect(equipped.body.snapshot.resolvedAppearance.family).toBe('bow');
 const unequipped=await p.request('gear/unequip',{command_id:randomUUID(),revision:equipped.body.revision,lease_id:p.lease,gear_id:bow.id});expect(unequipped.status).toBe(200);expect(unequipped.body.snapshot.resolvedAppearance.family).toBe('fist');
});
it('rejects incompatible weapon images transactionally and survives persisted override after gear change',async()=>{
 const p=await player(),before=await p.stored(),invalid=p.command({weapon:'100031'});
 expect((await p.request('appearance/preview',{selection:invalid.selection})).body.code).toBe('APPEARANCE_WEAPON');expect((await p.request('appearance/apply',invalid)).body.code).toBe('APPEARANCE_WEAPON');expect(await p.stored()).toEqual(before);
 const worn=await p.request('appearance/apply',p.command({weapon:'100011'}));expect(worn.status).toBe(200);
 const bow=p.s.gear.find(g=>g.base==='bow')!,switched=await p.request('gear/equip',{command_id:randomUUID(),revision:worn.body.revision,lease_id:p.lease,gear_id:bow.id});expect(switched.status).toBe(200);expect(switched.body.snapshot.appearance.selection.weapon).toBe('100011');expect(switched.body.snapshot.resolvedAppearance).toMatchObject({family:'bow',parts:{weapon:{setId:'400104'}}});
 expect((await p.request('appearance')).status).toBe(200);expect((await p.request('character')).status).toBe(200);
});
it('resets to automatic without changing combat stats and migrates legacy accounts additively once',async()=>{
 const p=await player(),done=await p.request('appearance/apply',p.command({head:starters[1]}));
 const reset=await p.request('appearance/reset',{command_id:randomUUID(),revision:done.body.revision,lease_id:p.lease});expect(reset.status).toBe(200);expect(reset.body.snapshot.appearance.selection).toEqual({});expect(reset.body.snapshot.stats).toEqual(done.body.snapshot.stats);
 const legacy=await p.stored();delete legacy.appearance;legacy.gold=777;legacy.material=42;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[legacy,p.s.id]);const permits=(await pool.query('SELECT * FROM ow_permits WHERE character=$1',[p.s.id])).rows;const receipts=(await pool.query('SELECT * FROM ow_receipts WHERE character=$1',[p.s.id])).rows;
 await pool.query('DELETE FROM ow_schema WHERE version=9');await migrate(pool);const migrated=await p.stored();expect(migrated).toMatchObject({gold:777,material:42,revision:legacy.revision+1,build:legacy.build});expect(migrated.progress).toEqual(legacy.progress);expect(migrated.gear).toEqual(legacy.gear);expect(migrated.appearance!.unlocked).toEqual(expect.arrayContaining(starters));expect((await pool.query('SELECT * FROM ow_permits WHERE character=$1',[p.s.id])).rows).toEqual(permits);expect((await pool.query('SELECT * FROM ow_receipts WHERE character=$1',[p.s.id])).rows).toEqual(receipts);
 await migrate(pool);expect(await p.stored()).toEqual(migrated);
});
