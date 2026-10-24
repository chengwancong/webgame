import type {TacticalAction,TacticalProjection,TacticalEvent} from '../../contracts/tactical.ts';
import {tacticalGraybox} from '../../content/tactical-content.ts';
import {applyTacticalAction,createTacticalPreviewState,legalTacticalMainActions,projectTacticalEncounter,type TacticalEncounterState} from './encounter.ts';

export type TacticalPlan={actions:TacticalAction[];legalCombinations:number;score:number;preview:{kills:number;damageDealt:number;damageTaken:number;remainingHeroHp:number}};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const planKey=(actions:TacticalAction[])=>JSON.stringify(actions);

/** Searches only the revealed response window. Each candidate uses the manual rule executor,
 * reconstructed from the public projection, with deterministic expected player damage. */
export function chooseTacticalPlan(projection:TacticalProjection):TacticalPlan{
 const initial=createTacticalPreviewState(projection),hero=projection.units.find(u=>u.side==='hero')!;
 const before=projection.units.filter(u=>u.side==='enemy'&&u.hp>0);
 let best:TacticalPlan|undefined,bestKey='',legalCombinations=0;
 const seen=new Set<string>(),weights=tacticalGraybox.autopilot,settings=projection.orchestration;
 function consider(state:TacticalEncounterState,actions:TacticalAction[]){
  const finished=!!state.outcome||state.round!==initial.round;
  const finalActions=finished?actions:[...actions,{type:'end'} as TacticalAction],key=planKey(finalActions);
  if(seen.has(key))return;seen.add(key);
  let end=state;
  try{if(!finished)end=applyTacticalAction(state,{type:'end'}).state;}catch{return;}
  legalCombinations++;
  const after=end.units.find(u=>u.id===hero.id)!;
  const kills=before.filter(u=>(end.units.find(v=>v.id===u.id)?.hp??0)<=0).length;
  const damageDealt=before.reduce((sum,u)=>sum+Math.max(0,u.hp-(end.units.find(v=>v.id===u.id)?.hp??0)),0);
  const damageTaken=Math.max(0,hero.hp-after.hp);
  let score=kills*weights.killWeight-damageTaken*weights.damageTakenWeight+damageDealt*weights.damageDealtWeight;
  if(after.hp<=0)score-=1_000_000;
  const victims=before.filter(u=>(end.units.find(v=>v.id===u.id)?.hp??0)<u.hp);
  const targetMode=settings.target;
  for(const victim of victims){
   if(targetMode==='support-first'&&(victim.kind==='shaman'||victim.kind==='summoner'))score+=weights.targetWeight*20;
   if(targetMode==='lowest-hp')score+=weights.targetWeight/(1+victim.hp);
   if(targetMode==='nearest')score+=weights.targetWeight/(1+distance(hero.cell,victim.cell));
  }
  const remaining=end.units.filter(u=>u.side==='enemy'&&u.hp>0),nearest=remaining.length?Math.min(...remaining.map(u=>distance(after.cell,u.cell))):0;
  // Even a non-attacking turn advances toward a legal attack; no invisible future intent search.
  score-=nearest*weights.positionWeight;
  if(settings.position==='keep-distance')score+=Math.min(nearest,3)*weights.positionWeight*2;
  if(settings.position==='behind-cover'){
   const cover=end.board.blocked.filter(c=>distance(c,after.cell)===1).length;
   score+=Math.min(cover,2)*weights.positionWeight;
  }
  const skill=actions.find(a=>a.type==='skill');
  if(skill?.type==='skill'){
   const rank=settings.priority.indexOf(skill.skillId);
   if(rank>=0)score+=(settings.priority.length-rank)*weights.priorityBonus;
   if(settings.guard==='on'&&hero.hp<hero.maxHp*weights.guardThreshold&&skill.skillId==='ward')score+=weights.guardBonus;
  }
  const result:TacticalPlan={actions:finalActions,score,legalCombinations:0,preview:{kills,damageDealt,damageTaken,remainingHeroHp:after.hp}};
  if(!best||score>best.score||score===best.score&&key<bestKey){best=result;bestKey=key;}
 }
 function moves(state:TacticalEncounterState):TacticalAction[]{
  if(state.outcome||state.round!==initial.round||state.budget.moveUsed||state.budget.ended)return [];
  return projectTacticalEncounter(state).reachable.map(row=>({type:'move',to:row.cell}));
 }
 consider(initial,[]);
 // Move then main, including stay and no main action.
 for(const movement of [null,...moves(initial)]){
  let moved=initial;const prefix:TacticalAction[]=[];
  try{if(movement){moved=applyTacticalAction(initial,movement).state;prefix.push(movement);}}catch{continue;}
  consider(moved,prefix);
  if(moved.outcome||moved.round!==initial.round)continue;
  for(const action of legalTacticalMainActions(moved)){
   try{const next=applyTacticalAction(moved,action).state;consider(next,[...prefix,action]);}catch{/* legal set can become stale after movement reactions */}
  }
 }
 // Main then move. Recompute reachability after kills/pulls, never reuse pre-action cells.
 for(const action of legalTacticalMainActions(initial)){
  let acted:TacticalEncounterState;
  try{acted=applyTacticalAction(initial,action).state;}catch{continue;}
  consider(acted,[action]);
  for(const movement of moves(acted)){
   try{consider(applyTacticalAction(acted,movement).state,[action,movement]);}catch{/* route can be interrupted by a public reaction */}
  }
 }
 if(!best)throw Error('No legal tactical plan');
 return {...best,legalCombinations};
}

/** Actual seeded execution: no damage, movement, cooldown or enemy rules live in this module. */
export function executeTacticalPlan(state:TacticalEncounterState,plan:Pick<TacticalPlan,'actions'>){
 let current=state,pending=[...plan.actions],committed=0;const events:TacticalEvent[]=[];
 // A predicted crit can clear a cell that a real non-crit leaves occupied. Re-plan only
 // the remaining allowances from the newly public result; never replay the first action.
 for(let step=0;step<4;step++){
  if(current.outcome||current.round!==state.round)break;
  const action=pending.shift()??{type:'end'} as TacticalAction;
  let result:ReturnType<typeof applyTacticalAction>;
  try{result=applyTacticalAction(current,action);}catch(error){
   if(!committed)throw error;
   pending=[...chooseTacticalPlan(projectTacticalEncounter(current)).actions];
   result=applyTacticalAction(current,pending.shift()??{type:'end'});
  }
  current=result.state;events.push(...result.events);committed++;
 }
 return {state:current,events};
}
