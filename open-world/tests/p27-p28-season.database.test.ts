import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {challengeContent,seasonActive,seasonForTime} from '../packages/content/progression-challenges.ts';
import {awardSeasonXp} from '../packages/rules/progression-challenges.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real isolated PostgreSQL required');
const schema='qa_p28_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
it('six public tiers preserve historical claims; new tiers grant exact rewards once through real database receipts',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'p28_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=async(path:string,payload?:any)=>app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload});
 const created=(await req('character',{name:'赛季隔离验收'})).json(),lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state,season=challengeContent.season;
 s.challengeProgress={daily:{},weekly:{},bestTier:0,seasonXp:{[season.id]:11999,'prior-season':123},seasonClaims:[season.id+':supply','prior-season:legacy']};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const command=async(reward_id:string)=>{const state=(await req('character')).json();return {command_id:randomUUID(),lease_id:lease,revision:state.revision,reward_id};};
 const blocked=await req('challenges/season-claim',await command('legend'));expect(blocked.statusCode).toBe(409);expect(blocked.json().code).toBe('SEASON_XP');
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state).toEqual(s);
 s.challengeProgress.seasonXp[season.id]=12000;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const view=(await req('challenges')).json();expect(view.season.rewards.map((r:any)=>r.id)).toEqual(['supply','journey','mastery','veteran','bounty','legend']);expect(view.season.rewards[0].claimed).toBe(true);
 for(const id of ['journey','mastery','veteran','bounty','legend']){
  const body=await command(id),before=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state,reward=season.rewards.find(r=>r.id===id)!;
  const one=await req('challenges/season-claim',body),again=await req('challenges/season-claim',body);expect(one.statusCode,one.body).toBe(200);expect(again.json()).toEqual(one.json());
  const after=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;expect(after.gold-before.gold).toBe(reward.gold);expect(after.material-before.material).toBe(reward.material);expect(after.challengeProgress.seasonXp).toEqual(before.challengeProgress.seasonXp);
  expect(after.challengeProgress.seasonClaims).toContain('prior-season:legacy');expect(after.challengeProgress.seasonClaims).toContain(season.id+':supply');
  expect((await req('challenges/season-claim',await command(id))).json().code).toBe('CLAIMED');expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[s.id,body.command_id])).rows[0].n).toBe(1);
 }
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state,at=Date.parse(season.start);awardSeasonXp(state,2,at);expect(state.challengeProgress.seasonXp[season.id]).toBe(12002);const boundary=Date.parse(season.end);awardSeasonXp(state,40,boundary);expect(state.challengeProgress.seasonXp[season.id]).toBe(12002);expect(state.challengeProgress.seasonXp['abyss-2027-q1']).toBe(40);const copy=structuredClone(state);awardSeasonXp(state,40,Date.parse('2027-04-01T00:00:00+08:00'));expect(state).toEqual(copy);expect(seasonActive(Date.parse('2027-04-01T00:00:00+08:00'))).toBe(false);
});
it('Q1 switches exactly at Beijing midnight, exposes suffixed tiers and preserves old claim history through real API writes',async()=>{
 const boundary=Date.parse('2027-01-01T00:00:00+08:00');expect(seasonForTime(boundary-1).id).toBe('abyss-2026-q4');expect(seasonForTime(boundary).id).toBe('abyss-2027-q1');
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'p28q1_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,payload?:any)=>app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload});
 const s=(await req('character',{name:'跨季隔离验收'})).json(),lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 s.challengeProgress={daily:{},weekly:{},bestTier:0,seasonXp:{'abyss-2026-q4':12000,'abyss-2027-q1':12000},seasonClaims:['abyss-2026-q4:legend']};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const clock=vi.spyOn(Date,'now').mockReturnValue(boundary+1000);
 try{
  const view=(await req('challenges')).json();expect(view.season.id).toBe('abyss-2027-q1');expect(view.season.active).toBe(true);expect(view.season.rewards).toHaveLength(6);expect(view.season.rewards.every((r:any)=>r.id.endsWith('-2027-q1'))).toBe(true);
  const currentLease=(await req('control',{client_id:randomUUID(),takeover:true})).json().lease_id;
  // PostgreSQL still has today's wall clock while the application exercises Q1.
  // Align this owned fixture lease with the simulated date; do not weaken lease validation.
  await pool.query('UPDATE ow_controls SET expires=$1 WHERE character=$2 AND lease=$3',[new Date(boundary+60000),s.id,currentLease]);
  const before=(await req('character')).json(),base={command_id:randomUUID(),revision:before.revision,lease_id:currentLease};
  expect((await req('challenges/season-claim',{...base,reward_id:'legend'})).json().code).toBe('SEASON');
  const body={...base,command_id:randomUUID(),reward_id:'legend-2027-q1'},one=await req('challenges/season-claim',body);expect(one.statusCode,one.body).toBe(200);
  expect(one.json().delta).toMatchObject({gold:36000,material:2400});expect((await req('challenges/season-claim',body)).json()).toEqual(one.json());
  const saved=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;expect(saved.challengeProgress.seasonClaims).toEqual(['abyss-2026-q4:legend','abyss-2027-q1:legend-2027-q1']);expect(saved.challengeProgress.seasonXp).toEqual(s.challengeProgress.seasonXp);
 }finally{clock.mockRestore();}
});
