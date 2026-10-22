import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';
import {snapshotSchema,receiptSchema,validateResponse,type CharacterState} from '../packages/contracts/index.ts';
import {challengeContent,seasonActive} from '../packages/content/progression-challenges.ts';
import {challengeProgressSchema} from '../packages/contracts/progression-challenges.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('A real isolated PostgreSQL instance is required');
const pool=new Pool({connectionString:dsn,max:2});
const flags=parseFieldFreeze({camps:true,patrols:true,exploration:true,waypoints:true,bounties:true,events:true,fieldEntry:true,fieldGather:true,fieldSprint:true});
const app=createApp(pool,{testLogin:true,dungeons:false,fieldFreeze:flags});
beforeAll(async()=>{await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();});
it('publishes nine switches and rejects legacy writes without state, receipts or ledger changes',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_hub_'+randomUUID().slice(0,8)}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const call=async(url:string,payload?:object)=>app.inject({method:payload?'POST':'GET',url:'/api/'+url,headers:{cookie},payload});
 const character=(await call('character',{name:'HUB冻结'})).json();
 expect(snapshotSchema.parse(character).fieldFreeze).toEqual(flags);
 const lease=(await call('control',{client_id:randomUUID()})).json().lease_id;
 const before=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[character.id])).rows[0].state;
 const cmd={command_id:randomUUID(),revision:character.revision,lease_id:lease};
 for(const [url,body] of [
  ['location',{region:'ss-map-wind'}],['safe',{region:'ss-map-wind',point:''}],
  ['quest',{op:'arrive',region:'ss-map-wind'}],
  ['plane/interact',{permit_id:randomUUID(),gate:'wind-plane'}],
  ['field/gather',{region:'ss-map-wind',node:'wind-gather',position:{x:1,y:1},mode:'manual'}],
 ] as const){const r=await call(url,{...cmd,...body,command_id:randomUUID()});expect(r.statusCode,r.body).toBe(409);expect(r.json()).toMatchObject({code:'FIELD_FROZEN',message:expect.stringContaining('冻结')});}
 const p=await call('permit',{lease_id:lease,region:'ss-map-wind'});expect(p.statusCode,p.body).toBe(409);expect(p.json().code).toBe('FIELD_FROZEN');
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[character.id])).rows[0].state).toEqual(before);
 expect(Number((await pool.query('SELECT count(*) n FROM ow_receipts WHERE character=$1',[character.id])).rows[0].n)).toBe(0);
 expect(Number((await pool.query('SELECT count(*) n FROM ow_ledger WHERE character=$1',[character.id])).rows[0].n)).toBe(0);
 const content=(await call('content')).json();expect(content.fieldFreeze).toEqual(flags);expect(content.regions.every((r:any)=>r.sprint!==true)).toBe(true);
});
it('keeps season supply currencies and growth materials while frozen factions gain no reputation, including receipt replay',async()=>{
 // Use the configured active season and real clock. Do not alter global time or
 // PostgreSQL lease deadlines for this regression.
 expect(seasonActive(),'This acceptance requires a configured season active at the real server time').toBe(true);
 const season=challengeContent.season,supply=season.rewards.find(r=>r.id==='supply'||r.id.startsWith('supply-'));
 expect(supply,'The active season must publish its existing supply tier').toBeDefined();
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_hub_season_'+randomUUID().slice(0,8)}});expect(login.statusCode,login.body).toBe(200);
 const cookie=String(login.headers['set-cookie']).split(';')[0],call=(url:string,payload?:object)=>app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+url,headers:{cookie},payload});
 const created=await call('character',{name:'冻结声望赛季回归'});expect(created.statusCode,created.body).toBe(200);const id=created.json().id;
 const control=await call('control',{client_id:randomUUID()});expect(control.statusCode,control.body).toBe(200);const lease=control.json().lease_id;
 const stored=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState;
 const seeded=await stored();seeded.challengeProgress=challengeProgressSchema.parse({seasonXp:{[season.id]:supply!.xp},seasonClaims:['prior-season:kept']});
 // Historical faction balances must be preserved, not cleared to disguise a
 // missing freeze; the supply claim simply must not increase any of them.
 seeded.progression!.reputation=Object.fromEntries(progressionConfig.factions.map((f,i)=>[f.id,i+1]));
 seeded.progression!.materials={...seeded.progression!.materials,character_shard:7,gold_moon:5};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[seeded,id]);
 const current=snapshotSchema.parse((await call('character')).json());expect(current.fieldFreeze?.fieldEntry).toBe(true);const before=await stored();
 const body={command_id:randomUUID(),revision:current.revision,lease_id:lease,reward_id:supply!.id},first=await call('challenges/season-claim',body);expect(first.statusCode,first.body).toBe(200);
 expect(()=>validateResponse('challenges/season-claim',first.json())).not.toThrow();const receipt=receiptSchema.parse(first.json()),after=await stored();
 expect(receipt.delta).toMatchObject({gold:supply!.gold,material:supply!.material,xp:0});expect(after.gold-before.gold).toBe(supply!.gold);expect(after.material-before.material).toBe(supply!.material);
 const expectedGrowth:Record<string,number>={};for(const reward of [progressionConfig.rewards.world,progressionConfig.rewards.season])for(const [material,amount]of Object.entries(reward))expectedGrowth[material]=(expectedGrowth[material]??0)+amount;
 expect(Object.keys(expectedGrowth).length).toBeGreaterThan(0);expect(receipt.delta.progression?.materials).toEqual(expectedGrowth);
 for(const [material,amount]of Object.entries(expectedGrowth))expect((after.progression!.materials[material]??0)-(before.progression!.materials[material]??0)).toBe(amount);
 expect(receipt.delta.progression?.reputation).toEqual({});expect(after.progression!.reputation).toEqual(before.progression!.reputation);expect(receipt.snapshot.progression!.reputation).toEqual(before.progression!.reputation);
 expect(after.challengeProgress!.seasonXp).toEqual(before.challengeProgress!.seasonXp);expect(after.challengeProgress!.seasonClaims).toEqual(['prior-season:kept',season.id+':'+supply!.id]);
 const replay=await call('challenges/season-claim',body);expect(replay.statusCode,replay.body).toBe(200);expect(replay.json()).toEqual(first.json());expect(await stored()).toEqual(after);
 expect((await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1 AND command=$2',[id,body.command_id])).rows[0].n).toBe(1);expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[id,body.command_id])).rows[0].n).toBe(1);
 const duplicate=await call('challenges/season-claim',{...body,command_id:randomUUID(),revision:after.revision});expect(duplicate.statusCode,duplicate.body).toBe(409);expect(duplicate.json().code).toBe('CLAIMED');expect(await stored()).toEqual(after);
});
