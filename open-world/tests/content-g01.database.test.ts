import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate,transaction} from '../apps/api/src/database.ts';
import {readHubState,saveHubState} from '../apps/api/src/hub-state.ts';
import {prepareHubEntry,consumeHubEntry,settleHubNode} from '../apps/api/src/hub-chart-service.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Requires isolated PostgreSQL, no production fallback');
const pool=poolFor(dsn),now=Date.parse('2026-10-23T03:00:00Z');
beforeAll(async()=>{await migrate(pool);});afterAll(async()=>{await pool.end();});
it('settles all six regional gates with the correct boss, successor, key, pet and idempotent receipt',async()=>{
 const account=randomUUID(),id=randomUUID(),s:CharacterState={id,name:'CONTENT隔离验收',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-port'],bosses:[],safe:'ss-map-port',tasks:[]},starsea:newStarseaState()};
 s.starsea!.prologue={done:true,weapon:'sword'};s.starsea!.location={map:'ss-map-port',x:14,y:20};ensureProgression(s);
 await transaction(pool,async c=>{await c.query('INSERT INTO ow_accounts(id,username,password) VALUES($1,$2,$3)',[account,'content-g01-'+account,'isolated-test']);await c.query('INSERT INTO ow_characters(id,account,state) VALUES($1,$2,$3)',[id,account,s]);await saveHubState(c,id,newHubState(now));});
 const regions=['wind','mist','forge','frost','rift','dragon'];
 for(const [index,region]of regions.entries()){
  await transaction(pool,async c=>{const state=(await c.query('SELECT state FROM ow_characters WHERE id=$1 FOR UPDATE',[id])).rows[0].state as CharacterState,h=await readHubState(c,id);
   // This is a settlement integration fixture, not a simulated/natural combat clear.
   for(const suffix of ['nest-1','nest-2','nest-3'])h.chart.cleared[region+'-'+suffix]={firstAt:new Date(now).toISOString(),bestSeconds:90};await saveHubState(c,id,h);
   const entry=await prepareHubEntry(c,state,{node_id:region+'-gate'}),instance=randomUUID();await consumeHubEntry(c,state,entry,instance,now);const first=await settleHubNode(c,state,{nodeId:region+'-gate',instanceId:instance,seconds:90},now),gold=state.gold;
   expect(await settleHubNode(c,state,{nodeId:region+'-gate',instanceId:instance,seconds:90},now)).toEqual(first);expect(state.gold).toBe(gold);
   expect(state.starsea!.bosses).toContain('ss-map-boss-'+(index+1));if(index<5)expect(state.starsea!.islands).toContain('ss-map-'+regions[index+1]);
   const saved=await readHubState(c,id);expect(saved.explore!.keys).toContain(region);const family=(region==='rift'?'star':region)+'-free';expect(state.pets!.owned[family]).toBeDefined();
   expect(saved.chart.returnQueue.some(q=>q.id==='ss-c0'+(index+1)+'-t06:accept')).toBe(true);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
  });
 }
 expect(Number((await pool.query('SELECT count(*) FROM ow_hub_node_first_clears WHERE character=$1',[id])).rows[0].count)).toBe(6);
});
