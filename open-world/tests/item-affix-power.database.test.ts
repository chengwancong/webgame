import {beforeAll,afterAll,it,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {makeGearByBase} from '../packages/rules/index.ts';
import {applyItemPower,stageForItemLevel} from '../packages/rules/item-power.ts';
import {generateGearAffixes,affixDefinitions,maxAffixTierForItemLevel,gearAffixConfig} from '../packages/rules/affix-generator.ts';
import type {CharacterState} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('R0 requires isolated real PostgreSQL');
const schema='qa_r0_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:2});
const app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
it('real saved instances survive reads; T1/T8 rerolls charge once, reject stale revisions and restore',async()=>{
 const username='r0_'+randomUUID().replaceAll('-','').slice(0,20),login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const response=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:response.statusCode,body:response.json()};};
 const created=await request('character',{name:'词缀验收'});expect(created.status).toBe(200);const id=created.body.id,lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState;delete s.story;delete s.starsea;s.level=50;s.gold=100000;s.material=10000;
 const old=makeGearByBase('standard-sword-t1-weapon',randomUUID());old.ilvl=45;old.stage=8;old.rank=3;old.locked=true;old.affixes=[{id:'old-speed',name:'移速',stat:'speed',tier:3,value:72,description:'移速 +72'}];
 s.gear.push(old);const targets=[1,45].map(level=>applyItemPower(makeGearByBase('standard-sword-t1-weapon',randomUUID()),level));for(const g of targets){g.quality='rare';g.affixes=generateGearAffixes(g);s.gear.push(g);}
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);const before=structuredClone(s.gear);
 await request('character');await request('gear/'+old.id+'/tip');await request('gear/'+old.id+'/preview');await migrate(pool);
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state.gear).toEqual(before);
 let current=(await request('character')).body;
 for(const g of targets){
  const body={command_id:randomUUID(),revision:current.revision,lease_id:lease,gear_id:g.id,affix_slot:0,region:'town',position:{x:8,y:14}},gold=current.gold,material=current.material,build=current.build;
  const rerolled=await request('gear/reroll',body);expect(rerolled.status).toBe(200);const next=rerolled.body.snapshot,item=next.gear.find((a:any)=>a.id===g.id);
  expect(next.gold).toBe(gold-100);expect(next.material).toBe(material-10);expect(next.build).toBe(build+1);expect(next.revision).toBe(current.revision+1);
  expect(item.affixes.length).toBeGreaterThan(0);for(const a of item.affixes){const entry=affixDefinitions.find(e=>e.stat===a.stat&&e.tier===a.tier)!;expect(a.tier).toBeLessThanOrEqual(maxAffixTierForItemLevel(g.ilvl!));expect(gearAffixConfig.quality.rare.tiers).toContain(a.tier);const factor=['attack','armor','hp'].includes(a.stat)?stageForItemLevel(g.ilvl!).scale:1;expect(a.value).toBeGreaterThanOrEqual((factor===1?entry.minValue:Math.round(entry.minValue*factor)));expect(a.value).toBeLessThanOrEqual((factor===1?entry.maxValue:Math.round(entry.maxValue*factor)));}
  expect(item.affixes.slice(1)).toEqual(g.affixes.slice(1));expect(item.rerollSlot).toBe(0);const {affixes,rerollSlot,...remaining}=item,{affixes:prior,...expected}=g;expect(remaining).toEqual(expected);
  expect((await request('gear/reroll',body)).body).toEqual(rerolled.body);
  expect((await request('gear/reroll',{...body,command_id:randomUUID()})).body.code).toBe('REVISION');
  expect((await request('gear/reroll',{...body,gear_id:old.id})).body.code).toBe('COMMAND_CONFLICT');
  expect((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[id,body.command_id])).rows[0].n).toBe(1);
  current=(await request('character')).body;expect(current.gear.find((a:any)=>a.id===old.id)).toEqual(old);
 }
 for(const g of before.filter(g=>!targets.some(t=>t.id===g.id)))expect(current.gear.find((a:any)=>a.id===g.id)).toEqual(g);
 const saved=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 expect(saved.gear).toEqual(current.gear);expect(saved.gold).toBe(s.gold-200);expect(saved.material).toBe(s.material-20);
});
