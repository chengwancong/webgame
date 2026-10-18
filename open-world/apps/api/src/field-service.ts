import {observeFieldReplay,fieldReplayView} from './field-replay-service.ts';
import {patrolCamp,patrolSpawns} from '../../../packages/rules/world-patrols.ts';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {versions,type CharacterState,type FieldCamps,type Receipt,type Spawn} from '../../../packages/contracts/index.ts';
import {worldProgressSchema} from '../../../packages/contracts/open-world.ts';
import {regionById,fieldRegionInfo} from '../../../packages/content/index.ts';
import {mergeExploration,revealExploration} from '../../../packages/rules/exploration.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {campsNear,campSpawns,campSource,plausibleMove} from '../../../packages/rules/world-camps.ts';
import {walkable} from '../../../packages/simulation/navigation.ts';
import encounterBalance from '../../../packages/content/encounter-balance.json';
import {currentCampCycle} from './world-camps.ts';
import {characterWorldTables} from '../../../packages/rules/world-levels.ts';
import {activeWorldTier,tierDifficulty,worldTier,worldTiers,worldTierUnlocked} from '../../../packages/rules/world-tier.ts';
import {starseaHub} from '../../../packages/content/starsea/index.ts';
import {acceptBounty,abandonBounty,bountyBoard,claimBounty} from '../../../packages/rules/bounty.ts';
import {applyXp} from '../../../packages/rules/index.ts';
import {visibleWorldRows,resolveWorldPhase} from '../../../packages/rules/world-phase.ts';
import {evaluateUnlocks} from '../../../packages/rules/quest-conditions.ts';
import {discoverPlaneGates,interactPlaneGate,PlaneGateError} from '../../../packages/rules/plane-gates.ts';

type Identity={account:string;session:string;resume?:string};
type Command={command_id:string;revision:number;lease_id:string};
type Context={write:(who:Identity,input:Command,body:unknown,fn:(c:PoolClient,s:CharacterState)=>Promise<{delta?:Receipt['delta'];questCompletions?:{id:string;xp:number;gold:number}[]}>)=>Promise<Receipt>;pool:Pool;identity:(req:unknown)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity,lock?:boolean)=>Promise<CharacterState>;lease:(c:Pool|PoolClient,s:CharacterState,who:Identity,id:string)=>Promise<void>;fail:(code:string,message:string,status?:number)=>never;transaction:<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>)=>Promise<T>};
const vec=z.object({x:z.number().finite(),y:z.number().finite()}).strict();
const commandShape={command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid()};
/** Same reach as waypoint activation and tier switching beside an outpost. */
const boardReach=4;
/** Fastest legitimate overland speed: hero speed × out-of-combat sprint. */
const maxSpeed=6*encounterBalance.openWorldSprint.speedMultiplier;

export type FieldCampView=FieldCamps['camps'][number];

/** Mark camp cycles whose every member has a timed kill receipt as cleared. Runs
 * in the report transaction so world-fact quests (clear_camp) see it at once. */
export async function markClearedCamps(c:PoolClient,character:string,region:string,sources:readonly string[]){
 const cycles=new Map<string,{camp:string;cycle:number}>();for(const id of sources){const at=campSource(id);if(at)cycles.set(at.camp+':'+at.cycle,at);}
 for(const {camp,cycle} of cycles.values()){
  const row=(await c.query('SELECT data FROM ow_camp_cycles WHERE character=$1 AND region=$2 AND camp=$3 AND cycle=$4 AND cleared_at IS NULL FOR UPDATE',[character,region,camp,cycle])).rows[0];if(!row)continue;
  const ids=(row.data.spawns as Spawn[]).map(m=>m.id),kills=(await c.query('SELECT count(*)::integer count,max(killed_at) at,bool_or(killed_at IS NULL) untimed FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[character,ids])).rows[0];
  if(kills.count===ids.length&&kills.at&&!kills.untimed)await c.query('UPDATE ow_camp_cycles SET cleared_at=$1 WHERE character=$2 AND region=$3 AND camp=$4 AND cycle=$5',[kills.at,character,region,camp,cycle]);
 }
}

export function registerField(app:FastifyInstance,{write,pool,identity,state,lease,fail,transaction}:Context){
 app.get('/api/field/replay-goal',async req=>{const s=await state(pool,await identity(req)),v=z.object({region:z.string().min(1).max(120)}).strict().parse(req.query),row=(await pool.query('SELECT private_data FROM ow_permits WHERE character=$1 AND region=$2 ORDER BY cycle DESC LIMIT 1',[s.id,v.region])).rows[0];return {goal:row?fieldReplayView(row.private_data):null};});
 /** Camps around the observer: current frozen cycle plus live members. The server
  * alone decides refreshes (all killed + 90 s + observer > 36 cells away). */
 app.post('/api/field/camps',async req=>{const who=await identity(req);const v=z.object({lease_id:z.uuid(),permit_id:z.uuid(),position:vec,explored:z.string().max(11000).optional()}).strict().parse(req.body);return transaction(pool,async c=>{
  const s=await state(c,who,true);await lease(c,s,who,v.lease_id);
  const row=(await c.query('SELECT * FROM ow_permits WHERE id=$1 AND character=$2 FOR UPDATE',[v.permit_id,s.id])).rows[0];if(!row)fail('PERMIT','战斗授权不存在。');
  const info=fieldRegionInfo(row.region);if(!info)return fail('REGION','这片区域没有营地。');
  if(row.data.rules!==versions.rules)fail('RULESET','战斗规则已更新，请重新出发。');if(new Date(row.expires).getTime()+30000<Date.now())fail('EXPIRED','战斗授权已过期，请恢复连接。');
  const region=regionById(row.region);if(!walkable(region,v.position))fail('POSITION','当前位置不可通行。');
  const now=Date.now(),last=row.private_data.fieldObserver as {x:number;y:number;at:number}|undefined,trusted=plausibleMove(last,v.position,now,maxSpeed);
  if(trusted)row.private_data.fieldObserver={...v.position,at:now};observeFieldReplay(row.private_data,row.region,v.position,trusted,boardReach);
  const tables=characterWorldTables(s),tier=activeWorldTier(s),difficulty=tierDifficulty(tier),known=new Set((row.data.spawns as Spawn[]).map(m=>m.id)),camps:FieldCampView[]=[];
  const patrols=visibleWorldRows(s,worldTables.patrols),allCamps=[...visibleWorldRows(s,worldTables.camps),...patrols.flatMap(row=>row.path.map(point=>({...patrolCamp(row),...point})))];
  for(const camp of new Map(campsNear(allCamps,row.region,v.position,info.chunkCells).map(c=>[c.id,c])).values()){
   // An implausible jump keeps current cycles: it is observed from the camp centre.
   const observer=trusted?v.position:{x:camp.x,y:camp.y};
   const cycle=await currentCampCycle(c,s.id,camp,observer,n=>{const seed=randomInt(1,2147483647);return {camp:camp.id,cycle:n,rules:versions.rules,tier,seed,spawns:patrols.some(p=>p.id===camp.id)?patrolSpawns(region,tables,patrols.find(p=>p.id===camp.id)!,n,difficulty,worldTier(tier).eliteAffixes,seed):campSpawns(region,tables,camp,n,difficulty,{range:worldTier(tier).eliteAffixes,seed})};});
   const killed=new Set((await c.query('SELECT source FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[s.id,cycle.spawns.map(m=>m.id)])).rows.map(r=>r.source));
   const live=cycle.spawns.filter(m=>!killed.has(m.id));for(const m of live)if(!known.has(m.id)){row.data.spawns.push(m);known.add(m.id);}
   camps.push({id:camp.id,zone:camp.zone,x:camp.x,y:camp.y,radius:camp.radius,cycle:cycle.cycle,spawns:live});
  }
  await c.query('UPDATE ow_permits SET data=$1,private_data=$2 WHERE id=$3',[row.data,row.private_data,row.id]);
  // Fog is presentation only (zone discovery and rewards stay on validated paths), so the
  // client bitmap is OR-merged as reported; the observer's own cell is always revealed.
  // Plane gates (F1): proximity discovery only from a trusted observer position; fact gates light up from world facts.
  const discovered=discoverPlaneGates(s,row.region,trusted?v.position:{x:Infinity,y:Infinity},now);
  const world=worldProgressSchema.parse(s.world??{}),before=world.exploration[row.region]??'';let explored=revealExploration(before,region.width,region.height,v.position);
  if(v.explored!==undefined)try{explored=mergeExploration(explored,v.explored,region.width,region.height);}catch{fail('EXPLORATION','探索记录格式不正确。');}
  if(explored!==before||discovered.length){world.exploration[row.region]=explored;s.world=world;await c.query("UPDATE ow_characters SET state=jsonb_set(state,'{world}',$1::jsonb,true) WHERE id=$2",[world,s.id]);}
  return {world_view:resolveWorldPhase(s,undefined,now),region:row.region,chunk_cells:info.chunkCells,camps,explored,discovered} satisfies FieldCamps;
 });});
 /** Interact discovery of a plane gate (F1): 破墙 / 拨开藤蔓 / 摇铃. The position is the
  * permit's last trusted observer (≤ 3 s old), never a client-supplied coordinate. */
 app.post('/api/plane/interact',async req=>{const who=await identity(req),v=z.object({...commandShape,permit_id:z.uuid(),gate:z.string().min(1).max(120)}).strict().parse(req.body);return write(who,v,{...v,operation:'plane.interact'},async(c,s)=>{
  const row=(await c.query('SELECT region,private_data FROM ow_permits WHERE id=$1 AND character=$2',[v.permit_id,s.id])).rows[0];if(!row)fail('PERMIT','战斗授权不存在。');
  const observer=row.private_data.fieldObserver as {x:number;y:number;at:number}|undefined;if(!observer||Date.now()-observer.at>3000)fail('PLANE_GATE_FAR','请走到入口旁边。');
  try{interactPlaneGate(s,v.gate,row.region,observer!,Date.now());}catch(e){if(e instanceof PlaneGateError)fail(e.code,e.message);throw e;}
  return {};
 });});
 /** Choose the world tier at the port or beside an outpost, out of combat. Camps already
  * standing keep their frozen tier; only cycles created afterwards use the new one. */
 app.post('/api/world/tier',async req=>{const who=await identity(req),v=z.object({command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid(),tier:z.number().int().min(1).max(100),region:z.string().min(1).max(120),position:vec.optional()}).strict().parse(req.body);return write(who,v,{...v,operation:'world.tier'},async(c,s)=>{
  try{worldTier(v.tier);}catch{fail('TIER','没有这片海域。');}if(!worldTierUnlocked(s,v.tier))fail('TIER_LOCKED','这片海域还没开启。');
  const port=worldTiers.switchAt.includes('port')&&v.region===starseaHub,outpost=worldTiers.switchAt.includes('outpost')&&v.position&&visibleWorldRows(s,worldTables.waypoints).some(w=>w.kind==='outpost'&&w.region===v.region&&Math.hypot(w.x-v.position!.x,w.y-v.position!.y)<=worldTiers.outpostReach);
  if(!port&&!outpost)fail('TIER_PLACE','回港口或前哨才能换海。');
  if((await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active',[s.id])).rowCount)fail('DUNGEON_ACTIVE','副本里不能换海。');
  const wave=s.starsea?.wave;if(wave&&wave.killed.length<wave.spawns.length)fail('IN_COMBAT','战斗中不能换海。');
  const world=worldProgressSchema.parse(s.world??{});world.worldTier=v.tier;world.unlockedWorldTier=Math.max(world.unlockedWorldTier,v.tier);s.world=world;
  return {};
 });});
 /** Outpost bounty board (content plan §6.3): stand beside an activated outpost of the
  * zone; empty and cooled-down slots are filled from that zone's pool by the server. */
 app.post('/api/bounty/board',async req=>{const who=await identity(req),v=z.object({...commandShape,region:z.string().min(1).max(120),position:vec}).strict().parse(req.body);return write(who,v,{...v,operation:'bounty.board'},async(_c,s)=>{
  const st=s.starsea;if(!st)return fail('STARSEA','星潮海尚未开放。');evaluateUnlocks(s);if(!st.features.includes('bounty'))fail('FEATURE_LOCKED','悬赏板尚未开放。');
  const outpost=visibleWorldRows(s,worldTables.waypoints).find(w=>w.kind==='outpost'&&w.region===v.region&&Math.hypot(w.x-v.position.x,w.y-v.position.y)<=boardReach);if(!outpost)return fail('BOUNTY_PLACE','请走到前哨悬赏板旁。');
  if(!st.waypoints.includes(outpost.id))fail('WAYPOINT_LOCKED','先激活这座前哨。');
  if(!bountyBoard(st,outpost.zone,Date.now(),n=>randomInt(n),randomUUID).length)fail('BOUNTY_EMPTY','这片分区暂时没有悬赏。');
  return {};
 });});
 for(const [op,run] of [['accept',(s:CharacterState,id:string)=>{acceptBounty(s.starsea!,id,Date.now(),fail);return {};}],['abandon',(s:CharacterState,id:string)=>{abandonBounty(s.starsea!,id,fail);return {};}],['claim',(s:CharacterState,id:string)=>{
  // Gold/material from the row, xp from the counted kills; no gear. Same transaction as the receipt.
  const {row,reward}=claimBounty(s.starsea!,id,Date.now(),fail);s.gold+=reward.gold;s.material+=reward.material;applyXp(s,reward.xp);
  return {delta:{gold:reward.gold,xp:reward.xp,material:reward.material},questCompletions:[{id:row.id,xp:reward.xp,gold:reward.gold}]};}]] as const)
  app.post('/api/bounty/'+op,async req=>{const who=await identity(req),v=z.object({...commandShape,instance:z.uuid()}).strict().parse(req.body);return write(who,v,{...v,operation:'bounty.'+op},async(_c,s)=>{if(!s.starsea)fail('STARSEA','星潮海尚未开放。');return run(s,v.instance);});});
 /** Free travel between unlocked waypoints of the current field map. Refused in
  * dungeons and while a quest wave is still fighting here; a full bag is allowed. */
 app.post('/api/travel/waypoint',async req=>{const who=await identity(req),v=z.object({command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid(),permit_id:z.uuid(),waypoint:z.string().min(1).max(120)}).strict().parse(req.body);return write(who,v,{...v,operation:'travel.waypoint'},async(c,s)=>{evaluateUnlocks(s);if(!s.starsea?.features.includes('waypoint'))fail('FEATURE_LOCKED','先触碰航标开启传送。');
  if((await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active',[s.id])).rowCount)fail('DUNGEON_ACTIVE','副本中不能使用航标传送。');
  const row=(await c.query('SELECT * FROM ow_permits WHERE id=$1 AND character=$2 FOR UPDATE',[v.permit_id,s.id])).rows[0];if(!row)fail('PERMIT','战斗授权不存在。');
  if(row.data.rules!==versions.rules)fail('RULESET','战斗规则已更新，请重新出发。');if(new Date(row.expires).getTime()+30000<Date.now())fail('EXPIRED','战斗授权已过期，请恢复连接。');
  const target=visibleWorldRows(s,worldTables.waypoints).find(w=>w.id===v.waypoint&&w.region===row.region);if(!target)return fail('WAYPOINT','这座航标不在当前地图。');
  if(!s.starsea?.waypoints?.includes(target.id))fail('WAYPOINT_LOCKED','先走到这座航标旁激活它。');
  const wave=s.starsea?.wave;if(wave&&wave.region===row.region&&wave.killed.length<wave.spawns.length)fail('IN_COMBAT','战斗中不能传送。');
  // The arrival point is trusted for camp refresh and resume.
  const at={x:target.x,y:target.y};row.private_data.fieldObserver={...at,at:Date.now()};row.private_data.lastPosition=at;
  await c.query('UPDATE ow_permits SET private_data=$1 WHERE id=$2',[row.private_data,row.id]);
  if(s.starsea)s.starsea.location={map:row.region,...at};
  return {};
 });});
}
