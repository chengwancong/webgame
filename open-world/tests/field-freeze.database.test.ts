import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';
import {validateResponse} from '../packages/contracts/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {registerProducedWorld,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {twoZoneIsland,catalogues} from './fixtures/production-island.ts';
import {advanceFieldActivity,type FieldActivity} from '../apps/api/src/field-activities.ts';
import {bountyRows,bountyNeed} from '../packages/rules/bounty.ts';
import {revealExploration} from '../packages/rules/exploration.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real isolated PostgreSQL required');
const schema='qa_freeze_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const all=parseFieldFreeze({camps:true,patrols:true,exploration:true,waypoints:true,bounties:true,events:true});
const live=createApp(pool,{testLogin:true,dungeons:false,devCheckpoints:true}),frozen=createApp(pool,{testLogin:true,dungeons:false,fieldFreeze:all});
const patrolOnly=createApp(pool,{testLogin:true,dungeons:false,fieldFreeze:{camps:true}});
const table=twoZoneIsland(),region=table.islands[0].region,point={x:220,y:256};
const sizes=Object.fromEntries(Object.entries(worldTables).filter(([k])=>k!=='source').map(([k,v])=>[k,(v as unknown[]).length]));
const templateCount=monsterContent.templates.length;
const template={...structuredClone(monsterContent.templates.find(t=>t.curve==='starsea'&&t.kind==='melee')!),id:'freeze-qa-target',role:'swarm' as const,base:{hp:1,attack:0,armor:0},skills:[]};
beforeAll(async()=>{
 await owner.query('CREATE SCHEMA '+schema);await migrate(pool);
 monsterContent.templates.push(template);
 table.events.push({_row:4,id:'freeze-qa-event',region,zone:table.zones[0].id,...point,name:'QA event',kind:'waves',definition:'freeze-qa-event',resource:table.waypoints[0].resource,radius:64,cooldownSeconds:600,durationSeconds:300,waveIntervalSeconds:15,waves:[[{template:template.id,rank:'normal',count:1}]],loot:'field-event'});
 table.patrols.push({_row:4,id:'freeze-qa-patrol',region,zone:table.zones[0].id,path:[point,{x:225,y:256}],template:table.camps[0].pack[0].template,rank:'elite',speed:1,radius:4,respawnSeconds:90});
 registerProducedWorld(generateProductionIsland(table,table.islands[0],catalogues) as unknown as ProducedWorld);
 for(const [key,rows]of Object.entries(table))if(key!=='source')(worldTables[key as keyof typeof worldTables] as unknown[]).push(...rows as unknown[]);
 await live.ready();await frozen.ready();await patrolOnly.ready();
});
afterAll(async()=>{
 await live.close();await frozen.close();await patrolOnly.close();await pool.end();
 await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();
 monsterContent.templates.splice(templateCount);for(const [key,n]of Object.entries(sizes))(worldTables[key as keyof typeof worldTables] as unknown[]).splice(n);
});
async function player(){
 const login=await live.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_freeze_'+randomUUID().slice(0,8)}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown,app=frozen)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'冻结验收'}),id=created.body.id;
 const row=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 row.level=50;row.starsea.features.push('events','bounty','waypoint');
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row,id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const send=async(path:string,body:object,app=frozen)=>{const s=(await request('character')).body,input={command_id:randomUUID(),revision:s.revision,lease_id:lease,...body};return {...await request(path,input,app),input};};
 const permit=async()=>{const p=await request('permit',{lease_id:lease,region});expect(p.status,JSON.stringify(p.body)).toBe(200);return p.body;};
 return {id,lease,request,send,permit};
}
const saved=async(id:string)=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
const counts=async(id:string)=>(await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[id])).rows[0];
it('publishes supported immutable switches and rejects unknown/unimplemented switches',async()=>{
 const frozenContent=(await frozen.inject('/api/content')).json(),liveContent=(await live.inject('/api/content')).json();
 expect(frozenContent.fieldFreeze).toEqual(all);
 expect(Object.values(liveContent.fieldFreeze)).toEqual(Array(6).fill(false));
 expect(validateResponse('content',frozenContent)).toEqual(frozenContent);
 expect(validateResponse('content',liveContent)).toEqual(liveContent);
 expect(Object.isFrozen(parseFieldFreeze())).toBe(true);
 for(const value of [{events:'true'},{sprint:true},{corridors:true},null])expect(()=>parseFieldFreeze(value)).toThrow();
});
it('rejects new commands without revision, receipt or resource changes',async()=>{
 const p=await player(),before=await saved(p.id),audit=await counts(p.id);
 for(const [path,body]of [
  ['bounty/board',{region,position:point}],
  ['bounty/accept',{instance:randomUUID()}],
  ['travel/waypoint',{permit_id:randomUUID(),waypoint:table.waypoints[0].id}],
  ['quest',{op:'waypoint',region,position:{x:table.waypoints[0].x,y:table.waypoints[0].y},target:table.waypoints[0].id}],
  ['field/activity/start',{kind:'event',region,target:'freeze-qa-event',position:point}],
 ] as const){
  const result=await p.send(path,body);expect(result.status,JSON.stringify(result.body)).toBe(409);expect(result.body.code).toBe('FIELD_FROZEN');
 }
 expect(await saved(p.id)).toEqual(before);expect(await counts(p.id)).toEqual(audit);
 expect((await pool.query('SELECT count(*)::int n FROM ow_field_activities WHERE character=$1',[p.id])).rows[0].n).toBe(0);
});
it('does not create frozen camps/patrols or expand fog, but keeps the old exploration readable',async()=>{
 const p=await player(),permit=await p.permit(),state=await saved(p.id),oldFog=revealExploration('',512,512,table.waypoints[0]);
 state.world={...(state.world??{}),exploration:{...(state.world?.exploration??{}),[region]:oldFog}};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);
 const result=await p.request('field/camps',{lease_id:p.lease,permit_id:permit.id,position:point,explored:revealExploration(oldFog,512,512,point)});
 expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.camps).toEqual([]);expect(result.body.explored).toBe(oldFog);
 expect((await saved(p.id)).world.exploration[region]).toBe(oldFog);
 expect((await pool.query('SELECT count(*)::int n FROM ow_camp_cycles WHERE character=$1',[p.id])).rows[0].n).toBe(0);
});
it('keeps camp and patrol switches independent',async()=>{
 const p=await player(),permit=await p.permit();
 const result=await p.request('field/camps',{lease_id:p.lease,permit_id:permit.id,position:point},patrolOnly);
 expect(result.status).toBe(200);expect(result.body.camps.map((c:any)=>c.id)).toEqual(['freeze-qa-patrol']);
});
it('reads existing cycles and never refreshes even after clear time and distance allow it',async()=>{
 const p=await player(),permit=await p.permit(),input={lease_id:p.lease,permit_id:permit.id,position:point};
 const opened=await p.request('field/camps',input,live);expect(opened.status).toBe(200);expect(opened.body.camps.length).toBeGreaterThan(0);
 const rows=(await pool.query('SELECT camp,cycle,data FROM ow_camp_cycles WHERE character=$1 ORDER BY camp',[p.id])).rows;
 await pool.query("UPDATE ow_camp_cycles SET cleared_at=now()-interval '600 seconds' WHERE character=$1",[p.id]);
 await pool.query("UPDATE ow_permits SET private_data=jsonb_set(private_data,'{fieldObserver,at}','0') WHERE id=$1",[permit.id]);
 const read=await p.request('field/camps',{...input,position:{x:280,y:256}});expect(read.status).toBe(200);expect(read.body.camps).toEqual(opened.body.camps);
 expect((await pool.query('SELECT camp,cycle,data FROM ow_camp_cycles WHERE character=$1 ORDER BY camp',[p.id])).rows).toEqual(rows);
});
it('lets an old running event finish and claim once, preserving the old start receipt',async()=>{
 const p=await player(),extra={kind:'event',region,target:'freeze-qa-event',position:point};
 const started=await p.send('field/activity/start',extra,live);expect(started.status,JSON.stringify(started.body)).toBe(200);
 expect((await p.request('field/activity/start',started.input)).body).toEqual(started.body);
 expect((await p.send('field/activity/start',extra)).status).toBe(200);
 const data=(await pool.query('SELECT data FROM ow_field_activities WHERE character=$1',[p.id])).rows[0].data as FieldActivity;
 const instance=data.instance;
 // Trusted offline clock through the real executor; no synthetic completion/kill payload.
 advanceFieldActivity(data,data.startedAt+60000,1800);expect(data.status).toBe('success');
 await pool.query('UPDATE ow_field_activities SET data=$1,status=$2 WHERE character=$3',[data,data.status,p.id]);
 const claimed=await p.send('field/activity/claim',{instance});expect(claimed.status,JSON.stringify(claimed.body)).toBe(200);
 expect((await p.request('field/activity/claim',claimed.input)).body).toEqual(claimed.body);
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,claimed.input.command_id])).rows[0].n).toBe(1);
 expect((await p.send('field/activity/start',extra)).body.code).toBe('FIELD_FROZEN');
 expect((await pool.query('SELECT instance FROM ow_field_activities WHERE character=$1',[p.id])).rows[0].instance).toBe(instance);
});
it('keeps completed historical bounties claimable without creating or accepting new offers',async()=>{
 const p=await player(),state=await saved(p.id),row=bountyRows[0],instance=randomUUID();
 state.starsea.bounties=[{slot:row.zone+':1',zone:row.zone,task:row.id,instance,progress:bountyNeed(row),xp:100,acceptedAt:1}];
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);
 const claimed=await p.send('bounty/claim',{instance});expect(claimed.status,JSON.stringify(claimed.body)).toBe(200);
 expect(claimed.body.delta.xp).toBe(50);expect((await p.request('bounty/claim',claimed.input)).body).toEqual(claimed.body);
 expect((await p.send('bounty/claim',{instance})).body.code).toBe('BOUNTY_GONE');
 expect((await p.send('bounty/accept',{instance})).body.code).toBe('FIELD_FROZEN');
});
it('HEX-A05 real event start protects HEX builds and old receipts until executor completion and claim',async()=>{
 const p=await player();
 const a=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'},live);
 const b=await p.send('dev/hex-grant',{base:'hex-aftershock',quality:'common'},live);
 expect(a.status,JSON.stringify(a.body)).toBe(200);expect(b.status).toBe(200);
 const first=a.body.delta.gear[0].id,second=b.body.delta.gear[0].id;
 const equip=await p.send('hex/equip',{gear_id:first,slot:'hex1'},live);expect(equip.status).toBe(200);
 const started=await p.send('field/activity/start',{kind:'event',region,target:'freeze-qa-event',position:point},live);
 expect(started.status,JSON.stringify(started.body)).toBe(200);
 const before=await saved(p.id),beforeCounts=await counts(p.id);
 const activity=(await pool.query('SELECT data,status FROM ow_field_activities WHERE character=$1',[p.id])).rows[0];
 expect(activity.status).toBe('running');
 for(const [path,body]of [
  ['hex/equip',{gear_id:second,slot:'hex2'}],['hex/equip',{gear_id:first,slot:'hex2'}],['hex/unequip',{slot:'hex1'}],
 ] as const){
  const denied=await p.send(path,body,live);expect(denied.status).toBe(409);expect(denied.body.code).toBe('FIELD_BUILD_LOCKED');
 }
 expect((await p.request('hex/equip',equip.input,live)).body).toEqual(equip.body);
 expect(await saved(p.id)).toEqual(before);expect(await counts(p.id)).toEqual(beforeCounts);
 // Explicit trusted clock fixture: real executor resolves combat, never a synthetic client kill/success report.
 const data=activity.data as FieldActivity;advanceFieldActivity(data,data.startedAt+60000,1800);
 expect(data.status).toBe('success');
 await pool.query('UPDATE ow_field_activities SET data=$1,status=$2 WHERE character=$3',[data,data.status,p.id]);
 const claim=await p.send('field/activity/claim',{instance:data.instance},live);expect(claim.status,JSON.stringify(claim.body)).toBe(200);
 const afterClaim=await saved(p.id),afterCounts=await counts(p.id);
 expect((await p.request('field/activity/claim',claim.input,live)).body).toEqual(claim.body);
 expect(await counts(p.id)).toEqual(afterCounts);
 const off=await p.send('hex/unequip',{slot:'hex1'},live);expect(off.status,JSON.stringify(off.body)).toBe(200);
 const after=await saved(p.id);expect(after.equipment.hex1).toBeUndefined();
 expect(after.gear).toEqual(afterClaim.gear);expect(after.gold).toBe(afterClaim.gold);expect(after.material).toBe(afterClaim.material);
 expect(after.revision).toBe(afterClaim.revision+1);
});
