import {dungeonContent} from '../content/dungeons.ts';
import {hexRuneById} from '../content/hex-runes.ts';
import {applyEncounterOverrides} from './encounter-overrides.ts';
import {activeWorldTier,worldTier,worldTierChoices,worldTiers} from './world-tier.ts';
import {nightZone,worldNightSpawns} from './world-night.ts';
import '../content/open-world/index.ts';
import {fieldRegionInfo,regionById} from '../content/index.ts';
import {characterWorldTables} from './world-levels.ts';
import {worldObjectiveHp} from './world-objective.ts';
import {engineDefense} from '../content/starsea/defense.ts';
// 星潮海主线运行时：任务拆步骤、波次生成、推进与章节奖励。只由服务端写入；客户端只读 view。
// 设计见 docs/hybrid-implementation.md §4。
import type {CharacterState,Spawn,Vec} from '../contracts/index.ts';
import type {StarseaState,StarseaView,StarseaPoint} from '../contracts/starsea.ts';
import type {StoryFeature} from '../contracts/story.ts';
import {starseaCampaign,starseaBalance,starseaMap,starseaHub,starseaIslands,starseaBossMaps,islandBand,placementLevel,tideNightKills,tideNightSize,starseaLootFocus,starseaRelics,lifeCrystalHp,type StarseaChapter,type StarseaTask,type StarseaMapSource} from '../content/starsea/index.ts';
import {resolveMonsterSpawn} from './monster-stats.ts';
import {applySkillRecovery,grantRouteSkill} from './skill-recovery.ts';
import {equipmentRuntime} from '../content/equipment-runtime.ts';
import {npcs as npcRows,props as propRows,chapters as chapterRows,taskById,stepsByTask,dialogueLines} from '../content/task-tables.ts';

export type StarseaStep={fact?:string;factId?:string;op:'talk'|'interact'|'wave'|'choose'|'boss';map:string;label:string;points:StarseaPoint[];size:number;enemies:string[];group:number;groupSize:number};
export class StarseaError extends Error{constructor(public code:string,message:string){super(message);}}
const reject=(code:string,message:string):never=>{throw new StarseaError(code,message);};

/** 港口常驻位置（NPC.xlsx）；未入住的 NPC 只在轮到他们说话时出现。 */
export const starseaPortSpots:Record<string,Vec>=Object.fromEntries(npcRows.filter(n=>n.campaign==='starsea').map(n=>[n.id,{x:n.x,y:n.y}]));
/** 回港报告后入住的 NPC 与开放的系统（章节.xlsx 完成后入住/开放列）。 */
export const starseaChapterUnlocks:{npc:string;features:StoryFeature[];message:string}[]=chapterRows.filter(c=>c.campaign==='starsea').sort((a,b)=>a.order-b.order).map(c=>({npc:c.unlock_npc??'',features:c.unlock_features as StoryFeature[],message:c.unlock_message??''}));
const initialNpcs=npcRows.filter(n=>n.campaign==='starsea'&&n.initial).map(n=>n.id);
/** 任务奖励与精英开关（任务.xlsx）。 */
const taskRow=(id:string)=>taskById.get(id)??reject('CONTENT','配置表缺少任务 '+id);
/** 交互道具：未完成态 → 完成态。 */
const propStates:Record<string,[string,string]>=Object.fromEntries(propRows.filter(p=>p.state_idle&&p.state_done).map(p=>[p.id,[p.state_idle!,p.state_done!]]));
export const starseaPropVerbs:Record<string,string>=Object.fromEntries(propRows.filter(p=>p.verb).map(p=>[p.id,p.verb!]));
/** 场景与任务栏显示用：道具名、任务栏动词（道具.xlsx）。 */
export const starseaPropNames:Record<string,string>=Object.fromEntries(propRows.filter(p=>p.name).map(p=>[p.id,p.name!]));
export const starseaPropHintVerbs:Record<string,string>=Object.fromEntries(propRows.filter(p=>p.hint_verb).map(p=>[p.id,p.hint_verb!]));

const names=new Map<string,string>([...starseaCampaign.npcs.map(n=>[n.id,n.name] as const),...starseaCampaign.bosses.map((b:{id:string;name:string})=>[b.id,b.name] as const)]);
export const starseaName=(id:string)=>names.get(id)??id;
/** 对白说话人：NPC 表 ID 显示名字，player 显示「你」，narrator 为旁白。 */
const speakerLabel=(id:string)=>id==='player'?'你':id==='narrator'?'':starseaName(id);
/** 客户端触发对白与服务端共用的说话人显示名。 */
export const starseaSpeaker=speakerLabel;
const stepRow=(task:string,index:number)=>[...(stepsByTask.get(task)??[])].sort((a,b)=>a.seq-b.seq)[index];
export const starseaChapter=(n:number):StarseaChapter|undefined=>starseaCampaign.chapters[n-1];
const landmark=(m:StarseaMapSource,id:string)=>m.landmarks.find(l=>l.id===id);
const blocked=(m:StarseaMapSource,p:Vec)=>p.x<2||p.y<2||p.x>m.width-3||p.y>m.height-3||m.obstacles.some(o=>p.x>=o.x-.5&&p.x<=o.x+o.w+.5&&p.y>=o.y-.5&&p.y<=o.y+o.h+.5);
function near(m:StarseaMapSource,c:Vec,index:number,radius:number):Vec{
 for(let r=radius;r<radius+4;r++)for(let k=0;k<12;k++){const a=index*2.39996+k*.5236,p={x:Math.round((c.x+Math.cos(a)*r)*10)/10,y:Math.round((c.y+Math.sin(a)*r)*10)/10};if(!blocked(m,p))return p;}
 return {...c};
}
/** `device-1` 起连续取 N 个地标；不够时在最后一个地标旁补点。 */
function taskPoints(m:StarseaMapSource,id:string,n:number):Vec[]{
 const match=/^(.*)-(\d+)$/.exec(id),out:Vec[]=[];
 if(match)for(let i=Number(match[2]);out.length<n;i++){const l=landmark(m,match[1]+'-'+i);if(!l)break;out.push({x:l.x,y:l.y});}
 else{const l=landmark(m,id);if(l)out.push({x:l.x,y:l.y});}
 if(!out.length)reject('CONTENT',`地图 ${m.id} 缺少地标 ${id}`);
 for(let i=1;out.length<n;i++)out.push(near(m,out.at(-1)!,i,4));
 return out;
}
const point=(id:string,p:Vec,label:string,prop?:string,npc?:string):StarseaPoint=>({id,x:p.x,y:p.y,label,prop,state:prop?(propStates[prop]?.[0]??'default'):undefined,npc,done:false});

/** 把任务拆成服务端可校验的步骤序列：逐行读取 任务.xlsx「步骤」。choice 只影响所选路线的战斗。 */
export function starseaTaskSteps(chapter:StarseaChapter,taskIndex:number,choice?:'a'|'b'):StarseaStep[]{
 const t=chapter.tasks[taskIndex];if(!t)reject('CONTENT','任务不存在');
 const rows=[...(stepsByTask.get(t.id)??[])].sort((a,b)=>a.seq-b.seq);if(!rows.length)reject('CONTENT','配置表任务 '+t.id+' 没有步骤');
 return rows.map(r=>{
  const map=r.map??reject('CONTENT',`配置表任务 ${t.id} 步骤 ${r.seq} 缺少地图`),group=r.point_count>1?r.point_index:0;
  const step=(op:StarseaStep['op'],points:StarseaPoint[],size=0,foes:string[]=[],label=r.label):StarseaStep=>({op,map,label,points,size,enemies:foes,group,groupSize:r.point_count});
  if(r.op==='boss')return step('boss',[],1);
  const m=starseaMap(map),at=()=>taskPoints(m,r.landmark??reject('CONTENT',`配置表任务 ${t.id} 步骤 ${r.seq} 缺少地标`),r.point_count)[r.point_index];
  switch(r.op){
   case 'kill_zone':case 'obtain_hex':case 'equip_hex':return {...step('interact',[point(r.key,at(),t.title)],r.count),fact:r.op,factId:r.key};
   case 'gate':case 'clear_camp':case 'reach_waypoint':case 'discover_zone':case 'open_chest':case 'complete_event':case 'kill_rare':case 'clear_dungeon':return {...step('interact',[point(r.key,at(),t.title,r.prop)]),fact:r.op,factId:r.gate??r.camp??r.key};
   case 'talk':{const npc=r.npc??t.speaker,spot=r.landmark?taskPoints(m,r.landmark,1)[0]:starseaPortSpots[npc];if(!spot)reject('CONTENT','对话 NPC 没有站位 '+npc);return step('talk',[point('npc:'+npc,spot,starseaName(npc),undefined,npc)]);}
   case 'interact':return step('interact',[point(r.key,at(),t.title,r.prop)]);
   case 'battle':case 'defend':return step('wave',[point('wave',at(),t.title,r.prop)],r.count,r.enemies);
   case 'choose':return step('choose',(['a','b'] as const).map(k=>point('route:'+k,taskPoints(m,chapter.choice[k].landmark,1)[0],chapter.choice[k].name)));
   case 'route_battle':{if(!choice)return step('wave',[],r.count);const o=chapter.choice[choice];return step('wave',[point('wave',taskPoints(m,o.landmark,1)[0],o.name)],r.count,o.enemies,o.goal);}
   default:return reject('CONTENT',`星潮海不支持步骤类型 ${r.op}（任务 ${t.id}）`);
  }
 });
}
import {steps as stepRows,tasks,conditions,rumors,questParameters,dialogueLines as linesFor} from '../content/task-tables.ts';
import {isStarseaRegion} from '../content/starsea/index.ts';
import {worldPhaseVisible,visibleWorldRows,resolveNpcPhase} from './world-phase.ts';
import {npcPositions as configuredNpcPositions} from '../content/task-tables.ts';
import {worldTables,worldZoneAt} from '../content/world-tables.ts';
import {economyRegionOf} from '../content/index.ts';
import {conditionMet,questEligible,evaluateUnlocks,conditionTargets,maxActiveQuests} from './quest-conditions.ts';
import type {LegacyStarseaState} from '../contracts/starsea.ts';
export {evaluateUnlocks};
const seaTasks=tasks.filter(t=>t.campaign==='starsea');
const definition=(id:string)=>seaTasks.find(t=>t.id===id)??reject('CONTENT','未知任务 '+id);
function info(id:string){const c=starseaCampaign.chapters.find(c=>c.tasks.some(t=>t.id===id));if(!c)return reject('CONTENT','任务不在岛屿故事中 '+id);const index=c.tasks.findIndex(t=>t.id===id);return {chapter:c,task:c.tasks[index],steps:starseaTaskSteps(c,index),index};}
const coords=(p:Vec)=>({x:p.x,y:p.y});
const empty=():StarseaState=>({version:2,quests:{},done:[],tracked:null,wave:null,attempts:{},gateAttempts:{},gates:[],seen:[],rumors:[],bounties:[],npcs:[...initialNpcs],features:[],islands:[starseaIslands[0]],bosses:[],hardmode:false,crystals:[],waypoints:[],discovered:[],clearedCamps:[]});
export function newStarseaState():StarseaState{const st=empty(),first=seaTasks.filter(t=>t.series==='onboarding').sort((a,b)=>a.order-b.order)[0];if(first){st.quests[first.id]={step:0,attempt:0,acceptedAt:Date.now()};st.tracked=first.id;}st.prologue={done:false};return st;}
function syncPhaseWaypoints(s:CharacterState){const st=s.starsea;if(!st)return false;let changed=false;for(const waypoint of visibleWorldRows(s,worldTables.waypoints))if(waypoint.unlockWhen&&conditionMet(s,waypoint.unlockWhen)){if(!st.waypoints.includes(waypoint.id)){st.waypoints.push(waypoint.id);changed=true;}s.world??={waypoints:[],exploration:{},planes:{},worldTier:1,unlockedWorldTier:1};if(!s.world.waypoints.includes(waypoint.id)){s.world.waypoints.push(waypoint.id);changed=true;}}return changed;}
/** A boss-driven removal resolves the camp's threat without inventing kills,
 * drops or bounty credit. Later accepted world-fact quests remain completable. */
function bossResolvedCamp(s:CharacterState,id:string){const camp=worldTables.camps.find(c=>c.id===id);if(!camp?.until)return false;const rows=conditions.filter(c=>c.target===camp.until);return rows.length>0&&rows.every(c=>c.kind==='boss')&&conditionMet(s,camp.until);}
export function ensureStarsea(s:CharacterState){if(!s.starsea)return false;const raw=s.starsea as unknown as LegacyStarseaState;if(raw.version===1){const st=empty(),order=questParameters.legacy_order as Record<string,string[]>;Object.assign(st,{done:[...raw.done],npcs:[...raw.npcs],features:[...raw.features],islands:[...raw.islands],bosses:[...raw.bosses],hardmode:raw.hardmode,crystals:[...raw.crystals],wave:raw.wave,legacy:{chapter:raw.chapter,task:raw.task,step:raw.step,attempt:raw.attempt}});for(const key of ['tide','night','nights','completion'] as const)if(raw[key]!==undefined)(st as any)[key]=structuredClone(raw[key]);for(const [n,ids]of Object.entries(order))for(let i=0;i<ids.length;i++)if(Number(n)<raw.chapter||Number(n)===raw.chapter&&i<raw.task){if(!st.done.includes(ids[i]))st.done.push(ids[i]);}
 const id=order[String(raw.chapter)]?.[raw.task];if(id){const mode=questParameters.legacy_accept_modes?.[id]??definition(id).accept_mode;const accepted=mode!=='talk'||(raw.accepted?raw.accepted.includes(id):raw.openingComplete!==false);if(accepted)st.quests[id]={step:raw.step,attempt:raw.attempt,acceptedAt:0,...(info(id).steps.some(step=>step.op==='choose')&&raw.choices[definition(id).chapter!]?{choice:raw.choices[definition(id).chapter!]}:{})};st.tracked=id;}
 if(st.wave&&!st.quests[st.wave.task]&&definition(st.wave.task))st.quests[st.wave.task]={step:st.wave.step,attempt:raw.attempt,acceptedAt:0};
 for(const [quest,run] of Object.entries(st.quests))st.attempts[quest]=run.attempt;
 for(const quest of seaTasks){const upto=st.done.includes(quest.id)?info(quest.id).steps.length:st.quests[quest.id]?.step??0;for(let index=0;index<upto;index++){const r=stepRow(quest.id,index);if(r?.op==='interact'&&r.world_fact&&!st.seen.includes(worldFactId(r)))st.seen.push(worldFactId(r));}}
 for(const row of worldTables.gates){const n=starseaIslands.indexOf(row.map)+1;if((n<raw.chapter||st.bosses.includes(starseaBossMaps[n-1]))&&!st.gates.includes(row.id))st.gates.push(row.id);}
 for(const f of questParameters.legacy_implicit_features??[])if(!st.features.includes(f))st.features.push(f);s.starsea=st;evaluateUnlocks(s);return true;}
 const st=s.starsea;st.attempts??={};st.gateAttempts??={};st.waypoints??=[];st.discovered??=[];st.clearedCamps??=[];for(const [id,run]of Object.entries(st.quests))st.attempts[id]=Math.max(st.attempts[id]??0,run.attempt);evaluateUnlocks(s);let changed=false;for(const gate of worldTables.gates)if(gate.openWhen&&conditionMet(s,gate.openWhen)&&!st.gates.includes(gate.id)){st.gates.push(gate.id);changed=true;}return syncPhaseWaypoints(s)||changed;}
export const hasStarsea=(s:CharacterState):s is CharacterState&{starsea:StarseaState}=>Boolean(s.starsea);
function current(st:StarseaState,id=st.tracked??''){if(!id||!seaTasks.some(t=>t.id===id))return;const item=info(id),run=st.quests[id],steps=starseaTaskSteps(item.chapter,item.index,run?.choice);return {...item,steps,run,step:steps[run?.step??0]};}
export function starseaCurrentStep(s:CharacterState){ensureStarsea(s);return s.starsea?current(s.starsea)?.step:undefined;}
export function starseaBossOpen(st:StarseaState,map:string){const n=starseaBossMaps.indexOf(map);return n>=0&&(st.bosses.includes(map)||st.islands.includes(starseaIslands[n]));}
export function starseaRegionOpen(st:StarseaState,region:string){region=economyRegionOf(region);return region===starseaHub||st.islands.includes(region)||starseaBossOpen(st,region);}
export type QuestCompletion={id:string;xp:number;gold:number;choice?:'a'|'b'};
export type StarseaGain={xp:number;gold:number;messages:string[];completed:QuestCompletion[]};
const gain=():StarseaGain=>({xp:0,gold:0,messages:[],completed:[]});
function worldFactId(r:NonNullable<ReturnType<typeof stepRow>>){return `${r.map}:${r.landmark??r.key}:${r.point_index}`;}
function factSatisfied(s:CharacterState,id:string){const st=s.starsea!;const c=current(st,id);if(!c?.run||!c.step)return false;const r=stepRow(id,c.run.step)!;switch(r.op){case 'kill_zone':case 'obtain_hex':return (c.run.progress?.[r.key]??0)>=r.count;case 'equip_hex':return ['hex1','hex2'].some(slot=>{const gear=s.gear.find(g=>g.id===s.equipment[slot as 'hex1'|'hex2']);return !!gear&&hexRuneById.has(gear.base);});case 'boss':return st.bosses.includes(c.step.map);case 'gate':return st.gates.includes(r.gate??r.key);case 'clear_camp':return st.clearedCamps.includes(r.camp??r.key)||bossResolvedCamp(s,r.camp??r.key);case 'reach_waypoint':return st.waypoints.includes(r.key);case 'discover_zone':return st.discovered.includes(r.key);case 'open_chest':case 'complete_event':case 'kill_rare':case 'clear_dungeon':return Boolean(st.fieldFacts?.[r.op].includes(r.key));case 'interact':return r.world_fact&&st.seen.includes(worldFactId(r));default:return false;}}
function complete(s:CharacterState,id:string,g:StarseaGain){const st=s.starsea!,r=st.quests[id],row=definition(id);if(!r||st.done.includes(id))return;const item=info(id),choice=r.choice??s.taskJournal?.archive.findLast(a=>taskById.get(a.taskId)?.chapter===row.chapter&&a.choice)?.choice,ctx={route:choice,routeName:choice?item.chapter.choice[choice].name:'',conditions:conditionTargets(s)},spoken=linesFor(row.dialog_complete??'',ctx).map(l=>({speaker:speakerLabel(l.speaker),text:l.text}));st.completion={id:id+':'+r.attempt,title:row.title,speaker:spoken[0]?.speaker??'',text:spoken.map(l=>l.text).join(' '),lines:spoken};st.done.push(id);delete st.quests[id];if(st.wave?.task===id)st.wave=null;if(st.tracked===id)st.tracked=null;const xp=st.hardmode?row.reward_xp_hardmode??row.reward_xp??0:row.reward_xp??0,gold=row.reward_gold??0;g.xp+=xp;g.gold+=gold;g.completed.push({id,xp,gold,...(r.choice?{choice:r.choice}:{})});evaluateUnlocks(s);applySkillRecovery(s,id,g);for(const rumor of rumors)if(rumor.source==='task'&&rumor.source_id===id&&!st.rumors.includes(rumor.id))st.rumors.push(rumor.id);}
function advance(s:CharacterState,id:string,g:StarseaGain){const st=s.starsea!,r=st.quests[id];if(!r)return;r.step++;if(st.wave?.task===id)st.wave=null;settleFacts(s,id,g);}
function settleFacts(s:CharacterState,id:string,g:StarseaGain){const st=s.starsea!,r=st.quests[id];if(!r)return;while(r.step<info(id).steps.length&&factSatisfied(s,id))r.step++;if(r.step>=info(id).steps.length)complete(s,id,g);}
export type FieldFact='open_chest'|'complete_event'|'kill_rare'|'clear_dungeon';
/** Called after an inventory command inside the same reward transaction. Only
 * newly acquired IDs count as pickups; an old item or command replay cannot
 * manufacture obtain progress. Equipping is checked from authoritative slots. */
export function recordHexInventoryFacts(s:CharacterState,before:ReadonlySet<string>):StarseaGain{
 const g=gain(),st=s.starsea;if(!st)return g;
 const acquired=s.gear.filter(item=>!before.has(item.id)&&hexRuneById.has(item.base)).length;
 for(const [id,run] of Object.entries(st.quests)){
  for(const row of stepsByTask.get(id)??[])if(row.op==='obtain_hex'&&acquired){
   run.progress??={};run.progress[row.key]=Math.min(row.count,(run.progress[row.key]??0)+acquired);
  }
  if((stepsByTask.get(id)??[]).some(r=>r.op==='obtain_hex'||r.op==='equip_hex'))settleFacts(s,id,g);
 }
 return g;
}
/** Called only by authoritative activity/dungeon settlement in its reward transaction. */
export function recordFieldFact(s:CharacterState,kind:FieldFact,id:string):StarseaGain{ensureStarsea(s);const g=gain(),st=s.starsea;if(!st)return g;st.fieldFacts??={open_chest:[],complete_event:[],kill_rare:[],clear_dungeon:[]};if(!st.fieldFacts[kind].includes(id))st.fieldFacts[kind].push(id);for(const task of Object.keys(st.quests))settleFacts(s,task,g);evaluateUnlocks(s);return g;}
function accept(s:CharacterState,id:string,at:number,g:StarseaGain){const st=s.starsea!,row=definition(id);if(st.quests[id])return;if(st.done.includes(id)||!questEligible(s,id))reject('QUEST_LOCKED','这条线索暂时不可接取。');if(Object.keys(st.quests).length>=maxActiveQuests)reject('QUEST_CAPACITY','进行中的任务已满，请先完成或放弃一条支线。');// Bounties are repeatable board instances (rules/bounty.ts), never story quests.
if(row.type==='bounty')reject('BOUNTY_BOARD','悬赏请在前哨悬赏板接取。');
 st.quests[id]={step:0,attempt:st.attempts[id]??0,acceptedAt:at};if(!st.tracked||row.auto_track&&definition(st.tracked).series==='onboarding'){st.tracked=id;st.trackedManually=false;}settleFacts(s,id,g);}
function autoAccept(s:CharacterState,at:number,g:StarseaGain){let accepted;do{accepted=false;for(const row of seaTasks)if(row.accept_mode==='none'&&!s.starsea!.quests[row.id]&&!s.starsea!.done.includes(row.id)&&questEligible(s,row.id)&&Object.keys(s.starsea!.quests).length<maxActiveQuests){accept(s,row.id,at,g);accepted=true;}}while(accepted);}
/** 本地验收检查点专用（apps/api 开发服 /api/dev/checkpoint）：按正常完成流程逐个做完任务，奖励、送技能、解锁都走 complete。 */
export function devCompleteStarseaTasks(s:CharacterState,ids:readonly string[],at:number):StarseaGain{ensureStarsea(s);const g=gain();for(const id of ids){autoAccept(s,at,g);if(!s.starsea!.quests[id])accept(s,id,at,g);complete(s,id,g);if(!s.starsea!.done.includes(id))reject('DEV_CHECKPOINT','检查点任务没有完成：'+id);}autoAccept(s,at,g);return g;}
export const starseaClearPlausible=(w:NonNullable<StarseaState['wave']>,now:number)=>w.startedAt===undefined||now-w.startedAt>=(w.minClearMs??0);
function activeWaveZone(w:NonNullable<StarseaState['wave']>){return (w.spawns[0]?worldZoneAt(w.region,w.spawns[0])?.id:undefined)??(w.task.startsWith('gate:')?worldTables.gates.find(g=>g.id===w.task.slice(5))?.zone:stepRow(w.task,w.step)?.zone);}
export const starseaEngineTask=(s:CharacterState)=>Boolean(s.starsea?.wave&&engineDefense.tasks.includes(s.starsea.wave.task)||s.starsea?.tracked&&engineDefense.tasks.includes(s.starsea.tracked));
function levelFor(st:StarseaState,zoneId:string,seq:number,rank:'normal'|'elite',map:string){const zone=characterWorldTables({starsea:st}).zones.find(z=>z.id===zoneId&&z.region===map);if(!zone)reject('CONTENT','任务步骤缺少有效分区 '+zoneId);const band=zone!.levelBand;return Math.min(52,band[0]+(seq-1)%(band[1]-band[0]+1)+(rank==='elite'?1:0));}
function startWave(s:CharacterState,id:string,input:QuestInput,g:StarseaGain){const st=s.starsea!,item=current(st,id)!;if(!item.run||!item.step)reject('QUEST','请先接取任务。');let step=item.step;if(input.choice&&item.run.choice&&input.choice!==item.run.choice)reject('STARSEA_ROUTE_LOCKED','这条线索的路线已经锁定。');if(input.retry&&stepRow(id,item.run.step)?.op==='defend'&&st.wave?.task===id&&(input.now??Date.now())-(st.wave.startedAt??0)>=engineDefense.retrySeconds*1000)st.wave=null;if(step.map!==input.region)reject('STARSEA_PLACE','请先到目标所在区域。');if(st.wave){if(st.wave.task===id&&st.wave.step===item.run.step)return st.wave.spawns.filter(m=>!st.wave!.killed.includes(m.id));if(st.wave.region===input.region&&activeWaveZone(st.wave)===(worldZoneAt(input.region,step.points[step.op==='choose'&&input.choice==='b'?1:0])?.id??stepRow(id,item.run.step)?.zone)&&st.wave.killed.length<st.wave.spawns.length)reject('QUEST_WAVE_BUSY','先清掉当前的任务敌人');st.wave=null;}
 if(step.op==='choose'){if(!input.choice)reject('STARSEA_CHOICE','请选择路线。');if(item.run.choice&&item.run.choice!==input.choice)reject('STARSEA_ROUTE_LOCKED','这条线索的路线已经锁定。');item.run.choice=input.choice;grantRouteSkill(s,id,input.choice!,g);item.run.step++;step=current(st,id)!.step!;}
 if(step.op!=='wave')reject('STARSEA_STEP','现在不是战斗步骤。');const row=stepRow(id,item.run.step)!;item.run.attempt++;st.attempts[id]=item.run.attempt;const c=item.chapter,m=starseaMap(step.map),center=step.points[0],foes=step.enemies.length?step.enemies:starseaCampaign.monsters.filter(x=>x.rank==='normal'&&x.chapter.includes(c.n)).map(x=>x.id);const elite=foes.find(x=>x.startsWith('ss-elite-')),normals=foes.filter(x=>!x.startsWith('ss-elite-'));const spawns=Array.from({length:step.size},(_,i)=>{const rank=elite&&i===0&&definition(id).elite?'elite' as const:'normal' as const,p=near(m,center,i+item.run!.attempt,3+i%2),template=rank==='elite'?elite!:normals[i%normals.length]??elite!;return applyEncounterOverrides(resolveMonsterSpawn({id:`q:${id}:${item.run!.step}:${item.run!.attempt}:${i}`,template,rank,level:levelFor(st,worldZoneAt(step.map,center)?.id??row.zone!,row.seq,rank,step.map),...p},undefined,row.op==='defend'?{hp:engineDefense.hpMultiplier,attack:engineDefense.attackMultiplier,armor:1}:undefined),row);});const zone=worldTables.zones.find(z=>z.id===row.zone||z.id===worldZoneAt(step.map,center)?.id)!,level=Math.max(...spawns.map(m=>m.monster!.level)),defense=row.op==='defend'?{hp:worldObjectiveHp(engineDefense.hp,zone.levelBand[1],st.hardmode?level:zone.levelBand[1]),radius:engineDefense.radius,holdTicks:engineDefense.holdTicks}:undefined;st.wave={defense,task:id,step:item.run.step,region:step.map,spawns,killed:[],startedAt:input.now??Date.now()};return spawns;}
export type QuestInput={task?:string|null;target?:string;gate?:string;choice?:'a'|'b';region:string;now?:number;position?:Vec;retry?:boolean};
export type QuestOp='accept'|'discover'|'gate'|'abandon'|'track'|'arrive'|'waypoint'|'start'|'interact'|'talk'|'relic'|'defense-finish';
/** Spatial target for application-layer validation; all coordinates come from authored data. */
export function questTarget(s:CharacterState,op:QuestOp,input:QuestInput):Vec|undefined{
 if(['track','abandon','defense-finish'].includes(op))return;
 if(op==='arrive'||op==='discover')return landmark(starseaMap(input.region),input.target??'')??(op==='arrive'?undefined:reject('QUEST_TARGET','线索物件不存在。'));
 if(op==='waypoint')return visibleWorldRows(s,worldTables.waypoints).find(w=>w.id===input.target&&w.region===input.region)??reject('QUEST_TARGET','航标不存在。');
 if(op==='gate'){const gate=visibleWorldRows(s,worldTables.gates).find(g=>g.id===(input.gate??input.target)&&g.map===input.region);return gate?landmark(starseaMap(gate.map),gate.landmark):reject('QUEST_TARGET','机关不存在。');}
 if(op==='relic')return starseaRelics.find(r=>r.id===input.target&&r.map===input.region);
 if(op==='accept'&&input.task){const row=definition(input.task),first=info(input.task).steps[0],map=row.accept_map??first.map;if(row.accept_mode==='talk'){const npc=starseaView(s)?.npcPositions.find(n=>n.npc===(row.accept_npc??row.giver)&&n.map===map);if(npc)return {x:npc.x,y:npc.y};}return row.accept_landmark?landmark(starseaMap(map),row.accept_landmark):first.points[0];}
 const id=input.task??s.starsea?.tracked;if(!id)return;const step=current(s.starsea!,id)?.step;if(!step)return;return step.op==='choose'&&input.choice?step.points[input.choice==='a'?0:1]:step.points[0];
}
export function applyStarseaOp(s:CharacterState,op:QuestOp,input:QuestInput):{gain:StarseaGain;spawns:Spawn[]}{ensureStarsea(s);const st=s.starsea??reject('STARSEA','该角色不在星潮海。'),g=gain(),at=input.now??Date.now();if(!starseaRegionOpen(st,input.region))reject('STARSEA_PLACE','区域尚未开放。');
 if(op==='track'){if(input.task!==null&&!st.quests[input.task??''])reject('QUEST','只能追踪进行中的任务。');st.tracked=input.task??null;st.trackedManually=Boolean(input.task);return {gain:g,spawns:[]};}
 if(op==='abandon'){const id=input.task??'',row=definition(id);if(row.type==='guide'||row.abandonable===false)reject('QUEST_ABANDON','引导可以取消追踪，不可放弃。');delete st.quests[id];if(st.wave?.task===id)st.wave=null;if(st.tracked===id)st.tracked=null;return {gain:g,spawns:[]};}
 if(op==='waypoint'){const w=visibleWorldRows(s,worldTables.waypoints).find(w=>w.id===input.target&&w.region===input.region);if(!w)reject('WAYPOINT','航标不存在。');if(!st.waypoints.includes(w!.id))st.waypoints.push(w!.id);if(!st.discovered.includes(w!.zone))st.discovered.push(w!.zone);for(const id of Object.keys(st.quests))settleFacts(s,id,g);evaluateUnlocks(s);return {gain:g,spawns:[]};}
 if(op==='gate'){const gate=visibleWorldRows(s,worldTables.gates).find(gate=>gate.id===(input.gate??input.target)&&gate.map===input.region);if(!gate)reject('GATE','机关不存在。');if(st.gates.includes(gate!.id))return {gain:g,spawns:[]};if(st.wave){if(st.wave.task==='gate:'+gate!.id)return {gain:g,spawns:st.wave.spawns.filter(m=>!st.wave!.killed.includes(m.id))};if(st.wave.region===input.region&&st.wave.killed.length<st.wave.spawns.length)reject('QUEST_WAVE_BUSY','先清掉当前的任务敌人');st.wave=null;}const previous=(st.gateAttempts[gate!.id]??0)+1;st.gateAttempts[gate!.id]=previous;const map=starseaMap(gate!.map),p=landmark(map,gate!.landmark)!;const spawns=gate!.guards.flatMap(spec=>Array.from({length:spec.count},()=>spec)).map((spec,i)=>resolveMonsterSpawn({id:`gate:${gate!.id}:${previous}:${i}`,template:spec.template,rank:spec.rank,level:levelFor(st,gate!.zone,1,spec.rank==='elite'?'elite':'normal',input.region),...near(map,p,i+previous,3)}));st.wave={task:'gate:'+gate!.id,step:0,region:input.region,spawns,killed:[],startedAt:at};return {gain:g,spawns};}
 if(op==='discover'||op==='arrive'){if(op==='discover')for(const r of stepRows.filter(r=>r.world_fact&&r.op==='interact'&&r.map===input.region&&r.landmark===input.target)){const fact=worldFactId(r);if(!st.seen.includes(fact))st.seen.push(fact);}const zoneAt=worldTables.zones.find(z=>z.region===input.region&&(!input.position||input.position.x>=z.rect.x&&input.position.x<z.rect.x+z.rect.w&&input.position.y>=z.rect.y&&input.position.y<z.rect.y+z.rect.h));if(zoneAt&&!st.discovered.includes(zoneAt.id))st.discovered.push(zoneAt.id);if(input.position)st.location={map:input.region,...input.position};autoAccept(s,at,g);const found=seaTasks.filter(t=>t.accept_mode===op&&t.discover_landmark===input.target&&info(t.id).steps[0].map===input.region&&questEligible(s,t.id));for(const row of found){const first=stepRow(row.id,0)!;const fact=worldFactId(first);if(op==='discover'&&!st.seen.includes(fact))st.seen.push(fact);if(!st.quests[row.id]&&!st.done.includes(row.id))accept(s,row.id,at,g);}for(const id of Object.keys(st.quests))settleFacts(s,id,g);autoAccept(s,at,g);return {gain:g,spawns:[]};}
 if(op==='relic'){const r=starseaRelics.find(x=>x.id===input.target&&x.map===input.region);if(!r||r.kind==='core'&&!st.hardmode)reject('STARSEA_RELIC','这里没有可收取的星晶。');if(st.crystals.includes(r!.id))reject('STARSEA_RELIC','已经收取。');st.crystals.push(r!.id);return {gain:g,spawns:[]};}
 const id=input.task??st.tracked??reject('QUEST','请选择任务。');if(op==='accept'){const start=info(id).steps[0];if((definition(id).accept_map??start.map)!==input.region)reject('STARSEA_PLACE','请先到接取地点。');if(!['talk','board'].includes(definition(id).accept_mode))reject('QUEST_DISCOVERY','请在世界中发现这条线索。');accept(s,id,at,g);return {gain:g,spawns:[]};}const item=current(st,id);if(!item?.run||!item.step)reject('QUEST','请先接取任务。');if(item!.step.map!==input.region)reject('STARSEA_PLACE','请先到目标所在区域。');
 if(op==='talk'){if(item!.step.op!=='talk'||input.target&&input.target!==item!.step.points[0].id)reject('STARSEA_TARGET','请与目标人物交谈。');advance(s,id,g);autoAccept(s,at,g);return {gain:g,spawns:[]};}
 if(op==='defense-finish'){if(!st.wave||st.wave.task!==id||st.wave.killed.length<st.wave.spawns.length||!starseaClearPlausible(st.wave,at))reject('STARSEA_DEFENSE','守护还没有完成。');advance(s,id,g);autoAccept(s,at,g);return {gain:g,spawns:[]};}
 if(op==='interact'){if(item!.step.op!=='interact'||input.target!==item!.step.points[0].id)reject('STARSEA_TARGET','请调查目标物件。');const r=stepRow(id,item!.run!.step)!;if(item!.step.fact==='gate')return applyStarseaOp(s,'gate',{...input,gate:item!.step.factId});if(r.op!=='interact')reject('WORLD_FACT','请先完成对应的世界目标。');if(r.world_fact&&!st.seen.includes(worldFactId(r)))st.seen.push(worldFactId(r));if(r.then_battle){item!.run!.step++;return {gain:g,spawns:startWave(s,id,input,g)};}advance(s,id,g);autoAccept(s,at,g);return {gain:g,spawns:[]};}
 const spawns=startWave(s,id,input,g);return {gain:g,spawns};}
function tideNightSpawns(st:StarseaState,region:string){const n=starseaIslands.indexOf(region)+1,m=starseaMap(region),center=landmark(m,'objective')??m.landmarks[0],pool=starseaCampaign.monsters.filter(x=>x.chapter.includes(n));return Array.from({length:tideNightSize},(_,i)=>{const elite=i<3,foes=pool.filter(x=>x.rank===(elite?'elite':'normal')),template=foes[i%foes.length].id,rank=elite?'elite' as const:'normal' as const;return resolveMonsterSpawn({id:`night:${region}:${st.nights??0}:${i}`,template,rank,level:placementLevel(n,1,rank,st.hardmode),...near(m,center,i+(st.nights??0),3+i%2)});});}
export function recordStarseaKill(s:CharacterState,region:string,source:string,boss:boolean,observer?:Vec,killPosition?:Vec):StarseaGain&{spawns?:Spawn[]}{ensureStarsea(s);const g:StarseaGain&{spawns?:Spawn[]}=gain(),st=s.starsea;if(!st)return g;if(killPosition){const zone=worldZoneAt(region,killPosition)?.id;for(const [task,run] of Object.entries(st.quests))for(const row of stepsByTask.get(task)??[])if(row.op==='kill_zone'&&row.map===region&&row.zone===zone){run.progress??={};run.progress[row.key]=Math.min(row.count,(run.progress[row.key]??0)+1);}}if(st.night?.spawns.some(m=>m.id===source)){if(!st.night.killed.includes(source))st.night.killed.push(source);if(st.night.killed.length===st.night.spawns.length){g.gold+=Math.round(200*1.15**(placementLevel(starseaIslands.indexOf(region)+1,1,'normal',st.hardmode)-1));st.night=null;}return g;}
 if(!boss&&!/^(q:|gate:)/.test(source)&&(starseaIslands.includes(region)||fieldRegionInfo(region))&&!st.night){const at=observer??(st.location?.map===region?st.location:starseaMap(fieldRegionInfo(region)?.island??region).landmarks[0]),zone=nightZone(region,killPosition??at),key=zone?.id??region;st.tide??={};st.tide[key]=(st.tide[key]??0)+1;if(st.tide[key]>=tideNightKills){st.tide[key]=0;const spawns=fieldRegionInfo(region)?worldNightSpawns(s,region,at,st.nights??0):tideNightSpawns(st,region);st.night={task:'tide-night',step:st.nights??0,region,spawns,killed:[]};st.nights=(st.nights??0)+1;g.spawns=spawns;}}
 if(boss&&starseaBossMaps.includes(region)&&!st.bosses.includes(region))st.bosses.push(region);syncPhaseWaypoints(s);if(st.wave?.spawns.some(m=>m.id===source)&&!st.wave.killed.includes(source)){st.wave.killed.push(source);if(st.wave.killed.length===st.wave.spawns.length){const id=st.wave.task;if(id.startsWith('gate:')){const key=id.slice(5);if(!st.gates.includes(key))st.gates.push(key);st.wave=null;}else if(stepRow(id,st.quests[id]?.step??0)?.op!=='defend')advance(s,id,g);}}
 for(const id of Object.keys(st.quests))settleFacts(s,id,g);evaluateUnlocks(s);autoAccept(s,Date.now(),g);return g;}
export function recordCampFact(s:CharacterState,id:string){ensureStarsea(s);const g=gain();if(s.starsea&&!s.starsea.clearedCamps.includes(id))s.starsea.clearedCamps.push(id);for(const q of Object.keys(s.starsea?.quests??{}))settleFacts(s,q,g);if(s.starsea)autoAccept(s,Date.now(),g);return g;}
export function starseaPendingWave(s:CharacterState,region:string){const w=s.starsea?.wave,night=s.starsea?.night;return [...(w?.region===region?w.spawns:[]),...(night?.region===region?night.spawns.filter(m=>!night.killed.includes(m.id)):[])];}
export function isTideNightSpawn(s:CharacterState,id:string){return Boolean(s.starsea?.night?.spawns.some(m=>m.id===id));}
function viewStep(st:StarseaState,id:string){const c=current(st,id);if(!c?.step)return null;const step=c.step,run=c.run,r=stepRow(id,run?.step??0),p=step.points[0],hint=r?.hint?.replaceAll('{verb}',p?.prop?starseaPropHintVerbs[p.prop]??'调查':'调查').replaceAll('{thing}',p?.prop?starseaPropNames[p.prop]??p.label:p?.label??'目标').replaceAll('{need}',String(step.size)).replaceAll('{part}',step.groupSize>1?`（${step.group+1}/${step.groupSize}）`:'').replaceAll('{npc}',p?.label??'居民');return {op:step.op,...(step.fact?{fact:step.fact}:{}),map:step.map,mapName:starseaMap(step.map).name,label:step.label,points:step.points,count:r&&['kill_zone','obtain_hex'].includes(r.op)?run?.progress?.[r.key]??0:st.wave?.task===id?st.wave.killed.length:0,need:step.fact&&r&&['kill_zone','obtain_hex','equip_hex'].includes(r.op)?r.count:step.op==='wave'?step.size:step.op==='boss'?1:0,defense:r?.op==='defend',hint,seq:r?.seq};}
export function starseaView(s:CharacterState):StarseaView|undefined{ensureStarsea(s);const st=s.starsea;if(!st)return;const met=conditionTargets(s),advanced=s.level>islandBand(1,false)[1]||st.islands.length>1,effectiveTracked=starseaTracked(s),qs=Object.keys(st.quests).map(id=>{const r=definition(id),step=viewStep(st,id)!;return {id,title:r.title,type:r.type,series:r.series,thread:r.thread,step,tracked:id===effectiveTracked,abandonable:r.type!=='guide'&&r.abandonable!==false,goal:r.goal,accept:linesFor(r.dialog_accept??'',{route:st.quests[id].choice,conditions:met}).map(l=>({speaker:speakerLabel(l.speaker),text:l.text}))};});
 const visible=seaTasks.filter(t=>!st.done.includes(t.id)&&!st.quests[t.id]&&questEligible(s,t.id)),available=visible.flatMap(row=>{const first=info(row.id).steps[0],map=starseaMap(first.map),at=(row.accept_mode==='talk'?first.points[0]:landmark(map,row.discover_landmark??row.accept_landmark??'landing'))??first.points[0]??landmark(map,'safe')!;if(row.zone&&!st.discovered.includes(row.zone)&&first.map!==starseaHub)return [];return [{id:'quest:'+row.id,task:row.id,map:first.map,type:row.type,title:row.title,accept_mode:row.accept_mode,x:at.x,y:at.y,label:row.title,npc:row.accept_npc??first.points[0]?.npc,prop:first.points[0]?.prop,done:false}];});
 const markers:StarseaView['markers']=[...visibleWorldRows(s,worldTables.waypoints).filter(w=>st.islands.includes(w.region)&&st.discovered.includes(w.zone)&&!st.waypoints.includes(w.id)).map(w=>({id:'waypoint:'+w.id,map:w.region,kind:'waypoint' as const,x:w.x,y:w.y,label:w.name,prop:'ss-prop-sign',done:false})),...visible.filter(t=>['discover','arrive'].includes(t.accept_mode)&&t.zone&&st.discovered.includes(t.zone)).map(row=>{const map=info(row.id).steps[0].map,at=landmark(starseaMap(map),row.discover_landmark!)!;return {id:'discover:'+row.id,task:row.id,map,kind:'clue' as const,x:at.x,y:at.y,label:row.title,prop:info(row.id).steps[0].points[0]?.prop,done:false};}),...visibleWorldRows(s,worldTables.gates).filter(g=>st.islands.includes(g.map)&&!st.gates.includes(g.id)&&st.discovered.includes(g.zone)).map(g=>({id:'gate:'+g.id,map:g.map,kind:'gate' as const,...coords(landmark(starseaMap(g.map),g.landmark)!),prop:g.prop,label:questParameters.gate_label??'调查机关',done:false})),...rumors.filter(r=>st.rumors.includes(r.id)&&!st.seen.includes(r.landmark)).map(r=>({id:'rumor:'+r.id,map:r.island,kind:'rumor' as const,...coords(landmark(starseaMap(r.island),r.landmark)!),label:r.text,done:false}))];
 const selected=effectiveTracked?current(st,effectiveTracked):undefined,q=qs.find(q=>q.id===effectiveTracked),task=q&&selected?{id:q.id,index:selected.index,title:q.title,goal:q.goal,speaker:selected.task.speaker,speakerName:starseaName(selected.task.speaker),accept:q.accept,player:[],complete:selected.task.complete}:null,chapter=selected?{n:selected.chapter.n,title:selected.chapter.title,island:starseaMap(selected.chapter.map).name,map:selected.chapter.map}:null;
 // 位置优先级：对话步骤 > 接取后留在原地（任务表 accept_stay，站在接取地标旁直到任务完成）> 港口站位。
 const phasedNpcs=new Map(resolveNpcPhase(s,configuredNpcPositions).map(n=>[n.npc,n])),authoredNpcs=new Set(configuredNpcPositions.map(n=>n.npc));
 const npcPositions=Object.entries(starseaPortSpots).flatMap(([npc,p])=>{const preferred=phasedNpcs.get(npc);if(preferred?.priority)return [{npc,map:preferred.map,x:preferred.x,y:preferred.y}];const active=qs.filter(q=>q.step.op==='talk'&&q.step.points.some(p=>p.npc===npc)).sort((a,b)=>(definition(a.id).chapter??'').localeCompare(definition(b.id).chapter??''))[0];if(active){const at=active.step.points.find(p=>p.npc===npc)!;return [{npc,map:active.step.map,x:at.x,y:at.y}];}const stay=qs.map(q=>definition(q.id)).find(r=>r.accept_stay&&r.accept_npc===npc&&r.accept_map&&r.accept_landmark),spot=stay&&landmark(starseaMap(stay.accept_map!),stay.accept_landmark!);if(stay&&spot)return [{npc,map:stay.accept_map!,x:spot.x+1,y:spot.y}];const phased=phasedNpcs.get(npc);if(phased)return [phased];if(authoredNpcs.has(npc))return [];return st.npcs.includes(npc)&&worldPhaseVisible(s,npcRows.find(n=>n.id===npc)??{})?[{npc,map:starseaHub,...p}]:[];});const port=npcPositions.filter(n=>n.map===starseaHub).map(n=>({npc:n.npc,name:starseaName(n.npc),idle:starseaCampaign.npcs.find(x=>x.id===n.npc)?.idle??[],x:n.x,y:n.y}));
 const islands=starseaIslands.map((map,i)=>({map,name:starseaMap(map).name,chapter:i+1,levels:islandBand(i+1,st.hardmode).join('–'),boss:starseaBossMaps[i],bossName:starseaCampaign.bosses[i].name,open:st.islands.includes(map),requiredLevel:Math.min(...conditions.filter(c=>c.target==='island:'+map&&c.kind==='level').map(c=>Number(c.value))),bossOpen:starseaBossOpen(st,starseaBossMaps[i]),bossCleared:st.bosses.includes(starseaBossMaps[i]),hardmodeBossCleared:Boolean(s.world?.hardmodeBosses?.includes(starseaBossMaps[i])),loot:starseaLootFocus[i].map(f=>equipmentRuntime.families[f].name).join('、')}));
 const region=s.lastRegion??st.islands[0],pos=st.location?.map===region?st.location:{x:starseaMap(isStarseaRegion(region)?region:starseaHub).landmarks[0].x,y:starseaMap(isStarseaRegion(region)?region:starseaHub).landmarks[0].y};const onboarding=qs.find(q=>q.series==='onboarding'),near=markers.filter(m=>m.map===region).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y))[0],candidate=onboarding??qs.find(q=>q.step.map===region);let recommend:StarseaView['recommend']=advanced?starseaStageGoal(s):null;if(!recommend){if(onboarding)recommend={label:questParameters.recommend_onboarding.replace('{goal}',onboarding.step.hint??onboarding.step.label),map:onboarding.step.map,point:onboarding.step.points[0],kind:'onboarding'};else if(near)recommend={label:questParameters.recommend_nearby.replace('{goal}',near.label),map:near.map,point:near,kind:'nearby'};else if(available.some(a=>a.map===region)){const a=available.filter(a=>a.map===region).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y))[0];recommend={label:questParameters.recommend_task.replace('{goal}',a.title),map:a.map,point:a,kind:'task'};}else if(worldTables.dungeonEntrances.some(d=>d.region===region)){const d=worldTables.dungeonEntrances.find(d=>d.region===region)!;recommend={label:questParameters.recommend_dungeon.replace('{place}',dungeonContent.definitions.find(item=>item.id===d.dungeon)?.name??d.dungeon),map:region,point:d,kind:'dungeon'};}else{const next=starseaIslands[Math.min(5,Math.max(0,starseaIslands.indexOf(region)+1))],n=starseaIslands.indexOf(next),open=st.islands.includes(next);recommend={label:(open?questParameters.recommend_voyage:questParameters.recommend_level).replace('{place}',starseaMap(next).name).replace('{level}',String(islands[n].requiredLevel)),map:starseaHub,kind:'voyage'};}}
 const relics=starseaRelics.filter(r=>st.islands.includes(r.map)&&(r.kind==='life'||st.hardmode)).map(r=>({...r,id:'relic:'+r.id,label:r.name,prop:'ss-prop-core',state:st.crystals.includes(r.id)?'stable':'dim',done:st.crystals.includes(r.id)}));const routeFork=q?.step.op==='choose'?point('route-fork',landmark(starseaMap(q.step.map),'route-fork')??q.step.points[0],'两路分岔口','ss-prop-sign'):undefined;const routes=selected&&routeFork?(['a','b'] as const).map(id=>({id,name:selected.chapter.choice[id].name,enemies:selected.chapter.choice[id].enemies,risk:selected.chapter.choice[id].risk})):undefined;
 return {quests:qs,available,markers,tracked:effectiveTracked,recommend,conditions:met,npcPositions,chapter,task,step:q?.step??null,props:selected?selected.steps.slice(0,selected.run?.step??0).filter(step=>step.op==='interact'&&step.map===q?.step.map).flatMap(step=>step.points.map(p=>({...p,done:true,state:'stable'}))):[],port,islands,relics,features:st.features,hardmode:st.hardmode,tideProgress:starseaTideProgress(s),complete:seaTasks.every(t=>st.done.includes(t.id)),opening:false,completion:st.completion,routeFork,routes};}

/** Read models only: ordinary clears never stand in for a tide clear. */
export function starseaTracked(s:CharacterState){
 const st=s.starsea;if(!st?.tracked)return null;
 const row=seaTasks.find(t=>t.id===st.tracked);if(!row||!st.quests[st.tracked])return null;
 const advanced=s.level>islandBand(1,false)[1]||st.islands.length>1;
 return advanced&&row.series==='onboarding'&&!st.trackedManually?null:st.tracked;
}
export function starseaTideProgress(s:Pick<CharacterState,'world'>){
 const remaining=starseaBossMaps.flatMap((boss,i)=>s.world?.hardmodeBosses?.includes(boss)?[]:[starseaMap(starseaIslands[i]).name]);
 return {completed:starseaBossMaps.length-remaining.length,total:starseaBossMaps.length,remaining};
}
export function starseaStageGoal(s:CharacterState):StarseaView['recommend']{
 const st=s.starsea;if(!st)return null;
 const index=starseaBossMaps.findIndex((boss,i)=>st.islands.includes(starseaIslands[i])&&!(st.hardmode?s.world?.hardmodeBosses?.includes(boss):st.bosses.includes(boss))),progress=starseaTideProgress(s);
 if(index<0){
  if(!st.hardmode)return null;
  const current=activeWorldTier(s),endgame=worldTiers.tiers.find(t=>t.unlock.kind==='hardmode_bosses');
  if(endgame&&current>=endgame.tier){const next=worldTierChoices(s).find(t=>t.tier>current&&t.unlocked);return next?{label:questParameters.recommend_stage_next_tier.replace('{name}',next.name),map:starseaHub,kind:'stage',action:'world-tier'}:{label:questParameters.recommend_stage_dungeon.replace('{name}',worldTier(current).name),map:starseaHub,kind:'stage',action:'dungeons'};}
  return {label:questParameters.recommend_stage_complete.replace('{count}',String(progress.completed)).replace('{total}',String(progress.total)),map:starseaHub,kind:'stage',action:'world-tier'};
 }
 const map=starseaIslands[index],name=starseaMap(map).name,boss=starseaCampaign.bosses[index].name;
 const label=st.hardmode?questParameters.recommend_stage_tide.replace('{count}',String(progress.completed)).replace('{total}',String(progress.total)).replace('{place}',name):questParameters.recommend_stage_boss.replace('{place}',name).replace('{boss}',boss);
 return {label,map,point:{...(regionById(map).bossPortal??regionById(map).portal)},kind:'stage'};
}
