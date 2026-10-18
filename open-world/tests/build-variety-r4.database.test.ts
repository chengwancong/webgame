import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {gearTipSchema,receiptSchema} from '../packages/contracts/index.ts';
import {statDefinition} from '../packages/contracts/stats.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('R4 requires real PostgreSQL');
const pool=poolFor(dsn),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
it('a confirmed drop has a real main stat, claims once, equips, rerolls without touching it, and survives reads',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'r4_'+randomUUID().replaceAll('-','').slice(0,20)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:object)=>{const r=await app.inject({method:body?'POST':'GET',url:'/api/'+path,headers:{cookie},payload:body});return {code:r.statusCode,data:r.json()};};let s=(await request('character',{name:'属性真实链路'})).data;const lease=(await request('control',{client_id:randomUUID()})).data.lease_id;
 const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;delete stored.story;delete stored.starsea;stored.gold=10000;stored.material=1000;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[stored,s.id]);s=(await request('character')).data;const oldGear=structuredClone(s.gear);
 const p=(await request('permit',{lease_id:lease,region:'meadow'})).data,frozen=(await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[p.id])).rows[0].private_data;
 // Only the private QA template selection is constrained. Reward generation and commands are real.
 frozen.gearBases=frozen.gearBases.filter((g:any)=>g.base==='standard-sword-t1-helmet');frozen.dropProfile.elite.gearPercent=100;frozen.dropProfile.elite.quality={common:0,magic:0,rare:100,legendary:0};await pool.query("UPDATE ow_permits SET private_data=$1,created=now()-interval '20 seconds' WHERE id=$2",[frozen,p.id]);
 const elite=p.spawns.find((e:any)=>e.elite),body={command_id:randomUUID(),revision:s.revision,lease_id:lease,permit_id:p.id,build:p.build,sequence:1,from_tick:0,to_tick:60,kills:[{source_id:elite.id,tick:30}]};const drop=await request('combat/report',body);expect(drop.code,JSON.stringify(drop.data)).toBe(200);receiptSchema.parse(drop.data);expect((await request('combat/report',body)).data).toEqual(drop.data);const reward=drop.data.rewards[0];expect(reward.gear.attributeVersion).toBe(2);expect(reward.gear.mainStat).toBeTruthy();s=drop.data.snapshot;
 const write=async(path:string,extra:object)=>{const payload={command_id:randomUUID(),revision:s.revision,lease_id:lease,...extra},r=await request(path,payload);expect(r.code,JSON.stringify(r.data)).toBe(200);expect((await request(path,payload)).data).toEqual(r.data);s=r.data.snapshot;return r.data;};
 await write('reward/claim-many',{reward_ids:[reward.id]});await write('gear/equip',{gear_id:reward.gear.id});const tip=gearTipSchema.parse((await request('gear/'+reward.gear.id+'/tip')).data);expect(tip.primary_attribute).toBe(reward.gear.mainStat.stat);expect(tip.attributes.effective[tip.primary_attribute]).toBe(reward.gear.mainStat.value);expect(tip.comparison[tip.primary_attribute]).toBeTruthy();
 const forge={region:'town',position:{x:8,y:14}};
 // Workshop-only reroll (2026-10-11): away from the forge or below level 23 is refused without charging anything.
 const before=structuredClone(s),reroll=(extra:object)=>request('gear/reroll',{command_id:randomUUID(),revision:s.revision,lease_id:lease,gear_id:reward.gear.id,affix_slot:0,...extra});
 expect((await reroll({})).data.code).toBe('FORGE_PLACE');expect((await reroll({region:'town',position:{x:30,y:30}})).data.code).toBe('FORGE_PLACE');expect((await reroll(forge)).data.code).toBe('REFORGE_LEVEL');expect((await request('character')).data).toEqual(before);
 const leveled=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;leveled.level=23;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[leveled,s.id]);s=(await request('character')).data;
 const main=structuredClone(reward.gear.mainStat);await write('gear/reroll',{gear_id:reward.gear.id,affix_slot:0,...forge});const item=s.gear.find((g:any)=>g.id===reward.gear.id);expect(item.mainStat).toEqual(main);for(const a of item.affixes){expect(a.stat).not.toBe(main.stat);expect(statDefinition(a.stat)!.slots).toContain('helmet');}
 const after=(await request('character')).data;expect(after.gear.find((g:any)=>g.id===item.id)).toEqual(item);for(const g of oldGear)expect(after.gear.find((x:any)=>x.id===g.id)).toEqual(g);
});
