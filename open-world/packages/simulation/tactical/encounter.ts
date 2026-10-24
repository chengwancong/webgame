import {TacticalActionSchema,TacticalOrchestrationSchema,TacticalProjectionSchema,type TacticalAction,type TacticalProjection,type TacticalUnit,type TacticalEvent,type TacticalOrchestration} from '../../contracts/tactical.ts';
import {tacticalArchetypes,tacticalBoardById,tacticalGraybox} from '../../content/tactical-content.ts';
import {commitTacticalMove,freshTacticalBudget,spendTacticalAction} from './board.ts';
import {boardFor,direction,reachableFor} from './geometry.ts';
import {executeEnemyIntents,revealEnemyIntents} from './enemy-ai.ts';
import {executeTacticalSkill,heroSkills,legalTacticalMainActions} from './skills.ts';
import {checkOutcome,emit,heroOf,movePower,moveUnit,roundEnd,type Resolution,type TacticalEncounterState} from './runtime.ts';
export type {TacticalEncounterState} from './runtime.ts';
export {legalTacticalMainActions} from './skills.ts';

export type CreateTacticalEncounter={battleId:string;boardId:string;heroId:'sword'|'hidden';seed:number;orchestration?:Partial<TacticalOrchestration>;ambush?:'player'|'enemy'};
export function createTacticalEncounter(input:CreateTacticalEncounter):TacticalEncounterState{
 const board=tacticalBoardById.get(input.boardId);if(!board)throw Error('Unknown tactical board');
 if(!heroSkills[input.heroId]||!Number.isSafeInteger(input.seed))throw Error('Invalid tactical hero or seed');
 const hero:TacticalUnit={id:'hero',kind:'hero',side:'hero',cell:{...board.heroSpawn},hp:tacticalGraybox.hero.hp,maxHp:tacticalGraybox.hero.hp,shield:0,statuses:[],cooldowns:{},eliteAffixes:[],facing:{x:0,y:-1},activeFromRound:1,flags:[]};
 const units:TacticalUnit[]=[hero,...board.enemies.map(e=>{
  const maxHp=e.boss?tacticalGraybox.boss.hp:tacticalGraybox.hpTiers[tacticalArchetypes[e.kind].hpTier]*(e.eliteAffixes.length?tacticalGraybox.eliteHpMultiplier:1);
  return {id:e.id,kind:e.boss?'boss' as const:e.kind,side:'enemy' as const,cell:{...e.cell},hp:maxHp,maxHp,shield:e.eliteAffixes.includes('shielded')?tacticalGraybox.affixes.shielded.shield:0,statuses:[],cooldowns:{},eliteAffixes:[...e.eliteAffixes],facing:direction(e.cell,hero.cell),activeFromRound:1,flags:[],...(e.boss?{phase:1}:{})};
 })];
 const s:TacticalEncounterState={battleId:input.battleId,boardId:input.boardId,heroId:input.heroId,seed:input.seed,round:1,ownerTurnId:`${input.battleId}:hero:1`,phase:'hero',difficulty:board.difficulty,board:{width:board.width,height:board.height,blocked:structuredClone(board.blocked)},units,intents:[],zones:[],budget:freshTacticalBudget(),reachable:[],skills:[],controlMode:'manual',outcome:null,orchestration:TacticalOrchestrationSchema.parse({...tacticalGraybox.autopilot.defaults,...input.orchestration}),rngState:input.seed>>>0,eventSerial:0,expected:false};
 const opening:Resolution={state:s,events:[],actionId:`${s.battleId}:opening`,sourceId:'system'};
 if(input.ambush==='enemy'){
  revealEnemyIntents(s,opening,true);executeEnemyIntents(opening);s.intents=[];
 }
 revealEnemyIntents(s,opening,input.ambush==='player');s.events=opening.events;
 return s;
}
export function projectTacticalEncounter(s:TacticalEncounterState):TacticalProjection{
 const {rngState:_rng,eventSerial:_serial,expected:_expected,...publicState}=s;
 const hero=heroOf(s),active=!s.outcome&&!s.budget.ended;
 publicState.intents=publicState.intents.map(intent=>intent.hidden?{...intent,destination:undefined,cells:[],line:[]}:intent);
 publicState.reachable=active&&!s.budget.moveUsed?reachableFor(s,hero,movePower(hero)):[];
 publicState.skills=heroSkills[s.heroId].map(id=>({id,available:active&&!s.budget.mainActionUsed&&(hero.cooldowns[id]??0)<=s.round,cooldown:Math.max(0,(hero.cooldowns[id]??0)-s.round),...((hero.cooldowns[id]??0)>s.round?{reason:'cooldown'}:s.budget.mainActionUsed?{reason:'main-action-used'}:{})}));
 return structuredClone(publicState);
}
/** Reconstructs a simulation from public data; the private RNG cursor is never available. */
export function createTacticalPreviewState(projection:TacticalProjection):TacticalEncounterState{
 return {...structuredClone(projection),rngState:0,eventSerial:0,expected:true};
}
function finishRound(r:Resolution){
 const s=r.state;s.budget.ended=true;executeEnemyIntents(r);if(!s.outcome)roundEnd(r);if(s.outcome){emit(r,'outcome',s.outcome);return;}
 s.round++;s.ownerTurnId=`${s.battleId}:hero:${s.round}`;s.budget=freshTacticalBudget();
 for(const u of s.units){
  if(u.statuses.some(t=>t.id==='ward'&&t.expiresOnRound!<=s.round))u.shield=0;
  u.statuses=u.statuses.filter(t=>t.expiresOnRound===undefined||t.expiresOnRound>s.round);
  u.flags=u.flags.filter(f=>!f.startsWith('opportunity:'));
 }
 // Preview stops at the public response window; it cannot search unrevealed future intentions.
 if(s.expected){s.intents=[];s.budget.ended=true;}else revealEnemyIntents(s,r);
 emit(r,'round-start','round-boundary');
}
/** The sole authoritative command executor, used by manual input, auto input and previews. */
export function applyTacticalAction(state:TacticalEncounterState,input:TacticalAction):{state:TacticalEncounterState;events:TacticalEvent[]}{
 const action=TacticalActionSchema.parse(input),s=structuredClone(state),r:Resolution={state:s,events:[],actionId:`${s.battleId}:a${s.eventSerial+1}`,sourceId:heroOf(s).id};
 if(s.outcome)throw Error('Encounter already ended');
 if(action.type==='set-control-mode'){s.controlMode=action.mode;emit(r,'control','control-mode',{detail:action.mode});return {state:s,events:r.events};}
 if(s.budget.ended)throw Error('Turn already ended');
 if(action.type==='move'){
  const hero=heroOf(s);const result=commitTacticalMove(boardFor(s,hero),hero.cell,action.to,movePower(hero),s.budget);s.budget=result.budget;moveUnit(r,hero,result.path,'hero-move');
 }else if(action.type==='skill'||action.type==='basic')executeTacticalSkill(r,action);
 else s.budget=spendTacticalAction(s.budget,'end');
 checkOutcome(s);
 if(!s.outcome&&(s.budget.ended||(s.budget.moveUsed&&s.budget.mainActionUsed)))finishRound(r);
 else if(s.outcome)emit(r,'outcome',s.outcome);
 s.reachable=[];s.skills=[];return {state:s,events:r.events};
}
export function previewTacticalEncounter(state:TacticalEncounterState,actions:TacticalAction[]){
 const initial=projectTacticalEncounter(state),hero=heroOf(initial);let s=createTacticalPreviewState(initial);const events:TacticalEvent[]=[];
 for(const action of actions){if(s.outcome||s.round!==initial.round)break;const result=applyTacticalAction(s,action);s=result.state;events.push(...result.events);}
 if(!s.outcome&&s.round===initial.round){const result=applyTacticalAction(s,{type:'end'});s=result.state;events.push(...result.events);}
 const enemyBefore=initial.units.filter(u=>u.side==='enemy'&&u.hp>0);
 return {kills:enemyBefore.filter(u=>s.units.find(v=>v.id===u.id)?.hp===0).length,damage:enemyBefore.reduce((sum,u)=>sum+Math.max(0,u.hp-(s.units.find(v=>v.id===u.id)?.hp??0)),0),expectedDamageTaken:Math.max(0,hero.hp-heroOf(s).hp),remainingHp:heroOf(s).hp,events,projection:projectTacticalEncounter(s)};
}
