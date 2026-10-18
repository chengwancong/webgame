import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {challengeViewSchema,challengeProgressSchema} from '../packages/contracts/progression-challenges.ts';
import type {CharacterState,Receipt} from '../packages/contracts/index.ts';
import {receiptSchema} from '../packages/contracts/index.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {challengePeriods,simulateChallenge,awardSeasonXp} from '../packages/rules/progression-challenges.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Challenge tests require actual PostgreSQL. No mock or skip.');
const schema='qa_challenges_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:8}),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(powerful=false){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'challenge_'+randomUUID().replaceAll('-','').slice(0,16)}});expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'挑战行者'}),id=created.body.id,lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 // These challenge fixtures represent existing characters; story unlock enforcement has its own native server journey.
 await pool.query("UPDATE ow_characters SET state=state-'story' WHERE id=$1",[id]);
 if(powerful){const s:CharacterState=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;s.level=100;s.gear.find(g=>g.id===s.equipment.weapon)!.attack=1000000;s.skills=['cut','whirl','ward','mend'];s.skillRanks={cut:5,whirl:5,ward:5,mend:5};s.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);}
 const command=async(path:string,body:object)=>{const s=(await request('character')).body;return request(path,{command_id:randomUUID(),revision:s.revision,lease_id:lease,...body});};
 return {id,lease,request,command};
}

it('uses fixed Beijing daily/Monday weekly resets and closed seasons never award XP',()=>{
 expect(challengePeriods(Date.parse('2026-10-04T16:00:00Z'))).toEqual({day:'2026-10-05',week:'2026-10-05'});
 expect(challengePeriods(Date.parse('2026-10-04T15:59:59Z'))).toEqual({day:'2026-10-04',week:'2026-09-28'});
 const s={challengeProgress:challengeProgressSchema.parse({})} as CharacterState;awardSeasonXp(s,100,Date.parse('2027-01-02T00:00:00Z'));expect(s.challengeProgress!.seasonXp).toEqual({});
});
it('validates auth, level, area and tier conditions before consuming attempts',async()=>{
 expect((await app.inject({url:'/api/challenges'})).statusCode).toBe(401);const p=await player(),view=await p.request('challenges');expect(()=>challengeViewSchema.parse(view.body)).not.toThrow();
 expect((await p.command('challenges/run',{challenge_id:'high-meadow'})).body.code).toBe('CHALLENGE_LOCKED');expect((await p.command('challenges/run',{challenge_id:'raid-abyss'})).body.code).toBe('RAID');
 expect((await p.command('challenges/run',{challenge_id:'nightmare',tier:101})).status).toBe(400);expect((await p.request('character')).body.challengeProgress?.daily??{}).toEqual({});
});
it('settles a server-simulated victory once under concurrent retries and records progression ledger',async()=>{
 const p=await player(true),s=(await p.request('character')).body,body={command_id:randomUUID(),revision:s.revision,lease_id:p.lease,challenge_id:'high-meadow',tier:1};
 const results=await Promise.all([p.request('challenges/run',body),p.request('challenges/run',body)]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[0].body).toEqual(results[1].body);
 const receipt=receiptSchema.parse(results[0].body);expect(receipt.snapshot.challengeProgress!.last!.won).toBe(true);expect(receipt.delta.gold).toBe(400);expect(receipt.delta.progression?.materials.omega_fragment).toBeGreaterThan(0);
 expect((await pool.query('SELECT * FROM ow_challenge_runs WHERE character=$1',[p.id])).rowCount).toBe(1);expect((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,body.command_id])).rowCount).toBe(1);
 expect((await p.request('challenges/run',{...body,challenge_id:'high-forest'})).body.code).toBe('COMMAND_CONFLICT');
 for(let i=0;i<2;i++)expect((await p.command('challenges/run',{challenge_id:'high-meadow'})).status).toBe(200);
 expect((await p.command('challenges/run',{challenge_id:'high-meadow'})).body.code).toBe('CHALLENGE_LOCKED');
});
it('failed battles award nothing but consume an attempt, and seed replay is deterministic',async()=>{
 const p=await player(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state as CharacterState;s.level=20;s.skills=['ward'];s.skillRanks={ward:1};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const d=challengeContent.entries[0],id=randomUUID(),first=simulateChallenge(s,d,1,17,id,'ow-7');expect(simulateChallenge(s,d,1,17,id,'ow-7')).toEqual(first);expect(first.won).toBe(false);expect(first.reward).toEqual({gold:0,xp:0,material:0});
 const r=await p.command('challenges/run',{challenge_id:d.id});expect(r.status).toBe(200);expect(r.body.delta).toEqual({gold:0,xp:0,material:0});expect(r.body.snapshot.challengeProgress.last.won).toBe(false);expect(Object.values(r.body.snapshot.challengeProgress.daily)).toEqual([1]);
});
it('nightmare cannot skip tiers, produces actual affixes and persists seasonal ranking',async()=>{
 const p=await player(true);expect((await p.command('challenges/run',{challenge_id:'nightmare',tier:2})).body.code).toBe('TIER');const r=await p.command('challenges/run',{challenge_id:'nightmare',tier:1});expect(r.status).toBe(200);expect(r.body.snapshot.challengeProgress.last.won).toBe(true);expect(r.body.snapshot.challengeProgress.last.affixes).toHaveLength(2);expect(r.body.snapshot.challengeProgress.bestTier).toBe(1);const view=(await p.request('challenges')).body;expect(view.leaderboard.some((v:any)=>v.tier===1)).toBe(true);
 const claim=await p.command('challenges/season-claim',{reward_id:'supply'});expect(claim.status).toBe(200);expect((await p.command('challenges/season-claim',{reward_id:'supply'})).body.code).toBe('CLAIMED');
});
it('requires 20 actual ready players, enforces roles, locks build versions and settles every member once',async()=>{
 const players=[];for(let i=0;i<20;i++)players.push(await player(true));const leader=players[0];expect((await leader.command('raids/create',{raid_id:'raid-abyss',role:'tank'})).status).toBe(200);const lobby=(await leader.request('challenges')).body.lobbies.find((l:any)=>l.leader===leader.id),id=lobby.id;
 expect((await leader.command('raids/start',{lobby_id:id})).body.code).toBe('RAID_READY');
 for(let i=1;i<20;i++){const role=i<2?'tank':i<6?'healer':'damage';expect((await players[i].command('raids/join',{lobby_id:id,role})).status).toBe(200);}
 const surplus=await player(true);expect((await surplus.command('raids/join',{lobby_id:id,role:'damage'})).body.code).toBe('RAID_FULL');
 for(const p of players)expect((await p.command('raids/ready',{lobby_id:id})).status).toBe(200);
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{build}',to_jsonb((state->>'build')::integer+1)) WHERE id=$1",[players[7].id]);expect((await leader.command('raids/start',{lobby_id:id})).body.code).toBe('RAID_BUILD');expect((await players[7].command('raids/ready',{lobby_id:id})).status).toBe(200);
 const s=(await leader.request('character')).body,body={command_id:randomUUID(),revision:s.revision,lease_id:leader.lease,lobby_id:id};const started=await leader.request('raids/start',body);expect(started.status).toBe(200);const result=(started.body as Receipt).snapshot.challengeProgress!.last!;expect(result.won).toBe(true);expect(result.stages).toBe(8);expect((await leader.request('raids/start',body)).body).toEqual(started.body);
 expect((await pool.query('SELECT * FROM ow_challenge_runs WHERE command=$1',[body.command_id])).rowCount).toBe(20);expect((await pool.query('SELECT * FROM ow_ledger WHERE command=$1',[body.command_id])).rowCount).toBe(20);
 for(const p of players){const current=(await p.request('character')).body;expect(current.challengeProgress.last.run_id).toBe(result.run_id);expect(Object.values(current.challengeProgress.weekly)).toEqual([1]);expect((await p.command('raids/create',{raid_id:'raid-abyss',role:'damage'})).body.code).toBe('RAID_LOCKED');}
},60000);
