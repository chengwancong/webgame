import type {TacticalProjection,TacticalEvent,TacticalUnit,TacticalCell} from '../../contracts/tactical.ts';
import {tacticalArchetypes,tacticalGraybox} from '../../content/tactical-content.ts';
import {area,compareCells,direction,distance,hasLineOfSight,sameCell} from './geometry.ts';

/** Projection removes RNG and unrevealed assassin destinations before preview construction. */
export type TacticalEncounterState=TacticalProjection&{rngState:number;eventSerial:number;expected:boolean};
export type Resolution={state:TacticalEncounterState;events:TacticalEvent[];actionId:string;sourceId:string;rootActionId?:string;ownerTurnId?:string};
export const living=(s:TacticalEncounterState)=>s.units.filter(u=>u.hp>0);
export const heroOf=(s:Pick<TacticalProjection,'units'>)=>s.units.find(u=>u.side==='hero')!;
export function emit(r:Resolution,type:string,cause:string,fields:Partial<TacticalEvent>={}){
 const s=r.state;const event:TacticalEvent={battleId:s.battleId,round:s.round,ownerTurnId:r.ownerTurnId??s.ownerTurnId,actionId:r.actionId,rootActionId:r.rootActionId??r.actionId,resolutionId:`${r.actionId}:r${++s.eventSerial}`,sourceId:r.sourceId,cause,type,...fields};r.events.push(event);return event;
}
export function checkOutcome(s:TacticalEncounterState){
 if(!s.units.some(u=>u.side==='enemy'&&u.hp>0))s.outcome='win';else if(heroOf(s).hp<=0)s.outcome='loss';
 if(s.outcome){s.phase='ended';s.budget.ended=true;}
}
export function playerMultiplier(s:TacticalEncounterState){
 const {critChance,critMultiplier}=tacticalGraybox.hero;
 if(s.expected)return 1+critChance*(critMultiplier-1);
 s.rngState=(Math.imul(s.rngState,1664525)+1013904223)>>>0;
 return s.rngState/4294967296<critChance?critMultiplier:1;
}
export function damage(r:Resolution,target:TacticalUnit,raw:number,cause:string,source:TacticalUnit|undefined=r.state.units.find(u=>u.id===r.sourceId)){
 if(target.hp<=0||raw<=0)return;
 let amount=raw;
 if(target.statuses.some(t=>t.id==='exhausted'))amount*=tacticalGraybox.boss.exhaustedMultiplier;
 const curse=target.statuses.find(t=>t.id==='curse');if(curse){amount*=curse.amount;target.statuses=target.statuses.filter(t=>t!==curse);}
 if(source?.side==='hero'&&target.side==='enemy'&&['cut','throwing_knife','venom_needle'].includes(cause)){
  const guarded=living(r.state).some(g=>g.kind==='guard'&&g.id!==target.id&&distance(g.cell,target.cell)<=1&&front(g.cell,source.cell,g.facing));
  if(guarded)amount*=1-tacticalGraybox.enemies.guard.frontalReduction!;
 }
 amount=Math.round(amount*1000)/1000;const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;
 const dealt=Math.min(target.hp,amount-absorbed);target.hp=Math.max(0,Math.round((target.hp-dealt)*1000)/1000);
 if(absorbed)emit(r,'shield-absorbed',cause,{targetId:target.id,amount:absorbed});
 emit(r,'damage',cause,{targetId:target.id,amount:dealt});
 if(target.hp<=0){
  emit(r,'death',cause,{targetId:target.id});
  if(target.eliteAffixes.includes('frost_nova')){
   const cells=area(r.state.board,target.cell,1).filter(c=>!sameCell(c,target.cell));
   r.state.zones.push({id:`${target.id}:frost`,kind:'frost',sourceId:target.id,cells,damage:tacticalGraybox.affixes.frost_nova.damage,remaining:1,activeFromRound:r.state.round+1,rootActionId:r.actionId});
   emit(r,'zone-telegraph','frost-nova',{sourceId:target.id,cells});
  }
 }else if(target.eliteAffixes.includes('summon_minions')&&!target.flags.includes('half-summoned')&&target.hp<=target.maxHp*tacticalGraybox.affixes.summon_minions.threshold){
  target.flags.push('half-summoned');summon(r,target,tacticalGraybox.affixes.summon_minions.count);
 }
 if(target.kind==='boss'&&target.hp>0&&target.phase===1&&target.hp<=target.maxHp*tacticalGraybox.boss.phaseThreshold){target.phase=2;emit(r,'phase','boss-phase-two',{targetId:target.id});}
}
export function front(origin:TacticalCell,attacker:TacticalCell,facing:TacticalCell){const a=direction(origin,attacker);return a.x*facing.x+a.y*facing.y>0&&Math.abs(a.x*facing.y-a.y*facing.x)<=1;}
export function summon(r:Resolution,source:TacticalUnit,count:number){
 const limit=source.kind==='boss'?tacticalGraybox.boss.summonLimit:2;
 const present=living(r.state).filter(u=>u.summonedBy===source.id).length;
 const cells=area(r.state.board,source.cell,2).filter(c=>!living(r.state).some(u=>sameCell(u.cell,c))).sort((a,b)=>distance(a,source.cell)-distance(b,source.cell)||compareCells(a,b));
 const serial=r.state.units.filter(u=>u.summonedBy===source.id).length;
 for(let i=0;i<Math.min(count,limit-present,cells.length);i++){
  const id=`${source.id}:summon:${r.state.round}:${serial+i}`;const maxHp=tacticalGraybox.hpTiers.swarm;
  r.state.units.push({id,kind:'swarm',side:'enemy',cell:cells[i],hp:maxHp,maxHp,shield:0,statuses:[],cooldowns:{},eliteAffixes:[],facing:{x:0,y:1},activeFromRound:r.state.round+1,summonedBy:source.id,flags:[]});
  emit(r,'summon','summon',{sourceId:source.id,targetId:id,cell:cells[i]});
 }
}
export function moveUnit(r:Resolution,unit:TacticalUnit,path:TacticalCell[],cause:string){
 const fired=new Set<string>(),traversed=[{...unit.cell}];
 for(const next of path.slice(1)){
  if(unit.hp<=0)break;const from={...unit.cell};
  if(unit.side==='hero')for(const guard of living(r.state).filter(u=>u.kind==='guard')){
   const mark=`opportunity:${r.state.round}`;
   if(distance(guard.cell,from)<=1&&distance(guard.cell,next)>1&&!guard.flags.includes(mark)){
    guard.flags.push(mark);const old=r.sourceId;r.sourceId=guard.id;damage(r,unit,tacticalGraybox.enemies.guard.damage,'opportunity',guard);r.sourceId=old;
   }
  }
  if(unit.hp<=0)break;
  unit.cell={...next};unit.facing=direction(from,next);traversed.push({...next});
  if(unit.eliteAffixes.includes('fire_trail'))r.state.zones.push({id:`${unit.id}:fire:${r.state.round}:${next.x},${next.y}`,kind:'fire',sourceId:unit.id,cells:[{...from}],damage:tacticalGraybox.affixes.fire_trail.damage,remaining:2,activeFromRound:r.state.round,rootActionId:r.actionId});
  if(unit.side==='hero')for(const zone of r.state.zones.filter(z=>z.kind==='fire'&&z.activeFromRound<=r.state.round&&z.cells.some(c=>sameCell(c,next)))){
   if(fired.has(zone.sourceId))continue;fired.add(zone.sourceId);
   const previousSource=r.sourceId,previousRoot=r.rootActionId;r.sourceId=zone.sourceId;r.rootActionId=zone.rootActionId;
   damage(r,unit,zone.damage,'fire-trail',r.state.units.find(u=>u.id===zone.sourceId));r.sourceId=previousSource;r.rootActionId=previousRoot;
  }
 }
 emit(r,'move',cause,{targetId:unit.id,cell:unit.cell,cells:traversed});checkOutcome(r.state);
}
export function canControl(unit:TacticalUnit){return !(unit.eliteAffixes.includes('shielded')&&unit.shield>0);}
export function movePower(unit:TacticalUnit){
 if(unit.side==='hero')return Math.max(0,tacticalGraybox.hero.move-(unit.statuses.some(s=>s.id==='frozen')?2:0));
 const base=unit.kind==='boss'?2:tacticalArchetypes[unit.kind as keyof typeof tacticalArchetypes].move;
 return base+(unit.eliteAffixes.includes('swift')?tacticalGraybox.affixes.swift.moveBonus:0);
}
export function roundEnd(r:Resolution){
 for(const u of living(r.state))for(const status of [...u.statuses])if(status.id==='poison'&&status.remaining>0){
  const previous=r.sourceId;r.sourceId=status.sourceId;r.rootActionId=status.rootActionId;r.ownerTurnId=`${r.state.battleId}:${u.id}:${r.state.round}`;damage(r,u,status.amount,'poison');r.sourceId=previous;r.rootActionId=undefined;r.ownerTurnId=undefined;status.remaining--;
 }
 for(const zone of r.state.zones){
  if(zone.activeFromRound>r.state.round)continue;
  if(zone.kind==='poison'||zone.kind==='frost')for(const unit of living(r.state).filter(u=>zone.cells.some(c=>sameCell(c,u.cell)))){
   if(zone.kind==='poison'&&unit.side==='hero')continue;
   const previous=r.sourceId;r.sourceId=zone.sourceId;r.rootActionId=zone.rootActionId;damage(r,unit,zone.damage,zone.kind);r.sourceId=previous;r.rootActionId=undefined;
   if(zone.kind==='frost'&&unit.hp>0)unit.statuses.push({id:'frozen',sourceId:zone.sourceId,remaining:1,amount:2,expiresOnRound:r.state.round+2});
  }
  zone.remaining--;
 }
 r.state.zones=r.state.zones.filter(z=>z.remaining>0);
 for(const u of r.state.units)u.statuses=u.statuses.filter(s=>s.remaining>0);
 checkOutcome(r.state);
}
