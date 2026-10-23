import {prepareExplore,explorePublic,type HubExploreRun} from './hub-explore-service.ts';
import {applyRegionWeakness} from '../../../packages/rules/zhangjian.ts';
import type {DungeonDefinition} from '../../../packages/contracts/dungeons.ts';
import type {HubDungeonPublic} from '../../../packages/contracts/hub-dungeons.ts';
import type {StoryEncounterView} from '../../../packages/contracts/story.ts';
import type {AugmentOption,AugmentContext} from '../../../packages/contracts/run-augments.ts';
import type {Spawn} from '../../../packages/contracts/index.ts';
import {World,distance,walkable,findPath} from '../../../packages/simulation/index.ts';
import {hubStorySegments,hubStoryRoutes,hubStorySpawns,type HubStoryStep,type HubStorySegment} from '../../../packages/content/hub-dungeon-templates.ts';
import {defenses,tasks,dialogueLines} from '../../../packages/content/task-tables.ts';
import {craftMaterials,craftGathering} from '../../../packages/content/crafting.ts';
import {resolveMonsterSpawn} from '../../../packages/rules/monster-stats.ts';
import {regionById,type Region} from '../../../packages/content/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';

export type HubRunState={explore?:HubExploreRun;seed?:number;replay?:boolean;nodeId:string;shards:string[];challenge?:'high'|'nightmare';candidateRewards?:{gold:number;xp:number;material:number};gatherAmounts?:Record<string,number>;lootTelemetry?:Record<string,{gearCount:number;hexCount:number;eligible:number}>;alreadyPaid?:{gold:number;xp:number;material:number};gatherOpen?:boolean;difficulty?:{hp:number;attack:number};storySegments:HubStorySegment[];storyRoutes?:ReturnType<typeof hubStoryRoutes>;storySpawns?:Record<string,Spawn[]>;defenseRules?:typeof defenses;step:number;facts:string[];choice:string|null;spawned:string[];waveReadyAt?:number;beaconHp?:number;beaconMax?:number;chests:string[];opening?:{id:string;player:string;tick:number;mimic?:true};mimic?:HubMimic|null;hunt?:HubHunt;gathered:string[];hazardAt:number;completed:boolean;mode:Record<string,'manual'|'semi'|'auto'>};
/** FP5 寻宝宝箱怪：每场按运行种子（无种子时按实例）35% 概率五箱之一是宝箱怪，重连不变；开箱读条结束变成精英，击败后照常给该箱奖励。 */
export const HUB_MIMIC_CHANCE=.35;
export type HubMimic={stage:number;chest:string;template:string;level:number;enemy?:string;player?:string;done?:boolean};
const fnv=(text:string)=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
export function hubMimicChest(instance:string,seed?:number){const h=fnv(seed!==undefined?'seed:'+seed:instance);return h%1000<HUB_MIMIC_CHANCE*1000?'hub-chest-'+Math.floor(h/1000)%5:null;}
/** FP4 狩猎场地机制：每场按运行种子抽一种（本航区招牌机制 50%，另两种各 25%），首次备场冻结、重连不变。
 * 引雷桩：精英交战后套「桩数 × 30% 最大生命」护盾，桩子站着时每 8 秒充满；站到桩旁读条 2 秒击碎一根，护盾上限减半，全碎破盾。桩子不攻击。 */
export type HubHuntMechanic='rockfall'|'flood'|'pylon';
export type HubPylon={id:string;x:number;y:number;broken:boolean};
export type HubHunt={mechanic:HubHuntMechanic;pylons?:HubPylon[];chargeAt?:number};
export const HUB_HUNT_MECHANICS:readonly HubHuntMechanic[]=['rockfall','flood','pylon'];
export const HUB_PYLON_SHIELD_RATIO=.3,HUB_PYLON_CHARGE_SECONDS=8,HUB_PYLON_CHANNEL_SECONDS=2;
const huntHome:Record<string,HubHuntMechanic>={wind:'rockfall',mist:'flood'};
export function hubHuntMechanic(node:string,instance:string,seed?:number):HubHuntMechanic{const home=huntHome[node.split('-')[0]]??'pylon',roll=fnv(seed!==undefined?'hunt:'+seed:'hunt:'+instance)%4;return roll<2?home:HUB_HUNT_MECHANICS.filter(m=>m!==home)[roll-2];}
const isPylon=(id?:string)=>Boolean(id?.startsWith('hub-pylon-'));
const standingPylons=(state:HubRunState)=>state.hunt?.mechanic==='pylon'?(state.hunt.pylons??[]).filter(p=>!p.broken):[];
/** 本场精英护盾上限：站着的桩数 × 30% 最大生命。 */
export const hubPylonShieldCap=(state:HubRunState,maxHp:number)=>Math.round(maxHp*HUB_PYLON_SHIELD_RATIO*standingPylons(state).length);
/** 自动模式下一根要去击碎的桩（离角色最近）；首领已倒或桩已全碎时为空。 */
export function hubPylonTarget(w:World,state:HubRunState,from:{x:number;y:number}){if(!w.enemies.some(e=>e.boss&&e.alive))return;return standingPylons(state).sort((a,b)=>distance(from,a)-distance(from,b)||a.id.localeCompare(b.id))[0];}
/** 玩家对桩子发起读条；离开 2 格或倒下取消，读条完成在 stepHubRuntime 结算。 */
export function startHubPylon(w:World,state:HubRunState,player:string,target:string){const pylon=standingPylons(state).find(p=>p.id===target),actor=w.players.get(player);if(!pylon)throw Error('这根引雷桩已经碎了。');if(!actor?.active||actor.hero.hp<=0||distance(actor.hero.position,pylon)>2)throw Error('请走近引雷桩。');if(state.opening?.id===target)return;state.opening={id:target,player,tick:w.tick};}
export const hubMimicAwake=(state:HubRunState,stage:number,chest?:string)=>Boolean(state.mimic&&state.mimic.stage===stage&&state.mimic.enemy&&!state.mimic.done&&(chest===undefined||state.mimic.chest===chest));
/** Unscaled elite placement at the mimic chest; the service scales it exactly like stage spawns. */
export function hubMimicPlacement(w:World,state:HubRunState,stage:number,instance:string):Spawn|undefined{const m=state.mimic,ch=m&&m.stage===stage?w.region.keyChests?.find(c=>c.id===m.chest):undefined;if(!m||!ch)return;return applyRegionWeakness([resolveMonsterSpawn({id:instance+':mimic:'+m.chest,template:m.template,level:m.level,rank:'elite',x:ch.x,y:ch.y})],state.nodeId)[0];}
const encounterKey=(step:HubStoryStep,choice:string|null)=>step.task+':'+step.seq+':'+(step.op==='route_battle'?choice??'':'');
export function newHubRun(d:DungeonDefinition,shards:string[]=[],challenge?:'high'|'nightmare',context:{conditions?:string[]}={}):HubRunState{
 const storySegments=structuredClone(hubStorySegments.get(d.hub!.node)??[]),storyRoutes=structuredClone([...new Set(storySegments.flatMap(p=>p.steps.map(s=>s.task)))].flatMap(hubStoryRoutes)),storySpawns:Record<string,Spawn[]>={};
 for(const part of storySegments)for(const step of part.steps){const task=tasks.find(t=>t.id===step.task);step.dialogue=step.dialogueGroup?structuredClone(dialogueLines(step.dialogueGroup,context)).slice(0,1):[];if(['battle','route_battle','clear_camp','defend'].includes(step.op))for(const route of step.op==='route_battle'?storyRoutes.filter(r=>r.task===step.task).map(r=>r.id):[null])storySpawns[encounterKey(step,route)]=hubStorySpawns(step,regionById(part.region),route,'hub-frozen',d.policy.monsterLevel??d.level);}
 return {nodeId:d.hub!.node,shards:[...shards],challenge,storySegments,storyRoutes,storySpawns,defenseRules:structuredClone(defenses),step:0,facts:[],choice:null,spawned:[],chests:[],gathered:[],hazardAt:0,completed:false,mode:{}};
}
export function matchingAugments(offered:string[],catalog:AugmentOption[],context:AugmentContext){const matching=offered.filter(id=>catalog.find(a=>a.id===id)?.tags.some(t=>t!=='all'&&context.tags.includes(t)));return matching.length?matching:offered.filter(id=>catalog.find(a=>a.id===id)?.tags.includes('all'));}
export function pickAutomaticAugment(offered:string[],catalog:AugmentOption[],context:AugmentContext){const fits=new Set(matchingAugments(offered,catalog,context)),rank={silver:0,gold:1,prismatic:2};return [...offered].sort((a,b)=>Number(fits.has(b))-Number(fits.has(a))||rank[catalog.find(x=>x.id===b)!.tier]-rank[catalog.find(x=>x.id===a)!.tier]||(a<b?-1:a>b?1:0))[0];}
function point(w:World,id?:string){return w.region.landmarks.find(l=>l.kind===id||l.name===id)??w.region.safe;}
const pointCache=new WeakMap<Region,Map<string,{x:number;y:number}>>();
export function accessibleHubPoint(r:Region,p:{x:number;y:number}){let cache=pointCache.get(r);if(!cache){cache=new Map();pointCache.set(r,cache);}const key=p.x+','+p.y,old=cache.get(key);if(old)return {...old};for(let ring=0;ring<20;ring++)for(let y=-ring;y<=ring;y++)for(let x=-ring;x<=ring;x++){if(ring&&Math.abs(x)!==ring&&Math.abs(y)!==ring)continue;const q={x:Math.max(2,Math.min(r.width-3,p.x+x)),y:Math.max(2,Math.min(r.height-3,p.y+y))};if(walkable(r,q)&&(distance(r.safe,q)<.1||findPath(r,r.safe,q).length)){cache.set(key,q);return {...q};}}throw Error('节点没有可到达的交互位置。');}
export function prepareHubRegion(r:Region,d:DungeonDefinition,stage:number,instance:string,state:HubRunState):Region{
 const kind=d.hub!.kind,region=structuredClone(r);region.sprint=false;
 if(kind==='story'){region.spawns=[];state.explore??={players:{},stages:{},fallbacks:[]};prepareExplore(region,d,stage,state.explore);return region;}
 if(kind==='tide'){
  const pool=region.spawns.filter(s=>!s.boss&&!s.elite);if(!pool.length)throw Error('怪潮缺少普通怪模板。');
  const count=8+stage*2,center=accessibleHubPoint(region,{x:region.width/2,y:region.height/2});region.safe={x:center.x,y:center.y+2};
  region.spawns=Array.from({length:count+(stage===3?1:0)},(_,i)=>{const template=pool[i%pool.length],a=i*2.399963,place=accessibleHubPoint(region,{x:center.x+Math.cos(a)*Math.min(12,region.width/3),y:center.y+Math.sin(a)*Math.min(12,region.height/3)});return resolveMonsterSpawn({id:instance+':wave:'+stage+':'+i,template:template.monster!.template,level:template.monster!.level,rank:i===count?'elite':'normal',...place});});
  region.boss=false;region.landmarks.push({name:'信标',kind:'hub-beacon',...center});
 }
 if(kind==='hunt'){
  const elite=region.spawns.find(e=>e.elite)??region.spawns.find(e=>e.boss);if(!elite?.monster)throw Error('狩猎缺少稀有精英模板。');
  const rare=resolveMonsterSpawn({id:instance+':rare',template:elite.monster.template,rank:'rare',level:d.policy.monsterLevel??d.level,x:elite.x,y:elite.y});region.spawns=[{...rare,boss:true},...region.spawns.filter(e=>!e.boss&&!e.elite).slice(0,3)];region.boss=true;
  state.hunt??={mechanic:hubHuntMechanic(d.hub!.node,instance,state.seed)};
  if(state.hunt.mechanic==='pylon')state.hunt.pylons??=[-1,1].map((side,i)=>({id:'hub-pylon-'+i,...accessibleHubPoint(region,{x:rare.x+side*6,y:rare.y+3}),broken:false}));
 }
 if(kind==='treasure'){
  region.boss=false;region.spawns=region.spawns.filter(e=>!e.boss).slice(0,5);
  const chestArt=region.keyChests?.[0]??worldTables.chests.find(c=>c.region===d.area);if(!chestArt)throw Error('寻宝节点缺少现有宝箱资源。');
  region.keyChests=Array.from({length:5},(_,i)=>{const p=accessibleHubPoint(region,{x:region.width*(.2+(i%3)*.3),y:region.height*(.25+Math.floor(i/3)*.5)});return {id:'hub-chest-'+i,name:'航图宝箱',...p,resource:chestArt.resource,openResource:chestArt.openResource};});
  const template=region.spawns.find(e=>e.elite&&e.monster)??region.spawns.find(e=>e.monster);if(state.mimic===undefined){const chest=hubMimicChest(instance,state.seed);state.mimic=chest&&template?.monster?{stage,chest,template:template.monster.template,level:d.policy.monsterLevel??d.level}:null;}
 }
 if(state.shards.includes('hub-shard-elite'))region.spawns.push(...region.spawns.filter(e=>e.elite&&!e.boss).map(e=>({...structuredClone(e),id:e.id+':shard',x:e.x+1})));
 applyRegionWeakness(region.spawns,state.nodeId);state.explore??={players:{},stages:{},fallbacks:[]};prepareExplore(region,d,stage,state.explore);return region;
}
export function startHubStage(w:World,d:DungeonDefinition,state:HubRunState){state.step=0;state.waveReadyAt=undefined;if(d.hub!.kind==='tide'){
 const max=state.beaconMax??Math.max(1,[...w.players.values()][0].stats.hp*5);state.beaconMax=max;state.beaconHp??=max;
 w.defense={position:point(w,'hub-beacon'),hp:state.beaconHp,maxHp:max,radius:Math.max(w.region.width,w.region.height),requiredTicks:Number.MAX_SAFE_INTEGER,heldTicks:0,enemyIds:w.enemies.map(e=>e.id),failed:false,complete:false};
}}
export function currentHubStoryStep(state:HubRunState,stage:number){return state.storySegments[stage]?.steps[state.step];}
function storyObjects(w:World,state:HubRunState,stage:number):StoryEncounterView['objects']{const step=currentHubStoryStep(state,stage);if(!step)return [];const object=(id:string,name:string,kind:'route'|'clue'|'npc'|'beacon',p:{x:number;y:number})=>({id,name,kind,position:accessibleHubPoint(w.region,p),...(kind==='npc'&&step.npc?{npcId:step.npc,artId:step.npc}:{artId:step.prop??'ss-prop-sign'}),enabled:true,label:name,reason:''});
 if(step.op==='choose')return (state.storyRoutes?.filter(r=>r.task===step.task)??hubStoryRoutes(step.task)).map((r,i)=>object(r.id,r.name,'route',{x:point(w,step.landmark).x+(i?3:-3),y:point(w,step.landmark).y}));
 if(['battle','route_battle','clear_camp'].includes(step.op))return [];
 return [object(step.task+':'+step.seq,step.label,step.op==='defend'?'beacon':step.op==='talk'?'npc':'clue',point(w,step.landmark))];
}
export function hubStoryView(w:World,d:DungeonDefinition,state:HubRunState,stage:number):StoryEncounterView|undefined{if(d.hub?.kind!=='story')return;const step=currentHubStoryStep(state,stage),task=tasks.find(t=>t.id===step?.task),lines=(step?.dialogue??[]).slice(0,1);return {chapter:d.hub.node,title:d.name,phase:step?.key??'checkpoint',objective:step?.label??'进入下一段',speaker:state.replay?'':lines[0]?.speaker??'',line:state.replay?'':lines.map(l=>l.text).join('\n'),objects:storyObjects(w,state,stage),completed:[...state.facts],choice:state.choice,heldTicks:w.defense?.heldTicks??0,requiredTicks:w.defense?.requiredTicks??0,readyForBoss:!step,defendActive:!!w.defense,contested:!!w.defense&&w.enemies.some(e=>e.alive&&distance(e.position,w.defense!.position)<=w.defense!.radius)};}
function finishStoryStep(state:HubRunState,stage:number){const step=currentHubStoryStep(state,stage);if(step){state.facts.push(step.task+':'+step.seq+':'+step.key);state.step++;}}
/** Preserve quest authored levels, camp budgets and encounter overrides. Re-resolving
 * a template here would discard the task's explicit HP/ATK (e.g. wind t01). */
export function scaleHubStorySpawns(spawns:Spawn[],d:DungeonDefinition,stage:number,difficulty={hp:1,attack:1}){const room=d.policy.stageEnemyScale?.[stage]??{hp:1,attack:1},hp=difficulty.hp*d.policy.enemyScale.hp*(1+stage*d.policy.enemyScale.hpPerStage)*room.hp,attack=difficulty.attack*d.policy.enemyScale.attack*(1+stage*d.policy.enemyScale.attackPerStage)*room.attack;return spawns.map(original=>{const s=structuredClone(original);s.hp=Math.max(1,Math.round(s.hp*hp));s.attack=Math.max(0,Math.round(s.attack*attack));if(s.monster){s.monster.difficulty.hp*=hp;s.monster.difficulty.attack*=attack;}return s;});}
function frozenStorySpawns(w:World,d:DungeonDefinition,state:HubRunState,stage:number,instance:string,step:HubStoryStep){const snapshot=state.storySpawns?.[encounterKey(step,state.choice)],spawns=snapshot?snapshot.map(s=>({...structuredClone(s),id:s.id.replace('hub-frozen',instance)})):hubStorySpawns(step,w.region,state.choice,instance,d.policy.monsterLevel??d.level);return applyRegionWeakness(scaleHubStorySpawns(spawns,d,stage,state.difficulty).map(s=>({...s,...accessibleHubPoint(w.region,s)})),state.nodeId);}
export function interactHubStory(w:World,d:DungeonDefinition,state:HubRunState,stage:number,player:string,target:string,instance:string){const step=currentHubStoryStep(state,stage),object=storyObjects(w,state,stage).find(o=>o.id===target),actor=w.players.get(player);if(!step||!object||!actor?.active||actor.hero.hp<=0||distance(actor.hero.position,object.position)>2.8)throw Error('请靠近当前剧情目标。');
 if(step.op==='choose'){if(state.choice&&state.choice!==target)throw Error('本场已选择另一条路线。');state.choice=target;}
 if(step.op==='defend'){if(!w.defense){const rule=(state.defenseRules??defenses).find(x=>x.id===step.defense);if(!rule)throw Error('剧情守护目标配置缺失。');const spawns=frozenStorySpawns(w,d,state,stage,instance,step);w.addSpawns(spawns);w.defense={position:object.position,hp:rule.hp,maxHp:rule.hp,radius:rule.radius,requiredTicks:rule.hold_ticks,heldTicks:0,enemyIds:spawns.map(x=>x.id),failed:false,complete:false};}return;}
 finishStoryStep(state,stage);
}
/** All clocks use committed simulation ticks, so reload cannot reopen chests or restart waves. */
export function stepHubRuntime(w:World,d:DungeonDefinition,state:HubRunState,stage:number,instance:string){
 const kind=d.hub!.kind,rate=w.rules.settings.tickRate;
 if(kind==='story'){
  const step=currentHubStoryStep(state,stage);if(step){const key=stage+':'+state.step;
   if(['battle','route_battle','clear_camp'].includes(step.op)){if(!state.spawned.includes(key)){const spawns=frozenStorySpawns(w,d,state,stage,instance,step);w.addSpawns(spawns);state.spawned.push(key);}else if(!w.enemies.some(e=>e.alive))finishStoryStep(state,stage);}
   else if(step.op==='defend'&&w.defense?.complete){finishStoryStep(state,stage);w.defense=null;}
   else if(step.op==='reach_waypoint')finishStoryStep(state,stage);
  }
 }
 if(kind==='tide'&&w.defense){state.beaconHp=w.defense.hp;state.beaconMax=w.defense.maxHp;if(!w.enemies.some(e=>e.alive)&&state.waveReadyAt===undefined)state.waveReadyAt=w.tick+(stage===3?0:8*rate);}
 const mechanic=state.hunt?.mechanic??(d.hub!.node.startsWith('wind-')?'rockfall':'flood');
 if(kind==='hunt'&&mechanic==='pylon')stepHubPylons(w,state,rate);
 else if(kind==='hunt'&&w.enemies.some(e=>e.alive&&e.boss)&&w.tick>=state.hazardAt){
  state.hazardAt=w.tick+6*rate;const p=w.livingPlayers()[0];if(p){const rock=mechanic==='rockfall',position=rock?{...p.position}:{x:w.region.width*(.25+.5*(Math.floor(w.tick/(6*rate))%2)),y:w.region.height/2},radius=rock?2.5:w.region.width/3;
   w.zones.push({id:-(w.tick+1),position,radius,damage:rock?Math.max(1,Math.round(w.enemies.find(e=>e.boss)!.attack)):0,life:rock?rate:5*rate,delay:rock?2*rate:rate,enemy:true,slow:!rock,skill:rock?'hub-rockfall':'hub-flood',damageType:'physical'});
   w.events.push({type:'danger_started',id:d.hub!.node,position,radius,duration:rock?2*rate:rate,tick:w.tick});
  }
 }
 const mimic=state.mimic;if(kind==='treasure'&&mimic&&hubMimicAwake(state,stage)&&w.enemies.some(e=>e.id===mimic.enemy&&!e.alive)){mimic.done=true;state.opening={id:mimic.chest,player:mimic.player!,tick:w.tick-HUB_CHEST_OPEN_SECONDS*w.rules.settings.tickRate-1,mimic:true};}
 if(state.opening&&!state.opening.mimic){const opening=state.opening,ch=isPylon(opening.id)?state.hunt?.pylons?.find(x=>x.id===opening.id&&!x.broken):w.region.keyChests?.find(x=>x.id===opening.id),hero=w.players.get(opening.player);if(!ch||!hero||hero.hero.hp<=0||distance(hero.hero.position,ch)>2)delete state.opening;}
}
function stepHubPylons(w:World,state:HubRunState,rate:number){
 const boss=w.enemies.find(e=>e.boss&&e.alive),opening=state.opening,hunt=state.hunt!;if(!boss)return;
 if(opening&&isPylon(opening.id)&&w.tick-opening.tick>=HUB_PYLON_CHANNEL_SECONDS*rate){const pylon=hunt.pylons?.find(p=>p.id===opening.id&&!p.broken),hero=w.players.get(opening.player);
  if(pylon&&hero&&hero.hero.hp>0&&distance(hero.hero.position,pylon)<=2){delete state.opening;pylon.broken=true;const cap=hubPylonShieldCap(state,boss.maxHp);boss.shield=Math.min(boss.shield??0,cap);
   w.events.push({type:'effect_triggered',id:pylon.id,position:{x:pylon.x,y:pylon.y},skill:'hub-pylon-break',tick:w.tick});
   if(!cap){boss.shieldUntil=undefined;w.events.push({type:'effect_triggered',id:boss.id,position:{...boss.position},skill:'hub-pylon-shield-break',tick:w.tick});}}}
 const cap=hubPylonShieldCap(state,boss.maxHp);
 if(cap&&boss.engaged&&w.tick>=(hunt.chargeAt??0)){hunt.chargeAt=w.tick+HUB_PYLON_CHARGE_SECONDS*rate;if((boss.shield??0)<cap){boss.shield=cap;boss.shieldUntil=undefined;w.events.push({type:'shielded',id:boss.id,position:{...boss.position},amount:cap,skill:'hub-pylon-shield',tick:w.tick,shieldPhase:'applied',shieldRemaining:cap});}}
}
export function hubStageComplete(w:World,d:DungeonDefinition,state:HubRunState,stage:number){switch(d.hub!.kind){case'story':return !currentHubStoryStep(state,stage);case'tide':return !w.enemies.some(e=>e.alive)&&state.waveReadyAt!==undefined&&w.tick>=state.waveReadyAt;case'treasure':return state.chests.length>=5;case'hunt':case'gate':return w.enemies.some(e=>e.boss)&&w.enemies.filter(e=>e.boss).every(e=>!e.alive);default:return false;}}
/** 寻宝宝箱开启读条秒数（dungeon-service finishHubChest 与公开状态共用）。 */
export const HUB_CHEST_OPEN_SECONDS=2;
export function hubPublicState(w:World|undefined,d:DungeonDefinition,state:HubRunState,stage:number,tick:number,rate:number,player?:string):HubDungeonPublic{const kind=d.hub!.kind,opened=state.chests.length,time=Math.max(0,d.policy.timeLimitSeconds-tick/rate),step=currentHubStoryStep(state,stage),openSeconds=isPylon(state.opening?.id)?HUB_PYLON_CHANNEL_SECONDS:HUB_CHEST_OPEN_SECONDS;return {...(explorePublic(w,state.explore,stage,player)?{explore:explorePublic(w,state.explore,stage,player)}:{}),objective:{kind:d.hub!.objective,text:kind==='story'?step?.label??'进入下一段':kind==='tide'?'守住信标，击退四波敌人':kind==='treasure'?(hubMimicAwake(state,stage)?'击败宝箱怪，夺回宝箱':'限时开启五个宝箱'):kind==='nest'?'击败首领，走进出口':kind==='hunt'&&standingPylons(state).length?'击碎引雷桩（还剩 '+standingPylons(state).length+' 根），再击败稀有精英':'击败本场首领',...(kind==='treasure'?{progress:{done:opened,total:5},timeLeft:time}:{})},segment:{index:stage+1,total:d.stages.length},...(kind==='tide'?{wave:{index:stage+1,total:4,...(state.waveReadyAt?{nextIn:Math.max(0,(state.waveReadyAt-tick)/rate)}:{})},beacon:{hp:state.beaconHp??1,max:state.beaconMax??1}}:{}),...(kind==='treasure'?{chests:{opened,total:5}}:{}),...(kind==='hunt'&&state.hunt?{hunt:{mechanic:state.hunt.mechanic,...(state.hunt.pylons?{pylons:state.hunt.pylons.map(p=>({...p}))}:{})}}:{}),...(state.opening&&(kind==='treasure'||kind==='hunt')?{opening:{id:state.opening.id,left:Math.max(0,openSeconds-(tick-state.opening.tick)/rate),total:openSeconds}}:{})};}
export function hubGatherPoints(w:World,d:DungeonDefinition,stage:number){const kind=d.hub!.kind,count=kind==='treasure'?4:kind==='nest'?2:['story','tide'].includes(kind)&&stage===0?2:0;const materials=craftMaterials.filter(m=>m.island===d.area&&m.tier==='T1'&&['ore','plant'].includes(m.kind));return Array.from({length:count},(_,i)=>({id:'hub-gather-'+stage+'-'+i,...accessibleHubPoint(w.region,{x:w.region.safe.x+(i+1)*3,y:w.region.safe.y+2}),material:materials[i%materials.length]?.id??'',quantity:craftGathering.min})).filter(p=>p.material);}

export function capHubBudget(candidate:{gold:number;xp:number;material:number},budget:{gold:number;xp:number;material:number},paid:{gold:number;xp:number;material:number}){return {gold:Math.min(candidate.gold,Math.max(0,budget.gold-paid.gold)),xp:Math.min(candidate.xp,Math.max(0,budget.xp-paid.xp)),material:Math.min(candidate.material,Math.max(0,budget.material-paid.material))};}
