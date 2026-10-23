import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate,transaction} from '../apps/api/src/database.ts';
import {readHubState,saveHubState} from '../apps/api/src/hub-state.ts';
import {consumeHubEntry,settleHubNode,type FrozenHubEntry} from '../apps/api/src/hub-chart-service.ts';
import {claimExploreCache,unlockExploreDoor} from '../apps/api/src/hub-explore-service.ts';
import {executeHubOutside,pendingHubOutsideNumbers} from '../apps/api/src/hub-outside-service.ts';
import {freezeCraftingLoot} from '../apps/api/src/crafting-loot.ts';
import {hubChartContent} from '../packages/content/hub-chart.ts';
import {cacheId,regionExplore} from '../packages/rules/zhangjian.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {rankSlots} from '../packages/contracts/zhangjian.ts';
import {versions,validateResponse,type CharacterState,type Gear} from '../packages/contracts/index.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import rows from './fixtures/build-variety-r1/legacy-builds.json';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Requires isolated PostgreSQL');
const pool=new Pool({connectionString:dsn,max:4}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'z_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=async(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=await req('character',{name:'杖剑临时库'});expect(created.statusCode,created.body).toBe(200);const id=created.json().id;
 const s=created.json() as CharacterState,base=structuredClone(rows[0].state) as unknown as CharacterState;s.gear=base.gear;s.skills=base.skills;s.skillRanks=base.skillRanks;s.level=30;s.gold=100000;s.material=10000;s.equipment=base.equipment;delete s.slotRanks;s.starsea!.prologue={done:true,weapon:'sword'};s.starsea!.location={map:'ss-map-port',x:14,y:20};s.starsea!.features.push('forge');
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);const control=await req('control',{client_id:randomUUID()});expect(control.statusCode,control.body).toBe(200);
 return {id,req,lease:control.json().lease_id,state:async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState};
}
async function locked<T>(id:string,fn:(c:import('pg').PoolClient,s:CharacterState)=>Promise<T>){return transaction(pool,async c=>{const s=(await c.query('SELECT state FROM ow_characters WHERE id=$1 FOR UPDATE',[id])).rows[0].state as CharacterState;const result=await fn(c,s);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);return result;});}
async function settlePetNode(id:string,nodeId:string){return locked(id,async(c,s)=>{
 const instanceId=randomUUID(),entry:FrozenHubEntry={budgetReady:true,nodeId,dungeonId:'hub-'+nodeId,region:'wind',kind:nodeId.endsWith('hunt')?'hunt':'gate',tier:1,rules:versions.rules,shards:[],shardEffects:[],reward:{xp:50,gold:0,material:0,rep:0,shards:0},shardPool:[],combatScale:{hp:1,attack:1},dropCountScale:1};
 await consumeHubEntry(c,s,entry,instanceId);const input={nodeId,instanceId,seconds:60},receipt=await settleHubNode(c,s,input),after=structuredClone(s);
 expect(await settleHubNode(c,s,input)).toEqual(receipt);expect(s).toEqual(after);return receipt;
});}
it('legendary pet is not awarded by hunting alone',async()=>{
 const a=await actor();await settlePetNode(a.id,'wind-hunt');expect((await a.state()).pets?.owned['wind-heavy']).toBeUndefined();
});
it.each([['wind-hunt','wind-gate'],['wind-gate','wind-hunt']])('legendary pet is awarded once after %s then %s, including replay and later clears',async(first,second)=>{
 const a=await actor();await settlePetNode(a.id,first);expect((await a.state()).pets?.owned['wind-heavy']).toBeUndefined();
 const receipt=await settlePetNode(a.id,second);expect((await a.state()).pets!.owned['wind-heavy']).toBeDefined();
 const view=(await a.req('pets')).json(),pet=view.owned.find((p:any)=>p.family==='wind-heavy');expect(receipt.firstClearRewards.filter(r=>r==='获得宠物：'+pet.name)).toHaveLength(1);
 const repeat=await settlePetNode(a.id,second);expect(repeat.firstClearRewards).not.toContain('获得宠物：'+pet.name);expect(Object.keys((await a.state()).pets!.owned).filter(id=>id==='wind-heavy')).toHaveLength(1);
});
it('existing character session recovery backfills legendary pet once and preserves unrelated state',async()=>{
 const a=await actor();await locked(a.id,async(c,s)=>{delete s.pets;const h=await readHubState(c,a.id);for(const node of ['wind-hunt','wind-gate'])h.chart.cleared[node]={firstAt:new Date().toISOString(),bestSeconds:60};await saveHubState(c,a.id,h);});
 const before=await a.state(),response=await a.req('character');expect(response.statusCode,response.body).toBe(200);const after=await a.state();expect(after.pets!.owned['wind-heavy']).toBeDefined();
 const omit=(s:CharacterState)=>{const {pets,build,...rest}=s;return rest;};expect(omit(after)).toEqual(omit(before));await a.req('character');expect(await a.state()).toEqual(after);
});
it('loadout restores skills, replays identically and refuses active instances',async()=>{
 const a=await actor(),original=(await a.state()).skills,body={op:'save',index:1,command_id:randomUUID()};const saved=await a.req('loadout',body);expect(saved.statusCode,saved.body).toBe(200);expect(()=>validateResponse('loadout',saved.json())).not.toThrow();
 await locked(a.id,async(_c,s)=>{s.skills=['cut'];});const apply={op:'apply',index:1,command_id:randomUUID()},r=await a.req('loadout',apply);expect(r.statusCode,r.body).toBe(200);expect((await a.state()).skills).toEqual(original);expect((await a.req('loadout',apply)).json()).toEqual(r.json());
 await locked(a.id,async(_c,s)=>{s.dungeon={instance:randomUUID(),pendingResult:null,returnRegion:'ss-map-port'};});expect((await a.req('loadout')).json().canSwitch).toBe(false);const denied=await a.req('loadout',{...apply,command_id:randomUUID()});expect(denied.statusCode).toBe(409);expect(denied.json().code).toBe('LOADOUT_LOCKED');
});
it('migration preserves unrelated state, takes warehouse maxima, and backfills pets/keys once',async()=>{
 const a=await actor();await locked(a.id,async(c,s)=>{delete s.slotRanks;s.gear[0].rank=3;s.warehouse=[{...structuredClone(s.gear[0]),id:randomUUID(),rank:6}];const h=newHubState();h.chart.cleared['wind-gate']={firstAt:new Date().toISOString(),bestSeconds:60};h.chart.cleared['mist-gate']={firstAt:new Date().toISOString(),bestSeconds:60};await saveHubState(c,a.id,h);});
 const before=await a.state();await a.req('pets');const after=await a.state();expect(after.slotRanks!.weapon).toBe(6);expect(after.pets!.owned['wind-free']).toBeDefined();expect(after.pets!.owned['mist-free']).toBeDefined();expect((await readHubState(pool,a.id)).explore!.keys).toEqual(['wind','mist']);
 const omit=(s:CharacterState)=>{const {slotRanks,pets,build,...rest}=s;return rest;};expect(omit(after)).toEqual(omit(before));await a.req('pets');expect(await a.state()).toEqual(after);
});
it('slot +3 survives changing equipment, grants one affix node and six +3 resonate',async()=>{
 const a=await actor();for(let i=0;i<3;i++){const r=await a.req('slot/upgrade',{slot:'weapon',command_id:randomUUID()});expect(r.statusCode,r.body).toBe(200);expect(()=>validateResponse('slot/upgrade',r.json())).not.toThrow();}
 const s=await a.state(),newGear={...structuredClone(s.gear[0]),id:randomUUID(),rank:0,affixNode:undefined} as Gear;await locked(a.id,async(_c,s)=>{s.gear.push(newGear);});
 const equip=await a.req('gear/equip',{gear_id:newGear.id,command_id:randomUUID(),revision:s.revision,lease_id:a.lease});expect(equip.statusCode,equip.body).toBe(200);const after=await a.state(),g=after.gear.find(g=>g.id===newGear.id)!;expect(g.rank).toBe(3);expect(g.affixNode).toMatchObject({rank:3});const unranked=structuredClone(after);unranked.slotRanks!.weapon=0;expect(resolveBuild(after).stats.attack).toBeGreaterThan(resolveBuild(unranked).stats.attack);
 await locked(a.id,async(_c,s)=>{s.slotRanks=Object.fromEntries(rankSlots.map(slot=>[slot,3]));});expect((await a.req('slots')).json().resonance.tier).toBe(1);
});
it('gate settlement grants active pet, future node pays pet XP and repeat receipt pays nothing',async()=>{
 const a=await actor();const run=async(nodeId:string)=>locked(a.id,async(c,s)=>{const instanceId=randomUUID(),entry:FrozenHubEntry={budgetReady:true,nodeId,dungeonId:'hub-'+nodeId,region:'wind',kind:'gate',tier:1,rules:'ow-92',shards:[],shardEffects:[],reward:{xp:50,gold:0,material:0,rep:0,shards:0},shardPool:[],combatScale:{hp:1,attack:1},dropCountScale:1};await consumeHubEntry(c,s,entry,instanceId);const input={nodeId,instanceId,seconds:60},r=await settleHubNode(c,s,input);const before=structuredClone(s);expect(await settleHubNode(c,s,input)).toEqual(r);expect(s).toEqual(before);return r;});
 await run('wind-gate');const before=await a.state();expect(before.pets!.lineup.active).toBe('wind-free');expect(resolveBuild(before).stats.rules!.some(r=>r.id==='pet-wind-free')).toBe(true);await run('wind-nest-1');const after=await a.state();expect(after.pets!.owned['wind-free'].level*10000+after.pets!.owned['wind-free'].xp).toBeGreaterThan(before.pets!.owned['wind-free'].level*10000+before.pets!.owned['wind-free'].xp);
 const flow=await a.req('pets',{op:'flow',family:'wind-free',flow:'ember',command_id:randomUUID()});expect(flow.statusCode,flow.body).toBe(200);expect(()=>validateResponse('pets',flow.json())).not.toThrow();
});
it('cache is once only, mist key opens wind door, completion awards wind-light and dock x1.5',async()=>{
 const a=await actor();await locked(a.id,async(c,s)=>{const h=await readHubState(c,a.id);const first=claimExploreCache(s,h,'wind-nest-1',freezeCraftingLoot());expect(first?.materials).toBeDefined();const score=regionExplore(h,'wind').score;expect(claimExploreCache(s,h,'wind-nest-1',freezeCraftingLoot())).toBeUndefined();expect(regionExplore(h,'wind').score).toBe(score);expect(()=>unlockExploreDoor(s,h,'wind-nest-2','wind-door-1')).toThrow('铃钥');await saveHubState(c,a.id,h);});
 await locked(a.id,async(c,s)=>{const h=await readHubState(c,a.id);for(const n of hubChartContent.nodes.filter(n=>n.region==='wind')){h.chart.cleared[n.id]={firstAt:new Date().toISOString(),bestSeconds:60};if(n.kind!=='gate'&&!h.explore!.caches.includes(cacheId(n.id)))h.explore!.caches.push(cacheId(n.id));}h.chart.cleared['mist-gate']={firstAt:new Date().toISOString(),bestSeconds:60};await saveHubState(c,a.id,h);});await a.req('pets');
 await locked(a.id,async(c,s)=>{const h=await readHubState(c,a.id);expect(unlockExploreDoor(s,h,'wind-nest-2','wind-door-1')).toBe(true);expect(unlockExploreDoor(s,h,'wind-nest-3','wind-door-2')).toBe(true);expect(regionExplore(h,'wind').percent).toBe(100);expect(s.pets!.owned['wind-light']).toBeDefined();h.dock.fleets=[{fleet:1,region:'wind',since:1000,accruedMs:3600000,remainder:{}}];const before=s.gold,r=await executeHubOutside(c,s,h,{kind:'dock',op:'collect'},{...pendingHubOutsideNumbers,dockRates:{wind:{goldPerHour:100,materialsPerHour:{}}}},1000);expect(s.gold-before).toBe(150);expect((r.result as any).gold).toBe(150);await saveHubState(c,a.id,h);});
 const chart=await a.req('hub/chart');expect(chart.statusCode,chart.body).toBe(200);expect(chart.json().regions[0].explore.percent).toBe(100);
});
