import {newHexStatistics,hexStatisticsRule,hexStatisticsSchema,type HexStatistics} from './hex-combat-stats.ts';
import {starseaBossMaps} from '../content/starsea/index.ts';
import {resolvedSkillTags,resolvedMechanismTags} from '../content/skill-mechanism-tags.ts';
import {freshSkillCharges,chargeReadiness,consumeSkillCharge,reduceSkillChargeCooldown,type SkillChargeState} from './skill-charges.ts';
import {putBuff,activeBuffs,buffAmount,hexDamageScale,validateHexBudgets,type SelfBuff,type HexRecoveryEvent,type HexManaEvent} from './effect-state.ts';
import {hexPolicy,hexPolicySchema} from '../content/hex-policy.ts';
import {validateHexCombatLedger,hexProtection,hexResetFrameSchema,hexResetMechanisms,type HexCombatLedger} from './hex-cooldowns.ts';
import {effectMarksSchema,type EffectMark} from './effect-state.ts';
import {fieldRegionInfo} from '../content/index.ts';
import {recordWindowHit,validateHitWindows,type HitWindows} from './hit-windows.ts';
import {combatRules} from './effect-rules.ts';
import {attackSource,type AttackSource} from './attack-source.ts';
import {matches} from './conditions.ts';
import type {ConditionContext} from '../contracts/conditions.ts';
import {fieldStatusStrength,type ExecutableRule,type EffectRule,type EffectAction} from '../contracts/effects.ts';
import {skillTags} from '../content/skill-tags.ts';
import type {DefenseTarget} from './defense.ts';
import {permitsWeapon} from '../contracts/weapons.ts';
import {combatNumerics,armorMitigation,armorRuleSchema} from '../rules/combat-numerics.ts';
import {monsterContent,monsterContentSchema,parseFrozenMonsterContent} from '../content/monsters.ts';
import {resolveMonsterSpawn,monsterLevelValues} from '../rules/monster-stats.ts';
import {monsterCombatSchema} from '../contracts/monsters.ts';
import {eliteAffixes} from '../content/elite-affixes.ts';
import type {Vec,Stats,Skill,Spawn,Mode,Effect} from '../contracts/index.ts';
import {damagePermissions,statusPolicy,statusEffectSchema,skillSchema,periodicDamageKinds,type StatusEffect,type StatusEffectInput,type StatusKind,type DamageType,type CastFailure} from '../contracts/index.ts';
import {statusInstanceSchema,splitBudget,remainingStatusDamage,checkedDamageType,type StatusInstance,type SkillSequence,type DamageContext,type ComboEcho} from './skill-runtime.ts';
import {comboLimits,isComboRuleId,statusVfxKey,type ComboRule,type ComboAction} from '../contracts/weapon-combos.ts';
import {settings,effects,aiRules,bodyCollision,skillCatalog,type Region} from '../content/index.ts';
import {moveBody,segmentContact,terrainContact,contactNormal,type Body} from './collision.ts';
import {SpatialGrid} from './spatial.ts';
import {distance,move,findPath,walkable,lineOfSight} from './navigation.ts';
import {chapterBossSkills,chapterDamageTypes,inBeam,type BossCast,type WarningDisplay,monsterSkills,getBossPhase,getAvailableSkills,getBossDefinition} from '../content/chapter-combat.ts';
export type {WarningDisplay} from '../content/chapter-combat.ts';
import encounterBalance from '../content/encounter-balance.json';
export {distance,walkable,findPath} from './navigation.ts';
export type Entity=Spawn & {hp:number;maxHp:number;alive:boolean;cooldown:number;slow:number;burn:number;position:Vec;facing:number;action:string;actionUntil:number;reward:boolean;path?:Vec[];pathTick?:number;skillCooldowns?:Map<string,number>;currentPhase?:number;engaged?:boolean;contactAt?:number;home?:Vec;leashRadius?:number;returning?:boolean;patrolIndex?:number;shield?:number;shieldUntil?:number;shieldNext?:number};
export type VfxOrigin={attackSource?:AttackSource;echo?:boolean;ruleId?:string;castId?:number;sourceId?:string;targetId?:string;vfxKey?:string;projectileId?:number;contact?:Vec};
export type CombatEvent=VfxOrigin & {type:'effect_triggered'|'cast_started'|'hit_resolved'|'entity_died'|'status_changed'|'danger_started'|'phase_changed'|'cast_released'|'effect_activated'|'cast_failed'|'healed'|'resource_restored'|'shielded'|'missed'|'revived'|'displaced'|'plane_passage_open'|'plane_exit_open';id:string;position:Vec;amount?:number;source?:string;action?:string;skill?:string;tick:number;phase?:number;origin?:Vec;target?:Vec;windup?:number;radius?:number;duration?:number;status?:StatusKind;change?:'applied'|'refreshed'|'expired'|'cleansed'|'broken'|'resisted'|'immune'|'consumed'|'source_lost'|'death';category?:DamageContext['category'];damageType?:DamageType;reason?:CastFailure;blocked?:number;part?:number;crit?:true;shieldPhase?:'applied'|'absorbed';shieldRemaining?:number};
export type Projectile=VfxOrigin & {hexHoming?:boolean;statusOnHit?:StatusEffect;part?:number;orbit?:{duration:number;radius:number;interval:number;speed:number;angle:number;ends:number;hits:Record<string,number>};returns?:boolean;returning?:boolean;id:number;position:Vec;direction:Vec;damage:number;life:number;enemy:boolean;pierce:boolean;hit:Set<string>;skill?:string;radius?:number;previous?:Vec;origin?:Vec;target?:Vec;owner?:string;targetId?:string;resolvedSkill?:Skill;damageType?:DamageType;penetrations?:number;turnRate?:number;explosionRadius?:number;comboDepth?:number};
export type Zone=VfxOrigin & {visualActivated?:boolean;id:number;position:Vec;radius:number;damage:number;life:number;delay:number;enemy:boolean;slow:boolean;skill?:string;started?:number;resolvedSkill?:Skill;nextHit?:number;hitIndex?:number;damageType?:DamageType};
export type WorldCheckpoint={version:1;region:Region;data:Record<string,any>};
export type WorldPlayer={id:string;hero:World['hero'];stats:Stats;skills:Skill[];cooldowns:Record<string,number>;active:boolean;connected:boolean;[key:string]:any};
const outOfCombatTicks=120;
// 自动施法时，指向敌人的冲刺技只对这个距离内的敌人放：只是一个短突进，不会自己把角色拽过半个屏幕（docs/progression-goal-plan.md §11.1）。
const autoDashMaxDistance=4;
const heroFields=['autoBounds','skillCharges','hero','stats','skills','cooldowns','pending','heroSlowUntil','targetId','mode','autoState','stopReason','anchor','radius','avoidElite','targetPriority','autoSkills','path','pathGoal','stuck','input','destination','dodge','wardCooldown','lastCastFailure','combatAt','hurtAt','comboReady','comboCounts','effectHitWindows','effectMarks','hexCombat','hexLedger','hexResetFrame','hexRecoveryWindow','hexManaWindow','echoes','castIntent','hexStatistics','effectStats','conditionClock','selfBuffs','effectKillTicks','effectMoved','effectLastPosition','effectsStarted','effectObservedShield','effectShieldPeak','effectPassive','effectCastHits'] as const;
const encode=(v:any):any=>v instanceof Map?{$map:[...v].map(([k,x])=>[k,encode(x)])}:v instanceof Set?{$set:[...v]}:Array.isArray(v)?v.map(encode):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)])):v;
function decode(v:any):any{
 if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid combat number');
 if(!v||typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(decode);
 if(Object.keys(v).some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('Invalid combat field');
 if('$map' in v){if(Object.keys(v).length!==1||!Array.isArray(v.$map)||v.$map.some((x:any)=>!Array.isArray(x)||x.length!==2||typeof x[0]!=='string')||new Set(v.$map.map((x:any)=>x[0])).size!==v.$map.length)throw Error('Invalid combat map');return new Map(v.$map.map(([k,x]:[string,any])=>[k,decode(x)]));}
 if('$set' in v){if(Object.keys(v).length!==1||!Array.isArray(v.$set))throw Error('Invalid combat set');return new Set(v.$set.map(decode));}
 return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));
}
/** 画面朝向：等距视角下屏幕左右由 x−y 决定，不是世界 x。正上/正下方时保持原朝向。 */
export function screenFacing(from:Vec,to:Vec,current=1){const d=(to.x-to.y)-(from.x-from.y);return Math.abs(d)<1e-6?current:d>0?1:-1;}
export class World {
 rules=structuredClone({hexPolicy,eliteAffixes,combatNumerics,monsters:monsterContent,aiRules,settings,effects,bodyCollision,encounterBalance,chapterBossSkills,monsterSkills,chapterDamageTypes,statusPolicy,damagePermissions});
 defense:DefenseTarget|null=null;
 /** 原地分层：剧情战斗期间被暂时移出本场战斗的野怪，战斗结束后原样放回。 */
 phased:Entity[]=[];
 phaseOut(center:Vec,radius:number,keep:(e:Entity)=>boolean){
  const out=this.enemies.filter(e=>e.alive&&!e.boss&&!keep(e)&&distance(e.position,center)<=radius);if(!out.length)return;
  const ids=new Set(out.map(e=>e.id));this.enemies=this.enemies.filter(e=>!ids.has(e.id));this.phased.push(...out);
  this.pending=this.pending.filter(p=>!p.target||!ids.has(p.target.id));this.monsterPending=this.monsterPending.filter(p=>!ids.has(p.owner));this.statuses=this.statuses.filter(x=>!ids.has(x.targetId)&&!ids.has(x.sourceId));this.projectiles=this.projectiles.filter(p=>!p.owner||!ids.has(p.owner));
  if(ids.has(this.targetId))this.targetId='';this.grid.rebuild(this.enemies.filter(e=>e.alive));
 }
 phaseIn(){if(!this.phased.length)return;for(const e of this.phased){e.action='idle';e.actionUntil=0;}this.enemies.push(...this.phased);this.phased=[];this.grid.rebuild(this.enemies.filter(e=>e.alive));}
 /** 守护中倒下算守护失败：在引擎旁满血站起，可以直接修复重来，不会进入倒地结算。 */
 private downedInDefense(){const d=this.defense;if(!d||d.complete||this.players.size||this.hero.hp>0)return;d.failed=true;d.downed=true;this.hero.hp=this.stats.hp;this.hero.position={x:d.position.x+1.5,y:d.position.y};this.cancelWalk();this.control(0,0);}
 statuses:StatusInstance[]=[];sequences:SkillSequence[]=[];guardianUsed=new Set<string>();lastCastFailure:CastFailure|''='';
 /** Weapon-combo runtime (per player via heroFields): rule cooldown ends, nth counters, queued echoes. */
 effectCastHits:Record<string,{tick:number;targets:string[]}>={};effectPassive:Record<string,boolean>={};selfBuffs:SelfBuff[]=[];effectKillTicks:number[]=[];effectMoved=0;effectLastPosition:Vec={x:0,y:0};effectsStarted=false;effectObservedShield=0;effectShieldPeak=0;
 hexStatistics:HexStatistics|null=newHexStatistics();
 upperBound=false;effectStats:Record<string,{count:number;damage:number;activations?:number;activeFrames?:number;uses?:number}>={};conditionClock={still:0,moving:0,manaSpent:0,kills:0,start:0};
 comboReady:Record<string,number>={};comboCounts:Record<string,number>={};echoes:ComboEcho[]=[];
 effectHitWindows:HitWindows|undefined=undefined;
 effectMarks:EffectMark[]|undefined=undefined;
 hexCombat:{started:number;lastDamage:number;moved:number}|undefined=undefined;
 hexRecoveryWindow:HexRecoveryEvent[]|undefined=undefined;
 hexLedger:HexCombatLedger|undefined=undefined;
 hexResetFrame:{tick:number;first:string}|undefined=undefined;
 private resetHexCooldownLedger(){
  if(!this.hexLedger&&!this.stats.rules?.some(r=>r.hexMechanism))return;
  this.hexLedger={deaths:(this.hexLedger?.deaths??0)+1,triggers:{}};
  this.hexResetFrame=undefined;
  for(const key of Object.keys(this.comboReady))if(key.startsWith('hex:')||key.startsWith('hex-'))delete this.comboReady[key];
  this.hexRecoveryWindow=undefined;this.hexManaWindow=undefined;
 }
 hexManaWindow:HexManaEvent[]|undefined=undefined;
 private hexResourceSource(skill:string){
  if(!this.rules.hexPolicy)return false;
  const id=this.vfxContext?.ruleId??skill,source=this.vfxContext?.sourceId;
  const stats=source&&source!==this.playerId?this.players.get(source)?.stats:this.stats;
  return Boolean(stats?.rules?.some(r=>r.id===id&&r.hexMechanism));
 }
 private reserveHexRecovery(wanted:number){
  const policy=this.rules.hexPolicy;if(!policy||wanted<=0)return wanted;
  this.hexRecoveryWindow=(this.hexRecoveryWindow??[]).filter(e=>e.tick>this.tick-30);
  const spent=this.hexRecoveryWindow.reduce((sum,e)=>sum+e.amount,0),amount=Math.max(0,Math.min(wanted,this.stats.hp*policy.recoveryPerSecondCap-spent));
  if(amount>0)this.hexRecoveryWindow.push({tick:this.tick,amount});return amount;
 }
 private noteHexManaSpend(amount:number){
  if(amount<=0||!this.rules.hexPolicy||!this.stats.rules?.some(r=>r.hexMechanism))return;
  this.hexManaWindow=(this.hexManaWindow??[]).filter(e=>e.tick>this.tick-30);this.hexManaWindow.push({tick:this.tick,amount,kind:'spent'});
 }
 private reserveHexMana(wanted:number){
  const policy=this.rules.hexPolicy;if(!policy||wanted<=0)return wanted;
  this.hexManaWindow=(this.hexManaWindow??[]).filter(e=>e.tick>this.tick-30);
  const spent=this.hexManaWindow.filter(e=>e.kind==='spent').reduce((n,e)=>n+e.amount,0),used=this.hexManaWindow.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.amount,0),amount=Math.max(0,Math.min(wanted,spent*policy.manaRefundCap-used));
  if(amount>0)this.hexManaWindow.push({tick:this.tick,amount,kind:'refund'});return amount;
 }
 private noteHexDamage(){
  if(!(this.stats.rules??[]).some(r=>r.hexMechanism))return;
  this.hexCombat??={started:this.tick,lastDamage:this.tick,moved:this.effectMoved};
  this.hexCombat.lastDamage=this.tick;
 }
 private clearHexCombat(){
  this.removeHexEffects((this.stats.rules??[]).filter(r=>r.hexMechanism).map(r=>r.id));
  this.hexCombat=undefined;
  if(this.hero.hp<=0){this.hexRecoveryWindow=undefined;this.hexManaWindow=undefined;}
 }
 /** D10 unequip boundary: remove owned temporary work immediately, not the ICD
  * or review counters. Other players and unrelated skills are left untouched. */
 removeHexEffects(ruleIds:readonly string[]){
  const removed=new Set(ruleIds);if(!removed.size)return;
  this.selfBuffs=this.selfBuffs.filter(b=>!removed.has(b.id));
  if(this.effectMarks)this.effectMarks=this.effectMarks.filter(m=>!removed.has(m.ruleId));
  this.echoes=this.echoes.filter(e=>!removed.has(e.rule));
  this.projectiles=this.projectiles.filter(p=>p.sourceId!==this.playerId||!p.ruleId||!removed.has(p.ruleId));
  this.zones=this.zones.filter(z=>z.sourceId!==this.playerId||!z.ruleId||!removed.has(z.ruleId));
  for(const status of [...this.statuses])if(status.sourceId===this.playerId&&removed.has(status.skill))this.removeStatus(status,'source_lost');
  for(const key of Object.keys(this.comboCounts))if(ruleIds.some(id=>key===id||key.startsWith(id+'#')))delete this.comboCounts[key];
  if(this.effectHitWindows)for(const id of ruleIds)delete this.effectHitWindows[id];
 }
 castIntent:{skill:string;targetId:string;until:number}|null=null;
 private comboSpent=0;private comboTick=-1;
 private statusFeedbackAt=new Map<string,number>();
 private bossKey(e:Entity){return e.monster?(e.monster.bossProfile??e.monster.bossKey??''):e.art;}
 private monsterAi(e:Entity){return e.monster?.ai??{...this.rules.aiRules.profiles[e.kind],cooldown:e.boss?this.rules.aiRules.bossCooldown:this.rules.aiRules.cooldown,skillChance:(this.rules.monsters?.legacy??monsterContent.legacy).skillChance,basicAttackBonus:e.kind==='guard'?(this.rules.monsters?.legacy??monsterContent.legacy).guardAttackBonus:0};}
 private summonCombat(e:Entity,key:keyof typeof monsterContent.summons,hp:number,attack:number){
  if(!e.monster)return undefined;
  const content=this.rules.monsters;if(!content)throw Error('Missing frozen monster catalogue');
  const template=content.summons[key],placement={id:e.id,template,level:e.monster.level,rank:'normal' as const,x:e.position.x,y:e.position.y},base=resolveMonsterSpawn(placement,content);
  return resolveMonsterSpawn(placement,content,{hp:hp/base.hp,attack:attack/base.attack,armor:1}).monster;
 }
 private getBossDefinition(id:string){return this.rules.chapterBossSkills[(id==='dragon_king'?'ancient_dragon_king':id) as keyof typeof chapterBossSkills];}
 private getBossPhase(id:string,hpRatio:number){const boss=this.getBossDefinition(id);if(boss&&'phases' in boss)for(let i=boss.phases.length-1;i>=0;i--)if(hpRatio<=boss.phases[i].hp)return boss.phases[i].phase;return 1;}
 private getAvailableSkills(id:string,phase:number){const boss=this.getBossDefinition(id);return boss&&'skills' in boss?boss.skills.filter(s=>s.phase<=phase):[];}
 private beamContains(origin:Vec,target:Vec,point:Vec){const rule=this.rules.chapterBossSkills.ancient_dragon_king;return inBeam(origin,target,point,rule.halfWidth,rule.reach);}
 players=new Map<string,WorldPlayer>();playerId='hero';supportRange=0;
 private vfxSerial=0;private vfxContext:VfxOrigin|undefined;
 private withVfx(context:VfxOrigin,run:()=>void){const previous=this.vfxContext;this.vfxContext=context;try{if(context.sourceId&&this.players.has(context.sourceId))this.forPlayer(context.sourceId,run);else run();}finally{this.vfxContext=previous;}}
 private vfxFor(e:Entity,skill:string):VfxOrigin{return {castId:++this.vfxSerial,sourceId:e.id,targetId:this.playerId,vfxKey:`${e.boss?'boss':'monster'}/${skill}`};}
 private bossAttackCounts=new Map<string,number>();
 targetId='';tick=0;paused=false;mode:Mode='semi';autoState='等待';stopReason='';hero:{position:Vec;hp:number;mana:number;shield:number;shieldUntil:number;facing:number;action:string;actionUntil:number};
 enemies:Entity[]=[];events:CombatEvent[]=[];projectiles:Projectile[]=[];zones:Zone[]=[];cooldowns:Record<string,number>={};skillCharges:Record<string,SkillChargeState>={};
 bossClock:{started:number;limit:number;enraged:boolean}|null=null;bossCasts:BossCast[]=[];heroSlowUntil=0;private bossSkillAt=new Map<string,number>();
 warnings:WarningDisplay[]=[];  // 新增：预警UI列表
 autoBounds?:{center:Vec;radius:number};kills:{source_id:string;tick:number}[]=[];pickups:Vec[]=[];anchor:Vec;radius=this.rules.settings.autoRadius;avoidElite=false;targetPriority:'near'|'ranged'='near';autoSkills=true;
 /** Zoned field roaming: stay inside `bounds`; with no living enemy there, walk to `next()` (an
  * unexplored or possibly refreshed camp); when that is empty too, stop with `emptyReason`. */
 roamGuide?:{bounds:{x:number;y:number;w:number;h:number};next:()=>Vec|undefined;emptyReason:string};skills:Skill[];stats:Stats;
 private separatedCount=-1;private randomState=1;private inputEvents:CombatEvent[]=[];private stepping=false;private monsterPending:{at:number;owner:string;target:string;position:Vec;skillId:string;vfx:VfxOrigin}[]=[];
 private grid=new SpatialGrid<Entity>();private spatialCount=-1;private spatialOrder=new Map<Entity,number>();private awakeIds=new Set<string>();private pending:{at:number;skill:Skill;target?:Entity;position:Vec;vfx:VfxOrigin}[]=[];private serial=0;private path:Vec[]=[];private pathGoal='';private stuck=0;private input:Vec={x:0,y:0};private destination?:Vec;private dodge?:Vec;private wardCooldown=0;private combatAt=0;private hurtAt?:number;
 constructor(public region:Region,stats:Stats,skills:Skill[],spawns:Spawn[],completed:string[]=[],seed=1){
 this.grid=new SpatialGrid<Entity>(region.activationRadius?8:2);this.randomState=seed>>>0;this.stats=stats;this.skills=skills;this.anchor={...region.safe};this.hero={position:{...region.safe},hp:stats.hp,mana:stats.mana,shield:0,shieldUntil:0,facing:1,action:'idle',actionUntil:0};
 this.enemies=spawns.filter(s=>!completed.includes(s.id)).map(s=>({...s,maxHp:s.hp,alive:true,cooldown:(seed+s.id.length)%60,slow:0,burn:0,position:{x:s.x,y:s.y},facing:-1,action:'idle',actionUntil:0,reward:true,skillCooldowns:new Map(),currentPhase:1}));this.grid.rebuild(this.enemies);
 }
 setMode(mode:Mode){this.cancelCastIntent();this.destination=undefined;this.mode=mode;this.stopReason='';this.stuck=0;this.path=[];this.pathGoal='';this.dodge=undefined;this.anchor={...this.hero.position};}
 bindCamp(camp:{x:number;y:number;radius:number},ids:readonly string[]){const extra=this.rules.encounterBalance.openWorldNavigation?.leashExtra;if(!Number.isFinite(extra)||!Number.isFinite(camp.radius)||camp.radius<0||!walkable(this.region,camp))throw Error('Invalid frozen camp navigation');const wanted=new Set(ids);for(const e of this.enemies)if(wanted.has(e.id)){e.home={x:camp.x,y:camp.y};e.leashRadius=camp.radius+extra!;e.returning=false;}}
 addSpawns(spawns:Spawn[]){const ids=new Set(this.enemies.map(e=>e.id));if(spawns.some(s=>ids.has(s.id))||new Set(spawns.map(s=>s.id)).size!==spawns.length)throw Error('Duplicate encounter spawn');const seeded=new World(this.region,this.stats,this.skills,spawns,[],this.randomState);this.enemies.push(...seeded.enemies);this.grid.rebuild(this.enemies.filter(e=>e.alive));}
 /** Unload far camp members: the dead and the idle (untouched, unengaged) only; returns the removed ids. */
 removeSpawns(ids:readonly string[]){const wanted=new Set(ids),removed:string[]=[];this.enemies=this.enemies.filter(e=>{const drop=wanted.has(e.id)&&(!e.alive||!e.engaged&&!e.returning&&e.hp>=e.maxHp);if(drop)removed.push(e.id);return !drop;});if(removed.length)this.refreshSpatial(true);return removed;}
 /** A cancelled scripted wave is removed without death events, kill receipts or
  * rewards. Its pending attacks disappear; unrelated combat remains intact. */
 cancelSpawns(ids:readonly string[]){const wanted=new Set(ids);this.enemies=this.enemies.filter(e=>!wanted.has(e.id));this.monsterPending=this.monsterPending.filter(p=>!wanted.has(p.owner));this.projectiles=this.projectiles.filter(p=>!p.sourceId||!wanted.has(p.sourceId));this.zones=this.zones.filter(z=>!z.sourceId||!wanted.has(z.sourceId));this.refreshSpatial(true);}
 stop(reason:string){if(this.mode==='auto')this.mode='semi';this.stopReason=reason;this.autoState='已停止';}
 control(dx:number,dy:number){this.input={x:dx,y:dy};if(dx||dy){this.cancelCastIntent();if(this.mode==='auto')this.setMode('semi');this.destination=undefined;this.path=[];}}
 go(p:Vec){this.cancelCastIntent();if(this.mode==='auto')this.setMode('semi');this.destination=p;this.path=findPath(this.region,this.hero.position,p);}
 isWalkingTo(p:Vec){return this.destination===p;}
 cancelWalk(){this.destination=undefined;this.path=[];}
 movementIntent(){return {destination:this.destination?{...this.destination}:undefined,input:{...this.input}};}
 bodyDiagnostics(){return [...this.livingPlayers().map(p=>({id:p.id,position:{...p.position},radius:this.rules.bodyCollision.heroRadius})),...this.enemyBodies(this.hero.position,Infinity).map(body=>({...body,position:{...body.position}}))];}
 /** Independent island arenas own this default approach; authoritative and legacy encounters retain their targeting policy. */
 soloBossTarget(){const boss=this.region.boss&&starseaBossMaps.includes(this.region.id)&&this.players.size===0?this.enemies.find(e=>e.alive&&e.boss):undefined;return boss?(this.enemies.find(e=>e.id===this.targetId&&e.alive)??boss):undefined;}
 private bossNeedsApproach(){const b=this.soloBossTarget();return !!b&&(distance(this.hero.position,b.position)>=this.autoAttackStopRange()||!lineOfSight(this.region,this.hero.position,b.position));}
 closest(){const chosen=this.enemies.find(e=>e.id===this.targetId&&e.alive);if(chosen)return chosen;const boss=this.mode!=='manual'?this.soloBossTarget():undefined;if(boss)return boss;
 let nearest:Entity|undefined,best=Infinity;for(const e of this.enemies){if(!e.alive)continue;const score=distance(e.position,this.hero.position)+(this.targetPriority==='ranged'&&['ranged','shaman','artillery'].includes(e.kind)?-4:0);if(score<best||score===best&&nearest&&e.id.localeCompare(nearest.id)<0){nearest=e;best=score;}}
 return nearest;}
 cast(id:string,target=this.closest(),position?:Vec):boolean{
 if(!this.stepping)this.cancelCastIntent();
 const skill=this.skills.find(s=>s.id===id);
 if(skill&&this.stats.weapon!==undefined&&!permitsWeapon(skill.weapons,this.stats.weapon))return this.failure(skill,'weapon');
 if(skill?.mechanics)return this.castDeclared(skill,target,position);
 const s=this.skills.find(s=>s.id===id);if(!s)return this.failure(s,'unknown');if(this.paused)return this.failure(s,'paused');if(this.hero.hp<=0)return this.failure(s,'dead');if((this.cooldowns[id]??0)>this.tick)return this.failure(s,'cooldown');if(this.hero.mana<s.cost)return this.failure(s,'resource');if(this.pending.length)return this.failure(s,'busy');
 if(['single','projectile','chain','dash','zone'].includes(s.kind)&&(!target||distance(this.hero.position,target.position)>s.range))return this.failure(s,target?'range':'target');
 if(s.kind==='area'&&(!target||distance(this.hero.position,target.position)>s.radius))return this.failure(s,target?'range':'target');
 if(s.kind==='projectile'&&target&&!lineOfSight(this.region,this.hero.position,target.position))return this.failure(s,'blocked');
 if(s.kind==='heal'&&this.hero.hp>this.stats.hp*.8)return this.failure(s,'unneeded');
 if(s.kind==='shield'&&this.hero.shield>0)return this.failure(s,'unneeded');
 if(this.region.sprint&&s.kind!=='heal'&&s.kind!=='shield'&&(s.damage>0||target?.alive))this.combatAt=this.tick;this.hero.mana-=s.cost;this.conditionClock.manaSpent+=s.cost;this.cooldowns[id]=this.tick+Math.max(1,Math.round(s.cooldown*(1-Math.max(0,Math.min(.75,this.stats.cdr??0)))));this.hero.action=s.kind==='single'?'attack':'skill';this.hero.actionUntil=this.tick+s.windup+8;
 if(target)this.hero.facing=screenFacing(this.hero.position,target.position,this.hero.facing);
 const vfx:VfxOrigin={castId:++this.vfxSerial,sourceId:this.playerId,targetId:target?.id,vfxKey:'player/'+id};
 const event:CombatEvent={...vfx,type:'cast_started',id:this.playerId,position:{...this.hero.position},origin:{...this.hero.position},target:target?{...target.position}:undefined,skill:id,windup:s.windup,radius:s.radius,tick:this.tick};
 if(this.stepping)this.events.push(event);else this.inputEvents.push(event);
 this.pending.push({at:this.tick+s.windup,skill:s,target,position:target?{...target.position}:{...this.hero.position},vfx});return true;
 }
 private emit(event:CombatEvent){(this.stepping?this.events:this.inputEvents).push(event);}
 private failure(s:Skill|undefined,reason:CastFailure){this.lastCastFailure=reason;if(!this.stepping)this.emit({type:'cast_failed',id:this.playerId,sourceId:this.playerId,position:{...this.hero.position},skill:s?.id,tick:this.tick,reason});return false;}
 private castDeclared(s:Skill,target:Entity|undefined,point?:Vec,ally?:string){
  const original=s;const castBuffs=this.effectBuffs(s,target);s=this.prepareEffectSkill(s,target);const m=s.mechanics!;this.lastCastFailure='';
  if(this.paused)return this.failure(s,'paused');if(this.hero.hp<=0)return this.failure(s,'dead');
  if(this.actionBlocked(this.playerId)||this.hasStatus(this.playerId,'silence'))return this.failure(s,'controlled');
  if(s.kind==='dash'&&this.movementBlocked(this.playerId))return this.failure(s,'controlled');
  if(this.pending.length||this.sequences.some(q=>q.sourceId===this.playerId))return this.failure(s,'busy');
  if(s.charges&&s.charges>1?this.chargeInfo(s).available===0:(this.cooldowns[s.id]??0)>this.tick)return this.failure(s,'cooldown');if(this.hero.mana<s.cost){this.fireEffects('mana_empty',target,0,original);s=this.prepareEffectSkill(original,target);if(this.hero.mana<s.cost)return this.failure(s,'resource');}
  let p=point?{...point}:target?{...target.position}:{...this.hero.position};
  const recipient=ally?this.players.get(ally):undefined,recipientId=ally??this.playerId,hero=recipient?.hero??this.hero,stats=recipient?.stats??this.stats;
  if(m.targeting==='enemy'){
   if(!target?.alive)return this.failure(s,'target');
   const range=s.kind==='area'?s.radius+1.5:s.range,d=distance(this.hero.position,target.position);
   if(d>range){
    if(!this.stepping&&this.mode!=='auto'&&['single','chain','area','projectile'].includes(s.kind)&&d<=(s.kind==='area'?s.radius:s.range)+8&&!this.movementBlocked(this.playerId)){
     const path=this.castApproachPath(target);if(!path.length)return this.failure(s,'blocked');
     this.castIntent={skill:s.id,targetId:target.id,until:this.tick+90};this.destination=undefined;this.path=path;this.pathGoal='';return true;
    }
    return this.failure(s,'range');
   }
  }
  if(m.targeting==='ground'&&!point&&!target?.alive)return this.failure(s,'target');
  if(m.targeting==='ground'&&(distance(this.hero.position,p)>s.range||!walkable(this.region,p)))return this.failure(s,'range');
  if(['enemy','ground'].includes(m.targeting)&&!lineOfSight(this.region,this.hero.position,p))return this.failure(s,'blocked');
  if(m.targeting==='direction'){
   if(!point){const length=Math.hypot(this.input.x,this.input.y)||1;p={x:this.hero.position.x+(this.input.x||this.input.y?this.input.x/length:this.hero.facing*Math.SQRT1_2)*s.range,y:this.hero.position.y+(this.input.x||this.input.y?this.input.y/length:-this.hero.facing*Math.SQRT1_2)*s.range};}
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||distance(this.hero.position,p)>s.range+.0001||this.movementBlocked(this.playerId))return this.failure(s,'range');
   const next=moveBody(this.region,this.hero.position,p,distance(this.hero.position,p),this.rules.bodyCollision.heroRadius,[...this.enemyBodies(this.hero.position,s.range+2),...this.playerBodies(this.playerId)],false);
   if(distance(next,p)>.01||distance(next,this.hero.position)<.1)return this.failure(s,'blocked');
  }
  if(m.cleanse&&!this.activeStatuses(recipientId).some(x=>x.effect.cleanse&&m.cleanse!.kinds.includes(x.effect.kind)))return this.failure(s,'unneeded');
  if(m.statuses.some(x=>x.kind==='guardian')&&this.guardianUsed.has(recipientId))return this.failure(s,'unneeded');
  const healing=s.kind==='heal'&&!m.cleanse;
  if(healing&&hero.hp>=stats.hp&&(!m.restoreMana||hero.mana>=stats.mana))return this.failure(s,'unneeded');
  if(s.kind==='shield'&&s.damage>0&&hero.shield>0)return this.failure(s,'unneeded');
  if(this.region.sprint&&s.kind!=='heal'&&s.kind!=='shield'&&(s.damage>0||target?.alive))this.combatAt=this.tick;this.hero.mana-=s.cost;this.conditionClock.manaSpent+=s.cost;this.noteHexManaSpend(s.cost);this.spendCooldown(s);this.hero.action=s.kind==='single'?'attack':'skill';this.hero.actionUntil=this.tick+s.windup+8;
  if(m.targeting==='self')p={...hero.position};else this.hero.facing=screenFacing(this.hero.position,p,this.hero.facing);
  const vfx={attackSource:attackSource({category:'direct',skill:original},this.skills),castId:++this.vfxSerial,sourceId:this.playerId,targetId:ally??(m.targeting==='self'?this.playerId:target?.id),vfxKey:'player/'+s.id};
  this.emit({...vfx,type:'cast_started',id:this.playerId,position:{...this.hero.position},origin:{...this.hero.position},target:p,skill:s.id,windup:s.windup,radius:s.radius,tick:this.tick});
  this.queueConsumedEcho([...castBuffs,...this.effectBuffs(original,target)],s,target,p);this.consumeBuffs('nextCast',[...castBuffs,...this.effectBuffs(original,target)],target);this.pending.push({at:this.tick+s.windup,skill:s,target,position:p,vfx,...(ally?{ally}:{})});if(!ally){this.comboCast(s,target,p);const fresh=this.effectBuffs(s,target).filter(b=>b.action.consume==='nextCast'&&b.action.currentCast&&b.starts===this.tick);if(fresh.length){this.pending.at(-1)!.skill=this.prepareEffectSkill(s,target,true);this.consumeBuffs('nextCast',fresh,target);}}return true;
 }
 private chargeInfo(s:Skill){const max=s.charges??1;let state=this.skillCharges[s.id];if(!state||state.max!==max){state=state?{max,spentUntil:state.spentUntil.slice(0,max)}:freshSkillCharges(max);this.skillCharges[s.id]=state;}return chargeReadiness(state,this.tick);}
 private spendCooldown(s:Skill){if(this.rules.hexPolicy&&this.stats.rules?.some(r=>r.hexMechanism))this.comboCounts['hex-cooldown-budget#'+s.id]=0;if((s.charges??1)>1){this.chargeInfo(s);this.skillCharges[s.id]=consumeSkillCharge(this.skillCharges[s.id],this.tick,this.finalCooldown(s));const ready=this.chargeInfo(s);this.cooldowns[s.id]=this.tick+(ready.available?0:ready.next);}else this.cooldowns[s.id]=this.tick+this.finalCooldown(s);}
 private reduceHexCooldown(id:string,wanted:number,mechanism?:string){
  const s=this.skills.find(s=>s.id===id),policy=this.rules.hexPolicy;if(!s||!policy)return 0;
  const final=this.finalCooldown(s),base=(s.resolution?.baseCooldown??s.cooldown)*(s.resolution?.encounterCooldownMultiplier??1),totalCap=s.resolution?.cooldownCap??.75,key='hex-cooldown-budget#'+id;
  const budget=Math.floor(Math.min(final*policy.cooldownReductionCap,Math.max(0,final-base*(1-totalCap)))+1e-9),used=this.comboCounts[key]??0;
  let scale=1;if(wanted>=1&&budget>used&&this.remainingCooldown(s)>0&&mechanism&&hexResetMechanisms.has(mechanism)&&policy.resetSecondaryScale!==undefined){if(this.hexResetFrame?.tick!==this.tick)this.hexResetFrame={tick:this.tick,first:mechanism};if(this.hexResetFrame.first!==mechanism)scale=policy.resetSecondaryScale;}
  const amount=Math.max(0,Math.min(Math.floor(wanted*scale),budget-used,this.remainingCooldown(s)));
  if(amount){this.comboCounts[key]=used+amount;this.adjustCooldown(id,amount);}return amount;
 }
 private adjustCooldown(id:string,ticks:number,reset=false){const skill=this.skills.find(s=>s.id===id);if(skill&&(skill.charges??1)>1){this.chargeInfo(skill);this.skillCharges[id]=reduceSkillChargeCooldown(this.skillCharges[id],this.tick,ticks,reset);const ready=this.chargeInfo(skill);this.cooldowns[id]=this.tick+(ready.available?0:ready.next);}else this.cooldowns[id]=reset?this.tick:Math.max(this.tick,(this.cooldowns[id]??0)-ticks);}
 private finalCooldown(s:Skill){return s.resolution?.finalCooldown??Math.max(1,Math.round(s.cooldown*(1-Math.max(0,Math.min(.75,this.stats.cdr??0)))));}
 skillReadiness(id:string){const s=this.skills.find(s=>s.id===id);const charge=s&&(s.charges??1)>1?this.chargeInfo(s):undefined;return {cooldown:charge?charge.available?0:charge.next:Math.max(0,(this.cooldowns[id]??0)-this.tick),...(charge?{charges:charge.available,maxCharges:s!.charges,nextCharge:charge.next}:{}),busy:this.pending.length>0||this.sequences.some(q=>q.sourceId===this.playerId),controlled:this.actionBlocked(this.playerId)||this.hasStatus(this.playerId,'silence')||s?.kind==='dash'&&this.movementBlocked(this.playerId),resource:!!s&&(this.hero.mana>=s.cost||this.buffFlag('freeCost',s))};}
 private activeStatuses(id:string){return this.statuses.filter(x=>x.targetId===id&&x.ends>this.tick);}
 hasStatus(id:string,kind:StatusKind){return this.statuses.some(x=>x.targetId===id&&x.ends>this.tick&&x.effect.kind===kind);}
 private strength(id:string,kind:StatusKind){const all=this.activeStatuses(id).filter(x=>x.effect.kind===kind);return all.filter(x=>x.effect.stackMode==='independent').reduce((n,x)=>n+x.effect.strength,0)+Math.max(0,...all.filter(x=>x.effect.stackMode!=='independent').map(x=>x.effect.strength));}
 private actionBlocked(id:string){return this.statuses.some(x=>x.targetId===id&&x.ends>this.tick&&(x.effect.kind==='stun'||x.effect.kind==='petrify'||x.effect.kind==='time_stop'||x.effect.kind==='freeze'));}
 private movementBlocked(id:string){return this.actionBlocked(id)||this.hasStatus(id,'root');}
 effectiveStats(id=this.playerId):Stats{const base=this.players.get(id)?.stats??this.stats;return {...base,attack:Math.round(base.attack*(1+this.strength(id,'attack_up'))),speed:base.speed*(this.region.sprint&&this.tick-((id===this.playerId?this.combatAt:this.players.get(id)?.combatAt)??0)>=(this.rules.encounterBalance.openWorldSprint?.calmTicks??90)?this.rules.encounterBalance.openWorldSprint?.speedMultiplier??1.4:1)*(1+this.strength(id,'speed_up'))*(1+(id===this.playerId?this.buffValue('speedPercent'):0))*(1-this.strength(id,'slow')),armor:Math.round(base.armor*(1-this.strength(id,'armor_down')))};}
 private enemyAttack(e:Entity){return Math.round(e.attack*(1+this.strength(e.id,'attack_up'))*(e.boss&&this.bossClock?.enraged?this.rules.encounterBalance.starseaBossEnrage?.attackMultiplier??1:1));}
 private enemySpellAttack(e:Entity){const rule=this.rules.encounterBalance.starseaBossContact,scales:Record<string,number>=rule?.spellScales??{},scale=e.monster?.template.startsWith(rule?.templatePrefix??'ss-')?scales[e.monster?.bossKey??this.bossKey(e)]??1:1;return this.enemyAttack(e)*scale;}
 /** 星潮海首领战狂暴计时：首领受伤或进入警戒距离时开始计时，到时首领攻击翻倍（不判负）。旧冻结规则没有此项时不计时。 */
 private stepBossClock(){
  const rule=this.rules.encounterBalance.starseaBossEnrage;if(!rule||!this.region.id.startsWith(rule.regionPrefix)||this.bossClock?.enraged)return;
  const boss=this.enemies.find(e=>e.boss&&e.alive);if(!boss)return;
  if(!this.bossClock){if(boss.hp<boss.maxHp||distance(boss.position,this.hero.position)<=this.rules.aiRules.activeRadius)this.bossClock={started:this.tick,limit:rule.seconds*30,enraged:false};return;}
  if(this.tick-this.bossClock.started>=this.bossClock.limit)this.bossClock.enraged=true;
 }
 private scaledDamage(s:Skill,amount=s.damage){return Math.round(amount*(1+(s.resolution?.attackShare??0)*this.strength(this.playerId,'attack_up')));}
 private actorPosition(id:string):Vec|undefined{return this.players.get(id)?.hero.position??this.enemies.find(e=>e.id===id)?.position??(id===this.playerId?this.hero.position:undefined);}
 private actorAlive(id:string){return this.players.has(id)?this.isActive(id)&&this.players.get(id)!.hero.hp>0:this.enemies.some(e=>e.id===id&&e.alive)||!this.players.size&&id===this.playerId&&this.hero.hp>0;}
 private statusEvent(x:StatusInstance,change:NonNullable<CombatEvent['change']>){if(['resisted','immune'].includes(change)){const key=x.id+':'+change;if((this.statusFeedbackAt.get(key)??-30)+30>this.tick)return;this.statusFeedbackAt.set(key,this.tick);}this.emit({type:'status_changed',id:x.targetId,sourceId:x.sourceId,targetId:x.targetId,castId:x.castId,position:{...(this.actorPosition(x.targetId)??x.sourcePosition)},skill:x.skill,status:x.effect.kind,change,duration:Math.max(0,x.ends-this.tick),amount:x.effect.strength,tick:this.tick,vfxKey:'status/'+x.effect.kind});}
 applyStatus(targetId:string,effect:StatusEffectInput,sourceId=this.vfxContext?.sourceId??this.playerId,skill='status',skillContext?:Skill){
  let def=statusEffectSchema.parse(effect);const target=this.enemies.find(e=>e.id===targetId),policy=this.rules.statusPolicy??statusPolicy;if(sourceId===this.playerId){for(const b of this.effectBuffs(skillContext??this.skills.find(s=>s.id===skill),target)){if(b.action.statusMultipliers?.[def.kind])def={...def,duration:Math.max(1,Math.round(def.duration*b.action.statusMultipliers[def.kind]!))};if(b.action.statusOverrides?.[def.kind])def={...def,...b.action.statusOverrides[def.kind]};}if(target&&def.duration)def={...def,duration:Math.max(1,Math.round(def.duration*(1+this.conditionalValue('statusDuration'))))};}if(def.kind==='freeze'&&target?.boss)def={...def,kind:'slow',strength:.5,maxStacks:1,onStacks:undefined};
  const resolvedSource=skillContext??this.skills.find(s=>s.id===skill);const instance:StatusInstance={...(resolvedSource?.runtimeEffects?.hexDamageFactor!==undefined?{hexDamageFactor:resolvedSource.runtimeEffects.hexDamageFactor}:{}),...(resolvedSource?.resolution?.typeAdd!==undefined?{typeAdd:resolvedSource.resolution.typeAdd}:{}),id:sourceId+':'+targetId+':'+skill+':'+def.kind,sourceId,targetId,skill,castId:this.vfxContext?.castId,effect:structuredClone(def),...(skill.startsWith('atom-')||skill.startsWith('aspect-')&&!isComboRuleId(skill)?{vfxKey:this.vfxContext?.vfxKey??combatRules(this.stats).find(r=>r.id===skill)?.vfxKey}:{}),started:this.tick,ends:this.tick+def.duration,baseEnds:this.tick+def.duration,next:this.tick+(def.interval??def.duration),emitted:0,sourcePosition:{...(this.actorPosition(sourceId)??this.hero.position)},penetration:Math.max(0,Math.min(1,this.players.get(sourceId)?.stats.penetration??(sourceId===this.playerId?this.stats.penetration??0:0)))};
  if(!this.actorAlive(targetId))return false;
  if(target?.boss&&policy.boss.immune.includes(def.kind)){this.statusEvent(instance,'immune');return false;}
  if(target?.boss&&(policy.boss.uninterruptibleCastImmune??statusPolicy.boss.uninterruptibleCastImmune).includes(def.kind)&&this.bossCasts.some(c=>{const ability=this.getBossDefinition(this.bossKey(target))?.skills.find(s=>s.id===c.skill);return c.owner===targetId&&!c.resolved&&!(ability&&'interruptible' in ability&&ability.interruptible); })){this.statusEvent(instance,'immune');return false;}
  if(target?.boss&&['slow','stun','silence','petrify','fear','root','blind','time_stop','armor_down'].includes(def.kind)){
   instance.ends=this.tick+Math.max(1,Math.round(def.duration*policy.boss.durationScale));this.statusEvent(instance,'resisted');
  }
  const limit=def.maxStacks??1,group=this.activeStatuses(targetId).filter(x=>x.sourceId===sourceId&&x.effect.kind===def.kind&&(limit===1||x.skill===skill));
  if(limit>1){
   if(group.length>=limit){const oldest=group.sort((a,b)=>a.ends-b.ends||a.started-b.started)[0];this.removeStatus(oldest,'consumed');}
   if(def.stackMode!=='independent')for(const prior of group)prior.ends=instance.ends;
   instance.id+=':'+ ++this.serial;this.statuses.push(instance);this.statusEvent(instance,'applied');
  }else{const prior=this.statuses.find(x=>x.id===instance.id);if(prior){prior.ends=instance.ends;prior.baseEnds=instance.baseEnds;prior.effect=instance.effect;if(instance.hexDamageFactor===undefined)delete prior.hexDamageFactor;else prior.hexDamageFactor=instance.hexDamageFactor;prior.penetration=instance.penetration;prior.sourcePosition=instance.sourcePosition;this.statusEvent(prior,'refreshed');}else{this.statuses.push(instance);this.statusEvent(instance,'applied');}}
  if(sourceId===this.playerId&&target)this.fireEffects('status_apply',target,0,undefined,[...this.activeStatuses(targetId)],0,false,def.kind);
  if(def.onStacks){const current=this.activeStatuses(targetId).filter(x=>x.sourceId===sourceId&&x.effect.kind===def.kind&&x.skill===skill);if(current.length>=def.onStacks.at){for(const prior of current.slice(0,def.onStacks.consume))this.removeStatus(prior,'consumed');this.applyStatus(targetId,statusEffectSchema.parse({kind:def.onStacks.convert,duration:def.onStacks.duration,strength:0,scope:'hit',cleanse:true}),sourceId,skill);return true;}}
  if(target&&def.kind==='burn')target.burn=instance.ends;if(target&&def.kind==='slow')target.slow=instance.ends;
  if(['stun','petrify','time_stop','freeze'].includes(def.kind))this.interruptActor(targetId);
  return true;
 }
 private interruptActor(id:string){this.monsterPending=this.monsterPending.filter(x=>x.owner!==id);this.sequences=this.sequences.filter(x=>x.sourceId!==id);if(this.players.has(id)||id===this.playerId)this.forPlayer(id,()=>{this.pending=[];this.echoes=[];this.hero.actionUntil=this.tick;});for(const c of this.bossCasts)if(c.owner===id&&!c.resolved){c.interrupted=true;c.resolved=true;c.expires=this.tick+15;}}
 private removeStatus(x:StatusInstance,change:NonNullable<CombatEvent['change']>){this.statuses=this.statuses.filter(s=>s!==x);this.statusEvent(x,change);const enemy=this.enemies.find(e=>e.id===x.targetId);if(enemy&&x.effect.kind==='burn')enemy.burn=Math.max(0,...this.activeStatuses(enemy.id).filter(s=>s.effect.kind==='burn').map(s=>s.ends));if(enemy&&x.effect.kind==='slow')enemy.slow=Math.max(0,...this.activeStatuses(enemy.id).filter(s=>s.effect.kind==='slow').map(s=>s.ends));}
 clearStatuses(id:string,reason:'cleansed'|'death'='cleansed'){for(const x of [...this.statuses])if(x.targetId===id&&(reason==='death'||x.effect.cleanse))this.removeStatus(x,reason);}
 private advanceStatuses(){for(const [key,at]of this.statusFeedbackAt)if(at+60<this.tick)this.statusFeedbackAt.delete(key);for(const x of [...this.statuses]){
  if(!this.statuses.includes(x))continue;
  if(!this.actorAlive(x.targetId)){this.removeStatus(x,'death');continue;}
  if(x.effect.removeWithSource&&!this.actorAlive(x.sourceId)){this.removeStatus(x,'source_lost');continue;}
  const effect=x.effect;
  if(effect.interval&&x.next<=this.tick&&x.next<=x.ends){
   const count=Math.max(1,Math.floor(effect.duration/effect.interval)),amount=splitBudget(effect.total??0,count,x.emitted%count);x.next+=effect.interval;x.emitted++;
   const target=this.enemies.find(e=>e.id===x.targetId);
   const vfx={castId:x.castId,sourceId:x.sourceId,targetId:x.targetId,vfxKey:'status/'+effect.kind};
   if(['burn','poison','bleed'].includes(effect.kind)){const context:DamageContext={...(x.hexDamageFactor!==undefined?{hexDamageFactor:x.hexDamageFactor}:{}),category:'periodic',damageType:effect.damageType!,statusKind:effect.kind,...(x.typeAdd!==undefined?{typeAdd:x.typeAdd}:{}),penetration:x.penetration,scaled:true};if(target){const run=()=>this.withVfx(vfx,()=>this.damage(target,amount,true,x.skill,context));if(this.players.has(x.sourceId))this.forPlayer(x.sourceId,run);else run();}else this.forPlayer(x.targetId,()=>this.withVfx(vfx,()=>this.hurt(amount,x.skill,context)));}
   if(effect.kind==='regen')this.withVfx(vfx,()=>this.forPlayer(x.targetId,()=>this.restoreResources(amount,0,x.skill)));
   if(effect.hpDrainRatio)this.forPlayer(x.targetId,()=>{const loss=Math.min(Math.max(0,this.hero.hp-1),Math.round(this.stats.hp*effect.hpDrainRatio!));this.hero.hp-=loss;this.emit({...vfx,type:'hit_resolved',id:x.targetId,position:{...this.hero.position},amount:loss,skill:x.skill,category:'periodic',damageType:'pure',tick:this.tick});});
  }
  if(this.tick>=x.ends)this.removeStatus(x,'expired');
 }}
 private restoreResources(hp:number,mana:number,skill:string){
  if(this.hero.hp<=0)return;hp*=1+this.conditionalValue('healingReceived');
  let healed=Math.min(hp,this.stats.hp-this.hero.hp),restored=Math.min(mana,this.stats.mana-this.hero.mana);
  if(this.hexResourceSource(skill)){if(healed>0)healed=this.reserveHexRecovery(healed);if(restored>0)restored=this.reserveHexMana(restored);}
  this.hero.hp+=healed;this.hero.mana+=restored;
  if(hp>0)this.emit({...this.vfxContext,type:'healed',id:this.playerId,targetId:this.playerId,position:{...this.hero.position},amount:healed,skill,tick:this.tick});
  if(mana>0)this.emit({...this.vfxContext,type:'resource_restored',id:this.playerId,targetId:this.playerId,position:{...this.hero.position},amount:restored,skill,tick:this.tick});
 }
 private pullEnemy(e:Entity,center:Vec,amount:number){const actual=amount*(e.boss?(this.rules.statusPolicy??statusPolicy).boss.pullScale:1),before={...e.position};if(!actual){this.emit({...this.vfxContext,type:'status_changed',id:e.id,position:before,skill:'pull',change:'resisted',amount:0,tick:this.tick});return;}this.moveEnemy(e,center,actual,false);const moved=distance(before,e.position);if(moved>0)this.emit({...this.vfxContext,type:'displaced',id:e.id,position:{...e.position},origin:before,amount:moved,skill:'pull',tick:this.tick});}
 private refreshSpatial(force=false){if(force||!this.region.activationRadius||this.spatialCount!==this.enemies.length){this.grid.rebuild(this.enemies.filter(e=>e.alive));this.spatialCount=this.enemies.length;this.spatialOrder=new Map(this.enemies.map((e,i)=>[e,i]));}}
 private nearbyEnemies(p:Vec,radius:number){if(this.region.activationRadius&&this.spatialCount!==this.enemies.length)this.refreshSpatial();return this.region.activationRadius?this.grid.near(p,radius).filter(e=>e.alive).sort((a,b)=>this.spatialOrder.get(a)!-this.spatialOrder.get(b)!):this.enemies;}
 private activeEnemies(){if(!this.region.activationRadius)return this.enemies;const active=new Set<Entity>();for(const player of this.livingPlayers())for(const e of this.grid.near(player.position,this.region.activationRadius))if(e.alive&&distance(e.position,player.position)<=this.region.activationRadius)active.add(e);return [...active].sort((a,b)=>this.spatialOrder.get(a)!-this.spatialOrder.get(b)!);}
 simulationDiagnostics(){this.refreshSpatial();return {loaded:this.enemies.length,living:this.enemies.filter(e=>e.alive).length,active:this.activeEnemies().filter(e=>e.alive).length,activationRadius:this.region.activationRadius??null,spatialCellSize:this.region.activationRadius?8:2};}
 step(){
 if(this.defense&&this.defense.hp<=0)this.defense.failed=true;
 this.downedInDefense();
 // 引擎被毁后袭击者撤离、战斗继续推进：玩家仍可自由走动，靠近引擎修复后重开新一轮。
 if(this.defense?.failed)for(const e of this.enemies)if(e.alive&&this.defense.enemyIds.includes(e.id))e.alive=false;
 if(this.paused||!this.players.size&&this.hero.hp<=0)return;this.tick++;if([...this.players.values()].some(p=>p.activeFrom===this.tick))this.separatePlayerBodies();this.stepping=true;this.events=this.inputEvents.splice(0);
 this.refreshSpatial();this.advanceStatuses();this.stepBossClock();
 if(this.region.activationRadius){const awake=this.activeEnemies(),ids=new Set(awake.map(e=>e.id));if(awake.some(e=>!this.awakeIds.has(e.id)))this.separatedCount=-1;this.awakeIds=ids;}
 if(this.separatedCount!==this.enemies.length||this.grid.near(this.hero.position,2).some(e=>e.alive&&distance(e.position,this.hero.position)<this.bodyRadius(e)+this.rules.bodyCollision.heroRadius-1e-5))this.separateBodies();
 this.refreshSpatial();
 if(this.players.size){for(const p of this.players.values())if(this.isActive(p.id))this.forPlayer(p.id,()=>this.stepTrackedHero());}else this.stepTrackedHero();
 this.advanceSequences();
 const monsterReady=this.monsterPending.filter(p=>p.at<=this.tick);this.monsterPending=this.monsterPending.filter(p=>p.at>this.tick);for(const pending of monsterReady)this.releaseMonster(pending);
 this.resolveBossCasts();
 this.updateWarnings();  // 新增：更新预警UI
 this.refreshSpatial();
 for(const e of this.activeEnemies()){if(!e.alive)continue;
 if(e.burn>this.tick&&this.tick%30===0&&!this.statuses.some(x=>x.targetId===e.id&&x.effect.kind==='burn'))this.damage(e,this.rules.effects.burnDamage,true,'burn',{category:'periodic',damageType:'fire',penetration:0,scaled:true});
 if(!e.alive)continue;const target=this.players.size?[...this.players.values()].filter(p=>this.isActive(p.id)&&p.hero.hp>0).sort((a,b)=>distance(a.hero.position,e.position)-distance(b.hero.position,e.position)||a.id.localeCompare(b.id))[0]:undefined;if(this.players.size&&!target)continue;if(target)this.forPlayer(target.id,()=>this.enemyStep(e));else this.enemyStep(e);
 }
 this.refreshSpatial();
 for(const p of this.projectiles){
  if(p.orbit){this.advanceOrbit(p);continue;}
  if(p.hexHoming&&!this.enemies.some(e=>e.id===p.targetId&&e.alive)){
   const target=this.enemies.filter(e=>e.alive).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position)||a.id.localeCompare(b.id))[0];
   if(!target){p.life=0;continue;}p.targetId=target.id;
  }
  if(p.turnRate&&p.targetId){const target=this.enemies.find(e=>e.id===p.targetId&&e.alive);if(target&&lineOfSight(this.region,p.position,target.position)){const angle=Math.atan2(p.direction.y,p.direction.x),desired=Math.atan2(target.position.y-p.position.y,target.position.x-p.position.x),delta=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle)),heading=angle+Math.max(-p.turnRate,Math.min(p.turnRate,delta));p.direction={x:Math.cos(heading),y:Math.sin(heading)};p.target={...target.position};}}
  if(p.returning){const back=this.actorPosition(p.owner??this.playerId)??p.origin!;const d=distance(p.position,back);if(d<.5){p.life=0;continue;}p.direction={x:(back.x-p.position.x)/d,y:(back.y-p.position.y)/d};p.target={...back};}
  const from={...p.position},to={x:from.x+p.direction.x*this.rules.aiRules.projectileSpeed,y:from.y+p.direction.y*this.rules.aiRules.projectileSpeed};p.previous=from;p.life--;
  const radius=p.radius??.15,wall=terrainContact(this.region,from,to,radius);
  const contacts=p.enemy?[...this.livingPlayers(),...(this.defense&&this.defense.hp>0?[{id:'ss-engine',position:this.defense.position}]:[])].filter(h=>!p.hit.has(h.id)).map(h=>({entity:null as Entity|null,player:h.id,t:segmentContact(from,to,h.position,this.rules.aiRules.projectileHitRadius)})):this.grid.near(from,this.rules.aiRules.projectileSpeed+radius+this.rules.bodyCollision.bossRadius).filter(e=>e.alive&&!p.hit.has(e.id)&&(!p.hexHoming||e.id===p.targetId)).map(entity=>({entity,player:'',t:segmentContact(from,to,entity.position,this.bodyRadius(entity)+radius)}));
  contacts.sort((a,b)=>(a.t??Infinity)-(b.t??Infinity));let end=wall??1;
  for(const contact of contacts){if(contact.t===null||contact.t>end)continue;
   const impact={x:from.x+(to.x-from.x)*contact.t!,y:from.y+(to.y-from.y)*contact.t!};
   if(contact.entity){p.hit.add(contact.entity.id);this.withVfx({...p,projectileId:p.id,contact:impact},()=>{
    if(p.explosionRadius){this.emit({...p,type:'effect_activated',id:p.sourceId??this.playerId,position:impact,radius:p.explosionRadius,duration:12,skill:p.skill,tick:this.tick});for(const e of this.nearbyEnemies(impact,p.explosionRadius+this.rules.bodyCollision.bossRadius))if(e.alive&&(e.id===contact.entity!.id||distance(impact,e.position)<=p.explosionRadius+this.bodyRadius(e))&&lineOfSight(this.region,impact,e.position))this.hitSkill(e,p.resolvedSkill!,p.damage,true,p.part);}
    else if(p.resolvedSkill)this.hitSkill(contact.entity!,p.resolvedSkill,p.damage,true,p.part);else {const landed=this.damage(contact.entity!,p.damage,false,p.skill,{category:p.comboDepth?'derived':'direct',damageType:p.damageType??'physical',scaled:true,...(p.comboDepth?{comboDepth:p.comboDepth}:{})});if(landed&&contact.entity!.alive&&p.statusOnHit)this.applyStatus(contact.entity!.id,p.statusOnHit,p.sourceId??this.playerId,p.ruleId??p.skill??'effect');}
   });}else if(contact.player==='ss-engine')this.hurtDefense(p.damage);else this.forPlayer(contact.player,()=>this.withVfx({...p,projectileId:p.id,contact:impact},()=>{const landed=this.hurt(p.damage,p.skill,{category:'direct',damageType:p.damageType??this.enemyDamageType(p.skill),scaled:true});if(landed&&this.hero.hp>0&&p.skill?.startsWith('island_'))for(const effect of this.rules.monsterSkills[p.skill]?.statuses??[])this.applyStatus(this.playerId,effect,p.sourceId??'enemy',p.skill);}));
   if(!p.returns&&p.penetrations!==undefined){if(p.penetrations<=0){end=contact.t;p.life=0;break;}p.penetrations--;}
   else if(!p.returns&&(!p.pierce||p.enemy)){end=contact.t;p.life=0;break;}
  }
  p.position={x:from.x+(to.x-from.x)*end,y:from.y+(to.y-from.y)*end};if(wall!==null)p.life=0;if(p.life<=0&&p.returns&&!p.returning){p.returning=true;p.hit.clear();p.life=Math.max(1,Math.ceil(distance(p.position,this.actorPosition(p.owner??this.playerId)??p.origin!)/this.rules.aiRules.projectileSpeed)+2);}
 }
 this.projectiles=this.projectiles.filter(p=>p.life>0);
 for(const z of this.zones){
  if(z.resolvedSkill){this.advanceZone(z);continue;}
  z.delay--;if(z.delay>0)continue;if(z.life>0&&!z.visualActivated){z.visualActivated=true;this.events.push({castId:z.castId??z.id,sourceId:z.sourceId,vfxKey:z.vfxKey??(z.enemy?'monster/basic-area':'player/'+(z.skill??'ember')),type:'effect_activated',id:z.sourceId??(z.enemy?'enemy':'hero'),position:{...z.position},radius:z.radius,duration:z.life,skill:z.skill,tick:this.tick});}z.life--;if(z.life%30===0){if(z.enemy){for(const h of this.livingPlayers())if(distance(z.position,h.position)<z.radius&&lineOfSight(this.region,z.position,h.position))this.forPlayer(h.id,()=>this.withVfx(z,()=>{const landed=this.hurt(z.damage,z.skill,{category:z.started!==undefined&&z.life>0?'periodic':'direct',damageType:z.damageType??this.enemyDamageType(z.skill),scaled:true});if(landed&&this.hero.hp>0)for(const effect of this.rules.monsterSkills[z.skill??'']?.statuses??[])this.applyStatus(this.playerId,effect,z.sourceId??'enemy',z.skill!);}));}
  else for(const e of this.nearbyEnemies(z.position,z.radius))if(e.alive&&distance(z.position,e.position)<z.radius&&lineOfSight(this.region,z.position,e.position)){this.withVfx(z,()=>this.damage(e,z.damage,false,z.skill));if(z.slow)e.slow=this.tick+45;}
 }
 if(z.enemy&&z.slow)for(const h of this.livingPlayers())if(distance(z.position,h.position)<z.radius&&lineOfSight(this.region,z.position,h.position))this.withVfx(z,()=>this.applyStatus(h.id,statusEffectSchema.parse({kind:'slow',duration:2,strength:.4,scope:'zone',cleanse:true}),z.sourceId??'enemy',z.skill??'basic-area'));
 }this.zones=this.zones.filter(z=>z.life>0);
 this.downedInDefense();
 if(this.defense){const d=this.defense;if(d.hp<=0)d.failed=true;else if(!d.failed&&!d.complete){if(distance(this.hero.position,d.position)<=d.radius)d.heldTicks=Math.min(d.requiredTicks,d.heldTicks+1);d.complete=d.heldTicks>=d.requiredTicks&&!this.enemies.some(e=>d.enemyIds.includes(e.id)&&e.alive);}}
 if(this.separatedCount!==this.enemies.length)this.separateBodies();this.stepping=false;
 if(!this.players.size&&this.hero.hp<=0)this.stop('你已倒下，请返回安全点。');
 }
 private stepTrackedHero(){this.stepEffects();const before={...this.hero.position};this.effectLastPosition=before;this.stepHero();this.effectMoved+=distance(before,this.hero.position);if(distance(before,this.hero.position)>.001){this.conditionClock.moving++;this.conditionClock.still=0;}else{this.conditionClock.still++;this.conditionClock.moving=0;}}
 private stepHero(){if(this.hero.hp<=0){this.interruptActor(this.playerId);this.clearStatuses(this.playerId,'death');return;}
  if(this.region.sprint){const radius=this.region.aggroRadius??this.rules.aiRules.activeRadius;if(this.defensiveThreat()||this.nearbyEnemies(this.hero.position,radius).some(e=>e.alive&&!e.returning&&distance(e.position,this.hero.position)<=radius&&lineOfSight(this.region,e.position,this.hero.position)))this.combatAt=this.tick;}
  this.hero.mana=Math.min(this.stats.mana,this.hero.mana+this.stats.regen/30);
 if(this.hero.shieldUntil<=this.tick){if(this.hero.shield>0)this.recordShield('shield_expire');this.hero.shield=0;}
 if(this.region.id==='town'||this.region.rest)this.hero.hp=Math.min(this.stats.hp,this.hero.hp+2);
 // 脱战回复：地图声明 calmRegen 时，4 秒未受伤后每秒回复该比例的生命，让一组怪物之间可以喘口气。
 else if(this.region.calmRegen&&this.tick-(this.hurtAt??-outOfCombatTicks)>=outOfCombatTicks)this.hero.hp=Math.min(this.stats.hp,this.hero.hp+this.stats.hp*this.region.calmRegen/30);
 const h=this.hero.position;
 if(this.hasStatus(this.playerId,'fear')){const status=this.activeStatuses(this.playerId).find(s=>s.effect.kind==='fear')!,source=this.actorPosition(status.sourceId)??status.sourcePosition;this.moveHero({x:h.x+(h.x-source.x),y:h.y+(h.y-source.y)});}
 else if(this.input.x||this.input.y){const length=Math.hypot(this.input.x,this.input.y);this.moveHero({x:h.x+this.input.x/length,y:h.y+this.input.y/length});}
 else if(this.castIntent)this.advanceCastIntent();
 else if(this.destination){if(distance(h,this.destination)<.3){this.destination=undefined;this.path=[];}else this.follow();}
 else if(this.mode==='auto')this.autoMove();
 else if(this.mode==='semi'&&this.bossNeedsApproach())this.autoMove(true);
 else if(this.hero.actionUntil<this.tick)this.hero.action='idle';
 this.stepEchoes();const ready=this.pending.filter(p=>p.at<=this.tick);this.pending=this.pending.filter(p=>p.at>this.tick);
 for(const p of ready)this.withVfx(p.vfx,()=>{const ally=(p as any).ally?this.players.get((p as any).ally):undefined;if((p as any).ally){if(!ally?.active||ally.hero.hp<=0||distance(this.hero.position,ally.hero.position)>this.supportRange&&this.supportRange>0||!lineOfSight(this.region,this.hero.position,ally.hero.position))return;if(p.skill.mechanics)this.executeDeclared(p.skill,undefined,p.position,0,ally.id);else{this.events.push({...p.vfx,type:'cast_released',id:this.playerId,position:{...this.hero.position},target:{...ally.hero.position},skill:p.skill.id,tick:this.tick});if(p.skill.kind==='heal')ally.hero.hp=Math.min(ally.stats.hp,ally.hero.hp+p.skill.damage);else{ally.hero.shield=p.skill.damage;ally.hero.shieldUntil=this.tick+p.skill.duration;}}}else this.execute(p.skill,p.target,p.position);});
 if(!this.castIntent&&this.region.id!=='town'&&!this.region.rest&&this.mode!=='manual'&&this.autoSkills&&(!this.players.size||this.players.get(this.playerId)?.connected)){const target=this.closest();for(const s of this.skills){
  if(this.stats.weapon!==undefined&&!permitsWeapon(s.weapons,this.stats.weapon))continue;
  if(s.mechanics?.statuses.some(e=>e.scope==='self'&&this.hasStatus(this.playerId,e.kind)))continue;
  if(s.mechanics?.targeting==='direction'){if(this.defensiveThreat()&&this.cast(s.id,undefined,this.escapePoint(s.range)))break;continue;}
  if(s.kind==='heal'&&this.supportRange>0){this.savePlayer();const ally=[...this.players.values()].filter(p=>p.active&&p.hero.hp>0&&p.stats.hp-p.hero.hp>0&&distance(p.hero.position,this.hero.position)<=this.supportRange).sort((a,b)=>(b.stats.hp-b.hero.hp)-(a.stats.hp-a.hero.hp)||a.id.localeCompare(b.id))[0];if(ally&&this.castAlly(this.playerId,ally.id,s.id,this.supportRange))break;}
  // Ground areas aim at the densest cluster in reach when that hits at least 3 (grind-feel §7).
  if(s.mechanics?.targeting==='ground'&&s.radius>0){const spot=this.densestSpot(s.range,s.radius);if(spot&&spot.hits>=3&&this.cast(s.id,target,spot.point))break;}
  if(s.kind==='dash'&&(!target||distance(this.hero.position,target.position)>autoDashMaxDistance))continue;
  if((s.kind!=='shield'||this.defensiveThreat())&&this.cast(s.id,target))break;
 }}

 }
 private cancelCastIntent(){if(this.castIntent){this.castIntent=null;this.path=[];this.pathGoal='';}}
 private castApproachPath(target:Entity){
  const h=this.hero.position,bodies=[...this.enemyBodies(h,distance(h,target.position)+4),...this.playerBodies(this.playerId)].filter(b=>b.id!==target.id&&distance(b.position,h)>b.radius+this.rules.bodyCollision.heroRadius);
  const obstacles=bodies.map(b=>({x:b.position.x-b.radius,y:b.position.y-b.radius,w:b.radius*2,h:b.radius*2}));
  return findPath({...this.region,dynamicObstacles:[...this.region.dynamicObstacles??[],...obstacles]},h,target.position,this.rules.bodyCollision.heroRadius);
 }
 private advanceCastIntent(){
  const intent=this.castIntent!,target=this.enemies.find(e=>e.id===intent.targetId&&e.alive),s=this.skills.find(s=>s.id===intent.skill);
  if(!target||!s||this.tick>=intent.until||this.actionBlocked(this.playerId)||this.movementBlocked(this.playerId)||this.hasStatus(this.playerId,'silence')){this.cancelCastIntent();return;}
  const range=s.kind==='area'?s.radius+1.5:s.range;
  if(distance(this.hero.position,target.position)<=range&&lineOfSight(this.region,this.hero.position,target.position)){this.cancelCastIntent();this.cast(s.id,target);return;}
  const goal=`${Math.floor(target.position.x)},${Math.floor(target.position.y)}`;
  if(this.pathGoal!==goal||!this.path.length||this.stuck>3){this.pathGoal=goal;this.path=this.castApproachPath(target);}
  this.follow();
 }
 private autoAttackStopRange(){const primary=this.skills.find(s=>s.damage>0&&!['heal','shield'].includes(s.kind)),orbit=primary?.mechanics?.projectile?.orbit;return orbit?Math.max(.6,orbit.radius-.4):this.skills.some(s=>s.kind==='projectile')?7:this.meleeStopRange();}
 private meleeStopRange(){const primary=this.skills.find(s=>s.kind==='single');return primary?Math.min(primary.range-.4,2.6):2.6;}
 private defensiveThreat():boolean{
 const h=this.hero.position;
 if(this.enemies.some(e=>e.alive&&distance(e.position,h)<=this.monsterAi(e).range&&lineOfSight(this.region,e.position,h)))return true;
 if(this.zones.some(z=>z.enemy&&z.life>0&&distance(z.position,h)<z.radius))return true;
 // An enemy can die while its projectile is still approaching the player.
 return this.projectiles.some(p=>{if(!p.enemy||p.life<=0)return false;const dx=h.x-p.position.x,dy=h.y-p.position.y,along=dx*p.direction.x+dy*p.direction.y;
 if(along<0||along>p.life*this.rules.aiRules.projectileSpeed)return false;
 const nearest={x:p.position.x+p.direction.x*along,y:p.position.y+p.direction.y*along};
 return distance(nearest,h)<this.rules.aiRules.projectileHitRadius&&lineOfSight(this.region,p.position,h);
 });
 }
 private moveHero(to:Vec){if(this.movementBlocked(this.playerId))return;if(this.mode==='auto'&&this.autoBounds){const b=this.autoBounds,d=distance(to,b.center);if(d>b.radius)to={x:b.center.x+(to.x-b.center.x)*b.radius/d,y:b.center.y+(to.y-b.center.y)*b.radius/d};}const before=this.hero.position,amount=this.effectiveStats().speed/30*(this.heroSlowUntil>this.tick&&!this.hasStatus(this.playerId,'slow')?.6:1),bodies=[...this.enemyBodies(before,2),...this.playerBodies(this.playerId)];
 this.hero.position=moveBody(this.region,before,to,amount,this.rules.bodyCollision.heroRadius,bodies);
 if((this.mode==='auto'||this.castIntent)&&distance(before,this.hero.position)<amount*.2){
  const heading=Math.atan2(to.y-before.y,to.x-before.x),options=[-Math.PI/3,Math.PI/3,-Math.PI/2,Math.PI/2].map(angle=>moveBody(this.region,before,{x:before.x+Math.cos(heading+angle),y:before.y+Math.sin(heading+angle)},amount,this.rules.bodyCollision.heroRadius,bodies)).filter(p=>distance(p,before)>amount*.5);
  const next=options.sort((a,b)=>distance(a,to)-distance(b,to))[0];if(next)this.hero.position=next;
 }
 this.hero.facing=screenFacing(before,to,this.hero.facing);
 if(distance(before,this.hero.position)<.002)this.stuck++;else this.stuck=0;
 if(this.hero.actionUntil<this.tick)this.hero.action='move';
 }
 /** Living enemy position in `range` whose `radius` covers the most living enemies. */
 densestSpot(range:number,radius:number){
  const h=this.hero.position,near=this.nearbyEnemies(h,range+radius).filter(e=>e.alive&&!e.returning);let best:{point:Vec;hits:number}|undefined;
  for(const e of near){if(distance(e.position,h)>range||!lineOfSight(this.region,h,e.position))continue;const hits=near.filter(o=>distance(o.position,e.position)<=radius).length;
   if(!best||hits>best.hits||hits===best.hits&&distance(e.position,h)<distance(best.point,h))best={point:{...e.position},hits};}
  return best;
 }
 private follow(){if(!this.path.length)return;const p=this.path[0];if(distance(this.hero.position,p)<.25)this.path.shift();else this.moveHero(p);}
 private autoMove(approachOnly=false){
 if(this.stuck>90){this.stop('当前位置无法继续自动战斗，请移动到可通行区域。');return;}
 const h=this.hero.position;
 const sceneBoss=this.soloBossTarget();if(sceneBoss){this.anchor={...sceneBoss.position};this.targetId=sceneBoss.id;}
 const candidates=sceneBoss?[sceneBoss]:this.nearbyEnemies(this.anchor,this.radius).filter(e=>e.alive&&distance(e.position,this.anchor)<=this.radius&&(this.avoidElite? !e.elite:true));
 // 巡猎：附近清空且没有待拾取的掉落时，把挂机中心移到最近的怪群。
 if(this.region.roam&&!candidates.length&&!this.pickups.some(p=>distance(p,this.anchor)<=this.radius)){const g=this.roamGuide,inside=(p:Vec)=>!g||p.x>=g.bounds.x&&p.x<g.bounds.x+g.bounds.w&&p.y>=g.bounds.y&&p.y<g.bounds.y+g.bounds.h;
  const next=this.enemies.filter(e=>e.alive&&(this.avoidElite? !e.elite:true)&&inside(e.position)).sort((a,b)=>distance(a.position,h)-distance(b.position,h)||a.id.localeCompare(b.id))[0];if(next){this.anchor={...next.position};candidates.push(next);}
  else if(g){const camp=g.next();if(!camp){this.stop(g.emptyReason);return;}if(distance(camp,this.anchor)>.5)this.anchor={...camp};}}
 const priority=(e:Entity)=>this.targetPriority==='ranged'&&['ranged','shaman','artillery'].includes(e.kind)?-4:0;
 const target=candidates.sort((a,b)=>distance(a.position,h)+priority(a)-distance(b.position,h)-priority(b)||a.id.localeCompare(b.id))[0];
 const pickup=this.pickups.filter(p=>distance(p,this.anchor)<=this.radius).sort((a,b)=>distance(a,h)-distance(b,h))[0];
 const collecting=!sceneBoss&&pickup&&(!target||distance(target.position,h)>4)&&(!target||distance(pickup,h)<distance(target.position,h));
 const goal=distance(h,this.anchor)>this.radius+1?this.anchor:collecting?pickup:target?.position;
 const dangers=this.dangerFields();
 const danger=!approachOnly&&dangers.find(z=>distance(z.position,h)<z.radius+.4||z.beam&&this.beamContains(z.beam.position,z.beam.target,h));
 const casting=this.pending[0];
 if(casting&&(!danger||danger.delay>casting.at-this.tick+Math.ceil((danger.radius+.4-distance(h,danger.position))/(this.stats.speed/30))+2)){this.autoState='释放技能';return;}
 if(danger){
 // Pick a reachable escape direction that also approaches the combat goal. Moving
 // radially away from every new warning stranded melee builds at the arena edge.
 const options=Array.from({length:16},(_,i)=>{const angle=i*Math.PI/8;return {x:h.x+Math.cos(angle)*(danger.radius+1),y:h.y+Math.sin(angle)*(danger.radius+1)};}).filter(p=>walkable(this.region,p)&&lineOfSight(this.region,h,p));
 const preferredRange=this.autoAttackStopRange();
 const score=(p:Vec)=>dangers.reduce((n,z)=>n+Math.max(0,z.radius+.5-distance(z.position,p))*100+(z.beam&&this.beamContains(z.beam.position,z.beam.target,p)?1000:0),0)+(goal?Math.abs(distance(p,goal)-preferredRange):distance(p,this.anchor));
 const reachable=options.filter(p=>{const next=moveBody(this.region,h,p,.5,this.rules.bodyCollision.heroRadius,this.enemyBodies(h,2),true);return distance(next,h)>.05;});
 if(!this.dodge||distance(h,this.dodge)<.3||this.stuck>2)this.dodge=reachable.sort((a,b)=>score(a)-score(b))[0];
 if(this.dodge)this.moveHero(this.dodge);else this.stuck++;
 this.autoState='避开危险';return;
 }
 this.dodge=undefined;
 if(!goal){this.autoState='等待敌群刷新';return;}
 if(collecting&&distance(h,goal)<1.5){this.autoState='拾取战利品';return;}
 if(target&&distance(h,target.position)<this.autoAttackStopRange()&&lineOfSight(this.region,h,target.position)){this.autoState='战斗';if(this.hero.actionUntil<this.tick)this.hero.action='idle';return;}
 const key=`${Math.floor(goal.x)},${Math.floor(goal.y)}`;
 if(this.pathGoal!==key||!this.path.length){this.pathGoal=key;this.path=findPath(this.region,h,goal);if(!this.path.length){this.stuck+=10;this.autoState='调整路线';return;}}
 this.autoState=sceneBoss?(sceneBoss.boss?'接近首领':'接近指定目标'):goal===this.anchor?'返回活动范围':collecting?'拾取战利品':'接近敌群';this.follow();
 }
 private dangerFields(){
  const fields:{position:Vec;radius:number;delay:number;beam?:{position:Vec;target:Vec}}[]=this.zones.filter(z=>z.enemy&&z.damage>0);
  for(const cast of this.bossCasts){
   if(cast.resolved||cast.interrupted||!this.enemies.some(e=>e.id===cast.owner&&e.alive))continue;
   const owner=this.enemies.find(e=>e.id===cast.owner)!,skill=this.getBossDefinition(this.bossKey(owner))?.skills.find(s=>s.id===cast.skill);
   if(!skill||!['zone','trap','beam'].includes(skill.kind)||('damage' in skill?skill.damage:1)<=0)continue;
   fields.push({position:cast.target,radius:'radius' in skill?skill.radius??3:3,delay:cast.ends-this.tick,...(skill.kind==='beam'?{beam:{position:cast.position,target:cast.target}}:{})});
  }
  return fields;
 }
 private execute(s:Skill,t:Entity|undefined,p:Vec){
 if(s.mechanics){this.executeDeclared(s,t,p);return;}
 const origin={...this.hero.position};
 if(s.kind==='dash')this.hero.position=moveBody(this.region,origin,p,s.range,this.rules.bodyCollision.heroRadius,[...this.enemyBodies(origin,s.range+2),...this.playerBodies(this.playerId)],false);
 this.events.push({...this.vfxContext,type:'cast_released',id:this.playerId,position:{...this.hero.position},origin,target:{...(s.kind==='single'&&t?.alive?t.position:p)},skill:s.id,radius:s.radius,duration:s.duration,tick:this.tick});
 if(s.kind==='shield'){this.hero.shield=s.damage;this.hero.shieldUntil=this.tick+s.duration;this.observeShield();return;}
 if(s.kind==='heal'){this.hero.hp=Math.min(this.stats.hp,this.hero.hp+s.damage);return;}
 if(s.kind==='single'){if(t?.alive&&distance(t.position,this.hero.position)<=s.range+.4&&lineOfSight(this.region,this.hero.position,t.position))this.damage(t,s.damage,false,s.id);return;}
 if(s.kind==='area'||s.kind==='dash'){for(const e of this.nearbyEnemies(this.hero.position,s.radius))if(e.alive&&distance(e.position,this.hero.position)<=s.radius&&lineOfSight(this.region,this.hero.position,e.position)){this.damage(e,s.damage,false,s.id);if(s.id==='nova')e.slow=this.tick+s.duration;if(e.alive&&(s.pull??0)>0){const before={...e.position};e.position=moveBody(this.region,e.position,this.hero.position,s.pull!,this.bodyRadius(e),[...this.enemyBodies(e.position,s.pull!+2,e),{id:this.playerId,position:this.hero.position,radius:this.rules.bodyCollision.heroRadius}],false);this.grid.update(e,before);}}return;}
 if(s.kind==='projectile'){const count=Math.max(1,Math.min(15,s.projectiles??1)),angle=Math.atan2(p.y-this.hero.position.y,p.x-this.hero.position.x),reach=Math.max(1,distance(this.hero.position,p));for(let i=0;i<count;i++){const heading=angle+(i-(count-1)/2)*(s.projectileSpread??.18),target=count===1?p:{x:this.hero.position.x+Math.cos(heading)*reach,y:this.hero.position.y+Math.sin(heading)*reach};this.shoot(this.hero.position,target,s.damage,false,this.stats.effects.includes('pierce')||s.id==='lance',s.id,s.radius,this.playerId,t?.id);}return;}
 if(s.kind==='zone'){this.zones.push({...this.vfxContext,id:++this.serial,position:p,radius:s.radius,damage:s.damage,life:s.duration,delay:0,enemy:false,slow:s.id==='frost',skill:s.id,started:this.tick});return;}
 if(s.kind==='chain'){const targets=this.nearbyEnemies(p,s.radius).filter(e=>e.alive&&distance(e.position,p)<s.radius).sort((a,b)=>distance(a.position,p)-distance(b.position,p)||a.id.localeCompare(b.id));targets.slice(0,3).forEach(e=>this.damage(e,s.damage,false,s.id));}
 }
 private escapePoint(range:number){const threat=this.closest()?.position??{x:this.hero.position.x-this.hero.facing,y:this.hero.position.y+this.hero.facing},angle=Math.atan2(this.hero.position.y-threat.y,this.hero.position.x-threat.x);for(const turn of [0,.6,-.6,1.2,-1.2,Math.PI]){const p={x:this.hero.position.x+Math.cos(angle+turn)*range,y:this.hero.position.y+Math.sin(angle+turn)*range};if(walkable(this.region,p,this.rules.bodyCollision.heroRadius)&&lineOfSight(this.region,this.hero.position,p))return p;}return {...this.hero.position};}
 private executeDeclared(s:Skill,t:Entity|undefined,p:Vec,index=0,ally?:string,sequenceOrigin?:Vec,sequenceDirection?:Vec){
  const m=s.mechanics!,actorOrigin={...this.hero.position},schedule=m.schedule,base=schedule?.followCaster?actorOrigin:sequenceOrigin??actorOrigin,aim=t?.position??p,length=distance(base,aim),direction=sequenceDirection??(length>0?{x:(aim.x-base.x)/length,y:(aim.y-base.y)/length}:{x:this.hero.facing*Math.SQRT1_2,y:-this.hero.facing*Math.SQRT1_2}),origin=schedule?.advance?{x:base.x+direction.x*schedule.advance*index,y:base.y+direction.y*schedule.advance*index}:actorOrigin;
  if(this.actionBlocked(this.playerId)||this.hasStatus(this.playerId,'silence'))return;
  if(m.targeting==='enemy'&&['single','projectile','dash','chain'].includes(s.kind)&&!t?.alive){this.emit({...this.vfxContext,type:'cast_failed',id:this.playerId,position:origin,skill:s.id,reason:'target',tick:this.tick});return;}
  if(m.targeting==='direction'){
   const next=moveBody(this.region,origin,p,s.range,this.rules.bodyCollision.heroRadius,[...this.enemyBodies(origin,s.range+2),...this.playerBodies(this.playerId)],false);
   if(distance(next,p)>.01){this.emit({...this.vfxContext,type:'cast_failed',id:this.playerId,position:origin,skill:s.id,reason:'blocked',tick:this.tick});return;}this.hero.position=next;
  }else if(s.kind==='dash'){
   if(this.movementBlocked(this.playerId))return;this.hero.position=moveBody(this.region,origin,p,s.range,this.rules.bodyCollision.heroRadius,[...this.enemyBodies(origin,s.range+2),...this.playerBodies(this.playerId)],false);
  }
  if(s.kind==='dash'&&m.dash?.pathHit){for(const enemy of this.nearbyEnemies(actorOrigin,distance(actorOrigin,this.hero.position)+s.radius+2))if(enemy.alive&&segmentContact(actorOrigin,this.hero.position,enemy.position,this.bodyRadius(enemy)+Math.max(.5,s.radius))!==null&&lineOfSight(this.region,actorOrigin,enemy.position))this.hitSkill(enemy,s,Math.round(s.damage*m.dash.pathHit),false,index);}
  if(s.kind==='dash'&&!this.vfxContext?.echo){this.effectLastPosition={...origin};this.fireEffects('dash',t,s.damage,s);}
  this.emit({...this.vfxContext,type:'cast_released',id:this.playerId,position:{...(schedule?.advance?origin:this.hero.position)},origin,target:{...(s.kind==='single'&&t?.alive?t.position:p)},skill:s.id,radius:s.radius,duration:s.duration,tick:this.tick,part:index+1});
  if(index===0&&schedule)this.sequences.push({sourceId:this.playerId,targetId:t?.id,skill:structuredClone(s),position:{...p},started:this.tick,ends:this.tick+Math.max(s.duration,schedule.interval*(schedule.hits-1)+1),next:this.tick+schedule.interval,index:1,...(schedule.advance?{origin:actorOrigin,direction}:{}),castId:this.vfxContext?.castId,vfxKey:this.vfxContext?.vfxKey});
  const part=schedule?splitBudget(s.damage,schedule.hits,index):s.damage;
  if(index===0&&m.targeting!=='self')for(const effect of m.statuses.filter(e=>e.scope==='self'))this.applyStatus(this.playerId,effect,this.playerId,s.id);
  if(m.targeting==='self'){
   const source=this.playerId,recipient=ally??source;
   this.forPlayer(recipient,()=>{
    if(s.kind==='shield'&&s.damage>0){this.hero.shield=s.damage;this.hero.shieldUntil=this.tick+s.duration;this.observeShield();this.emit({...this.vfxContext,type:'shielded',id:recipient,targetId:recipient,position:{...this.hero.position},amount:s.damage,skill:s.id,tick:this.tick,shieldPhase:'applied',shieldRemaining:this.hero.shield});}
    if(s.kind==='heal')this.restoreResources(s.damage,m.restoreMana??0,s.id);
    if(m.cleanse){const statuses=this.activeStatuses(recipient).filter(x=>x.effect.cleanse&&m.cleanse!.kinds.includes(x.effect.kind)).sort((a,b)=>a.started-b.started||a.id.localeCompare(b.id));for(const x of statuses.slice(0,m.cleanse.count))this.removeStatus(x,'cleansed');}
    for(const effect of m.statuses.filter(e=>e.scope==='self'||e.scope==='ally'))this.applyStatus(recipient,effect.kind==='counter'?{...effect,radius:s.radius}:effect,source,s.id);
   });if(!m.projectile?.orbit)return;
  }
  if(s.kind==='single'){if(t?.alive&&distance(t.position,this.hero.position)<=s.range+.4&&lineOfSight(this.region,this.hero.position,t.position))this.hitSkill(t,s,part,false,index);return;}
  if(s.kind==='area'||s.kind==='dash'){
   const center=schedule?.advance?origin:this.hero.position;for(const e of this.nearbyEnemies(center,s.radius))if(e.alive&&distance(e.position,center)<=s.radius&&lineOfSight(this.region,center,e.position)){this.hitSkill(e,s,part,false,index);if(e.alive&&(s.pull??0)>0)this.pullEnemy(e,this.hero.position,s.pull!);}
   return;
  }
  if(s.kind==='projectile'){
   if(index>0&&!t?.alive)return;
   const point=t?.alive&&schedule?{...t.position}:p,angle=Math.atan2(point.y-origin.y,point.x-origin.x),count=Math.max(1,s.projectiles??1),reach=Math.max(1,distance(origin,point));
   for(let i=0;i<count;i++){const heading=angle+(i-(count-1)/2)*(s.projectileSpread??.18),to={x:origin.x+Math.cos(heading)*reach,y:origin.y+Math.sin(heading)*reach};this.shoot(origin,to,this.scaledDamage(s,s.runtimeEffects?.unsharedProjectiles?part:splitBudget(part,count,i)),false,this.stats.effects.includes('pierce')||m.projectile!.penetrations>0,s.id,m.projectile!.collisionRadius,this.playerId,t?.id);const shot=this.projectiles.at(-1)!,shotSkill=structuredClone(s);for(const effect of shotSkill.mechanics!.statuses)if(effect.total!==undefined&&effect.scope==='hit')effect.total=s.runtimeEffects?.unsharedProjectiles?splitBudget(effect.total,schedule?.hits??1,index):splitBudget(splitBudget(effect.total,schedule?.hits??1,index),count,i);Object.assign(shot,{...(s.mechanics?.schedule?{part:index}:{}),...(m.projectile?.orbit?{orbit:{...m.projectile.orbit,angle:angle+i*Math.PI*2/count,ends:this.tick+m.projectile.orbit.duration,hits:{}},life:m.projectile.orbit.duration,position:{x:origin.x+Math.cos(angle+i*Math.PI*2/count)*m.projectile.orbit.radius,y:origin.y+Math.sin(angle+i*Math.PI*2/count)*m.projectile.orbit.radius}}:{}),...(m.projectile?.returns?{returns:true,life:Math.max(1,Math.ceil(s.range/this.rules.aiRules.projectileSpeed))}:{}),resolvedSkill:shotSkill,damageType:m.damageType,turnRate:m.projectile!.turnRate,penetrations:this.stats.effects.includes('pierce')?undefined:m.projectile!.penetrations,explosionRadius:m.projectile!.explosionRadius});}return;
  }
  if(s.kind==='zone'){
   if(m.zone!.mode==='burst'){this.emit({...this.vfxContext,type:'effect_activated',id:this.playerId,position:{...p},radius:s.radius,skill:s.id,tick:this.tick,duration:12});for(const e of this.nearbyEnemies(p,s.radius))if(e.alive&&distance(e.position,p)<=s.radius&&lineOfSight(this.region,p,e.position))this.hitSkill(e,s,s.damage);}
   else this.zones.push({...this.vfxContext,id:++this.serial,position:{...p},radius:s.radius,damage:s.damage,life:s.duration,delay:0,enemy:false,slow:false,skill:s.id,started:this.tick,resolvedSkill:structuredClone(s),nextHit:this.tick+m.zone!.firstDelay,hitIndex:0,damageType:m.damageType});return;
  }
  if(s.kind==='chain'){const targets=this.nearbyEnemies(p,s.radius).filter(e=>e.alive&&distance(e.position,p)<s.radius&&lineOfSight(this.region,p,e.position)).sort((a,b)=>distance(a.position,p)-distance(b.position,p)||a.id.localeCompare(b.id));for(const e of targets.slice(0,m.chain?.count??3))this.hitSkill(e,s,s.damage,false,index);}
 }
 private advanceOrbit(p:Projectile){const orbit=p.orbit!,owner=p.owner??this.playerId,center=this.actorPosition(owner);if(!center||!this.actorAlive(owner)||this.tick>=orbit.ends){p.life=0;return;}const before={...p.position};orbit.angle+=orbit.speed;p.position={x:center.x+Math.cos(orbit.angle)*orbit.radius,y:center.y+Math.sin(orbit.angle)*orbit.radius};p.previous=before;const length=distance(before,p.position)||1;p.direction={x:(p.position.x-before.x)/length,y:(p.position.y-before.y)/length};p.life=orbit.ends-this.tick;const wall=terrainContact(this.region,before,p.position,p.radius??.15);if(wall!==null){p.position={x:before.x+(p.position.x-before.x)*wall,y:before.y+(p.position.y-before.y)*wall};p.life=0;}for(const enemy of this.nearbyEnemies({x:(before.x+p.position.x)/2,y:(before.y+p.position.y)/2},length/2+this.rules.bodyCollision.bossRadius+(p.radius??.15)))if(enemy.alive&&(orbit.hits[enemy.id]??0)<=this.tick&&segmentContact(before,p.position,enemy.position,this.bodyRadius(enemy)+(p.radius??.15))!==null){orbit.hits[enemy.id]=this.tick+orbit.interval;const hit=()=>this.withVfx({...p,projectileId:p.id,contact:{...enemy.position}},()=>this.hitSkill(enemy,p.resolvedSkill!,p.damage,true,p.part));if(this.players.has(owner))this.forPlayer(owner,hit);else hit();}}
 private advanceSequences(){for(const q of [...this.sequences]){
  const schedule=q.skill.mechanics!.schedule!,position=this.actorPosition(q.sourceId);
  if(!this.actorAlive(q.sourceId)||this.actionBlocked(q.sourceId)||this.hasStatus(q.sourceId,'silence')||schedule.interruptOnMove&&position&&distance(position,q.position)>.05){this.sequences=this.sequences.filter(x=>x!==q);continue;}
  if(this.tick>=q.ends){this.sequences=this.sequences.filter(x=>x!==q);continue;}if(q.index>=schedule.hits||this.tick<q.next)continue;
  const target=this.enemies.find(e=>e.id===q.targetId);if(!schedule.followCaster&&!schedule.advance&&(!target?.alive||!position||distance(position,target.position)>q.skill.range||!lineOfSight(this.region,position,target.position))){this.sequences=this.sequences.filter(x=>x!==q);continue;}
  this.withVfx({sourceId:q.sourceId,targetId:q.targetId,castId:q.castId,vfxKey:q.vfxKey},()=>this.executeDeclared(q.skill,target,q.position,q.index,undefined,q.origin,q.direction));q.index++;q.next+=schedule.interval;
 }}
 private advanceZone(z:Zone){const s=z.resolvedSkill!,m=s.mechanics!,rule=m.zone!;if(rule.followCaster){const owner=this.actorPosition(z.sourceId??this.playerId);if(owner)z.position={...owner};}
  if(this.tick>=(z.started??this.tick)+s.duration){if(z.life>0)this.fireEffects('zone_end',this.effectProxy(z.position),s.damage,s);z.life=0;return;}
  z.life=Math.max(0,(z.started??this.tick)+s.duration-this.tick);
  this.withVfx(z,()=>{
   if(!z.visualActivated){z.visualActivated=true;this.emit({...z,type:'effect_activated',id:z.sourceId??this.playerId,position:{...z.position},radius:z.radius,duration:z.life,skill:s.id,tick:this.tick});}
   const targets=this.nearbyEnemies(z.position,z.radius).filter(e=>e.alive&&distance(e.position,z.position)<=z.radius&&lineOfSight(this.region,z.position,e.position));
   for(const e of targets){for(const effect of m.statuses.filter(e=>e.scope==='zone'&&!periodicDamageKinds.some(kind=>kind===e.kind)))this.applyStatus(e.id,effect,z.sourceId,s.id);if(rule.pullSpeed)this.pullEnemy(e,z.position,rule.pullSpeed/30);}
   if(this.tick>=(z.nextHit??0)&&(z.hitIndex??0)<rule.hits){const index=z.hitIndex??0,amount=rule.budget==='total'?splitBudget(s.damage,rule.hits,index):s.damage;for(const e of targets)if(e.alive){const landed=this.damage(e,this.scaledDamage(s,amount),true,s.id,{category:'periodic',damageType:m.damageType,skill:s,scaled:true,...(z.ruleId?{comboDepth:1}:{})});if(landed&&e.alive)for(const effect of m.statuses.filter(e=>e.scope==='zone'&&periodicDamageKinds.some(kind=>kind===e.kind))){const applied=structuredClone(effect);if(applied.total!==undefined)applied.total=this.scaledDamage(s,applied.total);this.applyStatus(e.id,applied,z.sourceId,s.id,s);}}z.hitIndex=index+1;z.nextHit=(z.nextHit??this.tick)+rule.interval;}
  });
 }
 private hitSkill(e:Entity,s:Skill,amount:number,scaled=false,part?:number){
  const dotBudget=s.mechanics!.statuses.filter(x=>x.kind==='poison'&&x.scope==='hit').reduce((n,x)=>n+(x.total??0),0);
  const generatedEffect=this.vfxContext?.ruleId===s.id&&!skillCatalog.some(skill=>skill.id===s.id);
  const landed=this.damage(e,Math.max(0,amount-(scaled?this.scaledDamage(s,dotBudget):dotBudget)),generatedEffect,s.id,{category:generatedEffect?'derived':'direct',damageType:s.mechanics!.damageType,skill:s,scaled,...(part!==undefined?{part}:{}),...(this.vfxContext?.ruleId&&!isComboRuleId(this.vfxContext.ruleId)?{comboDepth:1}:{})});
  if(landed&&e.alive)for(const effect of s.mechanics!.statuses.filter(x=>x.scope==='hit')){const applied=structuredClone(effect);if(applied.total!==undefined)applied.total=this.scaledDamage(s,applied.total);this.applyStatus(e.id,applied,this.vfxContext?.sourceId??this.playerId,s.id,s);}
 }
 private damage(e:Entity,amount:number,secondary=false,skill?:string,context?:DamageContext){
  if(this.region.sprint&&!secondary&&(context?.category??'direct')==='direct')this.combatAt=this.tick;
  if(!e.alive)return false;
  const category=context?.category??(secondary?'derived':'direct'),damageType=checkedDamageType(context?.damageType??'physical'),permissions=(this.rules.damagePermissions??damagePermissions)[category];
  const sourceId=this.vfxContext?.sourceId??this.playerId,blind=this.strength(sourceId,'blind');if(!this.upperBound&&category==='direct'&&blind>0&&this.random()<blind){this.emit({...this.vfxContext,type:'missed',id:e.id,position:{...e.position},amount:0,skill,category,damageType,tick:this.tick});return false;}if(amount<=0)return category==='direct';
  if(category==='direct'&&!context?.comboDepth&&this.vfxContext?.castId!==undefined){const key=String(this.vfxContext.castId),hits=this.effectCastHits[key]??={tick:this.tick,targets:[]};if(!hits.targets.includes(e.id))hits.targets.push(e.id);if(Object.keys(this.effectCastHits).length>256)delete this.effectCastHits[Object.keys(this.effectCastHits).sort((a,b)=>this.effectCastHits[a].tick-this.effectCastHits[b].tick)[0]];}
  if(context?.skill&&!context.scaled)amount=this.scaledDamage(context.skill,amount);
  const specific=context?.skill?.mechanics?.execute,bonus=Math.max(specific&&e.hp/e.maxHp<=specific.threshold?specific.bonus:0,e.hp/e.maxHp<=(this.stats.executeThreshold??.2)?this.stats.executeBonus??0:0);
  if(permissions.execute&&bonus>0)amount=Math.round(amount*(1+bonus));
  if(this.stats.dynamicConversions?.length&&!context?.comboDepth&&(category==='direct'||category==='periodic')){const currentSpeed=this.effectiveStats().speed,bonus=this.stats.dynamicConversions.reduce((n,c)=>n+(Math.max(0,currentSpeed/c.baselineSpeed-1)-c.permanentBonus)*c.ratio,0);if(bonus)amount=Math.max(1,Math.round(amount*(1+bonus/(1+(context?.skill?.resolution?.typeAdd??context?.typeAdd??this.stats.damageAdd??0)))));}
  const hitBuffs=this.effectBuffs(context?.skill,e,context),dotAllowed=category==='periodic'&&sourceId===this.playerId&&((this.stats.dotCrit??0)>0||this.buffFlag('dotCrit',context?.skill,e,context)||this.buffFlag('dotCritFull',context?.skill,e,context)),critChance=this.conditionalValue('critChance',context?.skill,e)*(category==='periodic'&&!this.buffFlag('dotCritFull',context?.skill,e,context)?.5:1),crit=(permissions.crit||dotAllowed||context?.effectCrit===true)&&(this.upperBound||category==='direct'&&(context?.skill?.runtimeEffects?.forceCrit||hitBuffs.some(b=>b.action.consume!=='nextCast'&&b.action.flags?.forceCrit))||critChance>0&&this.random()<Math.min(1,critChance));if(crit)amount=Math.round(amount*Math.max(1,this.conditionalValue('critMultiplier',context?.skill,e)));
  let hexDamageFactor=context?.skill?.runtimeEffects?.hexDamageFactor??context?.hexDamageFactor??1;
  const conditional=(this.stats.conditional??[]).filter(c=>c.pool==='cond'&&matches(c.when,this.conditionContext(context?.skill,e))).reduce((n,c)=>n+c.value,0);const damageBuffs=hitBuffs.filter(b=>b.action.consume!=='nextCast'&&b.action.consume!=='nextSkillCast'&&(!b.action.consume||category==='direct')&&(b.action.consume!=='nextMelee'||!!context?.skill&&resolvedSkillTags({...context.skill,category:skillCatalog.find(s=>s.id===context.skill!.id)?.category}).includes('melee'))),buffDamage=buffAmount(damageBuffs,'damageAdd')+buffAmount(damageBuffs,'damageMult');const scaling=hexDamageScale(damageBuffs,conditional,hexDamageFactor,this.rules.hexPolicy?.damageMultiplierCap);if(conditional||buffDamage||scaling.multiplier!==1)amount=Math.round(amount*scaling.multiplier);hexDamageFactor=scaling.hexFactor;
   // Weapon combos: reference = crit/execute-applied hit before amplify and armor; carried = statuses before this hit.
   const fromPlayer=sourceId===this.playerId||this.players.has(sourceId),reference=amount,carried=fromPlayer&&combatRules(this.stats).length?this.activeStatuses(e.id).map(x=>({...x,effect:structuredClone(x.effect)})):[];
   if(fromPlayer){const shock=this.strength(e.id,'shock');let mult=1+(shock+this.strength(e.id,'vulnerable'))*(1+this.conditionalValue('vulnerableBonus',context?.skill,e));for(const r of this.combosFor('passive'))if(r.action.type==='amplify'&&this.comboMatches(r,context,damageType,e,carried)&&(this.upperBound||!r.action.against.length||r.action.against.some(k=>carried.some(x=>x.effect.kind===k)))){this.effectTriggered(r);const count=r.action.selfHpSteps?(this.upperBound?r.action.maxSteps??9:Math.min(r.action.maxSteps??9,Math.floor((1-this.hero.hp/this.stats.hp+1e-8)/r.action.selfHpSteps))):r.action.perCrowd?(this.upperBound?r.action.crowdCap??10:Math.min(r.action.crowdCap??10,this.conditionContext(context?.skill,e).target?.crowd??0)):1;const missing=r.action.targetMissingHp,missingBonus=missing?this.upperBound?missing.cap:Math.min(missing.cap,Math.max(0,1-e.hp/e.maxHp)*missing.coefficient):0;const amp=1+(r.action.perCrowd??r.action.ratio)*count+missingBonus;if(r.rule.hexMechanism&&this.rules.hexPolicy&&hexDamageFactor>0){const applied=Math.min(amp,Math.max(1,(1+this.rules.hexPolicy.damageMultiplierCap)/hexDamageFactor));mult*=applied;hexDamageFactor*=applied;}else mult*=amp;}if(mult!==1)amount=Math.round(amount*mult);}
 const passivePen=this.combosFor('passive').reduce((p,r)=>r.action.type==='amplify'&&r.action.penetration&&this.comboMatches(r,context,damageType,e,carried)?1-(1-p)*(1-r.action.penetration):p,0);
 const penetration=Math.max(0,Math.min(1,1-(1-(context?.penetration??this.stats.penetration??0))*(1-(context?.skill?.mechanics?.penetration??0))*(1-passivePen))),armorDown=1-this.strength(e.id,'armor_down');
 amount=damageType==='pure'?amount:e.monster?armorMitigation(amount,e.monster.armor*armorDown*(1-penetration),this.rules.combatNumerics?.armor??combatNumerics.legacyArmor).damage:e.kind==='guard'?Math.max(1,amount-(this.rules.monsters?.legacy??monsterContent.legacy).guardReduction*armorDown*(1-penetration)):amount;
  if(e.shield&&amount>0){const absorbed=Math.min(e.shield,amount);e.shield-=absorbed;amount-=absorbed;this.emit({...this.vfxContext,type:'shielded',id:e.id,position:{...e.position},amount:absorbed,skill,tick:this.tick,shieldPhase:'absorbed',shieldRemaining:e.shield});}
  const healthBeforeDamage=e.hp,dealt=Math.min(e.hp,amount);e.hp=Math.max(0,e.hp-amount);e.action='hurt';e.actionUntil=this.tick+4;
  if(fromPlayer&&dealt>0)this.noteHexDamage();
  const lifesteal=this.conditionalValue('lifesteal',context?.skill,e)*Math.max(1,this.conditionalValue('lifestealMultiplier',context?.skill,e));if(permissions.lifesteal&&lifesteal>0&&this.hero.hp>0){const wanted=Math.min(this.stats.hp-this.hero.hp,dealt*Math.min(1,lifesteal)*(1+this.conditionalValue('healingReceived')));if(this.rules.hexPolicy){const buffs=this.effectBuffs(context?.skill,e).filter(b=>b.hexMechanism),ordinaryRate=Math.max(0,this.conditionalValue('lifesteal',context?.skill,e)-buffAmount(buffs,'lifesteal'))*Math.max(1,this.conditionalValue('lifestealMultiplier',context?.skill,e)-buffAmount(buffs,'lifestealMultiplier')),ordinary=Math.min(wanted,dealt*Math.min(1,ordinaryRate)*(1+this.conditionalValue('healingReceived')));this.hero.hp+=ordinary+this.reserveHexRecovery(Math.max(0,wanted-ordinary));}else this.hero.hp+=wanted;}
  for(const state of [...this.activeStatuses(e.id)])if(state.effect.breakOnDamage||state.effect.kind==='freeze'&&damageType!=='cold')this.removeStatus(state,'broken');
  // 打断检测（黑暗仪式等可打断技能）
  for(const cast of permissions.interrupt?this.bossCasts:[]){
    if(cast.owner===e.id&&!cast.resolved&&!cast.interrupted){
      const bossData=this.getBossDefinition(this.bossKey(e));
      if(bossData&&'skills' in bossData){
        const skillDef=bossData.skills.find((s:any)=>s.id===cast.skill);
        if(skillDef&&'interruptible' in skillDef&&skillDef.interruptible){
          cast.damage+=amount;
          const interruptRatio=('interruptRatio' in bossData?bossData.interruptRatio:0.025);
          if(cast.damage>=e.maxHp*interruptRatio){
            cast.interrupted=true;
            cast.resolved=true;
            cast.expires=this.tick+20;
            e.action='hurt';
            e.actionUntil=this.tick+20;
          }
        }
      }
    }
  }
  const effectId=this.vfxContext?.ruleId??(skill&&this.effectStats[skill]?skill:undefined);if(effectId)(this.effectStats[effectId]??={count:0,damage:0}).damage+=dealt;
  if(fromPlayer&&dealt>0){const measurement=this.hexStatistics??=newHexStatistics(false);measurement.totalDamage+=dealt;const rule=this.stats.rules?.find(r=>r.id===effectId&&r.hexMechanism);if(rule)hexStatisticsRule(measurement,rule).directDamage+=dealt;}
  this.events.push({...this.vfxContext,type:'hit_resolved',id:e.id,targetId:e.id,position:{...e.position},amount:dealt,skill,tick:this.tick,category,damageType,status:context?.statusKind,...(crit?{crit:true as const}:{})});
  if(e.hp>0&&permissions.burn&&this.stats.effects.includes('burn'))this.applyStatus(e.id,statusEffectSchema.parse({kind:'burn',duration:this.rules.effects.burnTicks,strength:0,scope:'hit',interval:30,total:this.rules.effects.burnDamage*Math.floor(this.rules.effects.burnTicks/30),damageType:'fire',cleanse:true}),this.vfxContext?.sourceId??this.playerId,'burn');
  if(permissions.chain&&this.stats.effects.includes('chain')){const next=this.nearbyEnemies(e.position,3).find(n=>n.alive&&n.id!==e.id&&distance(n.position,e.position)<3&&lineOfSight(this.region,e.position,n.position));if(next)this.damage(next,Math.round(dealt*(this.buffFlag('noChainDecay',context?.skill,e)?1:this.rules.effects.chainRatio)),true,skill,{category:'derived',damageType,penetration:this.stats.penetration??0,scaled:true});}
  if(permissions.ward&&this.stats.effects.includes('ward')&&this.wardCooldown<=this.tick){this.hero.shield=Math.max(this.hero.shield,this.rules.effects.wardAmount);this.hero.shieldUntil=this.tick+this.rules.effects.wardTicks;this.observeShield();this.wardCooldown=this.tick+this.rules.effects.wardTicks;}
  if(e.hp===0){if(fromPlayer){this.conditionClock.kills++;this.effectKillTicks.push(this.tick);}e.alive=false;this.grid.remove(e);e.action='death';e.actionUntil=this.tick+30;this.clearStatuses(e.id,'death');this.interruptActor(e.id);if(e.reward)this.kills.push({source_id:e.id,tick:this.tick});this.events.push({...this.vfxContext,type:'entity_died',id:e.id,position:{...e.position},tick:this.tick});if(fromPlayer&&combatRules(this.stats).length)this.comboKill(e,reference,skill,context,damageType,carried,healthBeforeDamage);if(fromPlayer&&(context?.comboDepth??0)<comboLimits.killDepth){this.fireEffects('kill',e,reference,context?.skill,carried,0,true,undefined,healthBeforeDamage);if(e.elite||e.boss)this.fireEffects('kill_elite',e,reference,context?.skill,carried,0,false,undefined,healthBeforeDamage);}}
   if(category==='direct'){this.consumeBuffs('nextHit',hitBuffs,e,context?.skill,reference);if(context?.skill&&resolvedSkillTags({...context.skill,category:skillCatalog.find(s=>s.id===context.skill!.id)?.category}).includes('melee'))this.consumeBuffs('nextMelee',hitBuffs,e);}
   // Skill zone ticks (periodic with a skill) count as hits; status DOT ticks and combo damage never do. crit/nth stay direct-only.
   const skillTick=category==='periodic'&&!!context?.skill;
   if(fromPlayer&&combatRules(this.stats).length&&(category==='direct'||skillTick)&&!context?.comboDepth)this.comboHit(e,reference,context,damageType,crit,carried,category==='direct',dealt,skill);
  return true;
 }
 // —— Weapon combos (contracts/weapon-combos.ts). One executor per action type. ——
 private combosFor(trigger:EffectRule['trigger']){const weapon=this.stats.weapon;return combatRules(this.stats).filter(r=>r.trigger===trigger&&(!weapon||r.weapons.includes(weapon)));}
 private conditionalValue(stat:string,skill?:Skill,target?:Entity){const base=(this.stats as unknown as Record<string,unknown>)[stat],set=this.effectBuffs(skill,target).findLast(b=>b.action.setMods?.includes(stat as 'critChance'));if(set)return set.action.mods[stat]??0;const ctx=this.conditionContext(skill,target);return (typeof base==='number'?base:stat==='critMultiplier'?1.5:0)+this.buffValue(stat,skill,target)+(this.stats.conditional??[]).filter(c=>c.pool==='stat'&&c.stat===stat&&matches(c.when,ctx)).reduce((n,c)=>n+(c.perStillSecond?Math.min(c.max??c.value,c.value*(this.upperBound?Math.ceil((c.max??c.value)/c.value):Math.floor(ctx.self.still))):c.value),0);}
 private conditionContext(skill?:Skill,target?:Entity,carried?:StatusInstance[]):ConditionContext{const statuses:Record<string,number>={};for(const x of carried??(target?this.activeStatuses(target.id):[]))statuses[x.effect.kind]=(statuses[x.effect.kind]??0)+1;return {upperBound:this.upperBound,skill:skill?{id:skill.id,tags:resolvedMechanismTags({...skill,category:skillCatalog.find(s=>s.id===skill.id)?.category}),weapon:this.stats.weapon,damageType:skill.mechanics?.damageType,longest:skill.cooldown===Math.max(...this.skills.map(s=>s.cooldown))}:undefined,target:target?{statuses,rank:target.boss?'boss':target.elite?'elite':'normal',hp:target.hp/target.maxHp,distance:distance(target.position,this.hero.position),crowd:this.enemies.filter(e=>e.alive&&distance(e.position,target.position)<=4).length}:undefined,self:{hp:this.hero.hp/this.stats.hp,shield:this.hero.shield,moving:this.conditionClock.moving/30,still:this.conditionClock.still/30,mana:this.hero.mana/this.stats.mana,buffs:[...this.activeStatuses(this.playerId).map(x=>x.skill),...this.selfBuffs.map(b=>b.id)],kills:this.effectKillTicks.length,manaSpent:this.conditionClock.manaSpent},combatTime:(this.tick-this.conditionClock.start)/30,castHits:this.vfxContext?.castId===undefined?0:this.effectCastHits[String(this.vfxContext.castId)]?.targets.length??0,nearbyDistances:this.enemies.filter(e=>e.alive).map(e=>distance(e.position,target?.position??this.hero.position))};}
 private comboMatches(r:ExecutableRule,context:DamageContext|undefined,damageType:DamageType,target?:Entity,carried?:StatusInstance[],healthBeforeDamage?:number){if(r.filter.mark&&(!target||!this.effectMarks?.some(m=>m.source===r.source&&m.key===r.filter.mark&&m.targetId===target.id&&m.ends>this.tick)))return false;if(r.filter.attackSources&&!r.filter.attackSources.includes(attackSource(context,this.skills,this.vfxContext?.ruleId?'proc':this.vfxContext?.attackSource)))return false;const ctx=this.conditionContext(context?.skill,target,carried);if(r.rule.hexMechanism&&(this.rules.hexPolicy?.version??0)>=3&&healthBeforeDamage!==undefined&&ctx.target&&target)ctx.target.hp=healthBeforeDamage/target.maxHp;return (!r.damageTypes||r.damageTypes.includes(damageType))&&(!r.skillKinds||!!context?.skill&&r.skillKinds.includes(context.skill.kind))&&(!r.filter.skills||!!ctx.skill&&r.filter.skills.includes(ctx.skill.id))&&(!r.filter.tags||r.filter.tags.some(t=>ctx.skill?.tags?.includes(t)))&&(!r.filter.categories||r.filter.categories.includes(context?.category??'direct'))&&(!r.filter.statusKinds||this.upperBound||!!context?.statusKind&&r.filter.statusKinds.includes(context.statusKind))&&(!r.filter.lastPart||this.upperBound||context?.part===(context?.skill?.mechanics?.schedule?.hits??1)-1)&&r.when.every(c=>matches(c,ctx));}
 private effectTriggered(r:ExecutableRule){if(r.rule.hexMechanism)hexStatisticsRule(this.hexStatistics??=newHexStatistics(false),r.rule).triggers++;const stats=this.effectStats[r.id]??={count:0,damage:0};stats.count++;this.emit({type:'effect_triggered',id:this.playerId,ruleId:r.id,source:r.source,action:r.action.type,amount:0,vfxKey:r.vfxKey,position:{...this.hero.position},tick:this.tick});}
 private comboReadyFor(r:ExecutableRule){
  if(this.comboTick!==this.tick){this.comboTick=this.tick;this.comboSpent=0;}
  const mechanismKey=r.rule.hexMechanism?'hex:'+r.rule.hexMechanism:undefined;
  const protection=this.rules.hexPolicy&&this.rules.hexPolicy.version>=2?hexProtection(r.rule):{lethal:false,invuln:false};
  if(protection.lethal&&(this.comboReady['hex:group-lethal-save']??0)>this.tick||protection.invuln&&(this.comboReady['hex:group-invuln']??0)>this.tick)return false;
  if(mechanismKey&&(this.comboReady[mechanismKey]??0)>this.tick)return false;
  if(this.comboSpent>=comboLimits.actionsPerTick||(this.comboReady[r.id]??0)>this.tick)return false;
  if(!this.upperBound&&r.chance<1&&this.random()>=r.chance)return false;
  this.comboSpent++;this.effectTriggered(r);const cooldown=Math.max(r.cooldown,protection.lethal?this.rules.hexPolicy!.lethalSaveMinimumTicks!:0);if(cooldown){this.comboReady[r.id]=this.tick+cooldown;if(mechanismKey)this.armHexCooldown(mechanismKey,cooldown);}if(protection.lethal)this.armHexCooldown('hex:group-lethal-save',cooldown);if(protection.invuln)this.armHexCooldown('hex:group-invuln',this.rules.hexPolicy!.invulnerabilitySharedTicks);return true;
 }
 private armHexCooldown(key:string,duration:number){this.comboReady[key]=this.tick+duration;this.hexLedger??={deaths:0,triggers:{}};this.hexLedger.triggers[key]={tick:this.tick,ready:this.tick+duration};}
 private comboHit(e:Entity,reference:number,context:DamageContext|undefined,damageType:DamageType,crit:boolean,carried:StatusInstance[],direct=true,dealt=reference,sourceSkill?:string){
  for(const r of [...this.combosFor('hit'),...(direct&&crit?this.combosFor('crit'):[]),...(direct?this.combosFor('nth').filter(r=>!r.rule.count||r.rule.count==='hit'||r.rule.count==='crit'&&crit):[]),...(direct?this.combosFor('nHits'):[])]){
   if(!this.comboMatches(r,context,damageType,e,carried))continue;
   if(r.targetStatus&&!r.targetStatus.some(k=>carried.some(x=>x.effect.kind===k)))continue;
   // nth counts skill releases that hit (one per castId), not targets: an area hit on 6 enemies counts once.
   if(r.trigger==='nth'){
    // Opt-in D11: count landed hits separately on each target. Frozen legacy
    // rules retain release counting (including their AOE cast-id de-duplication).
    const key=r.rule.countScope==='target'?r.id+'#target:'+e.id:r.id;
    if(!r.rule.countScope){const cast=this.vfxContext?.castId,mark=r.id+'#cast';if(cast!==undefined&&this.comboCounts[mark]===cast)continue;if(cast!==undefined)this.comboCounts[mark]=cast;}
    const n=(this.comboCounts[key]??0)+1;if(n<r.every!){this.comboCounts[key]=n;continue;}this.comboCounts[key]=0;
   }
   if(r.trigger==='nHits'){
    if(r.rule.status&&!carried.some(s=>s.effect.kind===r.rule.status))continue;
    if(r.rule.maxTriggers&&(this.effectStats[r.id]?.count??0)>=r.rule.maxTriggers)continue;
    const skillId=context?.skill?.id??sourceSkill,source=skillId===undefined?'untyped':'skill:'+skillId;
    if(!recordWindowHit(this.effectHitWindows??={},r.id,this.tick,source,r.every!,r.rule.window!,r.rule.distinctSources))continue;
   }
   if(this.comboReadyFor(r))this.comboAct(r,e,reference,1,carried,context?.skill,0,dealt);
  }
 }
 private comboKill(e:Entity,reference:number,skill:string|undefined,context:DamageContext|undefined,damageType:DamageType,carried:StatusInstance[],healthBeforeDamage:number){
  const depth=context?.comboDepth??0;if(depth>=comboLimits.killDepth)return;
  for(const r of this.combosFor('kill')){
   if(!this.comboMatches(r,context,damageType,e,carried,healthBeforeDamage))continue;
   if(r.targetStatus&&!r.targetStatus.some(k=>carried.some(x=>x.effect.kind===k)))continue;
   if(!this.comboReadyFor(r))continue;
   if(r.action.type==='refund'&&r.action.mode!=='longest'&&!r.rule.hexMechanism){if(skill&&this.skills.some(s=>s.id===skill)&&(this.cooldowns[skill]??0)>this.tick)this.adjustCooldown(skill,r.action.ticks??0);continue;}
   this.comboAct(r,e,reference,depth+1,carried,context?.skill??this.skills.find(s=>s.id===skill));
  }
 }
 private comboAct(r:ExecutableRule,e:Entity,reference:number,depth:number,carried:StatusInstance[],skill?:Skill,shield=0,dealt=reference){
  const a=r.action,vfx:VfxOrigin={ruleId:r.id,castId:++this.vfxSerial,sourceId:this.playerId,targetId:e.id,vfxKey:('vfx' in a?a.vfx:undefined)??r.vfxKey};
  this.withVfx(vfx,()=>{
   if(a.type==='nova'){const base=a.ref==='maxHp'&&a.at!=='self'?e.maxHp:this.effectRef(a.ref,reference,e,skill,shield);this.comboNova(a.at==='self'?this.effectProxy():e,base,depth,a,skill);}
   else if(a.type==='shards')this.comboShards(e,this.effectRef(a.ref,reference,e,skill,shield),depth,a);
   else if(a.type==='homing'){
    const target=e.alive?e:this.closest();if(!target)return;
    for(let i=0;i<a.count;i++){
     this.shoot(this.hero.position,target.position,Math.round(this.effectRef(a.ref,reference,e,skill)*a.ratio),false,false,r.id,.15,this.playerId,target.id);
     Object.assign(this.projectiles.at(-1)!,{hexHoming:true,turnRate:Math.PI,damageType:a.damageType,comboDepth:depth,...(a.status?{statusOnHit:structuredClone(a.status)}:{})});
    }
   }
   else if(a.type==='status'){if(e.alive)this.applyStatus(e.id,this.comboStatus(a,a.ref==='dealt'?dealt:reference),this.playerId,r.id,skill);}
   else if(a.type==='status_remove'){for(const status of [...this.activeStatuses(e.id)])if(a.statuses.includes(status.effect.kind))this.removeStatus(status,'consumed');}
   else if(a.type==='mark'&&e.alive){
    this.effectMarks=(this.effectMarks??[]).filter(m=>m.ends>this.tick&&!(m.source===r.source&&m.key===a.key&&m.targetId===e.id));
    this.effectMarks.push({source:r.source,ruleId:r.id,key:a.key,targetId:e.id,ends:this.tick+a.duration});
   }
   else if(a.type==='unmark')this.effectMarks=this.effectMarks?.filter(m=>!(m.source===r.source&&m.key===a.key&&m.targetId===e.id));
   else if(a.type==='blink')this.effectBlink(a);
   else if(a.type==='spread')this.comboSpread(e,a,carried);
   else if(a.type==='buff')this.effectBuff(r,a,e);
   else if(a.type==='shield')this.effectShield(r,a,e,reference);
   else if(a.type==='heal')this.effectHeal(r,a,e,reference);
   else if(a.type==='mana')this.restoreResources(0,Math.round(this.effectRef(a.ref,reference,e,skill)*a.ratio)+(a.flat??0),r.id);
   else if(a.type==='cooldown')this.effectCooldown(a,skill,r.rule.hexMechanism);
   else if(a.type==='refund'){if(a.mode==='longest'){const longest=[...this.skills].sort((x,y)=>this.remainingCooldown(y)-this.remainingCooldown(x)||x.id.localeCompare(y.id))[0];if(longest){const ticks=Math.round(this.remainingCooldown(longest)*(a.fraction??0));if(r.rule.hexMechanism&&this.rules.hexPolicy)this.reduceHexCooldown(longest.id,ticks,r.rule.hexMechanism);else this.adjustCooldown(longest.id,ticks);}}else if(skill)this.effectCooldown({type:'cooldown',mode:'current',ticks:a.ticks},skill,r.rule.hexMechanism);}
   else if(a.type==='field')this.effectField(r,a,e,reference,skill);
   else if(a.type==='detonate')this.effectDetonate(r,a,e,carried);
   else if(a.type==='extend')this.effectExtend(a,e);
   else if(a.type==='arc')this.effectArc(r,a,e,reference);
   else if(a.type==='echo'){const original=a.skill==='slot1'?this.skills[0]:skill;if(original){const copy=structuredClone(original);copy.damage=Math.max(1,Math.round(copy.damage*a.ratio));if(copy.mechanics)copy.mechanics.statuses=copy.mechanics.statuses.filter(x=>x.scope!=='self').map(x=>x.total===undefined?x:{...x,total:Math.round(x.total*a.ratio)});this.echoes.push({at:this.tick+(skill?.windup??0)+a.delay,skill:copy,targetId:e.alive?e.id:undefined,position:{...e.position},rule:r.id,retarget:a.retarget!==false});}}

  });
  for(const action of r.rule.after??[])this.comboAct({...r,action,rule:{...r.rule,after:undefined}},e,reference,depth,carried,skill,shield,dealt);
 }
 private comboNova(e:Entity,reference:number,depth:number,a:Extract<EffectAction,{type:'nova'}>,skill?:Skill){
  const center={...e.position},radius=a.radiusRef==='skill'?(skill?.radius??a.radius):a.radius,crowd=a.perCrowd?(this.upperBound?a.crowdCap??10:Math.min(a.crowdCap??10,this.nearbyEnemies(center,radius).filter(e=>e.alive&&distance(e.position,center)<=radius).length)):0,amount=Math.max(1,Math.round(reference*a.ratio*(1+(a.perCrowd??0)*crowd)));
  this.emit({...this.vfxContext,type:'effect_activated',id:this.playerId,position:center,radius,duration:12,skill:this.vfxContext?.vfxKey,tick:this.tick});
  let count=0;const candidates=a.at==='target'&&a.radius===0&&a.maxTargets===1?[e]:this.nearbyEnemies(center,radius+this.rules.bodyCollision.bossRadius);for(const n of candidates)if(n.alive&&distance(n.position,center)<=radius+this.bodyRadius(n)&&lineOfSight(this.region,center,n.position)&&count++<(a.maxTargets??Infinity)){const landed=this.damage(n,amount,true,this.vfxContext?.vfxKey,{category:'derived',damageType:a.damageType,penetration:this.stats.penetration??0,scaled:true,comboDepth:depth,...(a.crit?{effectCrit:true}:{})});if(landed&&n.alive&&a.status)this.applyStatus(n.id,a.status,this.playerId,this.vfxContext?.ruleId??'effect',skill);}
 }
 private comboShards(e:Entity,reference:number,depth:number,a:Extract<EffectAction,{type:'shards'}>){
  const origin={...e.position},start=this.random()*Math.PI*2,amount=Math.max(1,Math.round(reference*a.ratio));
  for(let i=0;i<a.count;i++){const angle=start+i*Math.PI*2/a.count,to={x:origin.x+Math.cos(angle)*a.range,y:origin.y+Math.sin(angle)*a.range};
   this.shoot(origin,to,amount,false,false,this.vfxContext?.vfxKey,.3,this.playerId);const shot=this.projectiles.at(-1)!;
   shot.hit.add(e.id);shot.damageType=a.damageType;shot.comboDepth=depth;shot.life=Math.max(1,Math.ceil(a.range/this.rules.aiRules.projectileSpeed));}
 }
 private comboStatus(a:Extract<EffectAction,{type:'status'}>,reference:number):StatusEffect{
  const dot=['bleed','burn','poison'].includes(a.status);
  return statusEffectSchema.parse({kind:a.status,duration:a.duration,strength:dot?0:a.strength,scope:'hit',cleanse:true,...(a.maxStacks?{maxStacks:a.maxStacks}:{}),...(a.stackMode?{stackMode:a.stackMode}:{}),...(a.onStacks?{onStacks:a.onStacks}:{}),...(dot?{interval:30,total:Math.max(1,Math.round(reference*a.ratio)),damageType:a.status==='burn'?'fire':a.status==='poison'?'poison':'physical'}:{})});
 }
 private comboSpread(e:Entity,a:Extract<EffectAction,{type:'spread'}>,carried:StatusInstance[]){
  const pool=carried.filter(x=>a.statuses.includes(x.effect.kind as never)&&x.sourceId===this.playerId);if(!a.seed&&!pool.length)return;
  const near=this.nearbyEnemies(e.position,a.radius).filter(n=>n.alive&&n.id!==e.id&&distance(n.position,e.position)<=a.radius&&lineOfSight(this.region,e.position,n.position)).sort((p,q)=>distance(p.position,e.position)-distance(q.position,e.position)||p.id.localeCompare(q.id)).slice(0,a.count);
  for(const n of near){if(a.seed)this.applyStatus(n.id,structuredClone(a.seed),this.playerId,this.vfxContext?.ruleId??'spread');else for(const x of pool)this.applyStatus(n.id,structuredClone(x.effect),this.playerId,x.skill);}
 }
 private comboCast(s:Skill,target:Entity|undefined,point:Vec){
  for(const r of this.combosFor('cast').filter(r=>!isComboRuleId(r.id)))if(this.comboMatches(r,{category:'direct',damageType:s.mechanics?.damageType??'physical',skill:s},s.mechanics?.damageType??'physical',target)&&this.comboReadyFor(r))this.comboAct(r,target??this.effectProxy(point),s.damage,1,[],s);this.fireEffects('cast',target,s.damage,s,[],0,true);

  const m=s.mechanics;if(!combatRules(this.stats).length||!m||s.damage<=0||m.schedule||!['single','area','projectile','zone','chain'].includes(s.kind)||!['enemy','ground'].includes(m.targeting))return;
  for(const r of this.combosFor('cast').filter(r=>isComboRuleId(r.id))){
   if(r.action.type!=='echo'||!this.comboMatches(r,{category:'direct',damageType:m.damageType,skill:s},m.damageType,target)||!this.comboReadyFor(r))continue;
   const copy=structuredClone(s),ratio=r.action.ratio;copy.damage=Math.max(1,Math.round(copy.damage*ratio));
   copy.mechanics!.statuses=copy.mechanics!.statuses.filter(x=>x.scope!=='self').map(x=>x.total!==undefined?{...x,total:Math.round(x.total*ratio)}:x);
   this.echoes.push({at:this.tick+s.windup+r.action.delay,skill:copy,targetId:target?.id,position:{...point},rule:r.id});return;
  }
 }
 private stepEchoes(){
  if(!this.echoes.length)return;const ready=this.echoes.filter(x=>x.at<=this.tick);this.echoes=this.echoes.filter(x=>x.at>this.tick);
  for(const x of ready){
   if(this.hero.hp<=0||this.actionBlocked(this.playerId)||this.hasStatus(this.playerId,'silence'))continue;
   let t=this.enemies.find(e=>e.id===x.targetId&&e.alive);
   if(!t&&x.skill.mechanics!.targeting==='enemy'){if(x.retarget===false)continue;const near=this.closest();t=near&&distance(near.position,this.hero.position)<=x.skill.range+1?near:undefined;if(!t)continue;}
   const p=t&&x.skill.kind!=='zone'?{...t.position}:x.position;
   this.withVfx({...(isComboRuleId(x.rule)?{}:{echo:true}),ruleId:x.rule,castId:++this.vfxSerial,sourceId:this.playerId,targetId:t?.id,vfxKey:'player/'+x.skill.id},()=>this.executeDeclared(x.skill,t,p));
  }
 }
 // General effects: the legacy seven actions and all new sources share one budget.
 private prepareEffectSkill(skill:Skill,target?:Entity,currentCastOnly=false){const buffs=this.effectBuffs(skill,target).filter(b=>currentCastOnly?b.action.currentCast:!b.action.currentCast),consumed=buffs.filter(b=>b.action.consume==='nextCast'||b.action.consume==='nextSkillCast');if(!consumed.length&&!buffs.some(b=>b.action.patches?.length))return skill;const copy=structuredClone(skill),scaling=hexDamageScale(consumed,0,skill.runtimeEffects?.hexDamageFactor??1,this.rules.hexPolicy?.damageMultiplierCap, true),mult=scaling.multiplier;copy.damage=Math.round(copy.damage*mult);if(this.rules.hexPolicy&&(consumed.some(b=>b.hexMechanism)||skill.runtimeEffects?.hexDamageFactor!==undefined))copy.runtimeEffects={...copy.runtimeEffects,hexDamageFactor:scaling.hexFactor};if(copy.mechanics)copy.mechanics.statuses=copy.mechanics.statuses.map(s=>s.total===undefined?s:{...s,total:s.kind==='poison'&&s.scope==='hit'?Math.floor(copy.damage/2):Math.round(s.total*mult)});if(consumed.some(b=>b.action.flags?.forceCrit))copy.runtimeEffects={...copy.runtimeEffects,forceCrit:true};if(consumed.some(b=>b.action.flags?.freeCost))copy.cost=0;const projectiles=buffAmount(consumed,'projectiles');if(projectiles&&copy.kind==='projectile')copy.projectiles=Math.min(15,(copy.projectiles??1)+projectiles);for(const b of buffs)for(const patch of b.action.patches??[]){const tags=resolvedSkillTags({...copy,category:skillCatalog.find(s=>s.id===copy.id)?.category});if(patch.skills&&!patch.skills.includes(copy.id)||patch.tags&&!patch.tags.some(t=>tags.includes(t as never)))continue;for(const op of patch.ops)if(op.path==='mechanics.projectile.returns'&&copy.mechanics?.projectile)copy.mechanics.projectile.returns=Boolean(op.value);}return copy;}
 private queueConsumedEcho(buffs:SelfBuff[],skill:Skill,target:Entity|undefined,position:Vec){for(const b of new Map(buffs.filter(b=>b.action.consume==='nextCast'&&b.action.echoOnConsume).map(b=>[b.id,b])).values()){const echo=b.action.echoOnConsume!,copy=structuredClone(skill);copy.damage=Math.round(copy.damage*echo.ratio);for(const status of copy.mechanics?.statuses??[])if(status.total!==undefined)status.total=status.kind==='poison'&&status.scope==='hit'?Math.floor(copy.damage/2):Math.round(status.total*echo.ratio);this.echoes.push({at:this.tick+echo.delay,skill:copy,targetId:target?.id,position:{...position},rule:b.id});}}
 private effectBuffs(skill?:Skill,target?:Entity,damageContext?:DamageContext):SelfBuff[]{
  const ctx=this.conditionContext(skill,target),list=activeBuffs(this.selfBuffs,this.tick,target?.id).filter(b=>(!b.requiresShield||this.hero.shield>0&&this.hero.shieldUntil>this.tick)&&(!b.when||b.when.every(c=>matches(c,ctx))));
  for(const r of combatRules(this.stats))if(r.trigger==='passive'&&r.action.type==='buff'&&this.comboMatches(r,damageContext??(skill?{category:'direct',damageType:skill.mechanics?.damageType??'physical',skill}:undefined),damageContext?.damageType??skill?.mechanics?.damageType??'physical',target)){
   if(r.action.firstPerTarget&&(!target||(this.comboCounts[r.id+'#first:'+target.id]??0)>=r.action.firstPerTarget))continue;
   // stepEffects没有目标/技能上下文；实际使用条件被动增益时
   // 每帧只记一次，不增加随机抽取。
   this.observeBuff(r);
   list.push({id:r.id,source:r.source,...(r.rule.hexMechanism?{hexMechanism:r.rule.hexMechanism}:{}),starts:0,ends:Number.MAX_SAFE_INTEGER,baseEnds:Number.MAX_SAFE_INTEGER,stacks:1,action:r.action,...(r.action.targetScoped?{targetId:target?.id}:{})});
  }return list.filter(b=>{const kind=b.action.consume;if(!kind||!['nextBasicHit','nextSkillHit','nextSkillCast'].includes(kind))return true;const source=attackSource(damageContext??(skill?{category:'direct',skill}:undefined),this.skills,this.vfxContext?.ruleId?'proc':this.vfxContext?.attackSource);return source===(kind==='nextBasicHit'?'basic':'cast');});
 }
 private buffValue(stat:string,skill?:Skill,target?:Entity){return buffAmount(this.effectBuffs(skill,target),stat);}
 private buffFlag(flag:string,skill?:Skill,target?:Entity,context?:DamageContext){return this.effectBuffs(skill,target,context).some(b=>(b.action.flags as Record<string,boolean>|undefined)?.[flag]);}
 private consumeBuffs(kind:'nextCast'|'nextMelee'|'nextHit',buffs:SelfBuff[],target?:Entity,skill?:Skill,reference=0){const ids=new Set(buffs.filter(b=>b.action.consume===kind||kind==='nextCast'&&b.action.consume==='nextSkillCast'||kind==='nextHit'&&['nextBasicHit','nextSkillHit'].includes(b.action.consume??'')).map(b=>b.id));for(const id of ids){const stats=this.effectStats[id]??={count:0,damage:0};stats.uses=(stats.uses??0)+1;}this.selfBuffs=this.selfBuffs.filter(b=>!ids.has(b.id));for(const id of ids){const r=combatRules(this.stats).find(r=>r.id===id);if(r)for(const action of r.rule.consumeEffects??[])this.comboAct({...r,action,rule:{...r.rule,after:undefined}},target??this.effectProxy(),reference,1,[],skill);}if(kind==='nextHit'&&target)for(const b of buffs)if(b.action.firstPerTarget){this.comboCounts[b.id+'#first:'+target.id]=(this.comboCounts[b.id+'#first:'+target.id]??0)+1;const rule=combatRules(this.stats).find(r=>r.id===b.id);if(rule)this.effectTriggered(rule);}}
 private effectProxy(point=this.hero.position):Entity{return {id:'effect-point',name:'',kind:'melee',x:point.x,y:point.y,position:{...point},hp:0,maxHp:0,alive:false,attack:0,elite:false,boss:false,art:'',cooldown:0,slow:0,burn:0,facing:1,action:'idle',actionUntil:0,reward:false};}
 private effectRef(ref:string|undefined,hit:number,target?:Entity,skill?:Skill,shield=0){switch(ref){case 'armor':return this.effectiveStats().armor;case 'attack':return this.stats.attack;case 'maxHp':return this.stats.hp;case 'maxMana':return this.stats.mana;case 'cost':return skill?.cost??0;case 'shield':return shield||this.effectShieldPeak||this.hero.shield;default:return hit;}}
 private fireEffects(trigger:EffectRule['trigger'],target?:Entity,reference=0,skill?:Skill,carried:StatusInstance[]=[],shield=0,nthOnly=false,statusKind?:DamageContext['statusKind'],healthBeforeDamage?:number){
  if(!carried.length&&target?.alive)carried=[...this.activeStatuses(target.id)];const ctx=skill||statusKind?{category:'direct' as const,damageType:skill?.mechanics?.damageType??'physical',...(skill?{skill}:{}),...(statusKind?{statusKind}:{})}:undefined;
  for(const r of combatRules(this.stats)){
   const nth=r.trigger==='nth'&&r.rule.count===trigger,match=!nthOnly&&(r.trigger===trigger||r.rule.also?.includes(trigger));if(!nth&&!match)continue;
   if(!this.comboMatches(r,ctx,ctx?.damageType??'physical',target,carried,healthBeforeDamage))continue;
   if(r.rule.status&&!carried.some(s=>s.effect.kind===r.rule.status))continue;
   if(r.rule.maxTriggers&&(this.effectStats[r.id]?.count??0)>=r.rule.maxTriggers)continue;
   if(trigger==='low_hp'){if(!r.when.some(c=>c.kind==='self_hp')&&this.hero.hp/this.stats.hp>=.3)continue;const key=r.id+'#low';if(this.comboCounts[key])continue;this.comboCounts[key]=1;}
   if(nth){const key=r.id+'#'+trigger;this.comboCounts[key]=(this.comboCounts[key]??0)+1;if(this.comboCounts[key]%r.every!)continue;}
   if(this.comboReadyFor(r))this.comboAct(r,target??this.effectProxy(),reference,1,carried,skill,shield);
  }
 }
 private stepEffects(){
  if(this.hexCombat&&(this.hero.hp<=0||this.region.rest||fieldRegionInfo(this.region.id)&&this.tick-this.hexCombat.lastDamage>=240))this.clearHexCombat();
  if(this.hero.hp<=0)return;if(this.effectMarks)this.effectMarks=this.effectMarks.filter(m=>m.ends>this.tick&&this.enemies.some(e=>e.id===m.targetId&&e.alive));this.selfBuffs=this.selfBuffs.filter(b=>b.ends>this.tick&&(!b.requiresShield||this.hero.shield>0&&this.hero.shieldUntil>this.tick));if(this.tick%15===0)for(const b of this.selfBuffs)if(b.aura)for(const e of this.nearbyEnemies(this.hero.position,b.aura.radius))if(e.alive&&distance(e.position,this.hero.position)<=b.aura.radius&&lineOfSight(this.region,this.hero.position,e.position))this.applyStatus(e.id,statusEffectSchema.parse({kind:b.aura.status,duration:Math.max(1,Math.min(30,b.ends-this.tick)),strength:b.aura.strength,scope:'hit',cleanse:true}),this.playerId,b.id);this.effectKillTicks=this.effectKillTicks.filter(t=>this.tick-t<=90);
  if(!this.effectsStarted&&this.enemies.some(e=>e.alive&&distance(e.position,this.hero.position)<=this.rules.aiRules.activeRadius)){this.effectsStarted=true;this.conditionClock.start=this.tick;this.fireEffects('combat_start',this.closest());}
  for(const r of combatRules(this.stats)){
   if(r.trigger==='passive'&&r.action.type==='buff'&&!r.action.firstPerTarget){const active=this.comboMatches(r,undefined,'physical');if(active)this.observeBuff(r);this.effectPassive[r.id]=active;}
   if(r.trigger==='low_hp'&&!r.when.every(c=>matches(c,this.conditionContext())))this.comboCounts[r.id+'#low']=0;
   if(r.rule.hexMechanism?r.trigger!=='moved'&&!this.hexCombat:!this.effectsStarted)continue;
   if(r.trigger==='interval'&&((this.tick===(r.rule.hexMechanism?this.hexCombat!.started:this.conditionClock.start)&&r.rule.startReady)||(this.tick-(r.rule.hexMechanism?this.hexCombat!.started:this.conditionClock.start))>0&&(this.tick-(r.rule.hexMechanism?this.hexCombat!.started:this.conditionClock.start))%r.every! ===0)){if(this.comboMatches(r,undefined,'physical',this.closest())&&this.comboReadyFor(r))this.comboAct(r,this.closest()??this.effectProxy(),this.stats.attack,1,[]);}
   if(r.trigger==='moved'||r.trigger==='mana_spent'){let progress=r.trigger==='moved'?this.effectMoved:this.conditionClock.manaSpent;if(r.trigger==='moved'&&r.rule.hexMechanism){const at=r.id+'#moveAt',distance=r.id+'#distance';this.comboCounts[distance]=(this.comboCounts[distance]??0)+Math.max(0,this.effectMoved-(this.comboCounts[at]??this.effectMoved));this.comboCounts[at]=this.effectMoved;progress=this.comboCounts[distance];}const n=Math.floor(progress/r.every!),key=r.id+'#threshold',last=this.comboCounts[key]??0;this.comboCounts[key]=n;for(let i=last;i<n;i++)if(this.comboMatches(r,undefined,'physical',this.closest())&&this.comboReadyFor(r))this.comboAct(r,this.closest()??this.effectProxy(),this.stats.attack,1,[]);}
  }
  // 额外冷却帧复用已按角色分隔并进入检查点的计数。
  // 小数余量按技能保存，技能已经就绪时不积攒额度。
  const recoveryBuffs=this.effectBuffs(),recovery=Math.max(0,buffAmount(recoveryBuffs.filter(b=>!this.rules.hexPolicy||!b.hexMechanism),'cooldownRecovery')),hexRecovery=this.rules.hexPolicy?Math.max(0,buffAmount(recoveryBuffs.filter(b=>b.hexMechanism),'cooldownRecovery')):0;
  for(const skill of this.skills){
   const key='cooldownRecovery#'+skill.id;
   const pending=(skill.charges??1)>1?this.chargeInfo(skill).available<(skill.charges??1):(this.cooldowns[skill.id]??0)>this.tick;
   const hexKey='hex-cooldown-credit#'+skill.id;
   if(pending&&hexRecovery){const credit=(this.comboCounts[hexKey]??0)+hexRecovery,extra=Math.floor(credit+1e-9);this.comboCounts[hexKey]=credit-extra;if(extra)this.reduceHexCooldown(skill.id,extra);}else if(this.comboCounts[hexKey]!==undefined)this.comboCounts[hexKey]=0;
   if(!pending||!recovery){this.comboCounts[key]=0;continue;}
   const credit=(this.comboCounts[key]??0)+recovery,extra=Math.floor(credit+1e-9);
   this.comboCounts[key]=credit-extra;if(extra)this.adjustCooldown(skill.id,extra);
  }
  for(const b of this.selfBuffs)if(b.ends>this.tick){const r=combatRules(this.stats).find(r=>r.id===b.id);if(r&&(!b.when||b.when.every(c=>matches(c,this.conditionContext()))))this.observeBuff(r,false);}
  this.fireEffects('low_hp',this.closest());this.observeShield();
 }
 private remainingCooldown(s:Skill){return (s.charges??1)>1?this.chargeInfo(s).next:Math.max(0,(this.cooldowns[s.id]??0)-this.tick);}
 private recordShield(key:'shield_gain'|'shield_break'|'shield_expire'){const stats=this.effectStats[key]??={count:0,damage:0};stats.count++;}
 private observeBuff(r:ExecutableRule,passive=true){const key=r.id+'#activeFrame',last=this.comboCounts[key],stats=this.effectStats[r.id]??={count:0,damage:0};if(last===this.tick)return;if(last===undefined||last<this.tick-1){stats.activations=(stats.activations??0)+1;if(passive)this.effectTriggered(r);}stats.activeFrames=(stats.activeFrames??0)+1;this.comboCounts[key]=this.tick;}
 private observeShield(){const now=this.hero.shield;if(now>this.effectObservedShield){this.recordShield('shield_gain');this.effectShieldPeak=Math.max(this.effectShieldPeak,now);this.effectObservedShield=now;this.fireEffects('shield_gain',this.closest(),now,undefined,[],now);}else{this.effectObservedShield=now;if(now<=0)this.effectShieldPeak=0;}}
 private effectBuff(r:ExecutableRule,a:Extract<EffectAction,{type:'buff'}>,target:Entity){
  if(r.rule.hexMechanism&&this.rules.hexPolicy&&this.rules.hexPolicy.version>=2&&a.flags?.immortal)a={...a,duration:Math.min(a.duration,this.rules.hexPolicy.invulnerabilityMaxTicks),untilCombatEnd:false};
  const phase=((this.effectStats[r.id]?.count??1)-1);if(a.alternate?.length)a={...a,mods:a.alternate[phase%a.alternate.length]};const variant=a.variants?.[phase%(a.variants?.length??1)];if(variant)a={...a,mods:variant.mods};this.selfBuffs=putBuff(this.selfBuffs,r,a,this.tick,target.id);this.observeBuff(r,false);if(variant)this.selfBuffs.find(b=>b.id===r.id)!.when=variant.when;
  if(a.flags?.immortal){if(a.flags.surviveAtOne)this.hero.hp=1;this.guardianUsed.delete(this.playerId);this.applyStatus(this.playerId,statusEffectSchema.parse({kind:'guardian',duration:a.duration,strength:0,scope:'self',cleanse:false,reviveRatio:a.mods.reviveRatio??1/this.stats.hp}),this.playerId,r.id);this.applyStatus(this.playerId,statusEffectSchema.parse({kind:'immunity',duration:a.duration,strength:0,scope:'self',cleanse:false,immunityTypes:['physical','fire','cold','lightning','arcane','shadow','poison','pure']}),this.playerId,r.id);}
 }
 private effectShield(r:ExecutableRule,a:Extract<EffectAction,{type:'shield'}>,target:Entity,reference:number){const amount=Math.max(0,Math.round(this.effectRef(a.ref,reference,target)*a.ratio));const before=this.hero.shield,isHex=Boolean(r.rule.hexMechanism&&this.rules.hexPolicy);this.hero.shield=isHex?before+this.reserveHexRecovery(Math.max(0,amount-before)):Math.max(before,amount);this.hero.shieldUntil=Math.max(this.hero.shieldUntil,this.tick+a.duration);this.emit({...this.vfxContext,type:'shielded',id:this.playerId,position:{...this.hero.position},amount:isHex?this.hero.shield-before:amount,shieldPhase:'applied',shieldRemaining:this.hero.shield,tick:this.tick});if(a.mods||a.aura){this.effectBuff(r,{type:'buff',duration:a.duration,maxStacks:1,mods:a.mods??{}},target);const b=this.selfBuffs.find(b=>b.id===r.id)!;b.requiresShield=true;b.aura=a.aura;}if(a.aura)for(const e of this.nearbyEnemies(this.hero.position,a.aura.radius))if(e.alive&&distance(e.position,this.hero.position)<=a.aura.radius)this.applyStatus(e.id,statusEffectSchema.parse({kind:a.aura.status,duration:a.duration,strength:a.aura.strength,scope:'hit',cleanse:true}),this.playerId,r.id);this.observeShield();}
 private effectHeal(r:ExecutableRule,a:Extract<EffectAction,{type:'heal'}>,target:Entity,reference:number){const amount=Math.round(this.effectRef(a.ref,reference,target)*a.ratio);if(amount<0){this.hero.hp=Math.max(a.nonlethal?1:0,this.hero.hp+amount);return;}const overflow=Math.max(0,amount-(this.stats.hp-this.hero.hp));this.restoreResources(amount,0,r.id);if(a.overflowShield&&overflow){const target=Math.min(this.stats.hp*a.overflowShield,this.hero.shield+overflow);this.hero.shield=r.rule.hexMechanism&&this.rules.hexPolicy?this.hero.shield+this.reserveHexRecovery(Math.max(0,target-this.hero.shield)):target;this.hero.shieldUntil=Math.max(this.hero.shieldUntil,this.tick+300);this.observeShield();}}
 private effectCooldown(a:Extract<EffectAction,{type:'cooldown'}>,skill?:Skill,hexMechanism?:string){let ids=this.skills.map(s=>s.id);if(a.mode==='current')ids=skill?[skill.id]:[];if(a.mode==='others')ids=ids.filter(id=>id!==skill?.id);if(a.mode==='random')ids=ids.length?[ids[Math.floor(this.random()*ids.length)]]:[];for(const id of ids){const s=this.skills.find(s=>s.id===id)!,ticks=Math.round((a.ticks??0)+(a.fraction?this.finalCooldown(s)*a.fraction:0));if(hexMechanism&&this.rules.hexPolicy)this.reduceHexCooldown(id,a.reset?this.remainingCooldown(s):ticks,hexMechanism);else this.adjustCooldown(id,ticks,a.reset??false);}}
 private effectField(r:ExecutableRule,a:Extract<EffectAction,{type:'field'}>,target:Entity,reference:number,skill?:Skill){if(a.orbit){const count=a.projectiles??3,s:Skill={id:r.id,name:r.name,description:r.description,kind:'projectile',damage:Math.round(reference*a.ratio)*count,range:a.radius,radius:.25,cooldown:1,cost:0,windup:0,duration:a.duration,projectiles:count,mechanics:{damageType:a.damageType,targeting:'self',projectile:{orbit:{duration:a.duration,radius:a.radius,interval:a.interval,speed:.14},collisionRadius:.25,penetrations:0,turnRate:0,explosionRadius:0},statuses:[]}};this.executeDeclared(s,undefined,{...this.hero.position});return;}const point=a.at==='self'?this.hero.position:target.position;const length=distance(this.effectLastPosition,this.hero.position),segments=Math.min(32,Math.max(1,Math.ceil(length/Math.max(.5,a.radius))));const positions=a.at==='path'?Array.from({length:segments+1},(_,i)=>({x:this.effectLastPosition.x+(this.hero.position.x-this.effectLastPosition.x)*i/segments,y:this.effectLastPosition.y+(this.hero.position.y-this.effectLastPosition.y)*i/segments})):[point];for(const p of positions){if(a.duration<=1&&a.pull){for(const e of this.nearbyEnemies(p,a.radius))if(e.alive&&distance(e.position,p)<=a.radius)this.pullEnemy(e,p,a.pull);this.emit({...this.vfxContext,type:'effect_activated',id:this.playerId,position:{...p},radius:a.radius,duration:6,tick:this.tick});continue;}const s:Skill={id:r.id,name:r.name,description:r.description,kind:'zone',damage:Math.max(0,Math.round(reference*a.ratio)),radius:a.radius,range:99,cooldown:1,cost:0,windup:0,duration:a.duration,mechanics:{damageType:a.damageType,targeting:'ground',zone:{mode:'periodic',hits:Math.max(1,Math.ceil(a.duration/a.interval)),interval:a.interval,firstDelay:0,pullSpeed:a.pull??0,budget:'per_tick'},statuses:(a.statuses??[]).map(kind=>statusEffectSchema.parse({kind,duration:a.duration,scope:'zone',cleanse:true,strength:fieldStatusStrength,...(['burn','poison','bleed'].includes(kind)?{interval:30,total:Math.round(reference*a.ratio),damageType:a.damageType}:{} )}))}};this.zones.push({...this.vfxContext,id:++this.serial,position:{...p},radius:a.radius,damage:s.damage,life:a.duration,delay:0,enemy:false,slow:false,skill:r.id,started:this.tick,resolvedSkill:s,nextHit:this.tick,hitIndex:0,damageType:a.damageType});}}
 private effectDetonate(r:ExecutableRule,a:Extract<EffectAction,{type:'detonate'}>,target:Entity,carried:StatusInstance[]){
  if(a.budget==='perTarget'){
   // Snapshot every eligible target before damage/kill chains can alter its DOTs.
   const candidates=a.radius?this.nearbyEnemies(target.position,a.radius):[target];
   const plan=candidates.filter(e=>e.alive&&(e.id===target.id||distance(e.position,target.position)<=a.radius!)).map(e=>({e,statuses:this.activeStatuses(e.id).filter(x=>a.statuses.includes(x.effect.kind)&&periodicDamageKinds.some(kind=>kind===x.effect.kind)&&remainingStatusDamage(x,this.tick)>0)})).filter(p=>p.statuses.length).map(p=>({...p,amount:Math.round(p.statuses.reduce((sum,x)=>sum+remainingStatusDamage(x,this.tick),0)*a.ratio)}));
   for(const {e,statuses,amount} of plan){if(!e.alive)continue;if(a.remove)for(const status of statuses)this.removeStatus(status,'consumed');this.damage(e,amount,true,r.id,{category:'derived',damageType:statuses[0].effect.damageType??'physical',scaled:true,comboDepth:1});}return;
  }
  // Omitted budget preserves frozen pre-HEX rules, including their splash semantics.
  const statuses=carried.filter(x=>a.statuses.includes(x.effect.kind)),remaining=statuses.reduce((n,x)=>{return n+remainingStatusDamage(x,this.tick);},0),amount=Math.round(remaining*a.ratio);if(a.remove)for(const x of this.activeStatuses(target.id).filter(x=>a.statuses.includes(x.effect.kind)))this.removeStatus(x,'consumed');for(const e of this.nearbyEnemies(target.position,a.radius??.1))if(e.alive&&(e.id===target.id||a.radius&&distance(e.position,target.position)<=a.radius))this.damage(e,amount,true,r.id,{category:'derived',damageType:statuses[0]?.effect.damageType??'physical',scaled:true,comboDepth:1});
 }
 private effectBlink(a:Extract<EffectAction,{type:'blink'}>){
  const origin={...this.hero.position},near=this.nearbyEnemies(origin,8).filter(e=>e.alive&&distance(e.position,origin)<=8).sort((a,b)=>a.id.localeCompare(b.id));if(!near.length)return;
  const center=near.reduce((p,e)=>({x:p.x+e.position.x/near.length,y:p.y+e.position.y/near.length}),{x:0,y:0}),length=distance(origin,center);if(length<1e-9)return;
  const destination={x:origin.x+(origin.x-center.x)/length*a.distance,y:origin.y+(origin.y-center.y)/length*a.distance};
  this.hero.position=moveBody(this.region,origin,destination,a.distance,this.rules.bodyCollision.heroRadius,[...this.enemyBodies(origin,a.distance+2),...this.playerBodies(this.playerId)],false);
  const moved=distance(origin,this.hero.position);if(moved>0)this.emit({...this.vfxContext,type:'displaced',id:this.playerId,position:{...this.hero.position},origin,amount:moved,skill:this.vfxContext?.ruleId,tick:this.tick});
 }
 private effectExtend(a:Extract<EffectAction,{type:'extend'}>,target:Entity){const statuses=[...(a.statuses?this.activeStatuses(target.id).filter(x=>a.statuses!.includes(x.effect.kind)):[]),...(a.buff?this.activeStatuses(this.playerId).filter(x=>x.skill===a.buff):[])];for(const x of new Set(statuses)){const max=a.maxMode==='absolute'?x.started+a.max:(x.baseEnds??x.started+x.effect.duration)+a.max;const hexImmunity=x.effect.kind==='immunity'&&this.stats.rules?.some(r=>r.id===x.skill&&r.hexMechanism)&&this.rules.hexPolicy&&this.rules.hexPolicy.version>=2?x.started+this.rules.hexPolicy.invulnerabilityMaxTicks:Infinity;x.ends=Math.min(max,hexImmunity,x.ends+a.duration);}if(a.buff)for(const b of this.selfBuffs)if(b.id===a.buff)b.ends=Math.min(a.maxMode==='absolute'?b.starts+a.max:b.baseEnds+a.max,b.ends+a.duration,b.hexMechanism&&b.action.flags?.immortal&&this.rules.hexPolicy&&this.rules.hexPolicy.version>=2?b.starts+this.rules.hexPolicy.invulnerabilityMaxTicks:Infinity);}
 private effectArc(r:ExecutableRule,a:Extract<EffectAction,{type:'arc'}>,target:Entity,reference:number){const used=new Set([target.id]);let from=target;for(let i=0;i<a.count;i++){const next=this.nearbyEnemies(from.position,a.range).filter(e=>e.alive&&!used.has(e.id)&&distance(e.position,from.position)<=a.range&&lineOfSight(this.region,from.position,e.position)).sort((x,y)=>distance(x.position,from.position)-distance(y.position,from.position)||x.id.localeCompare(y.id))[0];if(!next)break;used.add(next.id);const landed=this.damage(next,Math.round(reference*a.ratio*(this.buffFlag('noChainDecay')?1:a.decay**i)),true,r.id,{category:'derived',damageType:a.damageType,scaled:true,comboDepth:1});if(landed&&next.alive&&a.status)this.applyStatus(next.id,a.status,this.playerId,r.id);from=next;}}

 private enemyDamageType(skill?:string):DamageType{const monster=this.rules.monsterSkills[skill??''];if(monster?.damageType)return checkedDamageType(monster.damageType);const chapter=this.rules.chapterDamageTypes?.[skill??''];if(chapter)return checkedDamageType(chapter);if(skill&&this.rules.chapterDamageTypes&&!['basic-melee','basic-ranged','basic-area'].includes(skill))throw Error('Undeclared damage type: '+skill);return 'physical';}
 private hurt(amount:number,skill?:string,context?:DamageContext){
  if(amount<=0||this.hero.hp<=0||this.players.size&&!this.players.get(this.playerId)?.active)return false;
  const category=context?.category??'direct',damageType=checkedDamageType(context?.damageType??this.enemyDamageType(skill)),permissions=(this.rules.damagePermissions??damagePermissions)[category],source=this.vfxContext?.sourceId;
  if(this.activeStatuses(this.playerId).some(s=>s.effect.kind==='immunity'&&s.effect.immunityTypes?.includes(damageType))){this.emit({...this.vfxContext,type:'status_changed',id:this.playerId,position:{...this.hero.position},skill,status:'immunity',change:'immune',amount:0,damageType,category,tick:this.tick});return true;}
  if(category==='direct'&&source&&this.strength(source,'blind')>0&&this.random()<this.strength(source,'blind')){this.emit({...this.vfxContext,type:'missed',id:this.playerId,position:{...this.hero.position},amount:0,skill,category,damageType,tick:this.tick});return;}
  if(category==='direct'&&this.conditionalValue('dodge')>0&&this.random()<Math.min(1,this.conditionalValue('dodge'))){this.events.push({type:'status_changed',id:this.playerId,position:{...this.hero.position},amount:0,skill:'dodge',tick:this.tick});this.fireEffects('dodge',this.enemies.find(e=>e.id===source),amount);return false;}
  const attacker=this.enemies.find(e=>e.id===source),shieldBefore=this.hero.shield;const hexReduction=this.rules.hexPolicy?buffAmount(this.effectBuffs(undefined,attacker).filter(b=>b.hexMechanism),'damageReduction'):0;let reduction=Math.max(0,Math.min(.5,this.conditionalValue('damageReduction',undefined,attacker)-hexReduction)),hexReduce=Math.max(0,hexReduction);for(const r of this.combosFor('passive'))if(r.action.type==='reduce'&&this.comboMatches(r,undefined,damageType,attacker)){if(r.rule.hexMechanism&&this.rules.hexPolicy)hexReduce=1-(1-hexReduce)*(1-r.action.ratio);else reduction=1-(1-reduction)*(1-r.action.ratio);this.effectTriggered(r);}if(this.rules.hexPolicy)reduction=1-(1-reduction)*(1-Math.min(this.rules.hexPolicy.damageReductionCap,hexReduce));if(reduction)amount=Math.max(1,Math.round(amount*(1-reduction)));
  const blockChance=Math.min(.5,this.conditionalValue('blockChance',undefined,attacker));if(category==='direct'&&blockChance>0&&(this.upperBound||this.random()<blockChance)){const prevented=Math.floor(amount*.5);amount-=prevented;this.fireEffects('block',attacker,prevented);}
  // 2026-10-07 受伤顺序：伤害减免 → 格挡 → 护甲（按原始命中统一减免全部类型）→ 元素抗性（全抗＋对应元素，上限 75%，物理与真实伤害不吃抗性）→ 护盾。
  const armored=damageType==='pure'?amount:armorMitigation(amount,this.effectiveStats().armor,this.rules.combatNumerics?.armor??combatNumerics.legacyArmor).damage,resist=damageType==='physical'||damageType==='pure'?0:Math.min(.75,this.conditionalValue('allResist')+this.conditionalValue(damageType+'Resist')),damage=resist>0?Math.max(1,Math.round(armored*(1-resist))):armored,blocked=Math.min(damage,this.hero.shield);let loss=Math.min(this.hero.hp,damage-blocked);this.hero.shield-=blocked;
  const counter=this.activeStatuses(this.playerId).find(s=>s.effect.kind==='counter');
  if(blocked>0){this.emit({...this.vfxContext,type:'shielded',id:this.playerId,position:{...this.hero.position},amount:blocked,skill,tick:this.tick,shieldPhase:'absorbed',shieldRemaining:this.hero.shield});if(counter&&permissions.counter&&source){const attacker=this.enemies.find(e=>e.id===source&&e.alive),radius=counter.effect.radius??this.skills.find(s=>s.id===counter.skill)?.radius??0;if(attacker&&distance(attacker.position,this.hero.position)<=radius&&lineOfSight(this.region,this.hero.position,attacker.position)){const vfx={sourceId:counter.sourceId,targetId:attacker.id,castId:counter.castId,vfxKey:'player/'+counter.skill};this.withVfx(vfx,()=>this.damage(attacker,Math.round(blocked*counter.effect.strength),true,counter.skill,{category:'derived',damageType:'physical',scaled:true}));}}}
  if(shieldBefore>0&&this.hero.shield<=0){this.recordShield('shield_break');this.selfBuffs=this.selfBuffs.filter(b=>!b.requiresShield);this.fireEffects('shield_break',attacker,shieldBefore,undefined,[],this.effectShieldPeak||shieldBefore);this.effectObservedShield=this.hero.shield;}if(loss>=this.hero.hp)this.fireEffects('lethal',attacker,loss);loss=Math.min(this.hero.hp,damage-blocked);
  // Standalone last-stand protects this hit and subsequent hits only while its buff is live.
  // Keep the existing immortal/guardian revival path unchanged for frozen rules.
  if(this.effectBuffs().some(b=>b.action.flags?.surviveAtOne&&!b.action.flags.immortal))loss=Math.min(loss,Math.max(0,this.hero.hp-1));
  const guardian=this.activeStatuses(this.playerId).find(s=>s.effect.kind==='guardian');
  if(loss>=this.hero.hp&&guardian&&!this.guardianUsed.has(this.playerId)){this.guardianUsed.add(this.playerId);this.removeStatus(guardian,'consumed');this.hero.hp=Math.max(1,Math.round(this.stats.hp*(guardian.effect.reviveRatio??.3)));this.emit({sourceId:guardian.sourceId,targetId:this.playerId,castId:guardian.castId,vfxKey:'player/'+guardian.skill,type:'revived',id:this.playerId,position:{...this.hero.position},amount:this.hero.hp,skill:guardian.skill,tick:this.tick});}
  else this.hero.hp=Math.max(0,this.hero.hp-loss);
  if(loss>0||blocked>0)this.noteHexDamage();if(this.hero.hp<=0)this.clearHexCombat();if(this.hero.hp>0){this.fireEffects('low_hp',attacker,loss);this.fireEffects('hurt',attacker,loss);}if(loss>0)this.hurtAt=this.tick;if(loss>0||blocked>0)this.combatAt=this.tick;
  for(const x of [...this.activeStatuses(this.playerId)])if(loss>0&&x.effect.breakOnDamage)this.removeStatus(x,'broken');
  this.events.push({...this.vfxContext,type:'hit_resolved',id:this.playerId,targetId:this.playerId,position:{...this.hero.position},amount:loss,blocked,skill,category,damageType,status:context?.statusKind,tick:this.tick});
  if(this.hero.hp===0){this.resetHexCooldownLedger();this.interruptActor(this.playerId);this.clearStatuses(this.playerId,'death');this.emit({...this.vfxContext,type:'entity_died',id:this.playerId,position:{...this.hero.position},tick:this.tick});}
  return true;
 }
 private shoot(from:Vec,to:Vec,damage:number,enemy:boolean,pierce=false,skill?:string,radius?:number,owner?:string,targetId?:string){const d=distance(from,to)||1;this.projectiles.push({...this.vfxContext,id:++this.serial,position:{...from},direction:{x:(to.x-from.x)/d,y:(to.y-from.y)/d},damage,life:this.rules.aiRules.projectileTicks,enemy,pierce,skill,radius,owner:owner??this.vfxContext?.sourceId,targetId:targetId??this.vfxContext?.targetId,origin:{...from},target:{...to},hit:new Set()});}
 private moveEnemy(e:Entity,to:Vec,speed:number,pathing=true){
 if(this.movementBlocked(e.id))return;
 const before={...e.position},radius=this.bodyRadius(e);let goal=to;
 // A clear sight ray does not guarantee that the whole body fits past a corner.
 if(pathing&&terrainContact(this.region,e.position,to,radius)!==null){
 // Empty routes are cached too; an unreachable target must not run A* every tick.
 if(!e.path||e.pathTick===undefined||e.pathTick+45<this.tick){e.path=findPath(this.region,e.position,to,radius);e.pathTick=this.tick;}
 while(e.path?.length&&distance(e.position,e.path[0])<.3)e.path.shift();
 if(e.path?.length)goal=e.path[0];
 }
 e.position=moveBody(this.region,before,goal,speed,radius,[...this.enemyBodies(e.position,speed+2,e),...this.playerBodies()],speed<.5);this.grid.update(e,before);
 }
 private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 private bodyRadius(e:Entity){return e.boss?this.rules.bodyCollision.bossRadius:e.elite?this.rules.bodyCollision.eliteRadius:this.rules.bodyCollision.enemyRadius;}
 /** Ordinary mobs may overlap each other; players and elite/boss pairs retain contact. */
 private collideEnemies(a:Entity,b:Entity){return a.elite||a.boss||b.elite||b.boss;}
 private enemyBodies(position:Vec,reach:number,mover?:Entity):Body[]{return (Number.isFinite(reach)?this.grid.near(position,reach):this.enemies).filter(e=>e.alive&&e.id!==mover?.id&&(!mover||this.collideEnemies(mover,e))&&distance(e.position,position)<reach).map(e=>({id:e.id,position:e.position,radius:this.bodyRadius(e)}));}
 private separateBodies(){
  this.refreshSpatial();const alive=this.activeEnemies().filter(e=>e.alive);const hero:Body={id:this.playerId,position:this.hero.position,radius:this.rules.bodyCollision.heroRadius};let stable=false;
  for(let pass=0;pass<12;pass++){
   let changed=false;if(!this.region.activationRadius)this.grid.rebuild(alive);
   for(const e of alive){const body:Body={id:e.id,position:e.position,radius:this.bodyRadius(e)};
    for(const other of [...this.playerBodies(),...this.grid.near(e.position,2).filter(n=>n.id!==e.id&&this.collideEnemies(e,n)).map(n=>({id:n.id,position:n.position,radius:this.bodyRadius(n)}))]){
     const overlap=body.radius+other.radius-distance(body.position,other.position);if(overlap<=1e-5)continue;
     const normal=contactNormal(body,other),amount=overlap+1e-4;let next={x:e.position.x+normal.x*amount,y:e.position.y+normal.y*amount};
     const heroGap=distance(next,hero.position),heroReach=body.radius+hero.radius;
     if(heroGap<heroReach){const away=contactNormal({...body,position:next},hero);next={x:hero.position.x+away.x*(heroReach+1e-4),y:hero.position.y+away.y*(heroReach+1e-4)};}
     if(walkable(this.region,next,body.radius)){const before=e.position;e.position=next;body.position=next;this.grid.update(e,before);changed=true;}
    }
   }
   if(!changed){stable=true;break;}
  }
  this.separatedCount=stable?this.enemies.length:-1;
 }

 private startBossCast(e:Entity):boolean{
  const bossData=this.getBossDefinition(this.bossKey(e));
  if(!e.boss||!bossData||!('skills' in bossData))return false;
  
  // 检查是否已有未完成的施法
  if(this.bossCasts.some(c=>c.owner===e.id&&!c.resolved))return true;
  if((this.bossSkillAt.get(e.id)??30)>this.tick||distance(e.position,this.hero.position)>this.rules.aiRules.activeRadius)return false;
  
  // 更新BOSS阶段
  const hpRatio=e.hp/e.maxHp;
  const newPhase=e.monster?.bossPhaseMode==='single'?1:this.getBossPhase(this.bossKey(e),hpRatio);
  if(e.currentPhase!==newPhase){
    e.currentPhase=newPhase;
    this.events.push({type:'phase_changed',id:e.id,position:{...e.position},phase:newPhase,tick:this.tick});
  }
  
  // 获取当前阶段可用技能
  const availableSkills=this.getAvailableSkills(this.bossKey(e),e.currentPhase||1);
  if(!availableSkills.length)return false;
  
  // 选择技能（优先选择非冷却中的技能）
  if(!e.skillCooldowns)e.skillCooldowns=new Map();
  const readySkills=availableSkills.filter(s=>!e.skillCooldowns!.has(s.id)||e.skillCooldowns!.get(s.id)!<=this.tick);
  if(!readySkills.length)return false;
  
  // 随机选择一个技能
  const skill=readySkills[Math.floor(this.random()*readySkills.length)];
  
  // 创建施法
  const cast:BossCast={
    id:++this.serial,
    owner:e.id,
    skill:skill.id as any,
    position:{...e.position},
    target:{...this.hero.position},
    started:this.tick,
    ends:this.tick+skill.windup,
    damage:0,
    interrupted:false,
    resolved:false,
    expires:this.tick+skill.windup+60,
    phase:e.currentPhase||1
  };
  
  this.bossCasts.push(cast);
  e.skillCooldowns.set(skill.id,this.tick+skill.cooldown);
  e.action='skill';
  e.actionUntil=cast.ends;
  e.cooldown=cast.ends+30;
  
  // 创建预警UI
  this.createWarning(skill,cast);
  
  this.events.push({castId:cast.id,sourceId:e.id,vfxKey:'boss/'+skill.id,type:'cast_started',id:e.id,position:cast.position,target:cast.target,skill:skill.id,tick:this.tick,windup:skill.windup});
  this.events.push({castId:cast.id,sourceId:e.id,vfxKey:'boss/'+skill.id,type:'danger_started',id:e.id,position:cast.target,skill:skill.id,tick:this.tick});
  return true;
 }
 
 private createWarning(skill:any,cast:BossCast){
  // 根据技能类型创建预警
  if(skill.warning==='ground'){
    this.warnings.push({
      id:++this.serial,
      type:'ground_circle',
      position:{...cast.target},
      radius:skill.radius||4,
      color:'red',
      expires:cast.ends,
      skillName:skill.name
    });
  }else if(skill.warning==='countdown'){
    this.warnings.push({
      id:++this.serial,
      type:'countdown',
      countdown:Math.ceil(skill.windup/30),
      expires:cast.ends,
      skillName:skill.name,
      color:'red'
    });
  }else if(skill.warning==='charge_bar'){
    this.warnings.push({
      id:++this.serial,
      type:'charge_bar',
      chargeProgress:0,
      expires:cast.ends,
      skillName:skill.name,
      canInterrupt:skill.interruptible,
      color:'purple'
    });
  }else if(skill.warning==='screen_shake'){
    this.warnings.push({
      id:++this.serial,
      type:'screen_shake',
      expires:cast.ends,
      skillName:skill.name,
      color:'orange'
    });
  }
 }
 
 private updateWarnings(){
  // 更新所有预警UI
  for(const w of this.warnings){
    if(w.type==='countdown'){
      w.countdown=Math.ceil((w.expires-this.tick)/30);
    }else if(w.type==='charge_bar'){
      const cast=this.bossCasts.find(c=>!c.resolved);
      if(cast){
        w.chargeProgress=(this.tick-cast.started)/(cast.ends-cast.started);
      }
    }
  }
  // 移除过期的预警
  this.warnings=this.warnings.filter(w=>w.expires>this.tick);
 }
 
 private resolveBossCasts(){
  for(const c of this.bossCasts){
    const owner=this.enemies.find(e=>e.id===c.owner);
    if(!owner?.alive&&!c.resolved){c.interrupted=true;c.resolved=true;c.expires=this.tick+15;}
    if(c.resolved||c.ends>this.tick||!owner?.alive)continue;
    c.resolved=true;
    
    const bossData=this.getBossDefinition(this.bossKey(owner));
    if(!bossData||!('skills' in bossData))continue;
    
    const skillDef=bossData.skills.find((s:any)=>s.id===c.skill);
    if(!skillDef)continue;
    
    this.events.push({castId:c.id,sourceId:owner.id,vfxKey:'boss/'+c.skill,type:'cast_released',id:owner.id,position:c.position,target:c.target,skill:c.skill,tick:this.tick});
    // 执行技能效果
    if(skillDef.kind==='projectile'){
      this.withVfx({castId:c.id,sourceId:owner.id,targetId:this.playerId,vfxKey:'boss/'+c.skill},()=>this.shoot(c.position,c.target,Math.round(this.enemySpellAttack(owner)*(skillDef.damage||1)),true,false,c.skill));
    }else if(skillDef.kind==='zone'){
      this.zones.push({
        castId:c.id,sourceId:owner.id,targetId:this.playerId,vfxKey:'boss/'+c.skill,skill:c.skill,started:this.tick,id:++this.serial,
        position:{...c.target},
        radius:skillDef.radius||4,
        damage:Math.round(this.enemySpellAttack(owner)*(skillDef.damage||1)),
        life:skillDef.duration||90,
        delay:skillDef.delay||0,
        enemy:true,
        slow:'slow' in skillDef?skillDef.slow:false
      });
    }else if(skillDef.kind==='trap'){
      // 陷阱类技能（延迟伤害）
      this.zones.push({
        castId:c.id,sourceId:owner.id,targetId:this.playerId,vfxKey:'boss/'+c.skill,skill:c.skill,started:this.tick,id:++this.serial,
        position:{...c.target},
        radius:skillDef.radius||3,
        damage:Math.round(this.enemySpellAttack(owner)*(skillDef.damage??1)),
        life:1,
        delay:'delay' in skillDef?skillDef.delay:150,
        enemy:true,
        slow:false
      });
    }else if(skillDef.kind==='summon'){
      // 召唤技能
      if(c.skill==='ritual'&&!c.interrupted){
        const free=Math.max(0,this.rules.aiRules.summonCap-this.enemies.filter(e=>e.alive&&!e.reward).length);
        const summons='summons' in bossData?bossData.summons:6;
        for(let n=0;n<Math.min(free,summons);n++){
          const angle=n*Math.PI/3,p={x:c.position.x+Math.cos(angle)*3,y:c.position.y+Math.sin(angle)*3};
          if(!walkable(this.region,p))continue;
          this.enemies.push({...owner,id:owner.id+'-ritual-'+this.tick+'-'+n,name:'仪式暗影',art:'shadow_stalker',monster:this.summonCombat(owner,'ritual',this.rules.aiRules.summonHp,this.rules.aiRules.summonAttack),kind:'melee',boss:false,elite:false,maxHp:this.rules.aiRules.summonHp,hp:this.rules.aiRules.summonHp,attack:this.rules.aiRules.summonAttack,reward:false,position:p,cooldown:this.tick+30,skillCooldowns:new Map(),currentPhase:1});
        }
      }else if(c.skill==='summon_whelps'){
        const free=Math.max(0,this.rules.aiRules.summonCap-this.enemies.filter(e=>e.alive&&!e.reward).length);
        const rule=this.rules.chapterBossSkills.ancient_dragon_king.whelps;
        for(let n=0;n<Math.min(free,rule.count);n++){
          const angle=n*Math.PI/2,p={x:c.position.x+Math.cos(angle)*4,y:c.position.y+Math.sin(angle)*4};
          if(!walkable(this.region,p))continue;
          const hp=Math.max(this.rules.aiRules.summonHp,Math.round(owner.maxHp*rule.hpRatio));
          this.enemies.push({...owner,id:owner.id+'-whelp-'+this.tick+'-'+n,name:'幼龙',art:'dragon_whelp',monster:this.summonCombat(owner,'whelp',hp,Math.max(this.rules.aiRules.summonAttack,Math.round(owner.attack*rule.attackRatio))),kind:'charger',boss:false,elite:false,maxHp:hp,hp,attack:Math.max(this.rules.aiRules.summonAttack,Math.round(owner.attack*rule.attackRatio)),reward:false,position:p,cooldown:this.tick+30,skillCooldowns:new Map(),currentPhase:1});
        }
      }
    }else if(skillDef.kind==='beam'){
      // 毁灭吐息
      for(const player of this.livingPlayers())this.forPlayer(player.id,()=>{if(c.skill==='ultimate'&&this.beamContains(c.position,c.target,this.hero.position)&&lineOfSight(this.region,c.position,this.hero.position)){
        // 检查是否有掩体保护
        const covers=this.region.landmarks?.filter(l=>l.kind==='cover')||[];
        let protectedByCover=false;
        for(const cover of covers){
          if(this.isPlayerBehindCover(c.position,this.hero.position,cover)){
            protectedByCover=true;
            break;
          }
        }
        if(!protectedByCover){
          this.withVfx({castId:c.id,sourceId:owner.id,targetId:this.playerId,vfxKey:'boss/'+c.skill},()=>this.hurt(Math.round(this.enemySpellAttack(owner)*(skillDef.damage??1)),'ultimate'));
        }
      }});
    }
    // 打断检测（黑暗仪式）
    if(c.skill==='ritual'&&!c.interrupted){
      const interruptRatio=('interruptRatio' in bossData?bossData.interruptRatio:0.025);
      if(c.damage>=owner.maxHp*interruptRatio){
        c.interrupted=true;
        owner.action='hurt';
        owner.actionUntil=this.tick+20;
      }
    }
  }
  
  this.bossCasts=this.bossCasts.filter(c=>c.expires>=this.tick);
 }
 
 private isPlayerBehindCover(bossPos:Vec,playerPos:Vec,cover:any):boolean{
  // 简单的射线-圆碰撞检测
  const dx=playerPos.x-bossPos.x;
  const dy=playerPos.y-bossPos.y;
  const length=Math.hypot(dx,dy)||1;
  const dirX=dx/length;
  const dirY=dy/length;
  
  const fx=cover.x-bossPos.x;
  const fy=cover.y-bossPos.y;
  const along=fx*dirX+fy*dirY;
  
  if(along<=0||along>=length)return false;
  
  const nearestX=bossPos.x+dirX*along;
  const nearestY=bossPos.y+dirY*along;
  const dist=Math.hypot(nearestX-cover.x,nearestY-cover.y);
  
  return dist<1.5;  // 掩体半径
 }
 private stepMeadowBoss(e:Entity){
  const rule=this.rules.encounterBalance.meadowBoss,ai=e.monster?e.monster.ai:{speed:rule.speed,range:rule.reach,cooldown:rule.cooldown},h=this.hero.position,d=distance(e.position,h);
  if(d>(this.region.activationRadius??this.rules.aiRules.activeRadius))return;
  const enraged=e.hp/e.maxHp<=rule.enrageAt,phase=enraged?2:1;
  if(e.currentPhase!==phase){e.currentPhase=phase;this.events.push({type:'phase_changed',id:e.id,position:{...e.position},phase,tick:this.tick});}
  if(d>ai.range){this.moveEnemy(e,h,ai.speed*(enraged?1.15:1)*(1-this.strength(e.id,'slow'))/30);if(e.actionUntil<this.tick)e.action='move';return;}
  if(e.cooldown>this.tick)return;
  const count=(this.bossAttackCounts.get(e.id)??0)+1;this.bossAttackCounts.set(e.id,count);
  e.facing=screenFacing(e.position,h,e.facing);e.cooldown=this.tick+(enraged?rule.enrageCooldown:ai.cooldown);
  if(count%rule.slamEvery===0){
   // A fixed warning location provides a real dodge window; ordinary strikes add pressure.
   const position={...h},windup=e.monster?.template.startsWith('ss-')?this.rules.encounterBalance.starseaMeadowSlamWindup??rule.slamWindup:rule.slamWindup;e.action='skill';e.actionUntil=this.tick+windup;
   const vfx=this.vfxFor(e,'basic-area');
   this.events.push({...vfx,type:'danger_started',id:e.id,position,tick:this.tick,windup,radius:rule.slamRadius});
   this.zones.push({...vfx,started:this.tick,id:++this.serial,position,radius:rule.slamRadius,damage:Math.round(this.enemyAttack(e)*rule.slamMultiplier*this.starseaPressure(e)),life:1,delay:windup,enemy:true,slow:false,damageType:'physical'});
  }else{e.action='attack';e.actionUntil=this.tick+15;this.withVfx(this.vfxFor(e,'basic-melee'),()=>this.hurt(Math.round(this.enemyAttack(e)*this.starseaPressure(e)),'basic-melee'));}
 }
 private hurtDefense(amount:number){const d=this.defense;if(!d||d.failed||d.complete)return;d.hp=Math.max(0,d.hp-Math.max(1,Math.round(amount)));this.emit({type:'hit_resolved',id:'ss-engine',position:{...d.position},amount:Math.round(amount),tick:this.tick});if(d.hp<=0)d.failed=true;}
 private enemyLineOfFire(e:Entity,target:Vec){return lineOfSight(this.region,e.position,target)&&(e.kind!=='ranged'||terrainContact(this.region,e.position,target,this.rules.aiRules.projectileHitRadius)===null);}
 private defendEnemy(e:Entity){const d=this.defense!;if(d.failed||d.complete||this.actionBlocked(e.id))return;const ai=this.monsterAi(e),range=e.kind==='ranged'?ai.range:this.rules.aiRules.attackReach-.1;const speed=(this.hasStatus(e.id,'slow')?1-this.strength(e.id,'slow'):1)*ai.speed/30;if(distance(e.position,d.position)>range||!this.enemyLineOfFire(e,d.position)){this.moveEnemy(e,d.position,speed);e.action='move';return;}if(e.cooldown>this.tick)return;e.cooldown=this.tick+ai.cooldown;e.action='attack';e.actionUntil=this.tick+15;e.facing=screenFacing(e.position,d.position,e.facing);if(e.kind==='ranged'){const vfx={...this.vfxFor(e,'basic-ranged'),targetId:'ss-engine'};this.withVfx(vfx,()=>{this.emit({...vfx,type:'cast_released',id:e.id,position:{...e.position},origin:{...e.position},target:{...d.position},skill:'basic-ranged',tick:this.tick});this.shoot(e.position,d.position,this.enemyAttack(e),true,false,'basic-ranged');});}else this.hurtDefense(this.enemyAttack(e));}
 private starseaContactPolicy(e:Entity){const rule=this.rules.encounterBalance.starseaBossContact;return rule&&e.boss&&e.monster?.template.startsWith(rule.templatePrefix)&&rule.bossKeys.includes(e.monster?.bossKey??this.bossKey(e))?rule:undefined;}
 private starseaPressure(e:Entity){
  const rule=this.rules.encounterBalance.starseaBossContact;if(!rule||!e.boss||!e.monster?.template.startsWith(rule.templatePrefix))return 1;
  const profiles:Record<string,{hpRatio:number;maxMultiplier:number}>=rule.pressure??{},profile=profiles[e.monster?.bossKey??this.bossKey(e)];if(!profile&&!rule.bossKeys.includes(e.monster?.bossKey??this.bossKey(e)))return 1;
  const ratio=profile?.hpRatio??rule.weakHpRatio??0,mult=profile?.maxMultiplier??rule.weakHpMultiplier??1;
  const pressure=ratio>0?Math.max(0,Math.min(1,(ratio-this.hero.hp/this.stats.hp)/ratio)):0;return 1+(mult-1)*pressure;
 }
 /** 护盾 affix: once engaged, the elite raises a shield worth a share of max HP every
  * `every` ticks for `duration` ticks; damage drains it before HP. */
 private eliteShield(e:Entity){
  if(e.shieldUntil!==undefined&&this.tick>=e.shieldUntil)e.shield=0;
  if(!e.monster?.affixes?.includes('shielded')||!e.engaged||!e.alive)return;
  const rule=this.rules.eliteAffixes?.shielded??eliteAffixes.shielded;e.shieldNext??=this.tick+rule.first;if(this.tick<e.shieldNext)return;
  e.shieldNext=this.tick+rule.every;e.shield=Math.max(1,Math.round(e.maxHp*rule.ratio));e.shieldUntil=this.tick+rule.duration;
  this.emit({type:'shielded',id:e.id,position:{...e.position},amount:e.shield,skill:'elite-shield',tick:this.tick,shieldPhase:'applied',shieldRemaining:e.shield});
 }
 private eliteTrail(e:Entity){
  if(!e.alive||!e.engaged||this.actionBlocked(e.id)||!e.monster?.affixes?.includes('fire_trail'))return;
  const rule=this.rules.eliteAffixes?.fire_trail??eliteAffixes.fire_trail;e.skillCooldowns??=new Map();
  if((e.skillCooldowns.get(rule.skill)??0)>this.tick)return;e.skillCooldowns.set(rule.skill,this.tick+rule.every);
  const vfx=this.vfxFor(e,rule.skill),at={...e.position};
  this.emit({...vfx,type:'danger_started',id:e.id,position:at,target:at,radius:rule.radius,windup:rule.delay,duration:rule.duration,skill:rule.skill,tick:this.tick});
  this.zones.push({...vfx,id:++this.serial,position:at,radius:rule.radius,damage:Math.round(this.enemyAttack(e)*rule.damage),life:rule.duration,delay:rule.delay,enemy:true,slow:false,damageType:'fire',skill:rule.skill,started:this.tick});
 }
 private stepStarseaBossContact(e:Entity){
  const rule=this.starseaContactPolicy(e);if(!rule||this.bossCasts.some(c=>c.owner===e.id&&!c.resolved))return false;
  const h=this.hero.position,d=distance(e.position,h);if(d>rule.range||!lineOfSight(this.region,e.position,h))return false;
  e.contactAt??=e.cooldown;if(e.contactAt>this.tick)return false;
  e.contactAt=this.tick+rule.cooldown;e.facing=screenFacing(e.position,h,e.facing);e.action='attack';e.actionUntil=this.tick+15;
  const weak=this.starseaPressure(e);
  this.withVfx(this.vfxFor(e,'basic-melee'),()=>this.hurt(Math.round(this.enemyAttack(e)*rule.damageMultiplier*weak),'basic-melee'));return true;
 }
 private patrolEnemy(e:Entity){const patrol=e.monster?.patrol;if(!patrol||e.engaged||this.actionBlocked(e.id))return false;e.patrolIndex??=0;let target=patrol.path[e.patrolIndex%patrol.path.length];if(distance(e.position,target)<.25){e.patrolIndex=(e.patrolIndex+1)%patrol.path.length;target=patrol.path[e.patrolIndex];}e.facing=screenFacing(e.position,target,e.facing);this.moveEnemy(e,target,patrol.speed/30);e.action='move';return true;}
 private enemyStep(e:Entity){
  this.eliteShield(e);this.eliteTrail(e);if(this.patrolEnemy(e))return;
  if(e.home&&e.leashRadius!==undefined&&(e.returning||distance(this.hero.position,e.home)>e.leashRadius||distance(e.position,e.home)>e.leashRadius)){
   if(!e.returning){this.interruptActor(e.id);e.path=[];}e.returning=true;e.engaged=false;
   const origin={x:e.x,y:e.y};if(distance(e.position,origin)>.3){this.moveEnemy(e,origin,this.monsterAi(e).speed/30);e.action='move';}else{e.returning=false;e.path=[];e.action='idle';}return;
  }
  if(this.defense?.enemyIds.includes(e.id)&&distance(e.position,this.hero.position)>1.65){this.defendEnemy(e);return;}
  if(this.actionBlocked(e.id))return;
  if(this.hasStatus(e.id,'fear')){const state=this.activeStatuses(e.id).find(s=>s.effect.kind==='fear')!,source=this.actorPosition(state.sourceId)??state.sourcePosition;this.moveEnemy(e,{x:e.position.x+(e.position.x-source.x),y:e.position.y+(e.position.y-source.y)},this.monsterAi(e).speed/30);e.action='move';return;}
  if(e.monster?.bossProfile&&!this.hasStatus(e.id,'silence')&&this.startBossCast(e))return;
  if(e.boss&&(e.monster?.bossKey??this.bossKey(e))==='meadow-boss'){this.stepMeadowBoss(e);return;}
  if(this.stepStarseaBossContact(e))return;
  // BOSS有单独的技能系统
  if(!this.hasStatus(e.id,'silence')&&this.startBossCast(e))return;
  
  const h=this.hero.position,d=distance(e.position,h);
  if(d>(this.region.activationRadius??this.rules.aiRules.activeRadius))return;
  const contact=this.starseaContactPolicy(e),contactBoss=!!contact;
  // 地图声明 aggroRadius 时，怪物只在玩家靠近或受到攻击后加入战斗，并带上同一组（编号前缀相同）6 格内的同伴。
  const aggro=e.monster?.ai.aggroRadius??this.region.aggroRadius;
  if(aggro&&!e.engaged){if(d>aggro&&e.hp>=e.maxHp)return;e.engaged=true;const pack=e.id.slice(0,e.id.lastIndexOf('-'));if(pack)for(const o of this.nearbyEnemies(e.position,6))if(o.alive&&!o.engaged&&o.id.startsWith(pack+'-')&&distance(o.position,e.position)<=6)o.engaged=true;}
  const ai=this.monsterAi(e),speed=(this.hasStatus(e.id,'slow')?1-this.strength(e.id,'slow'):e.slow>this.tick?.45:1)*ai.speed/30;
  
  // 移动逻辑
  if(e.cooldown>this.tick){
    if(['melee','guard','assassin','charger','summoner'].includes(e.kind)&&d>1.3||d>ai.range||this.tick%6===0&&!this.enemyLineOfFire(e,h)){
      this.moveEnemy(e,h,speed);
      if(e.actionUntil<this.tick)e.action='move';
    }
    return;
  }
  
  if(d>ai.range||!this.enemyLineOfFire(e,h)){
    this.moveEnemy(e,h,speed);
    e.action='move';
    return;
  }
  
  // 尝试使用怪物技能
  if(!e.boss&&!this.hasStatus(e.id,'silence')&&this.tryMonsterSkill(e,h))return;
  
  // 默认攻击行为
  e.facing=screenFacing(e.position,h,e.facing);
  e.action='attack';
  e.actionUntil=this.tick+15;
  e.cooldown=this.tick+ai.cooldown;
  
  if(e.kind==='ranged'){const vfx=this.vfxFor(e,'basic-ranged');this.withVfx(vfx,()=>{this.events.push({...vfx,type:'cast_released',id:e.id,position:{...e.position},origin:{...e.position},target:{...h},skill:'basic-ranged',tick:this.tick});this.shoot(e.position,h,this.enemyAttack(e),true,false,'basic-ranged');});return;}
  if(['shaman','artillery','charger'].includes(e.kind)){
    const vfx=this.vfxFor(e,'basic-area');
    this.events.push({...vfx,type:'danger_started',id:e.id,position:{...h},tick:this.tick});
    this.zones.push({...vfx,started:this.tick,id:++this.serial,position:{...h},radius:e.boss?3.5:e.kind==='charger'?1.5:2.3,damage:this.enemyAttack(e)*(e.boss?2:1)*(contact?.spellMultiplier??1),life:e.kind==='shaman'?91:1,delay:e.kind==='artillery'?50:e.boss?35:25,enemy:true,slow:false,damageType:e.kind==='shaman'?'arcane':'physical'});
    if(e.kind==='charger'){this.moveEnemy(e,h,3);}
    return;
  }
  if(e.kind==='summoner'){
    if(this.enemies.filter(v=>v.alive&&!v.reward).length<this.rules.aiRules.summonCap){
      this.enemies.push({...e,id:e.id+'-echo-'+this.tick,name:'召唤影',monster:this.summonCombat(e,'echo',this.rules.aiRules.summonHp,this.rules.aiRules.summonAttack),kind:'melee',boss:false,elite:false,maxHp:this.rules.aiRules.summonHp,hp:this.rules.aiRules.summonHp,attack:this.rules.aiRules.summonAttack,reward:false,position:{x:e.position.x+.6,y:e.position.y+.6},cooldown:this.tick+30,skillCooldowns:new Map(),currentPhase:1});
    }
    return;
  }
  if(e.kind==='assassin'&&d<4)this.moveEnemy(e,h,2);
  if(distance(e.position,h)<this.rules.aiRules.attackReach&&lineOfSight(this.region,e.position,h))this.withVfx(this.vfxFor(e,'basic-melee'),()=>this.hurt(this.enemyAttack(e)+ai.basicAttackBonus,'basic-melee'));
 }
 
 private releaseMonster(p:{at:number;owner:string;target:string;position:Vec;skillId:string;vfx:VfxOrigin}){
 const e=this.enemies.find(e=>e.id===p.owner),skillId=p.skillId,skill=this.rules.monsterSkills[skillId],h=p.position,vfx=p.vfx;
 if(!e||!skill)return;this.forPlayer(p.target,()=>this.withVfx(vfx,()=>{
 const d=distance(e.position,h);
     if(!e.alive||this.actionBlocked(e.id))return;
    this.events.push({...vfx,type:'cast_released',id:e.id,position:{...e.position},origin:{...e.position},target:{...h},skill:skillId,radius:skill.radius,duration:skill.duration,tick:this.tick});
    if(skill.kind==='projectile'){
      this.shoot(e.position,h,Math.round(this.enemyAttack(e)*(skill.damage??1)),true,false,skillId);this.projectiles.at(-1)!.damageType=skill.damageType;
    }else if(skill.kind==='zone'){
      this.zones.push({
        ...vfx,skill:skillId,started:this.tick,id:++this.serial,
        position:{...h},
        radius:skill.radius||2,
        damage:Math.round(this.enemyAttack(e)*(skill.damage??1)),
        life:skill.duration||1,
        delay:skill.delay||25,
        enemy:true,
        slow:skill.slow||false,damageType:skill.damageType
      });
    }else if(skill.kind==='melee'){
      if(skill.effect==='dash'&&d<4){
        // 背刺：冲刺到玩家背后
        this.moveEnemy(e,h,2);
      }
      if(distance(e.position,this.hero.position)<this.rules.aiRules.attackReach&&lineOfSight(this.region,e.position,this.hero.position)){
        const landed=this.hurt(Math.round(this.enemyAttack(e)*(skill.damage??1)),skillId,{category:'direct',damageType:skill.damageType??'physical',scaled:true});
        if(landed&&this.hero.hp>0)for(const effect of skill.statuses??[])this.applyStatus(this.playerId,effect,e.id,skillId);
      }
    }else if(skill.kind==='teleport'){
      const bodies=[...this.enemyBodies(h,3,e),...this.playerBodies(e.id),...this.livingPlayers().map(p=>({...p,radius:this.rules.bodyCollision.heroRadius}))];
      if(walkable(this.region,h,this.bodyRadius(e))&&bodies.every(b=>distance(b.position,h)>=b.radius+this.bodyRadius(e))){e.position={...h};e.path=undefined;e.pathTick=undefined;this.refreshSpatial(true);this.emit({...vfx,type:'displaced',id:e.id,position:{...h},skill:skillId,tick:this.tick});}
    }else if(skill.kind==='summon'){
      // 召唤技能
      if(skill.effect==='summon_2'){
        const free=Math.max(0,this.rules.aiRules.summonCap-this.enemies.filter(v=>v.alive&&!v.reward).length);
        for(let n=0;n<Math.min(free,2);n++){
          const angle=n*Math.PI;
          const p={x:e.position.x+Math.cos(angle)*2,y:e.position.y+Math.sin(angle)*2};
          if(!walkable(this.region,p))continue;
          this.enemies.push({
            ...e,
            id:e.id+'-summon-'+this.tick+'-'+n,
            name:'亡灵仆从',
            art:'shadow_stalker',
            monster:this.summonCombat(e,'undead',this.rules.aiRules.summonHp,this.rules.aiRules.summonAttack),
            kind:'melee',
            boss:false,
            elite:false,
            maxHp:this.rules.aiRules.summonHp,
            hp:this.rules.aiRules.summonHp,
            attack:this.rules.aiRules.summonAttack,
            reward:false,
            position:p,
            cooldown:this.tick+30,
            skillCooldowns:new Map(),
            currentPhase:1
          });
        }
      }
    }else if(skill.kind==='buff'){
      // 增益技能：给周围友军加攻击
      if(skill.effect==='buff_nearby'&&skill.buff){
        for(const ally of this.nearbyEnemies(e.position,skill.buff.range)){
          if(ally.alive&&ally.id!==e.id&&distance(ally.position,e.position)<skill.buff.range&&lineOfSight(this.region,e.position,ally.position)){
            this.applyStatus(ally.id,statusEffectSchema.parse({kind:'attack_up',duration:skill.buff.duration,strength:skill.buff.strength,scope:'ally',cleanse:false,removeWithSource:skill.buff.removeWithSource}),e.id,skillId);
          }
        }
      }
    }

 }));
 }
 /** Self-centred skills (frost nova) are only worth casting with the hero inside their radius. */
 private monsterSkillUsable(e:Entity,id:string,h:Vec){const skill=this.rules.monsterSkills[id];return skill?.effect!=='self_centered'||distance(e.position,h)<=(skill.radius??2)-.5;}
 private tryMonsterSkill(e:Entity,h:Vec):boolean{
  const legacy=this.rules.monsters?.legacy??monsterContent.legacy;
  const skillId=e.monster?e.monster.skills.find(id=>(e.skillCooldowns?.get(id)??0)<=this.tick&&this.monsterSkillUsable(e,id,h)):legacy.skillMap[e.art];
  if(!skillId)return false;
  
  const skill=this.rules.monsterSkills[skillId];
  if(!skill)return false;
  
  // 检查技能冷却
  if(!e.skillCooldowns)e.skillCooldowns=new Map();
  if(e.skillCooldowns.has(skillId)&&e.skillCooldowns.get(skillId)!>this.tick)return false;
  
  if(this.random()>this.monsterAi(e).skillChance)return false;
  
  const d=distance(e.position,h);
  
  // 执行技能
  e.facing=screenFacing(e.position,h,e.facing);
  e.action='skill';
  e.actionUntil=this.tick+skill.windup+15;
  e.cooldown=this.tick+skill.cooldown;
  e.skillCooldowns.set(skillId,this.tick+skill.cooldown);
  
  // 延迟执行技能效果；自身为中心的技能锁定施法者脚下
  const vfx=this.vfxFor(e,skillId),at=skill.kind==='teleport'?{x:h.x+(skill.teleportDistance??3),y:h.y}:skill.effect==='self_centered'?{...e.position}:{...h};
  this.events.push({...vfx,type:'cast_started',id:e.id,position:{...e.position},target:{...at},...(skill.kind==='teleport'?{radius:skill.radius}:{}),skill:skillId,windup:skill.windup,tick:this.tick});
  this.monsterPending.push({at:this.tick+skill.windup,owner:e.id,target:this.playerId,position:at,skillId,vfx});
  return true;
 }
 applyBuild(stats:Stats,skills:Skill[]){const ratio=this.hero.hp/this.stats.hp;this.removeHexEffects((this.stats.rules??[]).filter(r=>r.id.startsWith('hex-')&&!(stats.rules??[]).some(n=>n.id===r.id&&n.source===r.source)).map(r=>r.id));this.stats=stats;this.skills=skills;this.hero.hp=ratio===0?0:Math.min(stats.hp,Math.max(1,Math.round(stats.hp*ratio)));this.hero.mana=Math.min(this.hero.mana,stats.mana);this.pending=[];}

 private savePlayer(){const p=this.players.get(this.playerId);if(p)for(const key of heroFields)p[key]=(this as any)[key];}
 focusPlayer(id:string){const p=this.players.get(id);if(!p)return false;this.savePlayer();this.playerId=id;for(const key of heroFields)(this as any)[key]=p[key];this.combatAt??=0;this.comboReady??={};this.comboCounts??={};this.echoes??=[];this.effectStats??={};this.conditionClock??={still:0,moving:0,manaSpent:0,kills:0,start:0};this.selfBuffs??=[];this.effectKillTicks??=[];this.effectMoved??=0;this.effectLastPosition??={...this.hero.position};this.effectsStarted??=false;this.effectObservedShield??=this.hero.shield;this.effectShieldPeak??=this.hero.shield;this.effectPassive??={};this.effectCastHits??={};return true;}
 forPlayer(id:string,run:()=>void){const previous=this.playerId;if(this.players.size&&!this.focusPlayer(id))return;try{run();}finally{this.savePlayer();if(this.players.size)this.focusPlayer(previous);}}
 /** A new stage has new terrain/targets. Run counters, charges and self buffs
  * remain owned by this actor; map-bound navigation and outgoing work expire in
  * the old checkpoint. Never reset a per-run lethal interception here. */
 carryPlayerRunState(id:string,previous:WorldPlayer){
  if(!this.players.has(id))throw Error('Stage actor is missing');
  this.forPlayer(id,()=>this.copyActorRun(previous));
 }
 private copyActorRun(previous:WorldPlayer){
  const local=new Set<string>(['hero','stats','skills','pending','echoes','targetId','autoState','stopReason','anchor','radius','path','pathGoal','stuck','input','destination','dodge','castIntent','effectLastPosition','effectCastHits']);
  const position={...this.hero.position};for(const key of heroFields)if(!local.has(key)&&previous[key]!==undefined)(this as any)[key]=structuredClone(previous[key]);this.hero={...structuredClone(previous.hero),position,action:previous.hero.hp>0?'idle':'death'};this.hero.hp=Math.min(this.hero.hp,this.stats.hp);this.hero.mana=Math.min(this.hero.mana,this.stats.mana);this.effectLastPosition={...position};
  // New D10 rules are stage-scoped; legacy non-HEX run buffs retain their old
  // carry semantics. Mechanism cooldowns stay in the copied comboReady ledger.
  this.hexStatistics=structuredClone(previous.hexStatistics??null);this.removeHexEffects((previous.stats.rules??[]).filter(r=>r.hexMechanism).map(r=>r.id));this.hexCombat=undefined;
 }
 /** Returning from an independently clocked server field encounter preserves
  * the actor's resources, charge deadlines and counters without replaying work
  * aimed at entities in that encounter. Existing field members keep their HP. */
 carrySoloRunState(previous:World){
  if(this.players.size||previous.players.size)throw Error('Solo encounter transfer cannot adopt party actors');
  const offset=previous.tick-this.tick;for(const enemy of this.enemies){for(const key of ['cooldown','actionUntil','shieldUntil','shieldNext'] as const)if(enemy[key]!==undefined)(enemy as any)[key]+=offset;if(enemy.skillCooldowns)for(const [id,at]of enemy.skillCooldowns)enemy.skillCooldowns.set(id,at+offset);}
  this.tick=previous.tick;this.copyActorRun(previous as unknown as WorldPlayer);this.randomState=previous.randomState;this.serial=Math.max(this.serial,previous.serial);this.vfxSerial=Math.max(this.vfxSerial,previous.vfxSerial);
  this.pending=[];this.echoes=[];this.castIntent=null;this.monsterPending=[];this.bossCasts=[];this.projectiles=[];this.zones=[];this.statuses=structuredClone(previous.statuses.filter(status=>status.targetId===previous.playerId));
 }
 carryStageIdentifiers(previous:World){
  this.vfxSerial=previous.vfxSerial;this.serial=previous.serial;
  const owners=new Map([...previous.players].map(([id,p])=>[id,new Set((p.stats.rules??[]).filter(r=>r.hexMechanism).map(r=>r.id))]));
  this.statuses=this.statuses.filter(s=>!owners.get(s.sourceId)?.has(s.skill));
 }
 addPlayer(id:string,stats:Stats,skills:Skill[],position:Vec=this.region.safe){
  if(this.players.has(id))throw Error('Duplicate combat player');this.savePlayer();
  const fresh=new World(this.region,structuredClone(stats),structuredClone(skills),[],[],1),p:any={id,active:true,connected:true,activeFrom:this.tick};
  for(const key of heroFields)p[key]=(fresh as any)[key];p.hero.position={...position};p.anchor={...position};this.players.set(id,p);if(this.players.size===1)this.focusPlayer(id);this.separatePlayerBodies();
 }
 removePlayer(id:string){this.forPlayer(id,()=>{this.pending=[];this.input={x:0,y:0};this.destination=undefined;});const p=this.players.get(id);if(p){p.active=false;p.connected=false;}}
 setConnected(id:string,value:boolean){const p=this.players.get(id);if(!p)return;p.connected=value;if(!value)this.forPlayer(id,()=>{this.input={x:0,y:0};this.destination=undefined;this.mode='manual';});}
 isActive(id:string){const p=this.players.get(id);return !!p?.active&&(p.activeFrom??0)<=this.tick;}
 livingPlayers(){this.savePlayer();return this.players.size?[...this.players.values()].filter(p=>this.isActive(p.id)&&p.hero.hp>0).map(p=>({id:p.id,position:p.hero.position})):this.hero.hp>0?[{id:this.playerId,position:this.hero.position}]:[];}
 private playerBodies(exclude=''):Body[]{return this.livingPlayers().filter(p=>p.id!==exclude).map(p=>({...p,radius:this.rules.bodyCollision.heroRadius}));}
 separatePlayerBodies(){for(const p of this.players.values())if(p.active&&p.hero.hp>0)this.forPlayer(p.id,()=>{const bodies=this.playerBodies(p.id);for(const other of bodies){const overlap=other.radius+this.rules.bodyCollision.heroRadius-distance(this.hero.position,other.position);if(overlap<=0)continue;const n=contactNormal({id:p.id,position:this.hero.position,radius:this.rules.bodyCollision.heroRadius},other),next={x:this.hero.position.x+n.x*(overlap+1e-4),y:this.hero.position.y+n.y*(overlap+1e-4)};if(walkable(this.region,next,this.rules.bodyCollision.heroRadius))this.hero.position=next;}});}
 castAlly(caster:string,target:string,skillId:string,range:number){const p=this.players.get(caster),ally=this.players.get(target);if(!p||!this.isActive(caster)||!ally||!this.isActive(target)||ally.hero.hp<=0||distance(p.hero.position,ally.hero.position)>range)return false;
  const declared=p.skills.find(s=>s.id===skillId);if(declared?.mechanics){if(declared.mechanics.targeting!=='self'||!lineOfSight(this.region,p.hero.position,ally.hero.position))return false;let ok=false;this.forPlayer(caster,()=>{ok=this.castDeclared(declared,undefined,undefined,target);});return ok;}
  let ok=false;this.forPlayer(caster,()=>{const skill=this.skills.find(s=>s.id===skillId);if(!skill||!['heal','shield'].includes(skill.kind)||skill.damage<=0||this.hero.hp<=0||this.hero.mana<skill.cost||(this.cooldowns[skillId]??0)>this.tick||this.pending.length)return;
   this.hero.mana-=skill.cost;this.cooldowns[skillId]=this.tick+Math.max(1,Math.round(skill.cooldown*(1-Math.max(0,Math.min(.75,this.stats.cdr??0)))));this.hero.action='skill';this.hero.actionUntil=this.tick+skill.windup+8;const vfx={castId:++this.vfxSerial,sourceId:caster,targetId:target,vfxKey:'player/'+skillId};this.inputEvents.push({...vfx,type:'cast_started',id:caster,position:{...this.hero.position},target:{...ally.hero.position},skill:skillId,windup:skill.windup,tick:this.tick});this.pending.push({at:this.tick+skill.windup,skill,position:{...ally.hero.position},vfx,ally:target} as any);ok=true;
  });return ok;
 }
 exportCheckpoint():WorldCheckpoint{this.savePlayer();const data:any={};for(const [key,value] of Object.entries(this))if(!['grid','region','spatialCount','spatialOrder','awakeIds'].includes(key)&&!(['effectHitWindows','effectMarks','hexCombat','hexLedger','hexResetFrame','hexRecoveryWindow','hexManaWindow'].includes(key)&&value===undefined))data[key]=encode(value);return {version:1,region:structuredClone(this.region),data};}
 static restore(checkpoint:WorldCheckpoint){
  if(checkpoint?.version!==1)throw Error('Unknown combat checkpoint version');
  if(!checkpoint.region?.safe||!Array.isArray(checkpoint.region.obstacles)||!Number.isFinite(checkpoint.region.width)||!Number.isFinite(checkpoint.region.height)||!checkpoint.data?.stats||!Array.isArray(checkpoint.data.skills))throw Error('Incomplete combat checkpoint');
  const data=decode(checkpoint.data),world=new World(checkpoint.region,data.stats,data.skills,[],[],1),keys=new Set(Object.keys(world).filter(k=>!['grid','region','spatialCount','spatialOrder','awakeIds'].includes(k)));
  for(const actor of [data,...[...data.players.values()]]){actor.hexStatistics??=null;if(actor.hexStatistics!==null)hexStatisticsSchema.parse(actor.hexStatistics);}
  for(const marks of [data.effectMarks,...[...data.players.values()].map((p:any)=>p.effectMarks)])if(marks!==undefined)effectMarksSchema.parse(marks);
  for(const combat of [data.hexCombat,...[...data.players.values()].map((p:any)=>p.hexCombat)])if(combat!==undefined&&(!combat||Object.keys(combat).some(k=>!['started','lastDamage','moved'].includes(k))||!Number.isInteger(combat.started)||combat.started<0||!Number.isInteger(combat.lastDamage)||combat.lastDamage<combat.started||combat.lastDamage>data.tick||!Number.isFinite(combat.moved)||combat.moved<0))throw Error('Invalid HEX combat clock');
  for(const history of [data.effectHitWindows,...[...data.players.values()].map((p:any)=>p.effectHitWindows)])validateHitWindows(history,data.tick);
  for(const actor of [data,...[...data.players.values()]])validateHexCombatLedger(actor.hexLedger,data.tick);
  for(const actor of [data,...[...data.players.values()]])if(actor.hexResetFrame!==undefined&&hexResetFrameSchema.parse(actor.hexResetFrame).tick>data.tick)throw Error('Future HEX reset frame');
  if(data.rules&&Object.hasOwn(data.rules,'hexPolicy'))hexPolicySchema.parse(data.rules.hexPolicy);
  for(const actor of [data,...[...data.players.values()]])validateHexBudgets(actor.hexRecoveryWindow,actor.hexManaWindow,data.tick);
  for(const intent of [data.castIntent,...[...data.players.values()].map((p:any)=>p.castIntent)])if(intent!=null&&(typeof intent.skill!=='string'||typeof intent.targetId!=='string'||!Number.isInteger(intent.until)||intent.until<0||Object.keys(intent).some(k=>!['skill','targetId','until'].includes(k))))throw Error('Invalid cast intent');
  if(data.statuses!==undefined){if(!Array.isArray(data.statuses))throw Error('Invalid status checkpoint');data.statuses=data.statuses.map((s:unknown)=>statusInstanceSchema.parse(s));}
  if(data.sequences!==undefined){if(!Array.isArray(data.sequences)||data.sequences.some((q:SkillSequence)=>!q.skill?.mechanics?.schedule||!Number.isInteger(q.index)||q.index<1||q.index>q.skill.mechanics.schedule.hits||!Number.isInteger(q.next)||!Number.isInteger(q.ends)))throw Error('Invalid skill sequence');for(const q of data.sequences)skillSchema.parse(q.skill);}
  if(data.guardianUsed!==undefined&&(!(data.guardianUsed instanceof Set)||[...data.guardianUsed].some(id=>typeof id!=='string')))throw Error('Invalid guardian consumption');
  for(const skill of [...data.skills,...[...data.players.values()].flatMap((p:any)=>p.skills)])skillSchema.parse(skill);
  for(const queue of [data.echoes,...[...data.players.values()].map((p:any)=>p.echoes)]){if(queue===undefined)continue;if(!Array.isArray(queue)||queue.some((x:any)=>!Number.isInteger(x?.at)||typeof x.rule!=='string'))throw Error('Invalid combo echo');for(const x of queue)skillSchema.parse(x.skill);}
  const numerics=data.rules?.combatNumerics;
  if(data.rules&&Object.hasOwn(data.rules,'combatNumerics')){
   if(!numerics||![2,3].includes(numerics.version))throw Error('Unknown frozen combat numerics version');
   armorRuleSchema.parse(numerics.armor);
   if(numerics.armor.model!==(numerics.version===2?'ratio':'hit-ratio'))throw Error('Frozen armor model does not match its version');
  }
  if(Object.keys(data).some(k=>!keys.has(k)))throw Error('Unknown combat checkpoint field');
  if(!Number.isInteger(data.tick)||data.tick<0||!(data.players instanceof Map)||!Array.isArray(data.enemies)||!Array.isArray(data.pending)||!Array.isArray(data.projectiles)||!Array.isArray(data.zones)||!Array.isArray(data.monsterPending))throw Error('Invalid combat checkpoint state');
  for(const at of [data.combatAt,...[...data.players.values()].map((p:any)=>p.combatAt)])if(at!==undefined&&(!Number.isInteger(at)||at<0))throw Error('Invalid sprint combat timer');
  const validHero=(h:any)=>h&&Number.isFinite(h.hp)&&h.hp>=0&&Number.isFinite(h.mana)&&h.mana>=0&&Number.isFinite(h.position?.x)&&Number.isFinite(h.position?.y);
  const catalogue=data.rules&&Object.hasOwn(data.rules,'monsters')?parseFrozenMonsterContent(data.rules.monsters):undefined;if(catalogue)data.rules.monsters=catalogue;
  for(const e of data.enemies)if(Object.hasOwn(e,'monster')&&e.monster!==undefined){
   const actor=monsterCombatSchema.parse(e.monster),template=catalogue?.templates.find(t=>t.id===actor.template);
   if(!catalogue||!template)throw Error('Missing frozen monster template');
   monsterLevelValues(template.curve,actor.level,catalogue);
   if(actor.skills.some(s=>!data.rules.monsterSkills?.[s]))throw Error('Unknown frozen monster skill');
  }
  if(!validHero(data.hero)||[...data.players.values()].some(p=>!validHero(p.hero)||!Array.isArray(p.pending)||!Array.isArray(p.skills)||typeof p.active!=='boolean')||data.enemies.some((e:any)=>!validHero({...e,mana:0})||typeof e.alive!=='boolean')||new Set(data.enemies.map((e:any)=>e.id)).size!==data.enemies.length)throw Error('Invalid combat actors');
  if(data.enemies.some((e:Entity)=>e.home!==undefined&&(!Number.isFinite(e.home.x)||!Number.isFinite(e.home.y)||!Number.isFinite(e.leashRadius)||e.leashRadius!<=0)||e.returning!==undefined&&typeof e.returning!=='boolean'))throw Error('Invalid camp leash checkpoint');
  Object.assign(world,data);world.grid=new SpatialGrid<Entity>(world.region.activationRadius?8:2);world.refreshSpatial(true);const bind=(pending:any[])=>{for(const p of pending)if(p.target)p.target=world.enemies.find(e=>e.id===p.target.id);};bind(world.pending);for(const p of world.players.values())bind(p.pending);return world;
 }
}
