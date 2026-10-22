import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {snapshotSchema,validateResponse,type Gear} from '../packages/contracts/index.ts';
import {makeGear} from '../packages/rules/index.ts';
import {generateGearAffixes} from '../packages/rules/affix-generator.ts';
import {applyItemPower} from '../packages/rules/item-power.ts';
import {rewards as economy} from '../apps/api/src/economy.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('D13 integration requires isolated PostgreSQL');
const schema='qa_hex_affix_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const app=createApp(pool,{testLogin:true,devCheckpoints:true,dungeons:false});
const evidence:unknown[]=[];
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{if(process.env.AW_HEX_AUDIT_OUTPUT)await writeFile(process.env.AW_HEX_AUDIT_OUTPUT,JSON.stringify({at:new Date().toISOString(),scope:'controlled isolated real PostgreSQL/API; not natural acquisition or GUI',evidence},null,2)+'\n');await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
function item(index:number,tier:'common'|'magic',hex=true):Gear{
 const g=makeGear(index,randomUUID());g.origin={kind:'random'};g.quality='rare';applyItemPower(g,20);
 g.affixes=generateGearAffixes(g,2,{int:(min)=>min,float:()=>.5});
 if(hex)g.hex={rune:'hex-aftershock',tier};return g;
}
async function actor(){
 const username='qa_affix_'+randomUUID().slice(0,8),login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=async(path:string,payload?:unknown)=>{const r=await app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});return {status:r.statusCode,body:r.json()};};
 const initial=await req('character',{name:'D13事务验收'});let revision=initial.body.revision;
 const lease=(await req('control',{client_id:randomUUID()})).body.lease_id;
 const command=(extra:object)=>({command_id:randomUUID(),revision,lease_id:lease,...extra});
 const send=async(path:string,extra:object)=>{const input=command(extra),result=await req(path,input);if(result.status===200)revision=result.body.revision;return {...result,input};};
 const checkpoint=await send('dev/checkpoint',{checkpoint:'port-road',weapon:'sword'});expect(checkpoint.status).toBe(200);
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[initial.body.id])).rows[0].state;
 // Controlled transaction preconditions only, not a natural growth or combat
 // measurement. Ordinary item stats come from the existing factories.
 s.level=30;s.gold=100000;s.material=10000;s.starsea.features=[...new Set([...s.starsea.features,'forge'])];s.lastRegion='ss-map-port';s.starsea.location={map:'ss-map-port',x:19,y:20};
 const low=item(0,'common'),high=item(2,'magic'),candidate=item(0,'magic'),plain=item(0,'common',false);
 s.gear.push(low,high,candidate,plain);s.equipment.weapon=low.id;s.equipment.armor=high.id;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,initial.body.id]);
 return {id:initial.body.id,username,req,send,command,low,high,candidate,plain};
}
async function saved(id:string){
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const counts=(await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[id])).rows[0];
 return {state,counts};
}
it('D13 real tip/preview compute activation changes without writes; ordinary equip commits one state and replays once',async()=>{
 const p=await actor(),before=await saved(p.id),tip=await p.req('gear/'+p.candidate.id+'/tip');
 expect(tip.status).toBe(200);validateResponse('gear/'+p.candidate.id+'/tip',tip.body);
 expect(tip.body.hexPreview.changes).toEqual(expect.arrayContaining([
  expect.objectContaining({gear:p.candidate.id,change:'activate'}),
  expect.objectContaining({gear:p.high.id,change:'deactivate'})
 ]));
 const preview=await p.req('gear/'+p.candidate.id+'/preview');expect(preview.status).toBe(200);validateResponse('gear/'+p.candidate.id+'/preview',preview.body);
 expect(preview.body.hexPreview).toEqual(tip.body.hexPreview);expect(await saved(p.id)).toEqual(before);
 const equip=await p.send('gear/equip',{gear_id:p.candidate.id});expect(equip.status).toBe(200);validateResponse('gear/equip',equip.body);
 const active=equip.body.snapshot.hexActive;expect(active.find((r:any)=>r.gear===p.candidate.id).active).toBe(true);expect(active.find((r:any)=>r.gear===p.high.id)).toMatchObject({active:false,reason:'duplicate'});
 expect((await p.req('gear/equip',equip.input)).body).toEqual(equip.body);
 const after=await saved(p.id);expect(after.counts).toEqual({receipts:before.counts.receipts+1,ledger:before.counts.ledger+1});
 expect(after.state.gear).toEqual(before.state.gear);
 evidence.push({case:'tip-preview-equip',versions:(await p.req('health')).body.versions,tip:{status:tip.status,hexPreview:tip.body.hexPreview},preview:{status:preview.status,hexPreview:preview.body.hexPreview},equip:{request:{...equip.input,lease_id:'[isolated lease omitted]'},revision:equip.body.revision,hexActive:active},counts:{before:before.counts,after:after.counts},inventoryPreserved:true,duplicateReceiptEqual:true});
});
it('D13 upgrade/reroll preserve the exact HEX, and explicit salvage pays the same as a plain item',async()=>{
 const p=await actor(),hex=structuredClone(p.candidate.hex),where={region:'ss-map-port',position:{x:19,y:20}};
 const before=await saved(p.id),upgrade=await p.send('gear/upgrade',{gear_id:p.candidate.id,...where});expect(upgrade.status).toBe(200);
 expect(upgrade.body.snapshot.gear.find((g:any)=>g.id===p.candidate.id).hex).toEqual(hex);
 expect(upgrade.body.snapshot.gear.find((g:any)=>g.id===p.candidate.id).rank).toBe(1);
 expect(upgrade.body.snapshot.gold).toBeLessThan(before.state.gold);
 const once=await saved(p.id);expect((await p.req('gear/upgrade',upgrade.input)).body).toEqual(upgrade.body);expect(await saved(p.id)).toEqual(once);
 const reroll=await p.send('gear/reroll',{gear_id:p.candidate.id,affix_slot:0,...where});expect(reroll.status).toBe(200);
 expect(reroll.body.snapshot.gear.find((g:any)=>g.id===p.candidate.id).hex).toEqual(hex);
 const hexSalvage=await p.send('gear/salvage',{gear_id:p.candidate.id}),plainSalvage=await p.send('gear/salvage',{gear_id:p.plain.id});
 expect(hexSalvage.status).toBe(200);expect(plainSalvage.status).toBe(200);
 expect(hexSalvage.body.delta.material).toBe(economy.salvageMaterial);expect(hexSalvage.body.delta.material).toBe(plainSalvage.body.delta.material);
 expect((await p.req('gear/salvage',hexSalvage.input)).body).toEqual(hexSalvage.body);
 evidence.push({case:'upgrade-reroll-salvage',hexBefore:hex,hexAfterReroll:reroll.body.snapshot.gear.find((g:any)=>g.id===p.candidate.id).hex,upgradeCost:upgrade.body.delta,rerollCost:reroll.body.delta,salvageHex:hexSalvage.body.delta.material,salvagePlain:plainSalvage.body.delta.material,replayNoDuplicate:true});
});
it('D13 public projection hides legacy socket items/state without deleting inventory, warehouse or pending rewards',async()=>{
 const p=await actor(),s=(await saved(p.id)).state;
 const old={id:randomUUID(),base:'hex-aftershock',name:'legacy sample',slot:'hex1',quality:'common',rank:0,locked:false,attack:0,armor:0,effect:'none',affixes:[],requiredLevel:10};
 s.gear.push(old);s.warehouse=[{...old,id:randomUUID()}];s.equipment.hex1=old.id;s.hex={awardedTasks:['HEX-Q01'],shards:20,offers:[]};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const reward={id:randomUUID(),source_id:'legacy-'+randomUUID(),region:'town',position:{x:0,y:0},gear:{...old,id:randomUUID()}};
 await pool.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,false)',[reward.id,p.id,reward.source_id,reward]);
 const before=await saved(p.id),read=await p.req('character');expect(read.status).toBe(200);const snapshot=snapshotSchema.parse(read.body);
 expect(snapshot.gear.some(g=>g.id===old.id)).toBe(false);expect(snapshot.warehouse).toEqual([]);expect(snapshot.rewards.some(r=>r.id===reward.id)).toBe(false);
 expect(snapshot.equipment).not.toHaveProperty('hex1');expect(snapshot).not.toHaveProperty('hexSlotAccess');
 expect(snapshot.hex).toEqual({awardedTasks:['HEX-Q01']});expect(await saved(p.id)).toEqual(before);
 expect((await pool.query('SELECT claimed FROM ow_rewards WHERE id=$1',[reward.id])).rows[0].claimed).toBe(false);
 for(const path of ['hex/equip','hex/unequip','hex/choose','dev/hex-grant'])expect((await p.req(path,p.command({}))).status).toBe(404);
 evidence.push({case:'legacy-projection',publicEquipment:snapshot.equipment,publicHex:snapshot.hex,inventoryIdRetained:old.id,warehouseIdRetained:s.warehouse[0].id,groundRewardRetained:reward.id,databaseUnchanged:true,removedRoutes404:true});
});
it('retired objects do not fill the visible inventory or enter bulk salvage, while their records remain intact',async()=>{
 const p=await actor(),s=(await saved(p.id)).state;
 for(let i=0;i<60;i++)s.gear.push({id:randomUUID(),base:'hex-aftershock',name:'retired',slot:'hex1',quality:'common',rank:0,locked:false,attack:0,armor:0,effect:'none',affixes:[],requiredLevel:10});
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const before=(await p.req('character')).body,preview=await p.req('gear/salvage-batch/preview');
 const reward={id:randomUUID(),source_id:'current-'+randomUUID(),region:'town',position:{x:0,y:0},gear:item(0,'common',false)};
 await pool.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,false)',[reward.id,p.id,reward.source_id,reward]);
 const claim=await p.send('reward/claim',{reward_id:reward.id});
 evidence.push({case:'retired-capacity',visibleBefore:before.gear.length,rawBefore:s.gear.length,claimStatus:claim.status,claimCode:claim.body.code,legacyInBulkPreview:preview.body.gear?.filter((g:any)=>g.slot==='hex1').length});
 expect(claim.status).toBe(200);
 expect(preview.body.gear.some((g:any)=>g.slot==='hex1')).toBe(false);
 expect(claim.body.snapshot.gear).toHaveLength(before.gear.length+1);
 expect((await saved(p.id)).state.gear.filter((g:any)=>g.slot==='hex1')).toHaveLength(60);
});
it('D13 ordinary quest rewards and rewritten dialogue commit through the real quest API exactly once',async()=>{
 const p=await actor(),s=(await saved(p.id)).state;
 s.starsea.islands=[...new Set([...s.starsea.islands,'ss-map-mist'])];s.starsea.discovered=[...new Set([...s.starsea.discovered,'ow-mist-z2'])];
 s.starsea.quests={'HEX-Q01':{step:2,attempt:0,acceptedAt:1,progress:{'kill:z2_invader':12,'obtain:hex_gear':1}}};s.starsea.tracked='HEX-Q01';
 s.starsea.done=s.starsea.done.filter((id:string)=>!id.startsWith('HEX-Q'));s.hex={awardedTasks:[],pity:{q01:true}};
 s.lastRegion='ss-map-mist';s.starsea.location={map:'ss-map-mist',x:131,y:339};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const before=await saved(p.id),done=await p.send('quest',{op:'talk',task:'HEX-Q01',region:'ss-map-mist',target:'npc:ss-npc-qingmang',position:{x:131,y:339}});
 expect(done.status).toBe(200);validateResponse('quest',done.body);
 expect(done.body.delta).toMatchObject({xp:2232,gold:120,material:0});expect(done.body.snapshot.starsea.done).toContain('HEX-Q01');
 expect(done.body.snapshot.starsea.completion.text).toContain('长在装备上');
 expect(done.body.snapshot.hex).not.toHaveProperty('offers');expect(done.body.snapshot.hex).not.toHaveProperty('shards');
 const after=await saved(p.id);expect(after.state.gold-before.state.gold).toBe(120);
 expect((await p.req('quest',done.input)).body).toEqual(done.body);expect(await saved(p.id)).toEqual(after);
 evidence.push({case:'D13-quest-reward',fixture:'controlled completed kill/pickup steps; real final NPC quest command and PG settlement',request:{...done.input,lease_id:'[isolated lease omitted]'},delta:done.body.delta,completion:done.body.snapshot.starsea.completion,counts:{before:before.counts,after:after.counts},replayNoDuplicate:true});
});
