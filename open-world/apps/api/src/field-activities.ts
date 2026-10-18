import {consumeCraftKills} from '../../../packages/rules/crafting-consumables.ts';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {fieldActivityCommandSchema,fieldActivityInputSchema,type FieldActivityView} from '../../../packages/contracts/field-activities.ts';
import type {CharacterState,Receipt,Reward,Spawn} from '../../../packages/contracts/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {characterWorldTables} from '../../../packages/rules/world-levels.ts';
import {regionById} from '../../../packages/content/index.ts';
import {resolveBuild,applyXp} from '../../../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../../../packages/rules/monster-stats.ts';
import {applyEliteAffixes,rollEliteAffixes} from '../../../packages/rules/elite-affixes.ts';
import {worldPhaseVisible} from '../../../packages/rules/world-phase.ts';
import {evaluateUnlocks} from '../../../packages/rules/quest-conditions.ts';
import {recordFieldFact,type FieldFact} from '../../../packages/rules/starsea.ts';
import {World,distance,type WorldCheckpoint,type CombatEvent} from '../../../packages/simulation/index.ts';
import {activeWorldTier,worldTier,tierDifficulty,tierReward} from '../../../packages/rules/world-tier.ts';
import {starseaKillReward} from './economy.ts';
import {worldObjectiveHp} from '../../../packages/rules/world-objective.ts';
import {walkable} from '../../../packages/simulation/navigation.ts';
import {freezeFieldLoot,awardFieldLoot,type FrozenFieldLoot} from './field-loot.ts';
import {transaction} from './database.ts';
type Identity={account:string;session:string;resume?:string};
type Command={command_id:string;revision:number;lease_id:string};
type Gain={delta?:Receipt['delta'];rewards?:Reward[];questCompletions?:{id:string;xp:number;gold:number}[]};
type Context={pool:Pool;identity:(req:unknown)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity,lock?:boolean)=>Promise<CharacterState>;lease:(c:Pool|PoolClient,s:CharacterState,who:Identity,id:string)=>Promise<void>;fail:(code:string,message:string,status?:number)=>never;write:(who:Identity,input:Command,body:unknown,fn:(c:PoolClient,s:CharacterState)=>Promise<Gain>)=>Promise<Receipt>};
type Event=typeof worldTables.events[number];type Rare=typeof worldTables.rares[number];
export type FieldActivity={spawnRadius?:number;eliteAffixes?:[number,number];worldTier?:number;difficulty?:{hp:number;attack:number;armor:number};instance:string;character:string;target:string;region:string;kind:'event'|'chest'|'rare';name:string;status:'running'|'success'|'failed'|'claimed';startedAt:number;cooldownUntil:number;attempt:number;definition:Event|Rare|typeof worldTables.chests[number];level:number;position:{x:number;y:number};waves:number;waveCount:number;tick:number;seed:number;reason:string;settled:boolean;lastInputAt:number;renderEvents:CombatEvent[];loot:FrozenFieldLoot;battle:WorldCheckpoint|null};
function spawnWave(data:FieldActivity,index:number,world:World){
 const event=data.definition as Event,specs=data.kind==='rare'?[{template:(data.definition as Rare).template,rank:'rare' as const,count:1}]:event.waves[index],hero=world.hero.position;
 const spawns=specs.flatMap(spec=>Array.from({length:spec.count},()=>spec)).map((spec,i)=>{
  const radius=data.kind==='event'&&event.kind==='horde'?(data.spawnRadius??36):3+i%4;let position:{x:number;y:number}|undefined;
  for(let n=0;n<32;n++){const angle=(n+i*7+index)*Math.PI/16,p={x:data.position.x+Math.cos(angle)*radius,y:data.position.y+Math.sin(angle)*radius};if(walkable(world.region,p,.6)){position=p;break;}}
  if(!position)throw Error('活动出现点不可走 '+data.target);
  let spawn=resolveMonsterSpawn({id:`activity:${data.instance}:${index}:${i}`,template:spec.template,rank:spec.rank,level:data.level,...position},world.rules.monsters,data.difficulty??{hp:1,attack:1,armor:1});
  if(spec.rank==='elite'||spec.rank==='rare')spawn=applyEliteAffixes(spawn,rollEliteAffixes(spec.rank==='rare'?(data.definition as Rare).affixes:data.eliteAffixes??[1,2],data.seed,spawn.id,world.rules.eliteAffixes),world.rules.eliteAffixes);
  if(data.kind==='rare'){spawn.name=data.name;spawn.x=data.position.x;spawn.y=data.position.y;}
  if(data.kind==='event'&&event.kind==='horde')spawn.monster!.ai.aggroRadius=distance(position,hero)+4;
  return spawn;
 });
 world.addSpawns(spawns);if(world.defense)world.defense.enemyIds.push(...spawns.map(s=>s.id));data.waves++;
}
/** Trusted server clock and real World only. No completion, HP, kills, reward,
 * checkpoint or elapsed-time values can be supplied through the HTTP commands. */
export function advanceFieldActivity(data:FieldActivity,now:number,maxTicks=300){
 if(data.status!=='running'||!data.battle)return;const world=World.restore(data.battle);if(now-(data.lastInputAt??data.startedAt)>1500)world.control(0,0);const definition=data.definition as Event,due=Math.max(0,Math.floor((now-data.startedAt)*30/1000)-data.tick),limit=data.kind==='event'?Math.ceil(definition.durationSeconds*30):Infinity;
 for(let n=0;n<Math.min(due,maxTicks)&&data.status==='running';n++){
  while(data.kind==='event'&&data.waves<data.waveCount&&world.tick>=data.waves*definition.waveIntervalSeconds*30)spawnWave(data,data.waves,world);
  world.step();data.tick=world.tick;data.renderEvents??=[];data.renderEvents.push(...world.events);if(data.renderEvents.length>256)data.renderEvents.splice(0,data.renderEvents.length-256);
  const targets=world.enemies.filter(e=>e.reward),cleared=data.waves===data.waveCount&&targets.length>0&&targets.every(e=>!e.alive),success=cleared&&(!world.defense||world.defense.complete);
  if(success){data.status='success';data.cooldownUntil=Math.ceil(data.startedAt+data.tick/30*1000+(data.kind==='rare'?(data.definition as Rare).cooldownMinutes*60000:definition.cooldownSeconds*1000));}
  else if(world.hero.hp<=0||world.defense?.failed||data.kind==='event'&&distance(world.hero.position,data.position)>definition.radius||world.tick>=limit){data.status='failed';if(world.defense?.downed)world.hero.hp=0;data.reason=world.hero.hp<=0?'角色倒下':world.defense?.failed?'守护目标被毁':world.tick>=limit?'活动超时':'离开活动范围';data.cooldownUntil=0;}
 }
 data.battle=world.exportCheckpoint();
}
export function fieldActivityView(data:FieldActivity,now:number,includeBattle=true):FieldActivityView{
 const definition=data.definition as Event,battle=includeBattle&&data.battle?structuredClone(data.battle):null,actors=(data.battle?.data.enemies??[]) as {reward:boolean;alive:boolean}[],defense=data.battle?.data.defense;if(battle)battle.data.events=structuredClone(data.renderEvents??[]);
 return {instance:data.instance,target:data.target,region:data.region,kind:data.kind,name:data.name,position:data.kind==='rare'&&data.status==='claimed'&&now>=data.cooldownUntil?(data.definition as Rare).spots[data.attempt%(data.definition as Rare).spots.length]:data.position,status:data.status==='claimed'&&data.kind!=='chest'?(now<data.cooldownUntil?'cooldown':'ready'):data.status,tick:data.tick,waves:data.waves,waveCount:data.waveCount,startedAt:data.startedAt,cooldownUntil:data.cooldownUntil,remainingSeconds:data.kind==='event'&&data.status==='running'?Math.max(0,definition.durationSeconds-data.tick/30):Math.max(0,(data.cooldownUntil-now)/1000),...(defense?{objectiveHp:defense.hp,objectiveMaxHp:defense.maxHp}:{}),killed:actors.filter(e=>e.reward&&!e.alive).length,total:actors.filter(e=>e.reward).length,reason:data.reason,...(includeBattle&&battle?{battle}:{})};
}
export function registerFieldActivities(app:FastifyInstance,ctx:Context){
 const {pool,identity,state,lease,fail,write}=ctx;
 const persist=async(c:PoolClient,data:FieldActivity)=>c.query('INSERT INTO ow_field_activities(character,target,instance,status,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(character,target) DO UPDATE SET instance=excluded.instance,status=excluded.status,data=excluded.data,updated=now()',[data.character,data.target,data.instance,data.status,data]);
 let busy=false,timer:ReturnType<typeof setInterval>|undefined;const tick=async()=>{if(busy)return;busy=true;try{
  const rows=(await pool.query("SELECT character,target FROM ow_field_activities WHERE status='running'")).rows;
  for(const row of rows)await transaction(pool,async c=>{await c.query('SELECT id FROM ow_characters WHERE id=$1 FOR UPDATE',[row.character]);const found=(await c.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2 FOR UPDATE',[row.character,row.target])).rows[0];if(!found)return;advanceFieldActivity(found.data,Date.now());await persist(c,found.data);});
 }catch(error){app.log.error({err:error},'field activity tick failed');}finally{busy=false;}};app.addHook('onReady',async()=>{timer=setInterval(()=>void tick(),100);timer.unref();});app.addHook('onClose',async()=>{if(timer)clearInterval(timer);while(busy)await new Promise(resolve=>setTimeout(resolve,10));});
 app.post('/api/field/activity/start',async req=>{
  const who=await identity(req),v=fieldActivityCommandSchema.parse(req.body);return write(who,v,{...v,operation:'field.activity.start'},async(c,s)=>{
   if((await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active',[s.id])).rowCount)fail('DUNGEON_ACTIVE','副本中不能开启世界活动。');evaluateUnlocks(s);if(v.kind==='event'&&!s.starsea?.features.includes('events'))fail('FEATURE_LOCKED','世界事件尚未开放。');
   const rows=v.kind==='event'?worldTables.events:v.kind==='rare'?worldTables.rares:worldTables.chests,definition=rows.find(r=>r.id===v.target&&r.region===v.region);if(!definition||!worldPhaseVisible(s,definition))fail('ACTIVITY','这个世界目标尚未出现。');
   if(!s.starsea?.islands.includes(v.region)&&!worldTables.islands.some(i=>i.region===v.region&&s.starsea?.islands.includes(i.island)))fail('LOCKED','这座岛尚未开放。');
   const old=(await c.query('SELECT data FROM ow_field_activities WHERE character=$1 AND target=$2 FOR UPDATE',[s.id,v.target])).rows[0]?.data as FieldActivity|undefined;
   if(old?.status==='running')return {};if(old?.settled&&v.kind==='chest')fail('CHEST_CLAIMED','宝箱已经打开。');if(old&&Date.now()<old.cooldownUntil)fail('ACTIVITY_COOLDOWN','这个目标尚在冷却。');
   if((await c.query("SELECT 1 FROM ow_field_activities WHERE character=$1 AND status='running'",[s.id])).rowCount)fail('ACTIVITY_BUSY','请先结束当前世界活动。');
   const attempt=(old?.attempt??0)+1,position=v.kind==='rare'?(definition as Rare).spots[(attempt-1)%(definition as Rare).spots.length]:{x:(definition as Event).x,y:(definition as Event).y};
   if(distance(v.position,position)>4.5||!walkable(regionById(v.region),v.position))fail('ACTIVITY_DISTANCE','请走到世界目标旁。');
   const zone=characterWorldTables(s).zones.find(z=>z.id===definition!.zone)!,tier=activeWorldTier(s),difficulty=tierDifficulty(tier),currency=tierReward(tier,starseaKillReward(zone.levelBand[1],'normal',s.level,v.region,Boolean(s.starsea?.hardmode))),data:FieldActivity={spawnRadius:v.kind==='event'?Math.max(3,(definition as Event).radius-4):undefined,worldTier:tier,difficulty,eliteAffixes:worldTier(tier).eliteAffixes,instance:randomUUID(),character:s.id,target:v.target,region:v.region,kind:v.kind,name:'name' in definition!?String(definition!.name):'宝箱',status:v.kind==='chest'?'success':'running',startedAt:Date.now(),cooldownUntil:0,attempt,definition:structuredClone(definition!),level:zone.levelBand[1],position:{...position},waves:0,waveCount:v.kind==='event'?(definition as Event).waves.length:v.kind==='rare'?1:0,tick:0,seed:randomInt(1,2147483647),reason:'',settled:false,lastInputAt:Date.now(),renderEvents:[],loot:freezeFieldLoot(definition!.loot,currency),battle:null};
   if(v.kind!=='chest'){
    const build=resolveBuild(s),world=new World({...regionById(v.region),sprint:Boolean(regionById(v.region).sprint&&s.starsea?.features.includes('sprint'))},build.stats,build.resolvedSkills,[],[],data.seed);world.hero.position={...position};world.anchor={...position};if(v.kind==='event'){world.radius=Math.max(3,(definition as Event).radius-4);world.autoBounds={center:{...position},radius:Math.max(2,(definition as Event).radius-2)};}world.setMode('auto');
    if(v.kind==='event'&&(definition as Event).kind==='defend'){const d=definition as Event;if(!d.objectiveHp)throw Error('守护事件缺少目标生命');world.defense={position:{...position},hp:Math.round(worldObjectiveHp(d.objectiveHp,worldTables.zones.find(z=>z.id===d.zone)!.levelBand[1],data.level)*difficulty.hp),maxHp:Math.round(worldObjectiveHp(d.objectiveHp,worldTables.zones.find(z=>z.id===d.zone)!.levelBand[1],data.level)*difficulty.hp),radius:d.radius,requiredTicks:Math.round(d.durationSeconds*30),heldTicks:0,enemyIds:[],failed:false,complete:false};}
    spawnWave(data,0,world);data.battle=world.exportCheckpoint();
   }
   await persist(c,data);return {};
  });
 });
 app.get('/api/field/activity',async req=>{const who=await identity(req);return transaction(pool,async c=>{const s=await state(c,who,true),rows=(await c.query('SELECT data FROM ow_field_activities WHERE character=$1 ORDER BY updated DESC',[s.id])).rows;return {activities:rows.map(row=>fieldActivityView(row.data,Date.now(),row.data.status==='running'||row.data.status==='success'))};});});
 app.post('/api/field/activity/input',async req=>{
  const who=await identity(req),v=fieldActivityInputSchema.parse(req.body);return transaction(pool,async c=>{
   const s=await state(c,who,true);await lease(c,s,who,v.lease_id);const data=(await c.query('SELECT data FROM ow_field_activities WHERE character=$1 AND instance=$2 FOR UPDATE',[s.id,v.instance])).rows[0]?.data as FieldActivity|undefined;if(!data||data.status!=='running')fail('ACTIVITY','当前活动已经结束。');
   advanceFieldActivity(data!,Date.now());if(data!.status==='running'){
    const world=World.restore(data!.battle!);data!.lastInputAt=Date.now();if(v.destination){if(!walkable(world.region,v.destination))fail('POSITION','目标不可通行。');world.go(v.destination);}if(v.mode)world.setMode(v.mode);if(v.movement){if(Math.abs(v.movement.x)>1||Math.abs(v.movement.y)>1)fail('INPUT','移动输入超出范围。');world.control(v.movement.x,v.movement.y);}if(v.skill)world.cast(v.skill,undefined,v.target);data!.battle=world.exportCheckpoint();
   }
   await persist(c,data!);return {activity:fieldActivityView(data!,Date.now(),false)};
  });
 });
 app.post('/api/field/activity/claim',async req=>{
  const who=await identity(req),v=z.object({command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid(),instance:z.uuid()}).strict().parse(req.body);return write(who,v,{...v,operation:'field.activity.claim'},async(c,s)=>{
   const data=(await c.query('SELECT data FROM ow_field_activities WHERE character=$1 AND instance=$2 FOR UPDATE',[s.id,v.instance])).rows[0]?.data as FieldActivity|undefined;if(!data)fail('ACTIVITY','活动不存在。');advanceFieldActivity(data!,Date.now());if(data!.status!=='success'||data!.settled)fail('ACTIVITY_UNFINISHED','目标未完成或收益已经结算。');
   const result=await awardFieldLoot(c,s,'field:'+data!.instance,data!.region,data!.level,data!.position,data!.loot,{kind:data!.kind,first:!s.starsea?.fieldFacts?.kill_rare.includes(data!.target),worldTier:data!.worldTier}),fact:FieldFact=data!.kind==='chest'?'open_chest':data!.kind==='rare'?'kill_rare':'complete_event',gain=recordFieldFact(s,fact,data!.target);s.gold+=gain.gold;applyXp(s,gain.xp);result.delta.gold+=gain.gold;result.delta.xp+=gain.xp;consumeCraftKills(s,(data!.battle?.data.enemies??[]).filter((enemy:any)=>enemy.reward&&!enemy.alive).length);data!.settled=true;data!.status='claimed';await persist(c,data!);return {...result,questCompletions:gain.completed};
  });
 });
}
