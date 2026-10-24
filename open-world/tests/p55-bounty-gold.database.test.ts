import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {bountyRows} from '../packages/rules/bounty.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {validateResponse} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('P55 requires isolated real PostgreSQL');
const pool=new Pool({connectionString:dsn}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
it('P55 all 108 rows match the authorized formula and each island/count lane does not fall with zone',()=>{
 const rows=bountyRows.filter(r=>r.id.startsWith('ow-'));expect(rows).toHaveLength(108);expect(rows.reduce((n,r)=>n+r.reward_gold!,0)).toBe(27780);
 for(const r of rows){const region=r.id.split('-')[1],lane=r.id.at(-1),zone=Number(r.zone!.match(/z(\d+)$/)![1]);const preceding=rows.filter(x=>x.id.startsWith('ow-'+region+'-')&&x.id.endsWith('-'+lane)&&Number(x.zone!.match(/z(\d+)$/)![1])<=zone);const expected=Math.max(...preceding.map(x=>{const z=worldTables.zones.find(z=>z.id===x.zone)!,level=Math.round((z.levelBand[0]+z.levelBand[1])/2),count=x.elite?10:x.cond_count!,old=x.elite?40:count===8?20:60;return Math.max(old,Math.round(.5*6*1.09**(level-1)*count/10)*10);}));expect(r.reward_gold).toBe(expected);expect(r.repeat_cooldown_seconds).toBe(600);}
 for(const island of ['wind','mist','forge','frost','rift','dragon']){const group=rows.filter(r=>r.id.startsWith('ow-'+island+'-'));expect(group).toHaveLength(18);for(const suffix of ['1','2','3']){const lane=group.filter(r=>r.id.endsWith('-'+suffix)).sort((a,b)=>a.zone!.localeCompare(b.zone!));for(let i=1;i<lane.length;i++)expect(lane[i].reward_gold).toBeGreaterThanOrEqual(lane[i-1].reward_gold!);}}
});
it('P55 a pre-update accepted Lv32 eight-kill instance claims 350 gold through real PG exactly once',async()=>{
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'p55_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const s=(await req('character',{name:'P55旧悬赏验收'})).json(),lease=(await req('control',{client_id:randomUUID()})).json().lease_id,instance=randomUUID(),task='ow-rift-bounty-z6-1';
 // Seed only a legacy-format accepted instance and confirmed progress. No reward
 // amounts/results are inserted; this is settlement compatibility, not natural kills.
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;
 state.level=32;state.starsea.features=[...new Set([...state.starsea.features,'bounty'])];state.starsea.bounties=[{slot:'ow-rift-z6:1',zone:'ow-rift-z6',task,instance,acceptedAt:Date.parse('2026-10-20T00:00:00Z'),progress:8,xp:80}];
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,s.id]);
 const before=(await req('character')).json(),input={command_id:randomUUID(),revision:before.revision,lease_id:lease,instance},response=await req('bounty/claim',input);expect(response.statusCode,response.body).toBe(200);const paid=validateResponse('bounty/claim',response.json()) as any;
 expect(paid.delta).toMatchObject({gold:350,xp:40,material:0});expect(paid.snapshot.gold-before.gold).toBe(350);expect(paid.snapshot.gear).toEqual(before.gear);expect(paid.snapshot.rewards).toEqual(before.rewards);
 expect((await req('bounty/claim',input)).json()).toEqual(response.json());
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[s.id,input.command_id])).rows[0].n).toBe(1);
 const archive=(await req('tasks')).json().archive.filter((r:any)=>r.bountyInstance===instance);expect(archive).toHaveLength(1);expect(archive[0].reward.gold).toBe(350);
 const again=await req('bounty/claim',{...input,command_id:randomUUID(),revision:paid.revision});expect(again.json().code).toBe('BOUNTY_GONE');expect((await req('character')).json().gold).toBe(before.gold+350);
});
