import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate,transaction} from '../apps/api/src/database.ts';
import {migrateHub,readHubState,saveHubState} from '../apps/api/src/hub-state.ts';
import {migrateHubChart} from '../apps/api/src/hub-chart-service.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {enterHubPort} from '../packages/rules/hub-today.ts';
import {hubCommissionPool} from '../packages/rules/hub-commissions.ts';
import {todayViewSchema,hubPortViewSchema,hubCommissionsViewSchema} from '../packages/contracts/hub.ts';
import {validateResponse} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('HUB API checks require isolated real PostgreSQL, never a mock or silent skip.');
const schema='qa_hub_outside_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn,max:1}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:2}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await transaction(pool,async c=>{await migrateHub(c);await migrateHubChart(c);});await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function actor(){
 const username='hub_'+randomUUID().slice(0,8),login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});if(r.statusCode>=200&&r.statusCode<300)expect(()=>validateResponse(path,r.json()),`${body===undefined?'GET':'POST'} ${path}: ${r.body}`).not.toThrow();return r;};
 const created=await req('character',{name:'港口接口回归'});expect(created.statusCode,created.body).toBe(200);const id=created.json().id;
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;s.starsea.prologue={weapon:'sword',done:true};s.starsea.location={map:'ss-map-port',x:10,y:10};s.dungeon=undefined;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);
 const h=newHubState();for(const node of ['wind-gate','mist-story-1','mist-gate'])h.chart.cleared[node]={firstAt:new Date().toISOString(),bestSeconds:60};h.chart.lastRegion='mist';h.port.rep={forge:2500,shipyard:2500,post:2500};await transaction(pool,c=>saveHubState(c,id,h));
 return {id,req,username,state:async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state};
}
it('serves all three exact views under existing authenticated login without requiring lease/revision',async()=>{
 const a=await actor();for(const[path,schema]of [['hub/port',hubPortViewSchema],['hub/today',todayViewSchema],['hub/commissions',hubCommissionsViewSchema]] as const){const r=await a.req(path);expect(r.statusCode,r.body).toBe(200);expect(schema.safeParse(r.json()).success,r.body).toBe(true);}
 const denied=await app.inject({url:'/api/hub/today'});expect(denied.statusCode).toBe(401);
});
it('binds an actual arrival once and cannot release a second unlock by polling or alternating already-observed sessions',async()=>{
 const a=await actor(),h=await readHubState(pool,a.id);for(const id of ['visit-one','visit-two','visit-three'])h.chart.returnQueue.push({id,item:{kind:'unlock',id,title:id,text:id}});enterHubPort(h);await transaction(pool,c=>saveHubState(c,a.id,h));
 const first=await a.req('hub/today');expect(first.statusCode,first.body).toBe(200);expect(first.json().returnQueue.filter((q:any)=>q.kind==='unlock').map((q:any)=>q.id)).toEqual(['visit-one']);expect((await readHubState(pool,a.id)).chart.returnSerial).toBe(h.chart.returnSerial);
 expect((await a.req('hub/return-ack',{kind:'unlock',id:'visit-one',command_id:randomUUID()})).statusCode).toBe(200);for(let i=0;i<2;i++)expect((await a.req('hub/today')).json().returnQueue.filter((q:any)=>q.kind==='unlock')).toEqual([]);
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:a.username}}),cookie=String(login.headers['set-cookie']).split(';')[0],next=await app.inject({url:'/api/hub/today',headers:{cookie}});expect(next.statusCode,next.body).toBe(200);expect(()=>validateResponse('hub/today',next.json())).not.toThrow();expect(next.json().returnQueue.filter((q:any)=>q.kind==='unlock').map((q:any)=>q.id)).toEqual(['visit-two']);const after=await readHubState(pool,a.id);
 await a.req('hub/today');await app.inject({url:'/api/hub/today',headers:{cookie}});expect((await readHubState(pool,a.id)).chart.returnSerial).toBe(after.chart.returnSerial);
});
it('serializes duplicate claim requests and rejects reuse of command ID with different intent',async()=>{
 const a=await actor(),body={building:'shipyard',tier:1,command_id:randomUUID()},responses=await Promise.all([a.req('hub/port/claim',body),a.req('hub/port/claim',body)]);
 for(const r of responses)expect(r.statusCode,r.body).toBe(200);expect(responses[0].json()).toEqual(responses[1].json());expect((await a.state()).progression.reputationClaims.filter((id:string)=>id==='hub:shipyard:1')).toHaveLength(1);
 const before=await a.state(),other=await a.req('hub/port/claim',{...body,tier:2});expect(other.statusCode).toBe(409);expect(await a.state()).toEqual(before);
});
it('persists quick daily quota and mode across fresh reads and never mutates rejected dock targets',async()=>{
 const a=await actor(),badBefore=await readHubState(pool,a.id),bad=await a.req('hub/dock',{op:'send',region:'deep',command_id:randomUUID()});expect(bad.statusCode,bad.body).toBe(409);expect(await readHubState(pool,a.id)).toEqual(badBefore);
 const sent=await a.req('hub/dock',{op:'send',region:'wind',command_id:randomUUID()});expect(sent.statusCode,sent.body).toBe(200);expect(sent.json().result.questRewards).toBeDefined();expect(sent.json()).not.toHaveProperty('questRewards');
 expect((await a.state()).starsea.seen).toContain('hub-gate:dispatch');
 const body={op:'quick',command_id:randomUUID()},first=await a.req('hub/dock',body);expect(first.statusCode,first.body).toBe(200);const after=await a.state();expect((await a.req('hub/dock',body)).json()).toEqual(first.json());expect(await a.state()).toEqual(after);
 const second=await a.req('hub/dock',{op:'quick',command_id:randomUUID()});expect(second.statusCode).toBe(409);expect(await a.state()).toEqual(after);
 expect((await a.req('control/mode-preference',{mode:'auto',command_id:randomUUID()})).statusCode).toBe(200);expect((await readHubState(pool,a.id)).mode).toBe('auto');
});
it('rejects port mutations when the authoritative dungeon membership is active even if the character pointer is stale',async()=>{
 const a=await actor(),instance=randomUUID();await pool.query('INSERT INTO ow_dungeons(id,leader,status,data) VALUES($1,$2,$3,$4)',[instance,a.id,'running',{}]);await pool.query('INSERT INTO ow_dungeon_members(instance,character,active,data) VALUES($1,$2,true,$3)',[instance,a.id,{}]);
 const before=await a.state(),hubBefore=await readHubState(pool,a.id);expect(before.dungeon).toBeUndefined();
 const denied=await a.req('hub/port/claim',{building:'shipyard',tier:1,command_id:randomUUID()});expect(denied.statusCode,denied.body).toBe(409);expect(denied.json().code).toBe('BUILD_LOCKED');expect(await a.state()).toEqual(before);expect(await readHubState(pool,a.id)).toEqual(hubBefore);
 const allowed=await a.req('control/mode-preference',{mode:'manual',command_id:randomUUID()});expect(allowed.statusCode,allowed.body).toBe(200);expect((await readHubState(pool,a.id)).mode).toBe('manual');
});
it('commission claims pay once, auto refill, and retain daily accounting after a new request',async()=>{
 const a=await actor();expect((await a.req('hub/commissions')).statusCode).toBe(200);const h=await readHubState(pool,a.id),row=hubCommissionPool().find(t=>t.id==='ow-wind-bounty-z1-1')!;
 h.commissions.slots[0]={id:'confirmed-fixture',task:row.id,region:'wind',progress:row.cond_count!,xp:200,sources:[]};await transaction(pool,c=>saveHubState(c,a.id,h));const quoted=(await a.req('hub/commissions')).json().slots.find((slot:any)=>slot.id==='confirmed-fixture').reward,before=await a.state(),body={op:'claim',id:'confirmed-fixture',command_id:randomUUID()};
 const paid=await a.req('hub/commissions',body);expect(paid.statusCode,paid.body).toBe(200);expect((await a.req('hub/commissions',body)).json()).toEqual(paid.json());expect((await a.state()).gold-before.gold).toBe(quoted.gold);
 const board=(await a.req('hub/commissions')).json();expect(board.slots).toHaveLength(4);expect(board.doneToday).toBe(1);expect(board.slots.some((s:any)=>s.id===body.id)).toBe(false);
 expect((await a.req('hub/commissions',{...body,command_id:randomUUID()})).statusCode).toBe(409);
});
