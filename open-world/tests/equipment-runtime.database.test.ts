import {craftMaterials,craftPatterns,craftRecipes} from '../packages/content/crafting.ts';
import {ensureCrafting} from '../packages/rules/crafting.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
// numeric-spine：同步已应用计划的精确值，保留原机制断言。
import {collectionSetIdentity} from '../packages/content/set-effects.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {collectionGearSets} from '../packages/content/equipment-runtime.ts';
import {receiptSchema,snapshotSchema,gearSchema,type CharacterState,type Snapshot,type Permit} from '../packages/contracts/index.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {gearBases,makeGearByBase} from '../packages/rules/index.ts';
import {starseaIslands,starseaHub} from '../packages/content/starsea/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {gearUpgradeCost} from '../packages/rules/item-power.ts';
import {upgradeCost} from '../packages/rules/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Equipment integration requires isolated real PostgreSQL; no mock or skip');
const schema='qa_equipment_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:8});
const app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'equipment_'+randomUUID().replaceAll('-','').slice(0,18)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return{status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'装备验收'});expect(created.status).toBe(200);const lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 return{request,id:created.body.id as string,lease,s:created.body as Snapshot};
}
async function seeded(p:Awaited<ReturnType<typeof player>>){
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state as CharacterState;
 delete state.story;delete state.starsea;state.level=50;state.gold=100000;state.material=10000;state.progress.safe='town';state.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];
 for(const gear of state.gear){delete gear.ilvl;delete gear.stage;}
 const growth=ensureProgression(state),craft=ensureCrafting(state);for(const profession of Object.values(craft.professions))profession.level=100;craft.patterns=craftPatterns.map(p=>p.id);for(const material of craftMaterials)growth.materials[material.id]=100000;state.progress.regions.push(...starseaIslands);
 const completed=dungeonContent.definitions.filter(d=>d.numericStage).sort((a,b)=>b.numericStage!-a.numericStage!)[0],instance=randomUUID();await pool.query("INSERT INTO ow_dungeons(id,leader,status,ended,data) VALUES($1,$2,'success',now(),$3)",[instance,state.id,{definition:completed}]);await pool.query('INSERT INTO ow_dungeon_completions(character,dungeon,instance) VALUES($1,$2,$3) ON CONFLICT(character,dungeon) DO NOTHING',[state.id,completed.id,instance]);
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);return state;
}
it('saved old labels and pending loot show current names without changing rolls, wallet or historical rows',async()=>{
 const p=await player(),state=await seeded(p),held={...makeGearByBase('primal-staff-t3-ring',randomUUID()),name:'原初·法杖·T3·戒指',setName:'原初·法杖·T3',rank:2,locked:true,attack:37};
 state.gear.push(held);state.equipment.ring=held.id;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);
 const pending={id:randomUUID(),source_id:'names-drop-'+randomUUID(),region:'meadow',position:{x:1,y:1},gear:{...makeGearByBase('standard-sword-t2-weapon',randomUUID()),name:'常规·剑·T2·武器',setName:'常规·剑·T2',attack:43}};
 await pool.query('INSERT INTO ow_rewards(id,character,source,claimed,data) VALUES($1,$2,$3,false,$4)',[pending.id,p.id,pending.source_id,pending]);
 const beforeRows=(await pool.query('SELECT count(*)::integer n FROM ow_receipts WHERE character=$1',[p.id])).rows[0].n;
 const shown=snapshotSchema.parse((await p.request('character')).body);
 expect(shown.gear.find(gear=>gear.id===held.id)).toEqual(gearSchema.parse({...held,name:'年轮之戒',setName:'长青誓约'}));
 expect(shown.rewards.find(reward=>reward.id===pending.id)?.gear).toEqual(gearSchema.parse({...pending.gear,name:'逐风之刃',setName:'逐风者'}));
 expect([shown.gold,shown.material,shown.revision,shown.build,shown.equipment]).toEqual([state.gold,state.material,state.revision,state.build,state.equipment]);
 const tip=(await p.request('gear/'+held.id+'/tip')).body;expect(tip.gear.name).toBe('年轮之戒');
 const recipes=(await p.request('crafting')).body.recipes;
 expect(recipes.find((recipe:any)=>recipe.id==='pattern-primal-staff-t3-ring').name).toContain('年轮之戒');
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(state);
 expect((await pool.query('SELECT data FROM ow_rewards WHERE id=$1',[pending.id])).rows[0].data).toEqual(pending);
 expect((await pool.query('SELECT count(*)::integer n FROM ow_receipts WHERE character=$1',[p.id])).rows[0].n).toBe(beforeRows);
 const body={command_id:randomUUID(),revision:shown.revision,lease_id:p.lease,reward_ids:[pending.id]},claimed=await p.request('reward/claim-many',body);
 expect(claimed.status).toBe(200);expect(claimed.body.snapshot.gear.find((gear:any)=>gear.id===pending.gear.id)).toEqual({...pending.gear,name:'逐风之刃',setName:'逐风者'});
 expect((await p.request('reward/claim-many',body)).body).toEqual(claimed.body);
 expect((await p.request('character')).body.gear.find((gear:any)=>gear.id===pending.gear.id)).toEqual(claimed.body.snapshot.gear.find((gear:any)=>gear.id===pending.gear.id));
});
it('a frozen travel pool shows current names without changing its frozen templates or displayed numbers',async()=>{
 const p=await player();await seeded(p);const permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 const before=(await p.request('travel/meadow/drops')).body;
 const frozen=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data;
 const template=frozen.gearBases.find((gear:any)=>gear.base==='standard-sword-t1-weapon');expect(template).toBeDefined();template.name='常规·剑·T1·武器';
 await pool.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[frozen,permit.id]);
 const after=(await p.request('travel/meadow/drops')).body;expect(after).toEqual(before);expect(after.equipment.find((gear:any)=>gear.base===template.base).name).toBe('青锋长剑');
 expect((await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data).toEqual(frozen);
});
it('the current island campaign crafts all six slots and reinforces them beyond the legacy cap',async()=>{
 const p=await player(),state=await seeded(p);state.gold=100000000;state.starsea=newStarseaState();state.starsea.features=['forge','professions','grid'];state.starsea.islands=[...starseaIslands];state.starsea.quests={};state.starsea.tracked=null;state.starsea.hardmode=true;state.progress.safe=starseaHub;state.progress.regions=[starseaHub,...starseaIslands];
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);let s=snapshotSchema.parse((await p.request('character')).body);
 for(const part of ['weapon','armor','helmet','boots','necklace','ring']){
  const target='pattern-primal-staff-t3-'+part,forge=regionById(starseaHub).landmarks.find(l=>l.kind==='forge')!;
  const r=await p.request('crafting/action',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,region:starseaHub,position:{x:forge.x,y:forge.y},action:{op:'craft',recipe:target}});expect(r.status,part+'/'+JSON.stringify(r.body)).toBe(200);s=receiptSchema.parse(r.body).snapshot;
  const gear=s.gear.find(gear=>gear.base==='primal-staff-t3-'+part)!;expect(gear.ilvl).toBe(craftRecipes.find(r=>r.id===target)!.output.level);expect(gear.stage).toBeGreaterThan(1);expect(gear.requiredLevel).toBeLessThanOrEqual(gear.ilvl!);
  const equipped=await p.request('gear/equip',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:gear.id});expect(equipped.status).toBe(200);s=receiptSchema.parse(equipped.body).snapshot;
  for(let rank=0;rank<6;rank++){const current=s.gear.find(item=>item.id===gear.id)!,price=gearUpgradeCost(current,upgradeCost),gold=s.gold,material=s.material,body={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:gear.id,region:'town',position:{x:8,y:14}};const upgraded=await p.request('gear/upgrade',body);expect(upgraded.status,part+'/rank'+rank+'/'+JSON.stringify(upgraded.body.code)).toBe(200);s=receiptSchema.parse(upgraded.body).snapshot;expect(s.gold).toBe(gold-price.gold);expect(s.material).toBe(material-price.material);expect(s.gear.find(item=>item.id===gear.id)?.rank).toBe(rank+1);expect((await p.request('gear/upgrade',body)).body).toEqual(upgraded.body);}
 }
 expect(Object.keys(s.equipment).filter(slot=>slot!=='core')).toHaveLength(6);expect(s.stats.dotCrit).toBe(1);expect(s.stats.zones?.some(z=>z.id==='set-ember-dot'&&z.value===1.375)).toBe(true);
 expect(snapshotSchema.parse((await p.request('character')).body).equipment).toEqual(s.equipment);
});
it('all 324 items can be earned by real crafting commands, equipped, quoted, reinforced once and restored',async()=>{
 const p=await player(),seed=await seeded(p),tested=new Set<string>();seed.gold=100000000;
 for(const item of equipmentItems){
  if(tested.size%50===0)await p.request('control/renew',{lease_id:p.lease});
  await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[structuredClone(seed),p.id]);let s=snapshotSchema.parse((await p.request('character')).body);
  const cmd=(extra:object)=>({command_id:randomUUID(),revision:s.revision,lease_id:p.lease,...extra});
  const forge=regionById(starseaHub).landmarks.find(l=>l.kind==='forge')!,recipe=craftRecipes.find(r=>r.output.base===item.id)!;
  const craftBody=cmd({region:starseaHub,position:{x:forge.x,y:forge.y},action:{op:'craft',recipe:recipe.id}}),crafted=await p.request('crafting/action',craftBody);expect(crafted.status,item.id+'/'+JSON.stringify(crafted.body)).toBe(200);s=receiptSchema.parse(crafted.body).snapshot;
  const gear=s.gear.find(gear=>gear.base===item.id)!;expect(gear,item.id).toBeDefined();expect(gear.quality).toBe(recipe.output.quality);expect(gear.affixes.length).toBeGreaterThan(0);expect(gear.setId).toBe(item.setId);
  expect((await p.request('crafting/action',craftBody)).body).toEqual(crafted.body);
  const equip=await p.request('gear/equip',cmd({gear_id:gear.id}));expect(equip.status,item.id).toBe(200);s=receiptSchema.parse(equip.body).snapshot;expect(s.equipment[gear.slot]).toBe(gear.id);
  const quote=await p.request('gear/'+gear.id+'/preview');expect(quote.status).toBe(200);expect(quote.body.equipBlock).toBe('');expect(quote.body.current.stats).toEqual(s.stats);
  const price=gearUpgradeCost(gear,upgradeCost),before={gold:s.gold,material:s.material},upgradeBody=cmd({gear_id:gear.id,region:'town',position:{x:8,y:14}}),upgraded=await p.request('gear/upgrade',upgradeBody);expect(upgraded.status,item.id).toBe(200);s=receiptSchema.parse(upgraded.body).snapshot;
  expect(s.gold).toBe(before.gold-price.gold);expect(s.material).toBe(before.material-price.material);expect(s.gear.find(g=>g.id===gear.id)?.rank).toBe(1);expect((await p.request('gear/upgrade',upgradeBody)).body).toEqual(upgraded.body);
  const tip=await p.request('gear/'+gear.id+'/tip');expect(tip.status).toBe(200);expect(tip.body.equipped).toBe(true);expect(tip.body.currentSets.some((set:any)=>set.setId===collectionSetIdentity(item.setId)&&set.count===1)).toBe(true);
  const restored=snapshotSchema.parse((await p.request('character')).body);expect(restored.equipment[gear.slot]).toBe(gear.id);expect(restored.gear.find(g=>g.id===gear.id)).toEqual(s.gear.find(g=>g.id===gear.id));
  for(const old of seed.gear)expect(restored.gear.find(gear=>gear.id===old.id)).toEqual(gearSchema.parse(old));
  expect((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,upgradeBody.command_id])).rows[0].n).toBe(1);tested.add(item.id);
 }
 expect(tested.size).toBe(324);
},120000);
it('real six-piece loadouts coexist with a retained old core and activate current 2/4 bonuses',async()=>{
 const p=await player(),state=await seeded(p),set=collectionGearSets.find(set=>set.id==='primal-staff-t3')!;
 const core=state.gear.find(gear=>gear.base==='core')!;core.rank=2;core.locked=true;state.equipment.core=core.id;
 for(const base of set.pieces)state.gear.push(makeGearByBase(base,randomUUID()));await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);let s=snapshotSchema.parse((await p.request('character')).body);
 for(const [index,base]of set.pieces.entries()){
  const gear=s.gear.find(gear=>gear.base===base)!,r=await p.request('gear/equip',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:gear.id});expect(r.status).toBe(200);s=receiptSchema.parse(r.body).snapshot;
  const tip=(await p.request('gear/'+gear.id+'/tip')).body;expect(tip.currentSets.find((entry:any)=>entry.setId==='set-staff-primal').activeBonuses).toEqual([2,4].filter(count=>count<=index+1));
 }
 expect(s.equipment.core).toBe(core.id);expect(s.gear.find(g=>g.id===core.id)).toEqual(gearSchema.parse(core));expect(s.stats.dotCrit).toBe(1);expect(s.stats.zones?.some(z=>z.id==='set-ember-dot'&&z.value===1.375)).toBe(true);expect(s.resolvedAppearance?.family).toBe('magic');
 for(const slot of ['helmet','boots','ring'] as const)expect(s.equipment[slot]).toBeTruthy();
 const ring=s.gear.find(g=>g.id===s.equipment.ring)!;expect((await p.request('gear/salvage',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:ring.id})).body.code).toBe('PROTECTED');
 const unequipped=await p.request('gear/unequip',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:ring.id});expect(unequipped.status).toBe(200);s=receiptSchema.parse(unequipped.body).snapshot;
 const salvaged=await p.request('gear/salvage',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:ring.id});expect(salvaged.status).toBe(200);expect(salvaged.body.snapshot.gear.some((g:any)=>g.id===ring.id)).toBe(false);
});
it('later-stage equip and unopened crafting gates fail without charging or changing the build',async()=>{
 const p=await player(),state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state as CharacterState,gear=makeGearByBase('standard-hammer-t3-helmet',randomUUID());state.gear.push(gear);await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);
 const before=(await p.request('character')).body,body={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,gear_id:gear.id};
 expect((await p.request('gear/equip',body)).body.code).toBe('GEAR_LEVEL');expect((await p.request('gear/'+gear.id+'/preview')).body.equipBlock).toContain('7');expect((await p.request('character')).body).toEqual(before);
 const learn=await p.request('crafting/action',{command_id:randomUUID(),revision:before.revision,lease_id:p.lease,region:'town',position:{x:8,y:14},action:{op:'craft',recipe:'pattern-standard-sword-t1-weapon'}});expect(learn.status).toBe(409);expect((await p.request('character')).body).toEqual(before);
});
it('confirmed field combat awards a new-stage item, its claim replays once and private pools stay private',async()=>{
 const p=await player(),permit=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body as Permit;
 expect(permit).not.toHaveProperty('collectionDrops');expect(permit).not.toHaveProperty('private_data');
 const frozen=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data;expect(frozen.gearBases).toHaveLength(330);expect(frozen.collectionDrops.version).toBe(1);
 await pool.query("UPDATE ow_permits SET created=now()-interval '20 seconds' WHERE id=$1",[permit.id]);
 const elite=permit.spawns.find(spawn=>spawn.elite)!;const report={command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:60,kills:[{source_id:elite.id,tick:30}]};
 const drop=await p.request('combat/report',report);expect(drop.status).toBe(200);expect(drop.body.rewards).toHaveLength(1);const item=equipmentItems.find(item=>item.id===drop.body.rewards[0].gear.base);if(item)expect(item.tier).toBe(1);else expect(gearBases.slice(0,6).some(gear=>gear.base===drop.body.rewards[0].gear.base)).toBe(true);expect((await p.request('combat/report',report)).body).toEqual(drop.body);
 const claim={command_id:randomUUID(),revision:drop.body.revision,lease_id:p.lease,reward_ids:[drop.body.rewards[0].id]},claimed=await p.request('reward/claim-many',claim);expect(claimed.status).toBe(200);expect((await p.request('reward/claim-many',claim)).body).toEqual(claimed.body);expect(claimed.body.snapshot.gear.filter((g:any)=>g.id===drop.body.rewards[0].gear.id)).toHaveLength(1);
 const preview=await p.request('travel/meadow/drops');expect(preview.status).toBe(200);expect(preview.body.equipment).toHaveLength(114);expect(preview.body).not.toHaveProperty('seriesWeights');
});
