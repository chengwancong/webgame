import {eliteAffixes} from '../packages/content/elite-affixes.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {settings,regionById} from '../packages/content/index.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {starseaHub} from '../packages/content/starsea/index.ts';
import {starseaKillReward} from '../apps/api/src/economy.ts';
import {validateResponse,type Permit,type Snapshot,type Spawn} from '../packages/contracts/index.ts';
import {exploredAt,revealExploration} from '../packages/rules/exploration.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Field camp API tests require real PostgreSQL. No mock/skip.');
const schema='qa_field_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:8});
const app=createApp(pool,{testLogin:true,dungeons:false,fieldQa:true}),closed=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();await closed.ready();});
afterAll(async()=>{await app.close();await closed.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});

const region='ow-graybox-wind',camps=worldTables.camps.filter(c=>c.region===region),chunk=settings.chunkSize;
const chunkOf=(p:{x:number;y:number})=>({x:Math.floor(p.x/chunk),y:Math.floor(p.y/chunk)});
// Camp A, plus an observer camp B that keeps A in its 2-chunk window yet stands > 36 cells away.
const pair=camps.flatMap(a=>camps.filter(b=>{const ca=chunkOf(a),cb=chunkOf(b);return Math.abs(ca.x-cb.x)<=2&&Math.abs(ca.y-cb.y)<=2&&Math.hypot(a.x-b.x,a.y-b.y)>40;}).map(b=>({a,b})))[0];
type View={camps:{id:string;cycle:number;spawns:Spawn[]}[]};
async function player(target=app){
 const login=await target.inject({method:'POST',url:'/api/session/login',payload:{username:'qa_'+randomUUID().replaceAll('-','').slice(0,20)}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await target.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'营地测试'});expect(created.status).toBe(200);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 const permit=async()=>(await request('permit',{lease_id:lease,region,attempt_id:randomUUID()}));
 const near=async(p:Permit,position:{x:number;y:number})=>{const r=await request('field/camps',{lease_id:lease,permit_id:p.id,position:{x:position.x,y:position.y}});if(r.status!==200&&r.body.code!=='POSITION')throw Error('field/camps '+r.status+' '+JSON.stringify(r.body));return r;};
 let sequence=0,tick=0;
 const report=async(p:Permit,ids:string[])=>{const s:Snapshot=(await request('character')).body;sequence++;const from=tick;tick+=60;return request('combat/report',{command_id:randomUUID(),revision:s.revision,lease_id:lease,permit_id:p.id,build:p.build,sequence,from_tick:from,to_tick:tick,kills:ids.map(id=>({source_id:id,tick:from+30}))});};
 const command=async(path:string,body:object)=>{const s:Snapshot=(await request('character')).body;return request(path,{command_id:randomUUID(),revision:s.revision,lease_id:lease,...body});};
 return {id:created.body.id as string,lease,request,permit,near,report,command};
}
// Kill-rate sampling measures permit age; age the permit instead of sleeping.
const age=(p:Permit)=>pool.query("UPDATE ow_permits SET created=now()-interval '600 seconds' WHERE id=$1",[p.id]);
const trustLater=(p:Permit)=>pool.query("UPDATE ow_permits SET private_data=jsonb_set(private_data,'{fieldObserver,at}','0') WHERE id=$1",[p.id]);
const cleared=(id:string,camp:string)=>pool.query("UPDATE ow_camp_cycles SET cleared_at=now()-interval '91 seconds' WHERE character=$1 AND camp=$2 AND cleared_at IS NOT NULL",[id,camp]);

it('keeps the QA graybox closed unless the server opts in',async()=>{const p=await player(closed);expect((await p.permit()).body.code).toBe('REGION');});

it('loads camps around the observer as frozen cycles inside the zone level band, without duplicating them',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body;expect(permit.spawns).toEqual([]);
 const one:View=(await p.near(permit,pair.a)).body,two:View=(await p.near(permit,pair.a)).body;
 expect(one.camps.length).toBeGreaterThan(1);expect(two).toEqual(one);
 const a=one.camps.find(c=>c.id===pair.a.id)!,band=worldTables.zones.find(z=>z.id===pair.a.zone)!.levelBand;
 expect(a.cycle).toBe(1);expect(a.spawns.map(m=>m.id)).toEqual(pair.a.pack.flatMap(x=>Array.from({length:x.count})).map((_,i)=>`${pair.a.id}:1:${i}`));
 for(const m of a.spawns)expect(m.monster!.level).toBeGreaterThanOrEqual(band[0]),expect(m.monster!.level).toBeLessThanOrEqual(band[1]+1);
 const stored=(await pool.query('SELECT data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].data.spawns as Spawn[];
 expect(stored.length).toBe(one.camps.reduce((n,c)=>n+c.spawns.length,0));expect(new Set(stored.map(m=>m.id)).size).toBe(stored.length);
 expect((await p.near(permit,{x:-5,y:-5})).body.code).toBe('POSITION');
});

it('settles camp kills, marks the camp cleared and refreshes only after 90 s with the observer > 36 cells away',async()=>{
 const p=await player();let permit:Permit=(await p.permit()).body;const a=(await p.near(permit,pair.a)).body.camps.find((c:any)=>c.id===pair.a.id);await age(permit);
 const done=await p.report(permit,a.spawns.map((m:Spawn)=>m.id));expect(done.status).toBe(200);expect(done.body.delta.xp).toBeGreaterThan(0);
 expect((await pool.query('SELECT cleared_at FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[p.id,pair.a.id])).rows[0].cleared_at).not.toBeNull();
 // Duplicate kill receipts are rejected.
 expect((await p.report(permit,[a.spawns[0].id])).body.code).toBe('DUPLICATE');
 // Inside the camp: never refreshes, even long after the clear.
 await cleared(p.id,pair.a.id);
 const inside=(await p.near(permit,pair.a)).body.camps.find((c:any)=>c.id===pair.a.id);expect(inside).toMatchObject({cycle:1,spawns:[]});
 // A sudden jump away is not trusted, so it cannot force the refresh.
 const jumped=(await p.near(permit,pair.b)).body.camps.find((c:any)=>c.id===pair.a.id);expect(jumped).toMatchObject({cycle:1,spawns:[]});
 await trustLater(permit);
 const fresh=(await p.near(permit,pair.b)).body.camps.find((c:any)=>c.id===pair.a.id);expect(fresh.cycle).toBe(2);expect(fresh.spawns.length).toBe(a.spawns.length);
 expect(fresh.spawns.every((m:Spawn)=>m.id.startsWith(pair.a.id+':2:'))).toBe(true);
 // Re-entering (new attempt / reconnect) keeps the same permit spawns and kill state.
 permit=(await p.permit()).body;expect(permit.completed).toEqual(expect.arrayContaining(a.spawns.map((m:Spawn)=>m.id)));
 expect(permit.spawns.map(m=>m.id)).toEqual(expect.arrayContaining(fresh.spawns.map((m:Spawn)=>m.id)));
 expect((await pool.query('SELECT count(*)::int n FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[p.id,pair.a.id])).rows[0].n).toBe(2);
});

it('does not refresh a partially cleared camp',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body,a=(await p.near(permit,pair.a)).body.camps.find((c:any)=>c.id===pair.a.id);await age(permit);
 expect((await p.report(permit,[a.spawns[0].id])).status).toBe(200);await trustLater(permit);
 const later=(await p.near(permit,pair.b)).body.camps.find((c:any)=>c.id===pair.a.id);expect(later.cycle).toBe(1);expect(later.spawns.length).toBe(a.spawns.length-1);
});

const [w1,w2]=worldTables.waypoints.filter(w=>w.region===region);
it('unlocks waypoints only beside them and travels for free, idempotently, even with a full bag',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body;
 expect((await p.command('quest',{op:'waypoint',region,target:w1.id})).body.code).toBe('QUEST_DISTANCE');
 expect((await p.command('quest',{op:'waypoint',region,target:w1.id,position:{x:w2.x,y:w2.y}})).body.code).toBe('QUEST_DISTANCE');
 const unlocked=await p.command('quest',{op:'waypoint',region,target:w1.id,position:{x:w1.x,y:w1.y}});expect(unlocked.status).toBe(200);expect(unlocked.body.snapshot.starsea.waypoints).toContain(w1.id);
 expect((await p.command('travel/waypoint',{permit_id:permit.id,waypoint:w2.id})).body.code).toBe('WAYPOINT_LOCKED');
 expect((await p.command('quest',{op:'waypoint',region,target:w2.id,position:{x:w2.x,y:w2.y}})).status).toBe(200);
 expect((await p.command('travel/waypoint',{permit_id:permit.id,waypoint:'m0-wind-nowhere'})).body.code).toBe('WAYPOINT');
 // Full bag: travel stays allowed (used to go sort the bag).
 const row=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;while(row.gear.length<60)row.gear.push({...row.gear[0],id:randomUUID()});await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row,p.id]);
 const before:Snapshot=(await p.request('character')).body,body={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,permit_id:permit.id,waypoint:w1.id};
 const [a,b]=await Promise.all([p.request('travel/waypoint',body),p.request('travel/waypoint',body)]);expect([a.status,b.status]).toEqual([200,200]);expect(b.body).toEqual(a.body);
 // The client validates every response by path: an unregistered path would turn the receipt into a protocol error.
 expect(()=>validateResponse('travel/waypoint',a.body)).not.toThrow();expect(()=>validateResponse('quest',unlocked.body)).not.toThrow();
 expect(a.body.revision).toBe(before.revision+1);expect(a.body.delta).toEqual({gold:0,xp:0,material:0});expect(a.body.snapshot.gold).toBe(before.gold);
 expect((await p.request('travel/waypoint',body)).body).toEqual(a.body);
 expect((await pool.query('SELECT count(*)::int n FROM ow_receipts WHERE character=$1 AND command=$2',[p.id,body.command_id])).rows[0].n).toBe(1);
 expect((await p.request('travel/waypoint',{...body,command_id:randomUUID()})).body.code).toBe('REVISION');
 // The arrival is trusted: an immediate camp query there is not treated as a jump.
 expect((await pool.query('SELECT private_data FROM ow_permits WHERE id=$1',[permit.id])).rows[0].private_data.fieldObserver).toMatchObject({x:w1.x,y:w1.y});
 // A quest wave still fighting on this map blocks travel.
 const st=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;st.starsea.wave={task:'qa',region,spawns:[{id:'q:qa:0:1:0'}],killed:[],startedAt:Date.now()};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[st,p.id]);
 expect((await p.command('travel/waypoint',{permit_id:permit.id,waypoint:w2.id})).body.code).toBe('IN_COMBAT');
});

it('merges the exploration fog only upward and rejects malformed bitmaps',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body,first=(await p.near(permit,pair.a)).body;
 expect(exploredAt(first.explored,512,512,pair.a)).toBe(true);
 const far=revealExploration('',512,512,{x:pair.b.x,y:pair.b.y});
 const merged=(await p.request('field/camps',{lease_id:p.lease,permit_id:permit.id,position:{x:pair.a.x,y:pair.a.y},explored:far})).body;
 expect(exploredAt(merged.explored,512,512,pair.a)).toBe(true);expect(exploredAt(merged.explored,512,512,pair.b)).toBe(true);
 // An empty report never clears anything.
 const kept=(await p.request('field/camps',{lease_id:p.lease,permit_id:permit.id,position:{x:pair.a.x,y:pair.a.y},explored:''})).body;expect(kept.explored).toBe(merged.explored);expect(()=>validateResponse('field/camps',kept)).not.toThrow();
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state.world.exploration[region]).toBe(merged.explored);
 expect((await p.request('field/camps',{lease_id:p.lease,permit_id:permit.id,position:{x:pair.a.x,y:pair.a.y},explored:'abc'})).body.code).toBe('EXPLORATION');
});

it('migrates old characters: reached landing/boss waypoints only, unwalkable saved spot to the nearest unlocked waypoint',async()=>{
 const map=regionById(region),wall=map.obstacles.map(o=>({x:o.x+o.w/2,y:o.y+o.h/2})).find(p=>!walkable(map,p))!;expect(wall).toBeTruthy();
 const wp=(n:number)=>'m0-wind-w'+n,state=async(id:string)=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 // Beat the wind boss on the old map and last stood where the new geometry has a wall.
 const veteran=await player(),fresh=await player();
 await pool.query("UPDATE ow_characters SET state=jsonb_set(jsonb_set(state,'{starsea,bosses}','[\"ss-map-boss-1\"]'),'{starsea,location}',$2::jsonb) WHERE id=$1",[veteran.id,{map:region,...wall}]);
 const before=await state(veteran.id);expect(before.starsea.islands).toContain('ss-map-wind');expect(before.starsea.waypoints).toEqual([]);
 expect((await veteran.permit()).status).toBe(200);
 const after=await state(veteran.id),open=[wp(7),wp(8)],nearest=open.map(id=>worldTables.waypoints.find(w=>w.id===id)!).sort((a,b)=>Math.hypot(a.x-wall.x,a.y-wall.y)-Math.hypot(b.x-wall.x,b.y-wall.y))[0];
 expect([...after.starsea.waypoints].sort()).toEqual(open);expect(after.starsea.location).toEqual({map:region,x:nearest.x,y:nearest.y});
 // No reward or other history: only waypoint ids and the location moved.
 expect(after.xp).toBe(before.xp);expect(after.gold).toBe(before.gold);expect(after.starsea.done).toEqual(before.starsea.done);
 expect((await veteran.permit()).status).toBe(200);expect((await state(veteran.id)).starsea.waypoints).toHaveLength(2);
 // Never beat the boss: the landing only.
 expect((await fresh.permit()).status).toBe(200);expect((await state(fresh.id)).starsea.waypoints).toEqual([wp(7)]);
});

it('switches the world tier only when unlocked, at the port; new camp cycles freeze it, standing ones keep theirs',async()=>{
 const p=await player();const permit:Permit=(await p.permit()).body;const before=(await p.near(permit,pair.a)).body.camps.find((c:any)=>c.id===pair.a.id);
 expect((await p.command('world/tier',{tier:2,region:starseaHub})).body.code).toBe('TIER_LOCKED');
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{starsea,bosses}','[\"ss-map-boss-3\"]') WHERE id=$1",[p.id]);
 // The landing is no outpost; beside an outpost (w1) the switch is allowed like at the port.
 const w7=worldTables.waypoints.find(w=>w.id==='m0-wind-w7')!,w1=worldTables.waypoints.find(w=>w.id==='m0-wind-w1')!;expect(w1.kind).toBe('outpost');
 expect((await p.command('world/tier',{tier:2,region,position:{x:w7.x,y:w7.y}})).body.code).toBe('TIER_PLACE');
 expect((await p.command('world/tier',{tier:1,region,position:{x:w1.x+2,y:w1.y}})).status).toBe(200);
 expect((await p.command('world/tier',{tier:9,region:starseaHub})).body.code).toBe('TIER_LOCKED');
 const switched=await p.command('world/tier',{tier:2,region:starseaHub});expect(switched.status).toBe(200);expect(switched.body.snapshot.world.worldTier).toBe(2);expect(switched.body.delta).toMatchObject({xp:0,gold:0});
 // Camp A stood before the switch: same cycle, same strength.
 const again=(await p.near(permit,pair.a)).body.camps.find((c:any)=>c.id===pair.a.id);expect(again.cycle).toBe(before.cycle);expect(again.spawns.map((m:Spawn)=>m.hp)).toEqual(before.spawns.map((m:Spawn)=>m.hp));
 // A camp outside A's 2-chunk window was never loaded: created now with tier 2 frozen in.
 const ca=chunkOf(pair.a),unseen=camps.find(c=>{const cc=chunkOf(c);return Math.max(Math.abs(cc.x-ca.x),Math.abs(cc.y-ca.y))>4;})!;
 expect((await pool.query('SELECT 1 FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[p.id,unseen.id])).rowCount).toBe(0);
 const b=(await p.near(permit,unseen)).body.camps.find((c:any)=>c.id===unseen.id);
 expect((await pool.query("SELECT (data->>'tier')::int tier FROM ow_camp_cycles WHERE character=$1 AND camp=$2",[p.id,unseen.id])).rows[0].tier).toBe(2);
 for(const m of b.spawns as Spawn[]){expect(m.monster!.difficulty).toMatchObject({hp:1.6,attack:1.25});expect(m.hp).toBe(Math.max(1,Math.round(m.monster!.baseStats.hp*1.6)));}
 // Kill rewards follow the frozen tier: xp ×1.2, gold ×1.3 of the base kill reward.
 await age(permit);const m:Spawn=b.spawns[0],base=starseaKillReward(m.monster!.level,m.elite?'elite':'normal',1,region,false);
 const kill=await p.report(permit,[m.id]);expect(kill.status).toBe(200);expect(kill.body.delta.xp).toBe(Math.round(base.xp*1.2));expect(kill.body.delta.gold).toBe(Math.round(base.gold*1.3));
});

it('freezes elite affixes into camp cycles: tier-sized, elites only, stable across reloads',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body,camp=camps.find(c=>c.pack.some(x=>x.rank==='elite'))!;
 const one:View=(await p.near(permit,camp)).body,two:View=(await p.near(permit,camp)).body;expect(two).toEqual(one);
 const members=one.camps.flatMap(c=>c.spawns),elites=members.filter(m=>m.elite);expect(elites.length).toBeGreaterThan(0);
 // Tier 1 rolls exactly one affix per elite; the name shows it.
 for(const m of elites){expect(m.monster!.affixes).toHaveLength(1);expect(m.name.startsWith(eliteAffixes[m.monster!.affixes![0]].name)).toBe(true);}
 expect(members.filter(m=>!m.elite).every(m=>!m.monster!.affixes)).toBe(true);
 const stored=(await pool.query('SELECT data FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[p.id,camp.id])).rows[0].data.spawns as Spawn[];
 expect(stored).toEqual(one.camps.find(c=>c.id===camp.id)!.spawns);
});

it('runs repeatable bounties: board at an activated outpost, server-confirmed zone kills only, one claim per instance, cooldown redraw',async()=>{
 const p=await player(),permit:Permit=(await p.permit()).body,w1=worldTables.waypoints.find(w=>w.id==='m0-wind-w1')!,at={x:w1.x+1,y:w1.y};
 const board=()=>p.command('bounty/board',{region,position:at}),mine=async()=>((await p.request('character')).body as Snapshot).starsea!.bounties;
 expect(()=>validateResponse('bounty/claim',{ok:true})).toThrow();
 expect((await board()).body.code).toBe('FEATURE_LOCKED');
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{starsea,features}',(state->'starsea'->'features')||'[\"bounty\"]'::jsonb) WHERE id=$1",[p.id]);
 expect((await board()).body.code).toBe('WAYPOINT_LOCKED');
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{starsea,waypoints}','[\"m0-wind-w1\"]') WHERE id=$1",[p.id]);
 expect((await p.command('bounty/board',{region,position:{x:w1.x+20,y:w1.y}})).body.code).toBe('BOUNTY_PLACE');
 const opened=await board();expect(opened.status).toBe(200);
 const offers=opened.body.snapshot.starsea.bounties as {slot:string;zone:string;task:string;instance:string;progress:number;xp:number;acceptedAt?:number;cooldownUntil?:number}[];
 expect(offers.map(b=>b.slot)).toEqual(['m0-wind-z1:1','m0-wind-z1:2','m0-wind-z1:3']);expect(new Set(offers.map(b=>b.task)).size).toBe(3);expect(new Set(offers.map(b=>b.instance)).size).toBe(3);
 // Opening again keeps the same instances (no reroll by reopening).
 expect((await board()).body.snapshot.starsea.bounties).toEqual(offers);
 const by=(task:string)=>offers.find(b=>b.task===task)!,hounds=by('m0-wind-z1-b1'),elite=by('m0-wind-z1-b2'),any=by('m0-wind-z1-b3');
 // An elite camp of zone 1 and a camp of zone 2: only zone-1 kills after acceptance count.
 const eliteCamp=camps.find(c=>c.zone==='m0-wind-z1'&&c.pack.some(x=>x.rank==='elite'))!,other=camps.find(c=>c.zone==='m0-wind-z2')!;
 const view:View=(await p.near(permit,eliteCamp)).body,members=view.camps.find(c=>c.id===eliteCamp.id)!.spawns,normals=members.filter(m=>!m.elite),boss=members.find(m=>m.elite)!;
 await age(permit);
 expect((await p.report(permit,[normals[0].id])).status).toBe(200);expect((await mine()).every(b=>b.progress===0)).toBe(true);
 for(const b of [hounds,elite,any])expect((await p.command('bounty/accept',{instance:b.instance})).status).toBe(200);
 expect((await p.command('bounty/claim',{instance:elite.instance})).body.code).toBe('BOUNTY_UNFINISHED');
 const kill=await p.report(permit,[boss.id]);expect(kill.status).toBe(200);
 const base=starseaKillReward(boss.monster!.level,'elite',1,region,false);
 let now=await mine();expect(now.find(b=>b.instance===elite.instance)).toMatchObject({progress:1,xp:base.xp});
 expect(now.find(b=>b.instance===hounds.instance)!.progress).toBe(1);expect(now.find(b=>b.instance===any.instance)!.progress).toBe(1);
 // Zone 2 kills never count for zone-1 bounties.
 const far:View=(await p.near(permit,other)).body;await p.report(permit,[far.camps.find(c=>c.id===other.id)!.spawns[0].id]);
 expect((await mine()).find(b=>b.instance===any.instance)!.progress).toBe(1);
 // Reload: progress lives in the saved character state (another character has none).
 const fresh=await player();expect((await fresh.request('character')).body.starsea.bounties).toEqual([]);
 expect((await p.request('character')).body.starsea.bounties.find((b:any)=>b.instance===elite.instance).progress).toBe(1);
 const lease=p.lease,s:Snapshot=(await p.request('character')).body;
 const claim={command_id:randomUUID(),revision:s.revision,lease_id:lease,instance:elite.instance};
 const paid=await p.request('bounty/claim',claim);expect(paid.status).toBe(200);
 expect(paid.body.delta).toMatchObject({xp:Math.round(base.xp*.5),gold:60,material:6});expect(paid.body.rewards).toEqual([]);
 expect(paid.body.snapshot.gold).toBe(s.gold+60);
 // Same command again: the stored receipt, not a second payment; a new command for the same instance is refused.
 const again=await p.request('bounty/claim',claim);expect(again.body).toEqual(paid.body);
 const s2:Snapshot=(await p.request('character')).body;expect((await p.request('bounty/claim',{...claim,command_id:randomUUID(),revision:s2.revision})).body.code).toBe('BOUNTY_GONE');
 expect((await pool.query("SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2",[p.id,claim.command_id])).rows[0].n).toBe(1);
 now=(await p.request('character')).body.starsea.bounties;const cooling=now.find((b:any)=>b.instance===elite.instance)!;
 expect(cooling.cooldownUntil!-Date.now()).toBeGreaterThan(590000);expect(cooling.acceptedAt).toBeUndefined();
 // Within the cooldown the board keeps the slot empty; afterwards it redraws a new instance.
 expect((await p.command('bounty/board',{region,position:at,lease_id:lease})).body.snapshot.starsea.bounties.find((b:any)=>b.slot===cooling.slot).instance).toBe(elite.instance);
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{starsea,bounties}',(SELECT jsonb_agg(CASE WHEN b->>'instance'=$2 THEN jsonb_set(b,'{cooldownUntil}','1') ELSE b END) FROM jsonb_array_elements(state->'starsea'->'bounties') b)) WHERE id=$1",[p.id,elite.instance]);
 const redrawn=(await p.command('bounty/board',{region,position:at,lease_id:lease})).body.snapshot.starsea.bounties.find((b:any)=>b.slot===cooling.slot);
 expect(redrawn.instance).not.toBe(elite.instance);expect(redrawn.cooldownUntil).toBeUndefined();expect(redrawn.progress).toBe(0);
 // Story quest accept cannot open a bounty.
 const s3:Snapshot=(await p.request('character')).body;expect((await p.request('quest',{command_id:randomUUID(),revision:s3.revision,lease_id:lease,op:'accept',target:'m0-wind-z1-b1'})).status).not.toBe(200);
});
