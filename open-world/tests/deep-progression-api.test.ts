import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {CharacterState,Permit} from '../packages/contracts/index.ts';
import {receiptSchema} from '../packages/contracts/index.ts';
import {progressionViewSchema,progressionPreviewSchema,type ProgressionAction} from '../packages/contracts/deep-progression.ts';
import {assignGearAspect} from '../packages/rules/deep-progression.ts';

const dsn=process.env.AW_DATABASE_URL;
if(!dsn)throw Error('Deep progression API tests require real PostgreSQL. No mock/skip.');
// Dedicated schema lets migration tests replay without touching other suites or saves.
const schema='qa_progression_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:8}),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});

async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_'+randomUUID().replaceAll('-','').slice(0,20)}});
 expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const response=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:response.statusCode,body:response.json()};};
 const created=await request('character',{name:'成长测试'});expect(created.status).toBe(200);
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.body.id])).rows[0].state as CharacterState;
 // Established-character fixtures keep previously available services; new-character gates are verified in story.database.test.ts.
 delete s.story;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 const command=(action:ProgressionAction,revision=s.revision)=>({command_id:randomUUID(),revision,lease_id:lease,action});
 const stored=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state as CharacterState;
 return {s,lease,request,command,stored,cookie};
}

it('requires authenticated identity and publishes a runtime-validated configurable view',async()=>{
 expect((await app.inject({url:'/api/progression'})).statusCode).toBe(401);
 const p=await player(),view=await p.request('progression');expect(view.status).toBe(200);expect(()=>progressionViewSchema.parse(view.body)).not.toThrow();
 expect(view.body.sections.length).toBeGreaterThanOrEqual(8);expect(view.body.state.weaponGrid).toHaveLength(9);expect(view.body.state.weaponGrid[0]).toBe(p.s.equipment.weapon);
});

it('previews without a control lease or persisted mutation, then applies once across concurrent retries',async()=>{
 const p=await player(),weapon=p.s.gear.find(g=>g.slot==='weapon'&&g.id!==p.s.equipment.weapon)!;
 const action:ProgressionAction={op:'grid.assign',target:weapon.id,slot:1};let before=await p.stored();
 const permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 before=await p.stored();const preview=await p.request('progression/preview',{revision:p.s.revision,action});expect(preview.status).toBe(200);expect(()=>progressionPreviewSchema.parse(preview.body)).not.toThrow();expect(preview.body.enabled).toBe(true);expect(await p.stored()).toEqual(before);
 const input=p.command(action),results=await Promise.all([p.request('progression/action',input),p.request('progression/action',input)]);
 expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[1].body).toEqual(results[0].body);expect(()=>receiptSchema.parse(results[0].body)).not.toThrow();
 const stored=await p.stored();expect(stored.progression!.weaponGrid[1]).toBe(weapon.id);expect(stored.revision).toBe(before.revision+1);expect(stored.build).toBeGreaterThan(before.build);
 expect((await pool.query('SELECT build FROM ow_permits WHERE id=$1',[permit.id])).rows[0].build).toBe(stored.build);
 const outdated=await p.request('combat/report',{command_id:randomUUID(),revision:stored.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:0,kills:[]});expect(outdated.body.code).toBe('BUILD');
 expect((await pool.query('SELECT * FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(1);
 expect((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(1);
 expect((await p.request('progression/action',{...input,action:{op:'grid.clear',slot:1}})).body.code).toBe('COMMAND_CONFLICT');
});

it('serializes competing commands at one revision and preserves lease ownership',async()=>{
 const p=await player(),weapon=p.s.gear.find(g=>g.slot==='weapon'&&g.id!==p.s.equipment.weapon)!;
 const results=await Promise.all([p.request('progression/action',p.command({op:'grid.assign',target:weapon.id,slot:1})),p.request('progression/action',p.command({op:'grid.assign',target:weapon.id,slot:2}))]);
 expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(results.find(r=>r.status===409)!.body.code).toBe('REVISION');
 const s=await p.stored();expect(s.progression!.weaponGrid.filter(id=>id===weapon.id)).toHaveLength(1);
 expect((await p.request('progression/action',{...p.command({op:'grid.clear',slot:1},s.revision),lease_id:randomUUID()})).body.code).toBe('CONTROL');
});

it('rolls back rejected costs, invalid targets and protected extraction without ledger entries',async()=>{
 const p=await player(),before=await p.stored();
 for(const action of [{op:'weapon.level',target:p.s.gear[0].id},{op:'aspect.extract',target:p.s.gear[0].id},{op:'grid.assign',target:randomUUID(),slot:1}] as ProgressionAction[]){
  const input=p.command(action),result=await p.request('progression/action',input);expect(result.status).toBe(409);expect(await p.stored()).toEqual(before);
  expect((await pool.query('SELECT * FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(0);expect((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rowCount).toBe(0);
 }
 expect((await p.request('progression/action',{...p.command({op:'grid.clear',slot:1}),action:{op:'unknown'}})).status).toBe(400);
});

it('protects a referenced subweapon from existing salvage commands and reports that protection in previews',async()=>{
 const p=await player(),weapon=p.s.gear.find(g=>g.slot==='weapon'&&g.id!==p.s.equipment.weapon)!;
 const assigned=await p.request('progression/action',p.command({op:'grid.assign',target:weapon.id,slot:1}));expect(assigned.status).toBe(200);
 const input={command_id:randomUUID(),revision:assigned.body.revision,lease_id:p.lease,gear_id:weapon.id};
 expect((await p.request('gear/'+weapon.id+'/preview')).body.salvage).toMatchObject({allowed:false,blocked:'grid'});
 expect((await p.request('gear/salvage',input)).body.code).toBe('PROTECTED');expect((await p.stored()).gear.some(g=>g.id===weapon.id)).toBe(true);
});

it('moves a subweapon into the main hand without duplicating it and keeps unequip synchronized',async()=>{
 const p=await player(),weapon=p.s.gear.find(g=>g.slot==='weapon'&&g.id!==p.s.equipment.weapon)!;
 const assigned=await p.request('progression/action',p.command({op:'grid.assign',target:weapon.id,slot:1}));expect(assigned.status).toBe(200);
 const equipped=await p.request('gear/equip',{command_id:randomUUID(),revision:assigned.body.revision,lease_id:p.lease,gear_id:weapon.id});expect(equipped.status).toBe(200);
 expect(equipped.body.snapshot.progression.weaponGrid[0]).toBe(weapon.id);expect(equipped.body.snapshot.progression.weaponGrid[1]).toBeNull();expect(equipped.body.snapshot.progression.weaponGrid.filter((id:string|null)=>id===weapon.id)).toHaveLength(1);
 const unequipped=await p.request('gear/unequip',{command_id:randomUUID(),revision:equipped.body.revision,lease_id:p.lease,gear_id:weapon.id});expect(unequipped.status).toBe(200);expect(unequipped.body.snapshot.progression.weaponGrid[0]).toBeNull();expect((await p.stored()).equipment.weapon).toBeUndefined();
});

it('extracts only an equipment instance’s own aspect and permanently reuses its codex without destroying locked gear',async()=>{
 const p=await player(),s=structuredClone(p.s);s.level=20;s.gold=2000;s.material=200;const weapon=s.gear.find(g=>g.slot==='weapon'&&g.id!==s.equipment.weapon)!;weapon.quality='legendary';assignGearAspect(weapon,0,s.level);expect(weapon.aspectId).toBeDefined();weapon.locked=true;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const action:ProgressionAction={op:'aspect.extract',target:weapon.id,value:weapon.aspectId};expect((await p.request('progression/action',p.command(action))).status).toBe(409);expect(await p.stored()).toEqual(s);
 weapon.locked=false;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 expect((await p.request('progression/action',p.command({...action,value:'aspect-8'}))).status).toBe(409);expect(await p.stored()).toEqual(s);
 const extracted=await p.request('progression/action',p.command(action));expect(extracted.status).toBe(200);expect(extracted.body.snapshot.gear.some((g:{id:string})=>g.id===weapon.id)).toBe(false);expect(extracted.body.snapshot.progression.codex[weapon.aspectId!]).toBe(1);
 const imprint=await p.request('progression/action',p.command({op:'aspect.imprint',target:s.equipment.weapon!,value:weapon.aspectId},extracted.body.revision));expect(imprint.status).toBe(200);expect(imprint.body.snapshot.progression.imprints[s.equipment.weapon!]).toBe(weapon.aspectId);expect(imprint.body.snapshot.progression.codex[weapon.aspectId!]).toBe(1);
});

it('awards growth resources from confirmed combat exactly once and rolls back a duplicate source batch',async()=>{
 const p=await player(),permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 await pool.query("UPDATE ow_permits SET created=now()-interval '20 seconds' WHERE id=$1",[permit.id]);
 expect(permit).not.toHaveProperty('private_data');expect(permit).not.toHaveProperty('progressionRewards');
 const frozen=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data;expect(frozen.gearBases).toHaveLength(330);expect(frozen.gearBases.filter((g:{base:string})=>g.base.includes('-t'))).toHaveLength(324);expect(frozen.collectionDrops.version).toBe(1);frozen.progressionRewards.world.ore=17;await pool.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[frozen,permit.id]);
 const input={command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:60,kills:[{source_id:permit.spawns.find(m=>m.elite)!.id,tick:30}]};
 const first=await p.request('combat/report',input);expect(first.status).toBe(200);expect(first.body.delta.progression.materials.wind_ore).toBe(17);expect(Object.keys(first.body.delta.progression.reputation).length).toBeGreaterThan(0);
 expect((await p.request('combat/report',input)).body).toEqual(first.body);const after=await p.stored();
 const failed=await p.request('combat/report',{...input,command_id:randomUUID(),revision:first.body.revision,sequence:2,from_tick:60,to_tick:90,kills:[{source_id:permit.spawns.find(m=>!m.elite)!.id,tick:75},{source_id:input.kills[0].source_id,tick:75}]});
 expect(failed.body.code).toBe('DUPLICATE');expect(await p.stored()).toEqual(after);
 expect((await pool.query('SELECT * FROM ow_kills WHERE character=$1',[p.s.id])).rowCount).toBe(1);
});

it('additively migrates legacy saves once while preserving wallets, identities, books, rewards and receipts',async()=>{
 const p=await player(),legacy=structuredClone(p.s);delete legacy.progression;delete legacy.challengeProgress;legacy.gold=777;legacy.material=42;legacy.skillBooks={ember:2};legacy.skillRanks.cut=3;legacy.gear[0].quality='legendary';delete legacy.gear[0].aspectId;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[legacy,p.s.id]);
 const receiptId=randomUUID(),rewardId=randomUUID();await pool.query('INSERT INTO ow_receipts VALUES($1,$2,$3,$4)',[p.s.id,receiptId,'historical',{historical:true}]);
 await pool.query('INSERT INTO ow_rewards(id,character,source,data) VALUES($1,$2,$3,$4)',[rewardId,p.s.id,'historical-source',{id:rewardId,gear:legacy.gear[0]}]);
 await pool.query('DELETE FROM ow_schema WHERE version=8');await migrate(pool);const after=await p.stored();
 expect(after).toMatchObject({gold:777,material:42,skillBooks:{ember:2},skillRanks:{cut:3},revision:legacy.revision+1,build:legacy.build+1});expect(after.gear).toMatchObject(legacy.gear);expect(after.gear[0].aspectId).toBeDefined();expect(after.progress).toEqual(legacy.progress);expect(after.progression!.weaponGrid[0]).toBe(legacy.equipment.weapon);
 expect((await pool.query('SELECT receipt FROM ow_receipts WHERE character=$1 AND command=$2',[p.s.id,receiptId])).rows[0].receipt).toEqual({historical:true});const reward=(await pool.query('SELECT * FROM ow_rewards WHERE id=$1',[rewardId])).rows[0];expect(reward.claimed).toBe(false);expect(reward.data.gear.aspectId).toBeDefined();
 await migrate(pool);expect(await p.stored()).toEqual(after);
});
