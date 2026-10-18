import type {World,CombatEvent} from './index.ts';
import type {CombatAdvice,CombatFatalHit,CombatHitKind,CombatReview} from '../contracts/combat-review.ts';
import type {DamageType,StatusKind} from '../contracts/skill-mechanics.ts';
import {deathCause,selectCombatAdvice} from '../rules/combat-advice.ts';
import {damageTypeLabels,skillHint,statusLabelList} from '../content/combat-hints.ts';
export type {CombatReview,CombatFatalHit,CombatAdvice};
/** The killing blow and the hits before it, resolved from executor events only. */
export type CombatReviewHit={source:string;skill:string;amount:number;kind:CombatHitKind;damageType:DamageType;statuses:StatusKind[];hint:string};
export type CombatReviewRecord={lastTick:number;recent:Record<string,CombatReviewHit[]>};
export const newCombatReview=():CombatReviewRecord=>({lastTick:-1,recent:{}});
function sourceLabel(w:World,event:CombatEvent){const source=w.enemies.find(e=>e.id===event.sourceId);return source?.name??(event.sourceId===w.playerId?'自身效果':event.sourceId&&w.players.has(event.sourceId)?'队友效果':'来源未记录');}
type SkillInfo={name:string;kind:CombatHitKind;damageType:DamageType;statuses:StatusKind[];hint:string};
const bossKind=(kind:string):CombatHitKind=>kind==='ultimate'?'beam':(['melee','projectile','zone','beam','trap','summon','buff','teleport'] as const).includes(kind as CombatHitKind)?kind as CombatHitKind:'zone';
const basicAttacks:Record<string,{name:string;kind:CombatHitKind}>={'basic-melee':{name:'近身攻击',kind:'melee'},'basic-ranged':{name:'远程攻击',kind:'projectile'},'basic-area':{name:'范围攻击',kind:'zone'}};
function skillInfo(w:World,event:CombatEvent):SkillInfo{
 const id=event.skill??'',monster=w.rules.monsterSkills[id];
 if(monster)return {name:monster.name,kind:monster.kind as CombatHitKind,damageType:monster.damageType??'physical',statuses:(monster.statuses??[]).map(s=>s.kind),hint:skillHint(monster)};
 for(const boss of Object.values(w.rules.chapterBossSkills)){
  const found=boss.skills?.find(s=>s.id===id) as {name:string;kind:string;damageType?:DamageType;slow?:boolean;hint?:string}|undefined;
  if(found)return {name:found.name,kind:bossKind(found.kind),damageType:found.damageType??w.rules.chapterDamageTypes?.[id]??'physical',statuses:found.slow?['slow']:[],hint:skillHint(found)};
 }
 const own=w.skills.find(s=>s.id===id);
 if(own)return {name:own.name,kind:'zone',damageType:'pure',statuses:[],hint:'来自你自己的技能，走开点'};
 const basic=basicAttacks[id]??{name:'普通攻击',kind:'melee' as CombatHitKind};
 return {...basic,damageType:'physical',statuses:[],hint:skillHint(basic)};
}
/** The executing World owns these events. Repeated broadcasts of one tick do not add hits. */
export function observeCombatReview(m:CombatReviewRecord,w:World,events:readonly CombatEvent[]=w.events){
 if(w.tick<=m.lastTick)return;m.lastTick=w.tick;
 for(const e of events){if(e.type!=='hit_resolved'||!(e.amount!>0))continue;
  if(!(e.id===w.playerId||w.players.has(e.id)))continue;
  const info=skillInfo(w,e),recent=m.recent[e.id]??=[];
  recent.push({source:sourceLabel(w,e),skill:info.name,amount:e.amount!,kind:info.kind,damageType:e.damageType??info.damageType,statuses:info.statuses,hint:info.hint});
  if(recent.length>5)recent.shift();
 }
}
function fatalHit(h:CombatReviewHit):CombatFatalHit{
 return {enemy:h.source,skill:h.skill,damage:Math.round(h.amount),damageType:damageTypeLabels[h.damageType]??h.damageType,statuses:statusLabelList(h.statuses.map(kind=>({kind}))),hint:h.hint,kind:h.kind};
}
/** outputShort puts damage advice first when the player could not out-damage the boss. */
export function resolveCombatReview(m:CombatReviewRecord|undefined,character:string,outputShort=false):CombatReview{
 const hits=m?.recent[character]??[],last=hits.at(-1);
 if(!last)return {fatal:null,advice:outputShort?selectCombatAdvice('output',true):[],recent:[]};
 return {fatal:fatalHit(last),advice:selectCombatAdvice(deathCause(last),outputShort),recent:hits.slice(0,-1).reverse().map(h=>`${h.source} · ${h.skill}：${Math.round(h.amount)} 伤害`)};
}
/** A later scene cannot borrow events from the previously loaded executor. */
export function currentCombatReview(m:CombatReviewRecord|undefined,recordedWorld:World|undefined,w:World){return recordedWorld===w?resolveCombatReview(m,w.playerId):undefined;}
