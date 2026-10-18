import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {Snapshot,Permit,Report} from '../packages/contracts/index.ts';
import {skillUpgradeCost,xpThreshold,gearBases} from '../packages/rules/index.ts';
import {starterSkills,equipmentItems} from '../packages/content/index.ts';
import {rewards as economy} from '../apps/api/src/economy.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Database tests require real PostgreSQL via tools/qa.mjs. No mock/skip.');
const pool=poolFor(dsn),app=createApp(pool,{campaign:'legacy',dungeons:false});
it('equipment tips resolve reinforcement and compare the official build without changing it',async()=>{
 const p=await player(),s=structuredClone(p.s),bow=s.gear.find(g=>g.base==='bow')!;bow.rank=3;bow.locked=true;bow.affixes=[{id:'test_armor',name:'护甲',stat:'armor',value:3,tier:1,description:'护甲 +3'}];await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const before=(await p.request('character')).body,tip=await p.request('gear/'+bow.id+'/tip');expect(tip.status).toBe(200);
 expect(tip.body.attributes).toEqual({base:{attack:7,armor:0},enhancement:{attack:6,armor:0},effective:{attack:13,armor:0}});expect(tip.body.comparison.attack.delta).toBe(4);expect(tip.body.comparison.armor.delta).toBe(3);expect(tip.body.gear.locked).toBe(true);
 const quote=await p.request('gear/'+bow.id+'/preview');expect(tip.body.comparison.attack.equipped).toBe(quote.body.equipped.stats.attack);expect(tip.body.comparison.armor.equipped).toBe(quote.body.equipped.stats.armor);expect((await p.request('character')).body).toEqual(before);
 const blade=s.gear.find(g=>g.base==='blade')!;expect((await p.request('gear/'+blade.id+'/tip')).body.equipped).toBe(true);
});
it('equipment tips reject unauthenticated access and another player’s equipment',async()=>{
 const p=await player(),other=await player(),id=p.s.gear[0].id;expect((await app.inject({url:'/api/gear/'+id+'/tip'})).statusCode).toBe(401);expect((await other.request('gear/'+id+'/tip')).status).toBe(404);
});
it('new characters have only starter skills and no upgrade quote for locked skills',async()=>{
 const p=await player();expect(p.s.skills).toEqual(starterSkills);expect(p.s.resolvedSkills.map(sk=>sk.id)).toEqual(starterSkills);expect(p.s.skillAccess.filter(sk=>sk.unlocked).map(sk=>sk.id)).toEqual(expect.arrayContaining(starterSkills));
 const preview=(await p.request('skills/preview')).body;expect(preview.skills.find((sk:any)=>sk.id==='lance')).toMatchObject({activated:false,rank:0,action:'activate',unlockLevel:10,cost:{gold:0,material:0}});
});
it('rejects locked equipment and upgrades without spending money or changing the build',async()=>{
 const p=await player(),s={...p.s,gold:1000,material:100};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 for(const [path,extra] of [['skills',{skills:['cut','lance']}],['skills/upgrade',{skill_id:'lance'}]] as const){const r=await p.request(path,{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,...extra});expect(r.status).toBe(409);expect(r.body.code).toBe('SKILL_INACTIVE');}
 const after=(await p.request('character')).body;expect(after.gold).toBe(s.gold);expect(after.material).toBe(s.material);expect(after.revision).toBe(s.revision);expect(after.build).toBe(s.build);expect(after.skills).toEqual(starterSkills);
});
it('confirmed combat XP unlocks a skill which can then be equipped and upgraded idempotently',async()=>{
 const p=await player(),s={...p.s,skillRanks:Object.fromEntries(Object.entries(p.s.skillRanks).filter(([id])=>id!=='whirl')),xp:xpThreshold(1)-10,gold:1000,material:100};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const normal=p.p.spawns.find(sk=>!sk.elite&&!sk.boss)!;const report=await p.request('combat/report',p.report([normal.id]));expect(report.status).toBe(200);expect(report.body.snapshot.level).toBe(2);expect(report.body.snapshot.skillAccess.find((sk:any)=>sk.id==='whirl')).toMatchObject({activated:false,eligible:true});
 const activated=await p.request('skills/activate',{command_id:randomUUID(),revision:report.body.revision,lease_id:p.lease,skill_id:'whirl'});expect(activated.status).toBe(200);
 const equipped=await p.request('skills',{command_id:randomUUID(),revision:activated.body.revision,lease_id:p.lease,skills:['cut','whirl','ward']});expect(equipped.status).toBe(200);
 const body={command_id:randomUUID(),revision:equipped.body.revision,lease_id:p.lease,skill_id:'whirl'};const upgraded=await p.request('skills/upgrade',body);expect(upgraded.status).toBe(200);expect(upgraded.body.snapshot.skillRanks.whirl).toBe(2);expect((await p.request('skills/upgrade',body)).body).toEqual(upgraded.body);
});
it('migration corrects legacy loadouts once while preserving trained ranks and rewards',async()=>{
 const p=await player(),s={...p.s,skills:['cut','whirl','ward','mend'],skillRanks:{mend:3},gold:777,material:42};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);await pool.query('DELETE FROM ow_schema WHERE version=4');await migrate(pool);
 const after=(await p.request('character')).body;expect(after.skills).toEqual(['cut','ward']);expect(after.skillRanks.mend).toBe(3);expect(after.gold).toBe(777);expect(after.material).toBe(42);expect(after.revision).toBe(s.revision+1);expect(after.build).toBe(s.build+1);expect(after.progress).toEqual(s.progress);
 await migrate(pool);expect((await p.request('character')).body).toEqual(after);
});
it('activation validates level, consumes nothing for a level skill and replays once',async()=>{
 const p=await player();delete p.s.skillRanks.whirl;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[p.s,p.s.id]);const initial=(await p.request('character')).body,body={command_id:randomUUID(),revision:initial.revision,lease_id:p.lease,skill_id:'whirl'};
 expect((await p.request('skills/activate',body)).body.code).toBe('SKILL_LEVEL');expect((await p.request('character')).body).toEqual(initial);
 const state={...initial,level:2};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);
 const done=await p.request('skills/activate',body);expect(done.status).toBe(200);expect(done.body.snapshot.skillRanks.whirl).toBe(1);expect(done.body.snapshot.skills).toEqual(starterSkills);expect(done.body.delta).toEqual({gold:0,xp:0,material:0});expect((await p.request('skills/activate',body)).body).toEqual(done.body);expect((await p.request('skills/upgrade',body)).body.code).toBe('COMMAND_CONFLICT');
 expect((await p.request('skills/activate',{...body,command_id:randomUUID(),revision:done.body.revision})).body.code).toBe('ALREADY_ACTIVE');
 expect((await p.request('skills/activate',{...body,skill_id:'mend'})).body.code).toBe('COMMAND_CONFLICT');
});
it('book activation requires the matching book, consumes exactly one and retries idempotently',async()=>{
 const p=await player(),s={...p.s,level:100,skillBooks:{chain:1,ember:0}},body={command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,skill_id:'ember'};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 expect((await p.request('skills/activate',body)).body.code).toBe('SKILL_BOOK');s.level=1;s.skillBooks={chain:1,ember:1};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const done=await p.request('skills/activate',body);expect(done.status).toBe(200);expect(done.body.delta.books).toEqual({ember:-1});expect(done.body.snapshot.skillBooks).toEqual({chain:1,ember:0});expect(done.body.snapshot.skillRanks.ember).toBe(1);expect(done.body.snapshot.skills).toEqual(starterSkills);expect((await p.request('skills/activate',body)).body).toEqual(done.body);expect((await p.request('skills/upgrade',body)).body.code).toBe('COMMAND_CONFLICT');
 expect((await p.request('skills/activate',{...body,command_id:randomUUID(),revision:done.body.revision})).body.code).toBe('ALREADY_ACTIVE');expect((await p.request('character')).body.skillBooks.ember).toBe(0);
});
it('inactive, insufficient and max rank upgrades never deduct resources',async()=>{
 const p=await player();for(const [ranks,gold,material,id,code] of [[p.s.skillRanks,999,999,'dual_strike','SKILL_INACTIVE'],[p.s.skillRanks,1,0,'cut','COST'],[{...p.s.skillRanks,cut:5},999,999,'cut','MAX_RANK']] as const){
  const s={...p.s,skillRanks:ranks,gold,material};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);const before=(await p.request('character')).body;
  expect((await p.request('skills/upgrade',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,skill_id:id})).body.code).toBe(code);expect((await p.request('character')).body).toEqual(before);
 }
});
it('first official boss settlement awards its book once across retries and later cycles',async()=>{
 const p=await player(),s={...p.s,progress:{...p.s.progress,kills:6,regionKills:{meadow:6},regionElites:{meadow:1}}};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const issue=async()=>{const permit=(await p.request('permit',{lease_id:p.lease,region:'meadow-boss',attempt_id:randomUUID()})).body as Permit;await pool.query("UPDATE ow_permits SET created=now()-interval '60 seconds' WHERE id=$1",[permit.id]);return permit;};
 const permit=await issue(),boss=permit.spawns.find(m=>m.boss)!;
 const body={...p.report([boss.id]),permit_id:permit.id,build:permit.build};const done=await p.request('combat/report',body);expect(done.status).toBe(200);expect(done.body.delta.books).toEqual({ember:1});expect(done.body.snapshot.skillBooks.ember).toBe(1);expect((await p.request('combat/report',body)).body).toEqual(done.body);
 await pool.query("UPDATE ow_permits SET expires=now()-interval '1 second' WHERE id=$1",[permit.id]);const again=await issue(),againBoss=again.spawns.find(m=>m.boss)!;
 const next=await p.request('combat/report',{...p.report([againBoss.id]),permit_id:again.id,build:again.build,revision:done.body.revision});expect(next.status).toBe(200);expect(next.body.delta.books).toBeUndefined();expect(next.body.snapshot.skillBooks.ember).toBe(1);
});
it('activation migration preserves trained and equipped skills and runs once',async()=>{
 const p=await player(),s={...p.s,skills:['cut','whirl','ward'],skillRanks:{mend:3},skillBooks:undefined,progress:{...p.s.progress,bosses:['meadow-boss']},gold:777};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);await pool.query('DELETE FROM ow_schema WHERE version=6');await migrate(pool);
 const after=(await p.request('character')).body;expect(after.skills).toEqual(s.skills);expect(after.skillRanks).toMatchObject({cut:1,bolt:1,ward:1,whirl:1,mend:3});expect(after.skillBooks.ember).toBe(1);expect(after.gold).toBe(777);expect(after.revision).toBe(s.revision+1);await migrate(pool);expect((await p.request('character')).body).toEqual(after);
});
it('drop previews require login and reject a non-combat region',async()=>{
 expect((await app.inject({url:'/api/travel/meadow/drops'})).statusCode).toBe(401);
 const p=await player();expect((await p.request('travel/town/drops')).status).toBe(404);expect((await p.request('travel/missing/drops')).status).toBe(404);
});
it('publishes accurate drop summaries without rolling loot or changing assets',async()=>{
 const p=await player(),before=await p.request('character');
 const preview=await p.request('travel/meadow-boss/drops');expect(preview.status).toBe(200);expect(preview.body.basis).toBe('per-kill');
 expect(preview.body.rewards).toEqual({gold:{min:120,max:120},xp:{min:100,max:100},material:{min:8,max:8}});
 expect(preview.body.equipment.map((g:any)=>g.base)).toEqual([...equipmentItems.filter(item=>item.tier===1).map(item=>item.id),...gearBases.slice(0,6).map(gear=>gear.base)]);
 expect(preview.body).not.toHaveProperty('gearPercent');expect(preview.body).not.toHaveProperty('seed');expect(preview.body.equipment.every((g:any)=>!('id' in g)&&!('rank' in g))).toBe(true);
 expect((await p.request('character')).body).toEqual(before.body);
 const field=await p.request('travel/meadow/drops');expect(field.body.rewards.gold).toEqual({min:6,max:18});
});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
it('gates bosses on confirmed regional kills and an elite; global totals cannot bypass it',async()=>{
 const p=await player();const s={...p.s,progress:{...p.s.progress,kills:999,regions:['town','meadow','forest']}};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 expect((await p.request('permit',{lease_id:p.lease,region:'meadow-boss'})).body.code).toBe('LOCKED');
 const six=p.p.spawns.slice(0,6).map(m=>m.id);const done=await p.request('combat/report',p.report(six));expect(done.status).toBe(200);
 expect(done.body.snapshot.progress.regionKills.meadow).toBe(6);expect(done.body.snapshot.progress.regionElites.meadow).toBe(1);
 expect(done.body.snapshot.bossAccess['meadow-boss'].eligible).toBe(true);expect(done.body.snapshot.bossAccess['forest-boss'].eligible).toBe(false);
 expect((await p.request('permit',{lease_id:p.lease,region:'forest-boss'})).body.code).toBe('LOCKED');
 const permit=(await p.request('permit',{lease_id:p.lease,region:'meadow-boss'})).body as Permit;expect(permit.region).toBe('meadow-boss');
 await pool.query("UPDATE ow_permits SET created=now()-interval '60 seconds' WHERE id=$1",[permit.id]);const boss=permit.spawns.find(m=>m.boss)!;
 const v={...p.report([boss.id]),command_id:randomUUID(),revision:done.body.revision,permit_id:permit.id,build:permit.build};
 const first=await p.request('combat/report',v);expect(first.status).toBe(200);expect(first.body.rewards).toHaveLength(1);expect(first.body.rewards[0].gear.quality).toBe('rare');expect(first.body.rewards[0].gear.affixes.every((a:any)=>a.tier===1)).toBe(true);
 expect((await p.request('combat/report',v)).body).toEqual(first.body);
});
it('later-area previews and settlements use the same frozen regional resource rules',async()=>{
 const p=await player(),saved=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;saved.progress.regions.push('tundra');await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[saved,p.s.id]);
 const permit=(await p.request('permit',{lease_id:p.lease,region:'tundra'})).body;
 const privateRules=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data;privateRules.economy.regions.tundra={gold:7,xp:9,material:4};privateRules.dropProfile.gearBaseScale=4;privateRules.dropProfile.normal={gearPercent:100,quality:{common:0,magic:0,rare:100,legendary:0}};privateRules.gearBases=[gearBases.find(gear=>gear.base==='blade')!];await pool.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[privateRules,permit.id]);
 const preview=(await p.request('travel/tundra/drops')).body;expect(preview.rewards).toEqual({gold:{min:42,max:126},xp:{min:90,max:216},material:{min:4,max:8}});expect(preview.note).toContain('100%');expect(preview.equipment[0].attack).toBe(36);
 const target=permit.spawns.find((m:any)=>!m.elite);const receipt=await p.request('combat/report',{command_id:randomUUID(),revision:saved.revision,lease_id:p.lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:30,kills:[{source_id:target.id,tick:30}]});expect(receipt.status).toBe(200);expect(receipt.body.delta).toMatchObject({gold:42,xp:90,material:4});expect(receipt.body.rewards[0].gear.attack).toBe(36);
 const reward=receipt.body.rewards[0];const claimed=await p.request('reward/claim',{command_id:randomUUID(),revision:receipt.body.revision,lease_id:p.lease,reward_id:reward.id});const equipped=await p.request('gear/equip',{command_id:randomUUID(),revision:claimed.body.revision,lease_id:p.lease,gear_id:reward.gear.id});expect(equipped.status).toBe(200);expect(equipped.body.snapshot.stats.attack).toBeGreaterThanOrEqual(10+2*equipped.body.snapshot.level+36);expect(equipped.body.snapshot.gear.find((g:any)=>g.id===saved.equipment.weapon).attack).toBe(9);
});
it('regional migration uses confirmed kill sources, preserves rewards, and runs only once',async()=>{
 const p=await player();const done=await p.request('combat/report',p.report());expect(done.status).toBe(200);
 const s=done.body.snapshot;s.progress.kills=999;s.progress.regionKills={meadow:999};s.progress.regionElites={meadow:999};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 await pool.query('DELETE FROM ow_schema WHERE version=7');await migrate(pool);const after=(await p.request('character')).body;
 expect(after.progress.regionKills.meadow).toBe(2);expect(after.progress.regionElites.meadow).toBe(1);expect(after.bossAccess['meadow-boss'].eligible).toBe(false);
 expect(after.gold).toBe(s.gold);expect(after.gear).toEqual(s.gear);expect(after.rewards).toEqual(s.rewards);expect(after.revision).toBe(s.revision+1);
 await migrate(pool);expect((await p.request('character')).body).toEqual(after);
});
async function player(){const username='qa_'+randomUUID().replaceAll('-','').slice(0,24);const r=await app.inject({method:'POST',url:'/api/session/register',payload:{username,password:'secure-qa-password'}});expect(r.statusCode).toBe(200);const cookie=String(r.headers['set-cookie']).split(';')[0];
 async function request(path:string,body?:unknown){const response=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:response.statusCode,body:response.json()};}
 const s=(await request('character',{name:'测试远行者'})).body as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;const p=(await request('permit',{lease_id:lease,region:'meadow'})).body as Permit;
 await pool.query("UPDATE ow_permits SET created=now()-interval '20 seconds' WHERE id=$1",[p.id]);
 const report=(ids:string[]=p.spawns.slice(0,2).map(s=>s.id)):Report=>({command_id:randomUUID(),revision:s.revision,lease_id:lease,permit_id:p.id,build:p.build,sequence:1,from_tick:0,to_tick:60,kills:ids.map(source_id=>({source_id,tick:30}))});
 return {s,p,lease,request,report,cookie};}
it('clearing an area, build synchronization and expired authorization never respawn its enemies',async()=>{
 const p=await player();await pool.query("UPDATE ow_permits SET created=now()-interval '60 seconds' WHERE id=$1",[p.p.id]);
 const body=p.report(p.p.spawns.map(m=>m.id)),done=await p.request('combat/report',body);expect(done.status).toBe(200);
 const before=(await p.request('character')).body;
 for(let i=0;i<3;i++){
  if(i===1)await pool.query("UPDATE ow_permits SET expires=now()-interval '1 second' WHERE id=$1",[p.p.id]);
  const renewed=await p.request('permit',{lease_id:p.lease,region:'meadow'});expect(renewed.status).toBe(200);expect(renewed.body.id).toBe(p.p.id);expect(renewed.body.cycle).toBe(p.p.cycle);expect(renewed.body.completed.sort()).toEqual(p.p.spawns.map(m=>m.id).sort());expect(renewed.body.build).toBe(before.build);expect(renewed.body.sequence).toBe(1);expect(renewed.body.from_tick).toBe(60);expect(new Date(renewed.body.expires_at).getTime()).toBeGreaterThan(Date.now());
 }
 expect((await p.request('character')).body).toEqual(before);expect((await p.request('combat/report',body)).body).toEqual(done.body);
 const entry={lease_id:p.lease,region:'meadow',attempt_id:randomUUID()},fresh=(await p.request('permit',entry)).body;
 expect(fresh.id).not.toBe(p.p.id);expect(fresh.completed).toEqual([]);expect(fresh.cycle).toBe(p.p.cycle+1);expect((await p.request('permit',entry)).body.id).toBe(fresh.id);
});
it('a rules-version replacement retains killed enemy instance IDs and rewards',async()=>{
 const p=await player(),killed=p.p.spawns.slice(0,23).map(m=>m.id),done=await p.request('combat/report',p.report(killed));expect(done.status).toBe(200);
 const row=(await pool.query('SELECT data FROM ow_permits WHERE id=$1',[p.p.id])).rows[0].data;row.rules='retired-rules';await pool.query('UPDATE ow_permits SET data=$1 WHERE id=$2',[row,p.p.id]);
 const next=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body;expect(next.id).not.toBe(p.p.id);expect(next.spawns.map((m:any)=>m.id)).toEqual(p.p.spawns.map(m=>m.id));expect(next.completed.sort()).toEqual(killed.sort());expect((await p.request('character')).body).toEqual(done.body.snapshot);
 const remaining=p.p.spawns.find(m=>!killed.includes(m.id))!;
 const report={command_id:randomUUID(),revision:done.body.revision,lease_id:p.lease,permit_id:next.id,build:next.build,sequence:1,from_tick:0,to_tick:30,kills:[{source_id:remaining.id,tick:15}]};expect((await p.request('combat/report',report)).status).toBe(200);
});
it('atomically settles official rewards and replays the original receipt',async()=>{const p=await player(),v=p.report(),first=await p.request('combat/report',v),repeat=await p.request('combat/report',v);expect(first.status).toBe(200);expect(repeat.body).toEqual(first.body);const s=(await p.request('character')).body;expect(s.gold).toBe(first.body.delta.gold);expect(s.progress.kills).toBe(2);expect(first.body.rewards.length).toBeGreaterThan(0);});
it('rejects same command with different content',async()=>{const p=await player(),v=p.report();await p.request('combat/report',v);expect((await p.request('combat/report',{...v,to_tick:61})).status).toBe(409);});
it('rolls back an entire batch including an earlier legal kill',async()=>{const p=await player(),v=p.report([p.p.spawns[0].id,'forged-source']);expect((await p.request('combat/report',v)).status).toBe(409);expect((await p.request('character')).body.gold).toBe(0);expect((await pool.query('SELECT * FROM ow_kills WHERE character=$1',[p.s.id])).rowCount).toBe(0);});
it('blocks another command rewarding an already settled source',async()=>{const p=await player(),v=p.report();const done=await p.request('combat/report',v);const next={...v,command_id:randomUUID(),revision:done.body.revision,sequence:2,from_tick:60,to_tick:90,kills:v.kills.map(k=>({...k,tick:75}))};expect((await p.request('combat/report',next)).status).toBe(409);expect((await p.request('character')).body.progress.kills).toBe(2);});
it('serializes racing duplicate commands against actual PostgreSQL',async()=>{const p=await player(),v=p.report();const replies=await Promise.all([p.request('combat/report',v),p.request('combat/report',v)]);expect(replies[0].body).toEqual(replies[1].body);expect((await p.request('character')).body.progress.kills).toBe(2);});
it('restores server-generated pending gear and claims it only once',async()=>{const p=await player();const done=await p.request('combat/report',p.report([p.p.spawns[0].id]));const reward=done.body.rewards[0];const body={command_id:randomUUID(),revision:done.body.revision,lease_id:p.lease,reward_id:reward.id};const a=await p.request('reward/claim',body),b=await p.request('reward/claim',body);expect(a.body).toEqual(b.body);expect(a.body.snapshot.gear.filter((g:any)=>g.id===reward.gear.id)).toHaveLength(1);});
it('keeps full-bag rewards without partial asset changes',async()=>{const p=await player(),done=await p.request('combat/report',p.report([p.p.spawns[0].id]));const s=done.body.snapshot;while(s.gear.length<s.capacity)s.gear.push({...s.gear[0],id:randomUUID()});await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.s.id]);const r=await p.request('reward/claim',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,reward_id:s.rewards[0].id});expect(r.body.code).toBe('CAPACITY');expect((await p.request('character')).body.rewards).toHaveLength(1);});
async function pendingDrops(p:Awaited<ReturnType<typeof player>>,count:number){const rewards=[];for(let n=0;n<count;n++){const id=randomUUID(),reward={id,source_id:'batch-fixture-'+id,region:'meadow',position:{x:10,y:10},gear:{...p.s.gear[0],id:randomUUID(),name:'批量拾取验收 '+n}};await pool.query('INSERT INTO ow_rewards(id,character,source,data) VALUES($1,$2,$3,$4)',[id,p.s.id,reward.source_id,reward]);rewards.push(reward);}return rewards;}
it('batch pickup deduplicates ids and replays one authoritative inventory receipt',async()=>{const p=await player(),drops=await pendingDrops(p,3),body={command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,reward_ids:[drops[0].id,drops[0].id,...drops.slice(1).map(r=>r.id)]};const first=await p.request('reward/claim-many',body),repeat=await p.request('reward/claim-many',body);expect(first.status).toBe(200);expect(repeat.body).toEqual(first.body);expect(first.body.snapshot.gear).toHaveLength(p.s.gear.length+3);expect(first.body.snapshot.rewards).toHaveLength(0);expect((await pool.query('SELECT count(*) FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,body.command_id])).rows[0].count).toBe('1');});
it('batch pickup fills remaining space and keeps the rest through reload and retries',async()=>{const p=await player(),drops=await pendingDrops(p,3),state=structuredClone(p.s);while(state.gear.length<state.capacity-1)state.gear.push({...state.gear[0],id:randomUUID()});await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);const first=await p.request('reward/claim-many',{command_id:randomUUID(),revision:state.revision,lease_id:p.lease,reward_ids:drops.map(r=>r.id)});expect(first.status).toBe(200);expect(first.body.snapshot.gear).toHaveLength(state.capacity);expect(first.body.snapshot.rewards).toHaveLength(2);const full=await p.request('reward/claim-many',{command_id:randomUUID(),revision:first.body.revision,lease_id:p.lease,reward_ids:drops.slice(1).map(r=>r.id)});expect(full.body.code).toBe('CAPACITY');expect((await p.request('character')).body).toEqual(first.body.snapshot);});
it('batch pickup cannot take another character’s drops or partially commit a mixed request',async()=>{const p=await player(),other=await player(),own=await pendingDrops(p,1),foreign=await pendingDrops(other,1),before=(await p.request('character')).body;const response=await p.request('reward/claim-many',{command_id:randomUUID(),revision:p.s.revision,lease_id:p.lease,reward_ids:[own[0].id,foreign[0].id]});expect(response.body.code).toBe('REWARD');expect((await p.request('character')).body).toEqual(before);expect((await other.request('character')).body.rewards).toHaveLength(1);});
it('does not reset reward identities when requesting a new permit',async()=>{const p=await player(),v=p.report([p.p.spawns[0].id]);await p.request('combat/report',v);const next=(await p.request('permit',{lease_id:p.lease,region:'meadow'})).body;expect(next.id).toBe(p.p.id);expect(next.completed).toContain(p.p.spawns[0].id);});
it('equipment changes update build and reject the old report epoch',async()=>{const p=await player(),g=p.s.gear.find(g=>g.effect==='pierce')!;const worn=await p.request('gear/equip',{command_id:randomUUID(),revision:0,lease_id:p.lease,gear_id:g.id});expect(worn.status).toBe(200);expect(worn.body.snapshot.stats.effects).toContain('pierce');expect((await p.request('combat/report',{...p.report(),revision:worn.body.revision})).body.code).toBe('BUILD');});
it('control takeover invalidates old writes but preserves receipt reads',async()=>{const p=await player(),v=p.report();await p.request('combat/report',v);const username=(await pool.query('SELECT username FROM ow_accounts WHERE id=(SELECT account FROM ow_characters WHERE id=$1)',[p.s.id])).rows[0].username;
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username,password:'secure-qa-password'}});const cookie=String(login.headers['set-cookie']).split(';')[0];const takeover=await app.inject({method:'POST',url:'/api/control',headers:{cookie},payload:{takeover:true,client_id:randomUUID()}});expect(takeover.statusCode).toBe(200);expect((await p.request('receipt/'+v.command_id)).status).toBe(200);expect((await p.request('control/renew',{lease_id:p.lease})).body.code).toBe('CONTROL');});
it('foreign account cannot read receipts or report another permit',async()=>{const a=await player(),b=await player(),v=a.report();await a.request('combat/report',v);expect((await b.request('receipt/'+v.command_id)).status).toBe(404);expect((await b.request('combat/report',{...v,command_id:randomUUID(),lease_id:b.lease})).body.code).toBe('PERMIT');});
it('checks browser origin, body schemas and speed envelopes',async()=>{const p=await player();expect((await app.inject({method:'POST',url:'/api/control',headers:{cookie:p.cookie,origin:'https://hostile.example'},payload:{}})).statusCode).toBe(403);expect((await p.request('combat/report',{...p.report(),to_tick:100000})).body.code).toBe('RATE');expect((await p.request('skills',{command_id:randomUUID(),revision:0,lease_id:p.lease,skills:['unknown']})).body.code).toBe('SKILL');});
it('blocks two tabs sharing the same login cookie',async()=>{const p=await player();const second=await p.request('control',{client_id:randomUUID()});expect(second.body.code).toBe('BUSY');});
it('retries an original payload under a newly valid controller without a new command ID',async()=>{const p=await player(),v=p.report([p.p.spawns[0].id]);await pool.query("UPDATE ow_controls SET expires=now()-interval '1 second' WHERE character=$1",[p.s.id]);const renewed=(await p.request('control',{client_id:randomUUID()})).body.lease_id;const r=await app.inject({url:'/api/combat/report',method:'POST',headers:{cookie:p.cookie,'x-aw-resume-lease':renewed},payload:v});expect(r.statusCode).toBe(200);expect(r.json().command_id).toBe(v.command_id);});
it('releases control on logout so immediate relogin does not request takeover',async()=>{const p=await player();await p.request('logout',{});expect((await pool.query('SELECT * FROM ow_controls WHERE character=$1',[p.s.id])).rowCount).toBe(0);});
it('keeps private reward rules out of permits and settles the authorized rule snapshot',async()=>{const p=await player();expect(p.p).not.toHaveProperty('private_data');expect(p.p).not.toHaveProperty('economy');const stored=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[p.p.id])).rows[0].private_data;stored.economy.elite={gold:77,xp:21,material:3};await pool.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[stored,p.p.id]);const elite=p.p.spawns.find(s=>s.elite)!;const receipt=await p.request('combat/report',p.report([elite.id]));expect(receipt.status).toBe(200);expect(receipt.body.delta).toMatchObject({gold:77,xp:21,material:3});});
it('equipment costs and upgrade commit once when retrying the same command',async()=>{const p=await player(),s=structuredClone(p.s);delete s.story;s.gold=1000;s.material=100;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.s.id]);const g=s.gear[0],preview=await p.request('gear/'+g.id+'/preview');expect(preview.body.gear_id).toBe(g.id);expect(preview.body.revision).toBe(s.revision);expect(preview.body.cost).toEqual({gold:35,material:2});expect(preview.body.salvage.material).toBe(economy.salvageMaterial);expect(preview.body.salvage.gear_id).toBe(g.id);const skills=await p.request('skills/preview');expect(skills.body.skills.find((row:any)=>row.id==='cut').cost).toEqual(skillUpgradeCost(1));const v={command_id:randomUUID(),revision:0,lease_id:p.lease,gear_id:g.id,region:'town',position:{x:8,y:14}};const a=await p.request('gear/upgrade',v),b=await p.request('gear/upgrade',v);expect(a.status).toBe(200);expect(b.body).toEqual(a.body);expect(a.body.delta).toEqual({gold:-35,xp:0,material:-2});expect(a.body.snapshot.gold).toBe(1000-preview.body.cost.gold);expect(a.body.snapshot.material).toBe(98);expect(a.body.snapshot.gear.find((x:any)=>x.id===g.id).rank).toBe(1);});
it('skills can train with no enhancement stones and stone shortages block equipment atomically',async()=>{
 const p=await player(),s=structuredClone(p.s);delete s.story;s.gold=1000;s.material=0;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const failed=await p.request('gear/upgrade',{command_id:randomUUID(),revision:s.revision,lease_id:p.lease,gear_id:s.gear[0].id,region:'town',position:{x:8,y:14}});expect(failed.body.code).toBe('COST');expect(failed.body.message).toContain('强化石');expect((await p.request('character')).body.material).toBe(0);
 const body={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,skill_id:'cut'},done=await p.request('skills/upgrade',body);expect(done.status).toBe(200);expect(done.body.delta).toEqual({gold:-60,xp:0,material:0});expect(done.body.snapshot.material).toBe(0);expect((await p.request('skills/upgrade',body)).body).toEqual(done.body);
});
