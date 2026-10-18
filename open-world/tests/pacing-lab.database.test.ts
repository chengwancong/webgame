import {it,expect,beforeAll,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {pacingBuild,pacingProfiles} from '../tools/pacing/profiles.ts';
import {pacingLabViewSchema,pacingLabSuggestionSchema} from '../packages/contracts/pacing-lab.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Pacing lab requires real PostgreSQL');
const schema='qa_pacing_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:6});
let app:ReturnType<typeof createApp>;
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);app=createApp(pool,{testLogin:true,pacingLab:{isolated:true,tickMs:1,ticksPerStep:30}});await app.listen({host:'127.0.0.1',port:0});});
afterAll(async()=>{await app?.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
const login=async(username:string)=>{const r=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(r.headers['set-cookie']).split(';')[0];expect(r.statusCode).toBe(200);const created=await app.inject({method:'POST',url:'/api/character',headers:{cookie},payload:{name:'隔离试玩'}});expect([200,409]).toContain(created.statusCode);return cookie;};
it('enforces server whitelist and production gates independently of the frontend',async()=>{
 const cookie=await login('pacing_visitor');const denied=await app.inject({method:'GET',url:'/api/pacing/view',headers:{cookie}});expect(denied.statusCode).toBe(403);
 expect(()=>createApp(pool,{production:true,pacingLab:{isolated:true}})).toThrow('cannot be enabled');
 const normal=createApp(pool,{testLogin:true,dungeons:false});await normal.ready();try{expect((await normal.inject({method:'GET',url:'/api/pacing/view'})).statusCode).toBe(404);}finally{await normal.close();}
});
it('freezes only the next trial, verifies requested skills, exports reviewable advice and writes no rewards',async()=>{
 const cookie=await login('pacing_dev'),headers={cookie},row=(await pool.query("SELECT c.state FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE a.username='pacing_dev'")).rows[0],state=row.state,a=pacingBuild(pacingProfiles.find(p=>p.id==='burn')!);
 Object.assign(state,{level:50,gear:a.state.gear,equipment:a.state.equipment,skills:a.state.skills,skillRanks:a.state.skillRanks,progression:a.state.progression});state.revision++;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);
 const before={revision:state.revision,gold:state.gold,xp:state.xp,gear:structuredClone(state.gear)};
 const change=await app.inject({method:'POST',url:'/api/pacing/overrides',headers,payload:{monsterHp:.25,monsterAttack:1}});expect(change.statusCode).toBe(200);
 const body={scene:'single',revision:state.revision,requestedSkills:state.skills,skillRanks:state.skillRanks};
 expect((await app.inject({method:'POST',url:'/api/pacing/start',headers,payload:{...body,requestedSkills:['cut']}})).statusCode).toBe(409);
 const start=await app.inject({method:'POST',url:'/api/pacing/start',headers,payload:body});expect(start.statusCode,start.body).toBe(200);const first=pacingLabViewSchema.parse(start.json());expect(first.trial!.frozen.requestedSkills).toEqual(first.trial!.frozen.executedSkills);
 const pending=pacingLabViewSchema.parse((await app.inject({method:'POST',url:'/api/pacing/overrides',headers,payload:{monsterHp:1,monsterAttack:1}})).json());expect(pending.overrides.monsterHp).toBe(1);expect(pending.trial!.frozen.overrides.monsterHp).toBe(.25);expect(pending.trial!.id).toBe(first.trial!.id);
 let latest=pending;for(let n=0;n<100&&latest.trial?.status==='running';n++){await new Promise(r=>setTimeout(r,10));latest=pacingLabViewSchema.parse((await app.inject({method:'GET',url:'/api/pacing/view',headers})).json());}
 expect(latest.trial!.status).toBe('won');expect(Object.values(latest.trial!.casts).reduce((n,v)=>n+v,0)).toBeGreaterThan(0);expect(latest.trial!.damage).toBeGreaterThan(0);
 const suggestion=pacingLabSuggestionSchema.parse((await app.inject({method:'POST',url:'/api/pacing/export',headers,payload:{}})).json());expect(suggestion.notApplied&&suggestion.requiresConfirmation&&suggestion.requiresTargetSelection).toBe(true);expect(suggestion.overrides.monsterHp).toBe(.25);expect(suggestion.pendingOverrides.monsterHp).toBe(1);expect(suggestion.trial!.frozen.overrides.monsterHp).toBe(.25);
 const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[state.id])).rows[0].state;expect({revision:stored.revision,gold:stored.gold,xp:stored.xp,gear:stored.gear}).toEqual(before);
 expect(Number((await pool.query('SELECT count(*) AS n FROM ow_kills WHERE character=$1',[state.id])).rows[0].n)).toBe(0);expect(Number((await pool.query('SELECT count(*) AS n FROM ow_rewards WHERE character=$1',[state.id])).rows[0].n)).toBe(0);
});
